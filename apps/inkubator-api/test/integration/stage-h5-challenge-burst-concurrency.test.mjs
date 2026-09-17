import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {
  acquireChallengeSeat,
  createChallenge,
  persistFrozenBuildContract,
} from '../../dist/challenge-store.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const t0 = 1_900_000_000_000;

async function createPlayer(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({
    player_id: playerId,
    display_name: `${label}-${playerId.slice(0, 6)}`,
  }).execute();
  return playerId;
}

function frozenContract(challengeId, slotLimit) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: '1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'H5 burst challenge',
    brief: 'Prove cross-instance seat-cap serialization under burst load',
    outcome_contract: {criteria: [{id: 'OUT', description: 'Works', mandatory: true}]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: slotLimit,
    activation_minimum: 1,
    entry_deadline: t0 + 100,
    build_start: t0 + 100,
    submission_deadline: t0 + 1_000,
    appeal_window_ms: 100,
    review_deadline: t0 + 2_000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

async function preparedOpenChallenge(db, slotLimit) {
  const organizer = await createPlayer(db, 'h5-organizer');
  const challengeId = randomUUID();
  const contract = frozenContract(challengeId, slotLimit);
  await createChallenge(db, {
    requestId: randomUUID(),
    challengeId,
    organizerPlayerId: organizer,
    organizerPayoutIdentity: `organizer-pay-${challengeId}`,
    funderPayoutIdentity: `funder-pay-${challengeId}`,
    mechanismVersion: contract.mechanism_version,
    settlementPolicyVersion: contract.settlement_policy_version,
    ipTermsVersion: contract.ip_terms_version,
    slotLimit: contract.slot_limit,
    activationMinimum: contract.activation_minimum,
    entryDeadlineMs: contract.entry_deadline,
    buildStartMs: contract.build_start,
    submissionDeadlineMs: contract.submission_deadline,
    appealWindowMs: contract.appeal_window_ms,
    reviewDeadlineMs: contract.review_deadline,
  });
  await persistFrozenBuildContract(db, {
    requestId: randomUUID(),
    actorPlayerId: organizer,
    challengeId,
    contract,
  });
  await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(db);
  return {challengeId};
}

test('H5 four independent DB pools cannot overbook a funded Challenge under burst entry load', async () => {
  const pools = Array.from({length: 4}, () => createDatabase(databaseUrl));
  const authorityDb = pools[0];
  await migrateToLatest(authorityDb);
  try {
    const slotLimit = 3;
    const {challengeId} = await preparedOpenChallenge(authorityDb, slotLimit);
    const builders = [];
    for (let index = 0; index < 12; index += 1) {
      builders.push(await createPlayer(authorityDb, `h5-builder-${index}`));
    }

    const attempts = builders.map((builderPlayerId, index) => acquireChallengeSeat(
      pools[index % pools.length],
      {
        requestId: randomUUID(),
        entryId: randomUUID(),
        challengeId,
        builderPlayerId,
        payoutIdentity: `h5-builder-pay-${index}-${randomUUID()}`,
      },
    ));
    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    assert.equal(fulfilled.length, slotLimit);
    assert.equal(rejected.length, builders.length - slotLimit);
    for (const result of rejected) {
      assert.match(String(result.reason?.message ?? result.reason), /challenge_slot_limit_reached/);
    }

    const entries = await sql`
      select entry_id, builder_player_id, payout_identity, state
      from challenge_entries
      where challenge_id = ${challengeId}
      order by created_at, entry_id
    `.execute(authorityDb);
    assert.equal(entries.rows.length, slotLimit);
    assert.equal(entries.rows.every((row) => row.state === 'SEATED'), true);
    assert.equal(new Set(entries.rows.map((row) => row.builder_player_id)).size, slotLimit);
    assert.equal(new Set(entries.rows.map((row) => row.payout_identity)).size, slotLimit);

    const events = await authorityDb.selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', 'challenge.entry.seated')
      .where('subject_id', '=', challengeId)
      .execute();
    assert.equal(events.length, slotLimit);
    assert.equal(new Set(events.map((event) => event.dedupe_key)).size, slotLimit);
  } finally {
    await Promise.all(pools.map((db) => db.destroy()));
  }
});
