import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {
  CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION,
  CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE,
  CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE,
  purgeChallengeSubmissionPrivateMaterial,
} from '../../dist/challenge-archive.js';
import {acceptChallengeSubmission, acquireChallengeSeat, createChallenge, persistFrozenBuildContract} from '../../dist/challenge-store.js';
import {canonicalizeJson} from '../../dist/canonical-json.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, now) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0', challenge_id: challengeId, contract_version: 'h2-retention-v1',
    mechanism_version: 'funded-challenge/1.1', settlement_policy_version: 'funded-challenge-settlement/1.0', ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'H2 retention challenge', brief: 'Private bytes are disposable; Challenge truth is durable.',
    outcome_contract: {criteria: [{id: 'OUT-1', description: 'Preserve durable truth', mandatory: true}]}, production_envelope: {criteria: []}, delivery_contract: {criteria: []},
    preferences: {}, reference_architecture: {}, normative_constraints: [], normative_references: [], informational_references: [], knowledge: [],
    slot_limit: 2, activation_minimum: 1, entry_deadline: now + 60_000, build_start: now + 60_000, submission_deadline: now + 120_000, appeal_window_ms: 100, review_deadline: now + 180_000,
    prize_minor_units: 100, settlement_asset: 'TEST',
  });
}

async function acceptedFixture(db, sourceValue = 'PRIVATE_SOURCE_REFERENCE_H2') {
  const now = (await readDatabaseNow(db)).getTime();
  const organizer = await player(db, 'h2-organizer');
  const builder = await player(db, 'h2-builder');
  const challengeId = randomUUID();
  const contract = contractFor(challengeId, now);
  await createChallenge(db, {requestId: randomUUID(), challengeId, organizerPlayerId: organizer, organizerPayoutIdentity: `organizer-${challengeId}`, funderPayoutIdentity: `funder-${challengeId}`, mechanismVersion: contract.mechanism_version, settlementPolicyVersion: contract.settlement_policy_version, ipTermsVersion: contract.ip_terms_version, slotLimit: contract.slot_limit, activationMinimum: contract.activation_minimum, entryDeadlineMs: contract.entry_deadline, buildStartMs: contract.build_start, submissionDeadlineMs: contract.submission_deadline, appealWindowMs: contract.appeal_window_ms, reviewDeadlineMs: contract.review_deadline});
  await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
  await db.updateTable('challenges').set({status: 'ENTRY_OPEN'}).where('challenge_id', '=', challengeId).execute();
  const entry = await acquireChallengeSeat(db, {requestId: randomUUID(), entryId: randomUUID(), challengeId, builderPlayerId: builder, payoutIdentity: `builder-${challengeId}`});
  await db.updateTable('challenges').set({status: 'BUILDING'}).where('challenge_id', '=', challengeId).execute();
  await db.updateTable('challenge_entries').set({state: 'ACTIVE', build_start: new Date(contract.build_start), submission_deadline: new Date(contract.submission_deadline)}).where('entry_id', '=', entry.entry_id).execute();
  const requestId = randomUUID();
  const submissionId = randomUUID();
  const manifest = {
    schema_version: 'inkubator.submission-manifest/1.0', challenge_id: challengeId, entry_id: entry.entry_id,
    terms_digest: contract.terms_digest, submission_version: 1,
    immutable_source_reference: {kind: 'GIT_COMMIT', value: sourceValue},
    artifact_digest: 'a'.repeat(64), evidence_references: ['PRIVATE_EVIDENCE_REFERENCE_H2'], optional_live_url: 'https://private.invalid/build', accepted_at: 0,
  };
  const accepted = await acceptChallengeSubmission(db, {requestId, submissionId, challengeId, entryId: entry.entry_id, manifest});
  return {challengeId, entryId: entry.entry_id, submissionId, requestId, manifest, accepted};
}

async function archiveJob(db, submissionId) {
  return db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE).where('idempotency_key', '=', `challenge.submission.archive:${submissionId}`).executeTakeFirstOrThrow();
}

test('H2 archive jobs persist only an opaque submission id and legacy payloads minimize on replay', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedFixture(db);
    const job = await archiveJob(db, fixture.submissionId);
    assert.deepEqual(job.payload, {schema_version: CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION, submission_id: fixture.submissionId});
    assert.equal(JSON.stringify(job.payload).includes('PRIVATE_SOURCE_REFERENCE_H2'), false);
    assert.equal(JSON.stringify(job.payload).includes('PRIVATE_EVIDENCE_REFERENCE_H2'), false);
    assert.equal(JSON.stringify(job.payload).includes('private.invalid'), false);

    const legacyPayload = {
      schema_version: 'challenge.submission_archive_capture.job.v1', submission_id: fixture.submissionId,
      challenge_id: fixture.challengeId, entry_id: fixture.entryId, source_kind: 'GIT_COMMIT', source_reference: 'PRIVATE_SOURCE_REFERENCE_H2',
      terms_digest: fixture.accepted.terms_digest, manifest_digest: fixture.accepted.manifest_digest, artifact_digest: 'a'.repeat(64),
      evidence_references: ['PRIVATE_EVIDENCE_REFERENCE_H2'], optional_live_url: 'https://private.invalid/build', ship_submission_id: null,
    };
    const normalizedLegacy = canonicalizeJson(legacyPayload);
    await db.updateTable('outbox_jobs').set({payload: normalizedLegacy.value, payload_hash: normalizedLegacy.sha256}).where('job_id', '=', job.job_id).execute();

    const replay = await acceptChallengeSubmission(db, {requestId: fixture.requestId, submissionId: fixture.submissionId, challengeId: fixture.challengeId, entryId: fixture.entryId, manifest: fixture.manifest});
    assert.equal(replay.submission_id, fixture.submissionId);
    const minimized = await archiveJob(db, fixture.submissionId);
    assert.deepEqual(minimized.payload, {schema_version: CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION, submission_id: fixture.submissionId});
  } finally { await db.destroy(); }
});

test('H2 purge deletes private archive material only after receipt and preserves durable adjudication facts', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedFixture(db);
    const job = await archiveJob(db, fixture.submissionId);
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
    const archiveSecret = 'r2://private-bucket/challenge-submissions/secret-object';
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: {capture: async () => ({outcome: 'CAPTURED', archive_digest: 'b'.repeat(64), archive_reference: archiveSecret})}})).status, 'succeeded');

    let deletes = 0;
    const deleter = {delete: async ({submissionId, archiveReference}) => {
      deletes += 1;
      assert.equal(submissionId, fixture.submissionId);
      assert.equal(archiveReference, archiveSecret);
    }};
    await assert.rejects(() => purgeChallengeSubmissionPrivateMaterial(db, fixture.submissionId, deleter), /challenge_private_material_purge_liability_hold/);
    assert.equal(deletes, 0);

    const beforeSubmission = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    await db.updateTable('challenges').set({status: 'RECEIPT_FILED'}).where('challenge_id', '=', fixture.challengeId).execute();
    const purged = await purgeChallengeSubmissionPrivateMaterial(db, fixture.submissionId, deleter);
    assert.equal(purged.already_purged, false);
    assert.equal(purged.manifest_digest, beforeSubmission.manifest_digest);
    assert.equal(purged.archive_digest, 'b'.repeat(64));
    assert.equal(deletes, 1);

    const archive = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(archive.source_reference, CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE);
    assert.equal(archive.archive_reference, CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE);
    assert.equal(archive.archive_digest, 'b'.repeat(64));
    assert.equal(archive.manifest_digest, beforeSubmission.manifest_digest);
    assert.equal(archive.status, 'CAPTURED');
    const frozenSources = await db.executeQuery({sql: 'select repository_id from challenge_submission_archive_sources where submission_id = $1', parameters: [fixture.submissionId]});
    assert.equal(frozenSources.rows.length, 0);

    const afterSubmission = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(afterSubmission.manifest_digest, beforeSubmission.manifest_digest);
    assert.deepEqual(afterSubmission.manifest_json, beforeSubmission.manifest_json);

    const purgeEvent = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'challenge.submission_private_material.purged').where('subject_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    const serializedEvent = JSON.stringify(purgeEvent);
    assert.equal(serializedEvent.includes('PRIVATE_SOURCE_REFERENCE_H2'), false);
    assert.equal(serializedEvent.includes('PRIVATE_EVIDENCE_REFERENCE_H2'), false);
    assert.equal(serializedEvent.includes(archiveSecret), false);

    const replay = await purgeChallengeSubmissionPrivateMaterial(db, fixture.submissionId, deleter);
    assert.equal(replay.already_purged, true);
    assert.equal(deletes, 1);

    await db.updateTable('outbox_jobs').set({state: 'pending', attempts: 0, next_attempt_at: new Date(0), completed_at: null, locked_at: null, lock_token: null}).where('idempotency_key', '=', `challenge.submission.archive:${fixture.submissionId}`).execute();
    let captures = 0;
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: {capture: async () => { captures += 1; throw new Error('must_not_capture'); }}})).status, 'succeeded');
    assert.equal(captures, 0);
  } finally { await db.destroy(); }
});

test('H2 purge fails closed when private object deletion fails', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedFixture(db, 'PRIVATE_SOURCE_DELETE_FAILURE');
    const job = await archiveJob(db, fixture.submissionId);
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
    const archiveSecret = 'r2://private-bucket/challenge-submissions/delete-failure';
    await runOneJob(db, {challengeSubmissionArchiveClient: {capture: async () => ({outcome: 'CAPTURED', archive_digest: 'c'.repeat(64), archive_reference: archiveSecret})}});
    await db.updateTable('challenges').set({status: 'RECEIPT_FILED'}).where('challenge_id', '=', fixture.challengeId).execute();

    await assert.rejects(() => purgeChallengeSubmissionPrivateMaterial(db, fixture.submissionId, {delete: async () => { throw new Error('object_store_unavailable'); }}), /object_store_unavailable/);
    const archive = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(archive.source_reference, 'PRIVATE_SOURCE_DELETE_FAILURE');
    assert.equal(archive.archive_reference, archiveSecret);
    const event = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'challenge.submission_private_material.purged').where('subject_id', '=', fixture.submissionId).executeTakeFirst();
    assert.equal(event, undefined);
  } finally { await db.destroy(); }
});
