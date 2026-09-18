import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {
  acceptChallengeSubmission,
  acquireChallengeSeat,
  createChallenge,
  markFinalChallengeSubmission,
  persistFrozenBuildContract,
  recordChallengeDecision,
  recordChallengeQualification,
} from '../../dist/challenge-store.js';
import {recordStageG3Selection} from '../../dist/challenge-g3-api.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const t0 = 2_000_000_000_000;
const qualificationCriterionId = 'G3-QUAL';

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
    outcome_contract: {criteria: [
      {id: qualificationCriterionId, description: 'Submission satisfies frozen qualification law.', mandatory: true},
    ]},
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

async function acceptSubmission(db, {challengeId, entryId, contract, suffix}) {
  const submissionId = randomUUID();
  await acceptChallengeSubmission(db, {
    requestId: randomUUID(),
    submissionId,
    challengeId,
    entryId,
    manifest: {
      schema_version: 'inkubator.submission-manifest/1.0',
      challenge_id: challengeId,
      entry_id: entryId,
      terms_digest: contract.terms_digest,
      submission_version: 1,
      immutable_source_reference: {kind: 'GIT_COMMIT', value: `g3-commit-${suffix}`},
      artifact_digest: suffix.repeat(64),
      evidence_references: [`G3-EVIDENCE-${suffix}`],
      accepted_at: 0,
    },
  });
  return submissionId;
}

async function firstPass(db, {challengeId, entryId, submissionId, result}) {
  return recordChallengeQualification(db, {
    requestId: randomUUID(),
    qualificationId: randomUUID(),
    challengeId,
    entryId,
    submissionId,
    qualificationVersion: 'g3-fixture-v1',
    criterionResults: [{criterion_id: qualificationCriterionId, result, evidence_refs: [`G3-QUAL-${entryId}`]}],
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

  await sql`update challenges set status = 'BUILDING' where challenge_id = ${challengeId}`.execute(db);
  const submission1 = await acceptSubmission(db, {challengeId, entryId: q1, contract, suffix: 'a'});
  const submission2 = await acceptSubmission(db, {challengeId, entryId: q2, contract, suffix: 'b'});

  await sql`update challenges set status = 'SUBMISSIONS_LOCKED' where challenge_id = ${challengeId}`.execute(db);
  await markFinalChallengeSubmission(db, {requestId: randomUUID(), challengeId, entryId: q1, submissionId: submission1});
  await markFinalChallengeSubmission(db, {requestId: randomUUID(), challengeId, entryId: q2, submissionId: submission2});

  await sql`update challenges set status = 'QUALIFICATION' where challenge_id = ${challengeId}`.execute(db);
  await firstPass(db, {challengeId, entryId: q1, submissionId: submission1, result: 'PASS'});
  await firstPass(db, {
    challengeId,
    entryId: q2,
    submissionId: submission2,
    result: qualifierCount === 2 ? 'PASS' : 'FAIL',
  });

  await sql`
    update challenges
    set status = 'APPEAL_WINDOW', appeal_opened_at = clock_timestamp() - interval '2 seconds'
    where challenge_id = ${challengeId}
  `.execute(db);
  const qualifierIds = qualifierCount === 2 ? [q1, q2].sort() : [q1];
  await recordChallengeDecision(db, {
    requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: null,
    decisionType: 'FINAL_QUALIFIERS', decisionVersion: 'stage-c-effective-v1',
    decision: {final_qualifier_ids: qualifierIds},
  });
  await sql`update challenges set status = 'SELECTION' where challenge_id = ${challengeId}`.execute(db);
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
      /challenge_selection_lifecycle_invalid/,
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

test('G3 concurrent organizer choices produce exactly one durable selection', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const state = await preparedSelection(db);
    const attempts = await Promise.allSettled([
      recordStageG3Selection(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: state.challengeId,
        selectedEntryId: state.q1, actorPlayerId: state.organizer,
      }),
      recordStageG3Selection(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: state.challengeId,
        selectedEntryId: state.q2, actorPlayerId: state.organizer,
      }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);

    const rows = await sql`
      select decision_id, entry_id, decision_json
      from challenge_decisions
      where challenge_id = ${state.challengeId} and decision_type = 'SELECTION'
    `.execute(db);
    assert.equal(rows.rows.length, 1);
    assert.ok([state.q1, state.q2].includes(rows.rows[0].entry_id));
  } finally {
    await db.destroy();
  }
});
