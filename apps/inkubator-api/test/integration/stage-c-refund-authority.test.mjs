import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {buildSettlementIntent, freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {
  createChallenge,
  persistFrozenBuildContract,
  recordChallengeDecision,
} from '../../dist/challenge-store.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({
    player_id: playerId,
    display_name: `${label}-${playerId.slice(0, 6)}`,
  }).execute();
  return playerId;
}

function contractFor(challengeId) {
  const entryDeadline = Date.now() + 60 * 60 * 1000;
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: '1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'Stage C refund authority regression',
    brief: 'Bind refund settlement intent to Stage-B state authority',
    outcome_contract: {criteria: [{id: 'OUT', description: 'Works', mandatory: true}]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: 2,
    activation_minimum: 1,
    entry_deadline: entryDeadline,
    build_start: entryDeadline,
    submission_deadline: entryDeadline + 60 * 60 * 1000,
    appeal_window_ms: 100,
    review_deadline: entryDeadline + 2 * 60 * 60 * 1000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

async function fixture(db, status) {
  const organizer = await player(db, 'refund-organizer');
  const challengeId = randomUUID();
  const contract = contractFor(challengeId);
  const organizerPayoutIdentity = `organizer-pay-${challengeId}`;
  const funderPayoutIdentity = `funder-pay-${challengeId}`;
  await createChallenge(db, {
    requestId: randomUUID(),
    challengeId,
    organizerPlayerId: organizer,
    organizerPayoutIdentity,
    funderPayoutIdentity,
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
  await sql`update challenges set status = ${status} where challenge_id = ${challengeId}`.execute(db);
  return {challengeId, contract, funderPayoutIdentity};
}

function refundIntent(fixture, type) {
  return buildSettlementIntent({
    contract: fixture.contract,
    resolution: {type, winner_entry_id: null, distributions: []},
    refundRecipientId: fixture.funderPayoutIdentity,
  });
}

test('Stage C accepts REFUND_PRE_BUILD only through the Stage-B NOT_ACTIVATED transition', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const allowed = await fixture(db, 'NOT_ACTIVATED');
    const intent = refundIntent(allowed, 'REFUND_PRE_BUILD');
    const stored = await recordChallengeDecision(db, {
      requestId: randomUUID(),
      decisionId: randomUUID(),
      challengeId: allowed.challengeId,
      decisionType: 'SETTLEMENT_INTENT',
      decisionVersion: 'refund-pre-build.v1',
      decision: intent,
    });
    assert.deepEqual(stored.decision_json, intent);

    const blocked = await fixture(db, 'BUILDING');
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(),
        decisionId: randomUUID(),
        challengeId: blocked.challengeId,
        decisionType: 'SETTLEMENT_INTENT',
        decisionVersion: 'refund-pre-build.v1',
        decision: refundIntent(blocked, 'REFUND_PRE_BUILD'),
      }),
      /illegal Challenge transition|pre-build refund/i,
    );
    const blockedRows = await sql`
      select count(*)::int as count from challenge_decisions
      where challenge_id = ${blocked.challengeId} and decision_type = 'SETTLEMENT_INTENT'
    `.execute(db);
    assert.equal(blockedRows.rows[0].count, 0);
  } finally {
    await db.destroy();
  }
});

test('Stage C fails closed on CANCELLED_BY_RESOLUTION without Stage-B exceptional authority', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const challenge = await fixture(db, 'NOT_ACTIVATED');
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(),
        decisionId: randomUUID(),
        challengeId: challenge.challengeId,
        decisionType: 'SETTLEMENT_INTENT',
        decisionVersion: 'cancelled.v1',
        decision: refundIntent(challenge, 'CANCELLED_BY_RESOLUTION'),
      }),
      /challenge_cancelled_by_resolution_authority_missing/,
    );
    const rows = await sql`
      select count(*)::int as count from challenge_decisions
      where challenge_id = ${challenge.challengeId} and decision_type = 'SETTLEMENT_INTENT'
    `.execute(db);
    assert.equal(rows.rows[0].count, 0);
  } finally {
    await db.destroy();
  }
});
