import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
  digestAcceptanceManifest,
} from '@rekt-ink/protocol/acceptance-manifest';
import {
  acceptChallengeSubmission,
  acquireChallengeSeat,
  createChallenge,
  markFinalChallengeSubmission,
  persistFrozenBuildContract,
  readChallengeSnapshot,
  recordChallengeQualification,
} from '../../dist/challenge-store.js';
import {runOneJob} from '../../dist/jobs.js';
import {
  buildStageG2BQualificationFromSnapshot,
  recordStageG2BQualification,
} from '../../dist/challenge-test-arena-api.js';
import {trustedTestModuleCatalog} from '../../dist/challenge-test-runners.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const t0 = 2_000_000_000_000;
const acceptanceReferenceId = 'REF-G2B2-ACCEPTANCE';

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function archiveModule() {
  const module = trustedTestModuleCatalog().find((candidate) => candidate.module_id === 'archive-capture-integrity');
  assert.ok(module);
  return module;
}

function acceptanceManifest(challengeId) {
  const module = archiveModule();
  return {
    schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
    challenge_id: challengeId,
    contract_version: 'g2b2-v1',
    bindings: [
      {
        criterion_id: 'AUTO-ARCHIVE',
        mode: 'AUTOMATED',
        module_id: module.module_id,
        module_version: module.module_version,
        module_digest: module.module_digest,
        fixture_reference_ids: [],
        config: {},
      },
      {
        criterion_id: 'HUMAN-UX',
        mode: 'HUMAN_OBSERVATION',
        instructions: 'Confirm the frozen interaction requirement.',
      },
    ],
  };
}

function contractFor(challengeId, manifest) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'g2b2-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'G2B2 persistence challenge',
    brief: 'Prove trusted Test Arena persistence.',
    outcome_contract: {criteria: [
      {id: 'AUTO-ARCHIVE', description: 'Final work has authoritative archive evidence.', mandatory: true},
    ]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: [
      {id: 'HUMAN-UX', description: 'Frozen human interaction requirement is observed.', mandatory: true},
    ]},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [
      {id: acceptanceReferenceId, kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: digestAcceptanceManifest(manifest)},
    ],
    informational_references: [],
    knowledge: [],
    slot_limit: 2,
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

async function captureCanonicalArchive(db, submissionId) {
  const job = await db.selectFrom('outbox_jobs')
    .selectAll()
    .where('idempotency_key', '=', `challenge.submission.archive:${submissionId}`)
    .executeTakeFirstOrThrow();
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const result = await runOneJob(db, {
    challengeSubmissionArchiveClient: {
      capture: async (input) => {
        assert.equal(input.submissionId, submissionId);
        return {
          outcome: 'CAPTURED',
          archive_digest: 'b'.repeat(64),
          archive_reference: 'PRIVATE_G2B2_ARCHIVE_REFERENCE',
        };
      },
    },
  });
  assert.deepEqual(result, {status: 'succeeded', jobId: job.job_id});
  const archive = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', submissionId).executeTakeFirstOrThrow();
  assert.equal(archive.status, 'CAPTURED');
  assert.equal(archive.archive_digest, 'b'.repeat(64));
  assert.equal(archive.archive_reference, 'PRIVATE_G2B2_ARCHIVE_REFERENCE');
}

async function preparedChallenge(db, {archiveStatus = 'CAPTURED'} = {}) {
  const organizer = await player(db, 'g2b2-organizer');
  const builder = await player(db, 'g2b2-builder');
  const challengeId = randomUUID();
  const entryId = randomUUID();
  const submissionId = randomUUID();
  const manifest = acceptanceManifest(challengeId);
  const contract = contractFor(challengeId, manifest);

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
    requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract,
  });

  await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(db);
  await acquireChallengeSeat(db, {
    requestId: randomUUID(), entryId, challengeId, builderPlayerId: builder, payoutIdentity: `builder-pay-${entryId}`,
  });
  await sql`update challenges set status = 'BUILDING' where challenge_id = ${challengeId}`.execute(db);

  const submission = await acceptChallengeSubmission(db, {
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
      immutable_source_reference: {kind: 'GIT_COMMIT', value: 'abc123'},
      artifact_digest: 'a'.repeat(64),
      evidence_references: ['EVIDENCE-SUBMISSION'],
      accepted_at: 0,
    },
  });

  if (archiveStatus === 'CAPTURED') await captureCanonicalArchive(db, submissionId);

  await sql`update challenges set status = 'SUBMISSIONS_LOCKED' where challenge_id = ${challengeId}`.execute(db);
  await markFinalChallengeSubmission(db, {
    requestId: randomUUID(), challengeId, entryId, submissionId,
  });

  await sql`update challenges set status = 'QUALIFICATION' where challenge_id = ${challengeId}`.execute(db);
  return {organizer, builder, challengeId, entryId, submissionId, manifest, contract, submission};
}

function command(state, overrides = {}) {
  return {
    requestId: randomUUID(),
    qualificationId: randomUUID(),
    challengeId: state.challengeId,
    entryId: state.entryId,
    actorPlayerId: state.organizer,
    acceptanceManifestReferenceId: acceptanceReferenceId,
    acceptanceManifest: state.manifest,
    humanObservations: [{criterion_id: 'HUMAN-UX', result: 'PASS', evidence_refs: ['EVIDENCE-HUMAN']}],
    ...overrides,
  };
}

async function safeArchives(db, state) {
  return db.selectFrom('challenge_submission_archives')
    .select(['submission_id', 'challenge_id', 'entry_id', 'terms_digest', 'manifest_digest', 'status', 'archive_digest', 'reason_code'])
    .where('challenge_id', '=', state.challengeId)
    .where('entry_id', '=', state.entryId)
    .execute();
}

test('G2B2 persists one immutable qualification and one replay-safe execution evidence event', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const state = await preparedChallenge(db);
    const input = command(state);
    const first = await recordStageG2BQualification(db, input);
    assert.equal(first.result, 'QUALIFIED');
    assert.equal(first.submission_id, state.submissionId);
    assert.match(first.execution_digest, /^[0-9a-f]{64}$/);

    const replay = await recordStageG2BQualification(db, input);
    assert.deepEqual(replay, first);

    const qualifications = await sql`
      select qualification_id, submission_id, result, qualification_version
      from challenge_qualifications where challenge_id = ${state.challengeId} and entry_id = ${state.entryId}
    `.execute(db);
    assert.equal(qualifications.rows.length, 1);
    assert.equal(qualifications.rows[0].qualification_id, input.qualificationId);
    assert.equal(qualifications.rows[0].submission_id, state.submissionId);
    assert.equal(qualifications.rows[0].result, 'QUALIFIED');

    const executionEvents = await sql`
      select event_type, payload
      from history_events
      where subject_id = ${state.challengeId} and event_type = 'challenge.test_arena.executed'
    `.execute(db);
    assert.equal(executionEvents.rows.length, 1);
    assert.equal(executionEvents.rows[0].payload.execution_digest, first.execution_digest);
    assert.equal(executionEvents.rows[0].payload.submission_id, state.submissionId);
    assert.deepEqual(executionEvents.rows[0].payload.acceptance_manifest, state.manifest);
    assert.equal(executionEvents.rows[0].payload.execution.submission.manifest_digest, state.submission.manifest_digest);
    assert.equal(JSON.stringify(executionEvents.rows[0].payload).includes('PRIVATE_G2B2_ARCHIVE_REFERENCE'), false);

    await assert.rejects(
      recordStageG2BQualification(db, {
        ...input,
        humanObservations: [{criterion_id: 'HUMAN-UX', result: 'FAIL', evidence_refs: ['EVIDENCE-HUMAN']}],
      }),
      /history_event_idempotency_conflict|challenge_qualification_immutable_conflict/,
    );
  } finally {
    await db.destroy();
  }
});

test('G2B2 refuses to persist qualification while canonical archive capture is still pending', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const state = await preparedChallenge(db, {archiveStatus: 'PENDING'});
    await assert.rejects(recordStageG2BQualification(db, command(state)), /challenge_test_archive_pending/);
    const qualifications = await sql`
      select qualification_id from challenge_qualifications where challenge_id = ${state.challengeId} and entry_id = ${state.entryId}
    `.execute(db);
    assert.equal(qualifications.rows.length, 0);
  } finally {
    await db.destroy();
  }
});

test('G2B2 exact replay can backfill missing execution evidence after lifecycle advance', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const state = await preparedChallenge(db);
    const input = command(state);
    const snapshot = await readChallengeSnapshot(db, state.challengeId);
    assert.ok(snapshot);
    const prepared = buildStageG2BQualificationFromSnapshot(snapshot, await safeArchives(db, state), {
      entryId: state.entryId,
      acceptanceManifestReferenceId: acceptanceReferenceId,
      acceptanceManifest: state.manifest,
      humanObservations: input.humanObservations,
    });

    const qualification = await recordChallengeQualification(db, {
      requestId: input.requestId,
      qualificationId: input.qualificationId,
      challengeId: state.challengeId,
      entryId: state.entryId,
      submissionId: prepared.submission_id,
      qualificationVersion: prepared.qualification.qualification_version,
      criterionResults: prepared.qualification.criterion_results,
    });
    assert.equal(qualification.result, 'QUALIFIED');

    const before = await sql`
      select event_type from history_events
      where subject_id = ${state.challengeId} and event_type = 'challenge.test_arena.executed'
    `.execute(db);
    assert.equal(before.rows.length, 0);

    await sql`update challenges set status = 'APPEAL_WINDOW' where challenge_id = ${state.challengeId}`.execute(db);

    const recovered = await recordStageG2BQualification(db, input);
    assert.equal(recovered.qualification_id, input.qualificationId);
    assert.equal(recovered.result, 'QUALIFIED');
    assert.equal(recovered.execution_digest, prepared.qualification.execution_digest);

    const after = await sql`
      select payload from history_events
      where subject_id = ${state.challengeId} and event_type = 'challenge.test_arena.executed'
    `.execute(db);
    assert.equal(after.rows.length, 1);
    assert.equal(after.rows[0].payload.execution_digest, prepared.qualification.execution_digest);
    assert.equal(after.rows[0].payload.qualification_id, input.qualificationId);

    await assert.rejects(
      recordStageG2BQualification(db, command(state)),
      /challenge_not_qualifying/,
    );
  } finally {
    await db.destroy();
  }
});