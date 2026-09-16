import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {
  acquireChallengeSeat,
  createChallenge,
  persistFrozenBuildContract,
  recordChallengeDecision,
} from '../../dist/challenge-store.js';
import {recordStageG3Selection} from '../../dist/challenge-g3-api.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const t0 = 2_000_000_000_000;

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'g3-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'G3 selection challenge',
    brief: 'Prove one human choice among final qualifiers.',
    outcome_contract: {criteria: []},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    preferences: {taste: 'organizer-only'},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: 3,
    activation_minimum: 1,
    entry_deadline: t0 + 100,
    build_start: t0 + 100,
    submission_deadline: t0 + 10_000,
    appeal_window_ms: 1_000,
    review_deadline: t0 + 20_000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

async function preparedSelection(db, {qualifierCount = 2} = {}) {
  const organizer = await player(db, 'g3-organizer');
  const builder1 = await player(db, 'g3-builder1');
  const builder2 = await player(db, 'g3-builder2');
  const challengeId = randomUUID();
  const q1 = randomUUID();
  const q2 = randomUUID();
  const contract = contractFor(challengeId);
  await createChallenge(db, {
    requestId: randomUUID(), challengeId, organizerPlayerId: organizer,
    organizerPayoutIdentity: `organizer-pay-${challengeId}`,
    funderPayoutIdentity: `funder-pay-${challengeId}`,
    mechanismVersion: contract.mechanism_version,
    settlementPolicyVersion: contract.settlement_policy_version,
    ipTermsVersion: contract.ip_terms_version,
    slotLimit: contract.slot_limit, activationMinimum: contract.activation_minimum,
    entryDeadlineMs: contract.entry_deadline, buildStartMs: contract.build_start,
    submissionDeadlineMs: contract.submission_deadline, appealWindowMs: contract.appeal_window_ms,
    reviewDeadlineMs: contract.review_deadline,
  });
  await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
  await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(db);
  await acquireChallengeSeat(db, {requestId: randomUUID(), entryId: q1, challengeId, builderPlayerId: builder1, payoutIdentity: `pay-${q1}`});
  await acquireChallengeSeat(db, {requestId: randomUUID(), entryId: q2, challengeId, builderPlayerId: builder2, payoutIdentity: `pay-${q2}`});
  await sql`update challenges set status = 'SELECTION' where challenge_id = ${challengeId}`.execute(db);
  const qualifierIds = qualifierCount === 2 ? [q1, q2].sort() : [q1];
  await recordChallengeDecision(db, {
    requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: null,
    decisionType: 'FINAL_QUALIFIERS', decisionVersion: 'stage-c-effective-v1',
    decision: {final_qualifier_ids: qualifierIds},
  });
  return {organizer, builder1, builder2, challengeId, q1, q2};
}

test('G3 selection persists once and exact command replays after lifecycle advance', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const state = await preparedSelection(db);
    const input = {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId: state.challengeId,
      selectedEntryId: state.q2, actorPlayerId: state.organizer,
    };
    const first = await recordStageG3Selection(db, input);
    assert.equal(first.entry_id, state.q2);
    assert.equal(first.decision_type, 'SELECTION');
    assert.equal(first.decision_version, 'stage-g3-selection-v1');

    const rows = await sql`select decision_id, entry_id, decision_json from challenge_decisions where challenge_id = ${state.challengeId} and decision_type = 'SELECTION'`.execute(db);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].decision_id, input.decisionId);
    assert.deepEqual(rows.rows[0].decision_json, {selected_entry_id: state.q2});

    await sql`update challenges set status = 'SETTLEMENT_PENDING' where challenge_id = ${state.challengeId}`.execute(db);
    const replay = await recordStageG3Selection(db, input);
    assert.equal(replay.decision_id, first.decision_id);

    await assert.rejects(
      recordStageG3Selection(db, {...input, requestId: randomUUID(), decisionId: randomUUID()}),
      /challenge_selection_not_open/,
    );
  } finally {
    await db.destroy();
  }
});

test('G3 selection rejects a non-qualifier and a non-organizer', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const state = await preparedSelection(db, {qualifierCount: 1});
    await assert.rejects(
      recordStageG3Selection(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: state.challengeId,
        selectedEntryId: state.q2, actorPlayerId: state.organizer,
      }),
      /qualifier|selection/i,
    );
    await assert.rejects(
      recordStageG3Selection(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: state.challengeId,
        selectedEntryId: state.q1, actorPlayerId: state.builder1,
      }),
      /challenge_organizer_required/,
    );
  } finally {
    await db.destroy();
  }
});
