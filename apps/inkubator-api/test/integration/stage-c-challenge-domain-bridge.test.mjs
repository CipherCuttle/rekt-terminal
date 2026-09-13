import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {
  acceptChallengeSubmission,
  acquireChallengeSeat,
  createChallenge,
  markFinalChallengeSubmission,
  persistFrozenBuildContract,
  readChallengeSnapshot,
  recordChallengeDecision,
  recordChallengeQualification,
  recordChallengeReceipt,
} from '../../dist/challenge-store.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const t0 = 1_900_000_000_000;

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function frozenContract(challengeId, overrides = {}) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: '1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'Stage C integration challenge',
    brief: 'Prove the Postgres bridge invariants',
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
    entry_deadline: t0 + 100,
    build_start: t0 + 100,
    submission_deadline: t0 + 1_000,
    appeal_window_ms: 100,
    review_deadline: t0 + 2_000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
    ...overrides,
  });
}

async function preparedChallenge(db, {slotLimit = 2} = {}) {
  const organizer = await player(db, 'organizer');
  const challengeId = randomUUID();
  const contract = frozenContract(challengeId, {slot_limit: slotLimit});
  await createChallenge(db, {
    requestId: randomUUID(), challengeId, organizerPlayerId: organizer,
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
    requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract,
  });
  return {organizer, challengeId, contract};
}

test('Stage C frozen contract is durable, replayable, and immutable', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const organizer = await player(db, 'contract-owner');
    const challengeId = randomUUID();
    const contract = frozenContract(challengeId);
    const createRequest = randomUUID();
    const freezeRequest = randomUUID();

    const created = await createChallenge(db, {
      requestId: createRequest, challengeId, organizerPlayerId: organizer,
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
    assert.equal(created.status, 'DRAFT');
    assert.equal((await createChallenge(db, {
      requestId: createRequest, challengeId, organizerPlayerId: organizer,
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
    })).challenge_id, challengeId);

    const stored = await persistFrozenBuildContract(db, {requestId: freezeRequest, actorPlayerId: organizer, challengeId, contract});
    assert.equal(stored.terms_digest, contract.terms_digest);
    assert.deepEqual(stored.contract_json, contract);
    assert.equal((await persistFrozenBuildContract(db, {requestId: freezeRequest, actorPlayerId: organizer, challengeId, contract})).terms_digest, contract.terms_digest);

    const changed = frozenContract(challengeId, {title: 'Changed frozen authority'});
    await assert.rejects(
      persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract: changed}),
      /challenge_contract_already_frozen|immutable_conflict/,
    );
    const snapshot = await readChallengeSnapshot(db, challengeId);
    assert.equal(snapshot.contract.terms_digest, contract.terms_digest);
    assert.deepEqual(snapshot.contract.contract_json, contract);
  } finally {
    await db.destroy();
  }
});

test('Stage C serializes the final-seat race and rejects duplicate builder/payout authority', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const oneSeat = await preparedChallenge(db, {slotLimit: 1});
    await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${oneSeat.challengeId}`.execute(db);
    const a = await player(db, 'seat-a');
    const b = await player(db, 'seat-b');
    const results = await Promise.allSettled([
      acquireChallengeSeat(db, {requestId: randomUUID(), entryId: randomUUID(), challengeId: oneSeat.challengeId, builderPlayerId: a, payoutIdentity: 'pay-a'}),
      acquireChallengeSeat(db, {requestId: randomUUID(), entryId: randomUUID(), challengeId: oneSeat.challengeId, builderPlayerId: b, payoutIdentity: 'pay-b'}),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const count = await sql`select count(*)::int as count from challenge_entries where challenge_id = ${oneSeat.challengeId}`.execute(db);
    assert.equal(count.rows[0].count, 1);

    const roomy = await preparedChallenge(db, {slotLimit: 3});
    await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${roomy.challengeId}`.execute(db);
    const builder1 = await player(db, 'uniq-a');
    const builder2 = await player(db, 'uniq-b');
    const firstRequest = randomUUID();
    const firstEntry = randomUUID();
    const first = await acquireChallengeSeat(db, {requestId: firstRequest, entryId: firstEntry, challengeId: roomy.challengeId, builderPlayerId: builder1, payoutIdentity: 'same-pay'});
    assert.equal((await acquireChallengeSeat(db, {requestId: firstRequest, entryId: firstEntry, challengeId: roomy.challengeId, builderPlayerId: builder1, payoutIdentity: 'same-pay'})).entry_id, first.entry_id);
    await assert.rejects(
      acquireChallengeSeat(db, {requestId: randomUUID(), entryId: randomUUID(), challengeId: roomy.challengeId, builderPlayerId: builder1, payoutIdentity: 'other-pay'}),
      /challenge_entry_uniqueness_conflict/,
    );
    await assert.rejects(
      acquireChallengeSeat(db, {requestId: randomUUID(), entryId: randomUUID(), challengeId: roomy.challengeId, builderPlayerId: builder2, payoutIdentity: 'same-pay'}),
      /challenge_entry_uniqueness_conflict/,
    );
    await assert.rejects(
      acquireChallengeSeat(db, {requestId: randomUUID(), entryId: randomUUID(), challengeId: roomy.challengeId, builderPlayerId: roomy.organizer, payoutIdentity: 'organizer-pay'}),
      /challenge_organizer_cannot_build/,
    );
  } finally {
    await db.destroy();
  }
});

test('Stage C submission, qualification, decision, receipt and snapshot facts remain append-only', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await preparedChallenge(db, {slotLimit: 2});
    const builder = await player(db, 'builder');
    await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${fixture.challengeId}`.execute(db);
    const entry = await acquireChallengeSeat(db, {
      requestId: randomUUID(), entryId: randomUUID(), challengeId: fixture.challengeId,
      builderPlayerId: builder, payoutIdentity: 'builder-pay',
    });
    await sql`update challenges set status = 'BUILDING' where challenge_id = ${fixture.challengeId}`.execute(db);
    await sql`update challenge_entries set state = 'ACTIVE', build_start = ${new Date(fixture.contract.build_start)}, submission_deadline = ${new Date(fixture.contract.submission_deadline)} where entry_id = ${entry.entry_id}`.execute(db);

    const submissionId = randomUUID();
    const submissionRequest = randomUUID();
    const manifest = {
      schema_version: 'inkubator.submission-manifest/1.0', challenge_id: fixture.challengeId, entry_id: entry.entry_id,
      terms_digest: fixture.contract.terms_digest, submission_version: 1,
      immutable_source_reference: {kind: 'GIT_COMMIT', value: 'a'.repeat(40)}, artifact_digest: 'b'.repeat(64),
      evidence_references: [], accepted_at: fixture.contract.build_start + 50,
    };
    const submission = await acceptChallengeSubmission(db, {requestId: submissionRequest, submissionId, challengeId: fixture.challengeId, entryId: entry.entry_id, manifest});
    assert.equal(submission.terms_digest, fixture.contract.terms_digest);
    assert.equal((await acceptChallengeSubmission(db, {requestId: submissionRequest, submissionId, challengeId: fixture.challengeId, entryId: entry.entry_id, manifest})).submission_id, submissionId);
    await assert.rejects(
      acceptChallengeSubmission(db, {requestId: randomUUID(), submissionId: randomUUID(), challengeId: fixture.challengeId, entryId: entry.entry_id, manifest: {...manifest, submission_version: 1, artifact_digest: 'c'.repeat(64)}}),
      /challenge_submission_immutable_conflict/,
    );

    await sql`update challenges set status = 'SUBMISSIONS_LOCKED' where challenge_id = ${fixture.challengeId}`.execute(db);
    const final = await markFinalChallengeSubmission(db, {requestId: randomUUID(), challengeId: fixture.challengeId, entryId: entry.entry_id, submissionId});
    assert.equal(final.is_final, true);

    const qualification = await recordChallengeQualification(db, {
      requestId: randomUUID(), qualificationId: randomUUID(), challengeId: fixture.challengeId,
      entryId: entry.entry_id, submissionId, qualificationVersion: 'qualification.v1', result: 'PASS',
      qualification: {overall: 'QUALIFIED', criteria: [{criterion_id: 'OUT', result: 'PASS', evidence_refs: []}]},
    });
    assert.equal(qualification.result, 'PASS');

    const decisionId = randomUUID();
    const decisionRequest = randomUUID();
    const decision = {final_qualifier_ids: [entry.entry_id]};
    const storedDecision = await recordChallengeDecision(db, {
      requestId: decisionRequest, decisionId, challengeId: fixture.challengeId,
      decisionType: 'FINAL_QUALIFIERS', decisionVersion: '1', decision,
    });
    assert.equal((await recordChallengeDecision(db, {
      requestId: decisionRequest, decisionId, challengeId: fixture.challengeId,
      decisionType: 'FINAL_QUALIFIERS', decisionVersion: '1', decision,
    })).decision_digest, storedDecision.decision_digest);
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: fixture.challengeId,
        decisionType: 'FINAL_QUALIFIERS', decisionVersion: '1', decision: {final_qualifier_ids: []},
      }),
      /challenge_decision_immutable_conflict/,
    );

    const receiptId = randomUUID();
    const receipt = {schema_version: 'inkubator.challenge-receipt/1.0', challenge_id: fixture.challengeId, terms_digest: fixture.contract.terms_digest, outcome: 'TEST_ONLY'};
    const storedReceipt = await recordChallengeReceipt(db, {requestId: randomUUID(), receiptId, challengeId: fixture.challengeId, receiptVersion: '1', receipt});
    const correctionId = randomUUID();
    const correction = {...receipt, schema_version: 'inkubator.challenge-receipt-correction/1.0', correction: 'presentation-only'};
    const storedCorrection = await recordChallengeReceipt(db, {
      requestId: randomUUID(), receiptId: correctionId, challengeId: fixture.challengeId,
      receiptVersion: '1', receipt: correction, supersedesReceiptId: receiptId,
    });
    assert.equal(storedCorrection.supersedes_receipt_id, storedReceipt.receipt_id);

    const before = await sql`select count(*)::int as count from history_events where subject_type = 'challenge' and subject_id = ${fixture.challengeId}`.execute(db);
    const firstSnapshot = await readChallengeSnapshot(db, fixture.challengeId);
    const secondSnapshot = await readChallengeSnapshot(db, fixture.challengeId);
    const after = await sql`select count(*)::int as count from history_events where subject_type = 'challenge' and subject_id = ${fixture.challengeId}`.execute(db);
    assert.equal(after.rows[0].count, before.rows[0].count);
    assert.deepEqual(secondSnapshot, firstSnapshot);
    assert.equal(firstSnapshot.receipts.length, 2);
    assert.equal(firstSnapshot.decisions.length, 1);
    assert.equal(firstSnapshot.qualifications.length, 1);
  } finally {
    await db.destroy();
  }
});
