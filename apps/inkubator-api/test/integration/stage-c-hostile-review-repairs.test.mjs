import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {
  buildSettlementIntent,
  freezeBuildContract,
} from '@rekt-ink/protocol/challenge';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {stageCQualificationOverallMigration} from '../../dist/migrations/022-stage-c-qualification-overall.js';
import * as challengeStore from '../../dist/challenge-store.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, overrides = {}) {
  const entryDeadline = Date.now() + 60 * 60 * 1000;
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: '1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'Stage C hostile review regression',
    brief: 'Prove Stage C authority boundaries',
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
    ...overrides,
  });
}

function createInput(organizer, contract, overrides = {}) {
  return {
    requestId: randomUUID(),
    challengeId: contract.challenge_id,
    organizerPlayerId: organizer,
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
    ...overrides,
  };
}

async function preparedChallenge(db, overrides = {}) {
  const organizer = await player(db, 'organizer');
  const challengeId = randomUUID();
  const contract = contractFor(challengeId, overrides);
  await challengeStore.createChallenge(db, createInput(organizer, contract));
  await challengeStore.persistFrozenBuildContract(db, {
    requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract,
  });
  return {organizer, challengeId, contract};
}

async function seatedBuilder(db, fixture) {
  const builder = await player(db, 'builder');
  await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${fixture.challengeId}`.execute(db);
  const requestId = randomUUID();
  const entryId = randomUUID();
  const input = {
    requestId, entryId, challengeId: fixture.challengeId,
    builderPlayerId: builder, payoutIdentity: `pay-${entryId}`,
  };
  const entry = await challengeStore.acquireChallengeSeat(db, input);
  return {builder, entry, input};
}

function manifestFor(fixture, entryId, acceptedAt = 0) {
  return {
    schema_version: 'inkubator.submission-manifest/1.0',
    challenge_id: fixture.challengeId,
    entry_id: entryId,
    terms_digest: fixture.contract.terms_digest,
    submission_version: 1,
    immutable_source_reference: {kind: 'GIT_COMMIT', value: 'a'.repeat(40)},
    artifact_digest: 'b'.repeat(64),
    evidence_references: [],
    accepted_at: acceptedAt,
  };
}

test('Stage C rejects every duplicated Challenge/Build Contract authority mismatch before freeze', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const cases = [
      (c) => ({slotLimit: c.slot_limit + 1}),
      (c) => ({activationMinimum: c.activation_minimum + 1}),
      (c) => ({entryDeadlineMs: c.entry_deadline + 1_000, buildStartMs: c.build_start + 1_000}),
      (c) => ({submissionDeadlineMs: c.submission_deadline + 1_000}),
      (c) => ({appealWindowMs: c.appeal_window_ms + 1}),
      (c) => ({reviewDeadlineMs: c.review_deadline + 1_000}),
      () => ({mechanismVersion: 'mismatch-mechanism'}),
      () => ({settlementPolicyVersion: 'mismatch-settlement'}),
      () => ({ipTermsVersion: 'mismatch-ip'}),
    ];

    for (const mismatch of cases) {
      const organizer = await player(db, 'mismatch-owner');
      const challengeId = randomUUID();
      const contract = contractFor(challengeId);
      await challengeStore.createChallenge(db, createInput(organizer, contract, mismatch(contract)));
      await assert.rejects(
        challengeStore.persistFrozenBuildContract(db, {
          requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract,
        }),
        /contract_challenge_authority_mismatch/,
      );
      const snapshot = await challengeStore.readChallengeSnapshot(db, challengeId);
      assert.equal(snapshot.contract, null);
      assert.equal(snapshot.challenge.current_contract_version, null);
      assert.equal(snapshot.challenge.current_terms_digest, null);
    }
  } finally {
    await db.destroy();
  }
});

test('Stage C uses database time for submission acceptance and exact commands replay after lifecycle progress', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await preparedChallenge(db);
    const {entry, input: seatInput} = await seatedBuilder(db, fixture);

    await sql`update challenges set status = 'BUILDING' where challenge_id = ${fixture.challengeId}`.execute(db);
    assert.equal((await challengeStore.acquireChallengeSeat(db, seatInput)).entry_id, entry.entry_id);
    await sql`
      update challenge_entries
      set state = 'ACTIVE', build_start = ${new Date(fixture.contract.build_start)}, submission_deadline = ${new Date(fixture.contract.submission_deadline)}
      where entry_id = ${entry.entry_id}
    `.execute(db);

    const submissionId = randomUUID();
    const submissionRequestId = randomUUID();
    const manifest = manifestFor(fixture, entry.entry_id, 0);
    const submissionInput = {
      requestId: submissionRequestId, submissionId, challengeId: fixture.challengeId,
      entryId: entry.entry_id, manifest,
    };
    const accepted = await challengeStore.acceptChallengeSubmission(db, submissionInput);
    assert.notEqual(accepted.accepted_at.getTime(), manifest.accepted_at);
    assert.equal(accepted.manifest_json.accepted_at, accepted.accepted_at.getTime());
    assert.ok(accepted.accepted_at.getTime() <= fixture.contract.submission_deadline);

    await sql`update challenges set status = 'SUBMISSIONS_LOCKED' where challenge_id = ${fixture.challengeId}`.execute(db);
    const replayedSubmission = await challengeStore.acceptChallengeSubmission(db, submissionInput);
    assert.equal(replayedSubmission.submission_id, accepted.submission_id);
    assert.equal(replayedSubmission.accepted_at.getTime(), accepted.accepted_at.getTime());

    const finalRequestId = randomUUID();
    const finalInput = {requestId: finalRequestId, challengeId: fixture.challengeId, entryId: entry.entry_id, submissionId};
    const final = await challengeStore.markFinalChallengeSubmission(db, finalInput);
    assert.equal(final.is_final, true);

    await sql`update challenges set status = 'QUALIFICATION' where challenge_id = ${fixture.challengeId}`.execute(db);
    assert.equal((await challengeStore.markFinalChallengeSubmission(db, finalInput)).submission_id, submissionId);

    const qualificationId = randomUUID();
    const qualificationRequestId = randomUUID();
    const qualificationInput = {
      requestId: qualificationRequestId, qualificationId, challengeId: fixture.challengeId,
      entryId: entry.entry_id, submissionId, qualificationVersion: 'qualification.v1',
      criterionResults: [{criterion_id: 'OUT', result: 'PASS', evidence_refs: []}],
    };
    const qualification = await challengeStore.recordChallengeQualification(db, qualificationInput);
    assert.equal(qualification.result, 'QUALIFIED');

    await sql`update challenges set status = 'APPEAL_WINDOW' where challenge_id = ${fixture.challengeId}`.execute(db);
    assert.equal((await challengeStore.recordChallengeQualification(db, qualificationInput)).qualification_id, qualificationId);

    const lateOrganizer = await player(db, 'late-owner');
    const lateChallengeId = randomUUID();
    const lateContract = contractFor(lateChallengeId, {
      entry_deadline: 1_000,
      build_start: 1_000,
      submission_deadline: 2_000,
      review_deadline: 3_000,
    });
    await challengeStore.createChallenge(db, createInput(lateOrganizer, lateContract));
    await challengeStore.persistFrozenBuildContract(db, {
      requestId: randomUUID(), actorPlayerId: lateOrganizer, challengeId: lateChallengeId, contract: lateContract,
    });
    const lateFixture = {organizer: lateOrganizer, challengeId: lateChallengeId, contract: lateContract};
    const {entry: lateEntry} = await seatedBuilder(db, lateFixture);
    await sql`update challenges set status = 'BUILDING' where challenge_id = ${lateChallengeId}`.execute(db);
    await assert.rejects(
      challengeStore.acceptChallengeSubmission(db, {
        requestId: randomUUID(), submissionId: randomUUID(), challengeId: lateChallengeId,
        entryId: lateEntry.entry_id, manifest: manifestFor(lateFixture, lateEntry.entry_id, 1_500),
      }),
      /challenge_submission_deadline_elapsed/,
    );
  } finally {
    await db.destroy();
  }
});

test('Stage C persists only protocol-validated authoritative decision shapes and exposes one receipt path', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    assert.equal('recordChallengeReceipt' in challengeStore, false);

    const fixture = await preparedChallenge(db);
    const {entry} = await seatedBuilder(db, fixture);

    const qualifiers = await challengeStore.recordChallengeDecision(db, {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId: fixture.challengeId,
      decisionType: 'FINAL_QUALIFIERS', decisionVersion: '1',
      decision: {final_qualifier_ids: [entry.entry_id]},
    });
    assert.deepEqual(qualifiers.decision_json, {final_qualifier_ids: [entry.entry_id]});

    const selection = await challengeStore.recordChallengeDecision(db, {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId: fixture.challengeId,
      entryId: entry.entry_id, decisionType: 'SELECTION', decisionVersion: '1',
      decision: {selected_entry_id: entry.entry_id},
    });
    assert.deepEqual(selection.decision_json, {selected_entry_id: entry.entry_id});

    const settlementIntent = buildSettlementIntent({
      contract: fixture.contract,
      resolution: {
        type: 'WINNER_PAYOUT', winner_entry_id: entry.entry_id,
        distributions: [{entry_id: entry.entry_id, amount_minor_units: fixture.contract.prize_minor_units}],
      },
      recipientByEntryId: {[entry.entry_id]: entry.payout_identity},
    });
    const settlement = await challengeStore.recordChallengeDecision(db, {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId: fixture.challengeId,
      entryId: entry.entry_id, decisionType: 'SETTLEMENT_INTENT', decisionVersion: '1',
      decision: settlementIntent,
    });
    assert.deepEqual(settlement.decision_json, settlementIntent);

    await assert.rejects(
      challengeStore.recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: fixture.challengeId,
        decisionType: 'FINAL_QUALIFIERS', decisionVersion: '2', decision: {},
      }),
      /invalid_final_qualifiers_decision/,
    );
    await assert.rejects(
      challengeStore.recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: fixture.challengeId,
        decisionType: 'SETTLEMENT_INTENT', decisionVersion: '2', decision: {},
      }),
      /settlement intent|invalid_settlement_intent/,
    );
    await assert.rejects(
      challengeStore.recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId: fixture.challengeId,
        decisionType: 'INVENTED_AUTHORITY', decisionVersion: '1', decision: {},
      }),
      /challenge_decision_type_unsupported/,
    );
  } finally {
    await db.destroy();
  }
});

test('Stage C migration 022 round-trips persisted qualification vocabulary safely', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await preparedChallenge(db);
    const {entry} = await seatedBuilder(db, fixture);
    await sql`update challenges set status = 'BUILDING' where challenge_id = ${fixture.challengeId}`.execute(db);
    await sql`
      update challenge_entries
      set state = 'ACTIVE', build_start = ${new Date(fixture.contract.build_start)}, submission_deadline = ${new Date(fixture.contract.submission_deadline)}
      where entry_id = ${entry.entry_id}
    `.execute(db);
    const submissionId = randomUUID();
    await challengeStore.acceptChallengeSubmission(db, {
      requestId: randomUUID(), submissionId, challengeId: fixture.challengeId,
      entryId: entry.entry_id, manifest: manifestFor(fixture, entry.entry_id, 0),
    });
    await sql`update challenges set status = 'SUBMISSIONS_LOCKED' where challenge_id = ${fixture.challengeId}`.execute(db);
    await challengeStore.markFinalChallengeSubmission(db, {
      requestId: randomUUID(), challengeId: fixture.challengeId, entryId: entry.entry_id, submissionId,
    });
    await sql`update challenges set status = 'QUALIFICATION' where challenge_id = ${fixture.challengeId}`.execute(db);
    const qualificationId = randomUUID();
    await challengeStore.recordChallengeQualification(db, {
      requestId: randomUUID(), qualificationId, challengeId: fixture.challengeId,
      entryId: entry.entry_id, submissionId, qualificationVersion: 'qualification.migration.v1',
      criterionResults: [{criterion_id: 'OUT', result: 'PASS', evidence_refs: []}],
    });

    await stageCQualificationOverallMigration.down(db);
    const down = await db.selectFrom('challenge_qualifications').select(['result', 'qualification_json']).where('qualification_id', '=', qualificationId).executeTakeFirstOrThrow();
    assert.equal(down.result, 'PASS');
    assert.equal(down.qualification_json.overall, 'PASS');

    await stageCQualificationOverallMigration.up(db);
    const up = await db.selectFrom('challenge_qualifications').select(['result', 'qualification_json']).where('qualification_id', '=', qualificationId).executeTakeFirstOrThrow();
    assert.equal(up.result, 'QUALIFIED');
    assert.equal(up.qualification_json.overall, 'QUALIFIED');
  } finally {
    await db.destroy();
  }
});
