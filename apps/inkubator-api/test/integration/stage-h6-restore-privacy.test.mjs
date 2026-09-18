import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {
  CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE,
  purgeChallengeSubmissionPrivateMaterial,
} from '../../dist/challenge-archive.js';
import {
  acceptChallengeSubmission,
  acquireChallengeSeat,
  createChallenge,
  persistFrozenBuildContract,
} from '../../dist/challenge-store.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {verifyRestoredPrivacyRetention} from '../../dist/restore-privacy.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, now) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'h6-privacy-restore-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'H6 privacy restore fixture',
    brief: 'A restore may preserve adjudication truth but must not resurrect purged private material.',
    outcome_contract: {criteria: [{id: 'H6-PRIVACY', description: 'Keep private source purged.', mandatory: true}]},
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
    entry_deadline: now + 60_000,
    build_start: now + 60_000,
    submission_deadline: now + 120_000,
    appeal_window_ms: 1_000,
    review_deadline: now + 180_000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

async function purgedFixture(db) {
  const now = (await readDatabaseNow(db)).getTime();
  const organizer = await player(db, 'h6-privacy-organizer');
  const builder = await player(db, 'h6-privacy-builder');
  const challengeId = randomUUID();
  const entryId = randomUUID();
  const submissionId = randomUUID();
  const contract = contractFor(challengeId, now);

  await createChallenge(db, {
    requestId: randomUUID(), challengeId, organizerPlayerId: organizer,
    organizerPayoutIdentity: `organizer-${challengeId}`, funderPayoutIdentity: `funder-${challengeId}`,
    mechanismVersion: contract.mechanism_version, settlementPolicyVersion: contract.settlement_policy_version,
    ipTermsVersion: contract.ip_terms_version, slotLimit: contract.slot_limit, activationMinimum: contract.activation_minimum,
    entryDeadlineMs: contract.entry_deadline, buildStartMs: contract.build_start,
    submissionDeadlineMs: contract.submission_deadline, appealWindowMs: contract.appeal_window_ms,
    reviewDeadlineMs: contract.review_deadline,
  });
  await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
  await db.updateTable('challenges').set({status: 'ENTRY_OPEN'}).where('challenge_id', '=', challengeId).execute();
  await acquireChallengeSeat(db, {
    requestId: randomUUID(), entryId, challengeId, builderPlayerId: builder, payoutIdentity: `builder-${challengeId}`,
  });
  await db.updateTable('challenges').set({status: 'BUILDING'}).where('challenge_id', '=', challengeId).execute();
  await acceptChallengeSubmission(db, {
    requestId: randomUUID(), submissionId, challengeId, entryId,
    manifest: {
      schema_version: 'inkubator.submission-manifest/1.0', challenge_id: challengeId, entry_id: entryId,
      terms_digest: contract.terms_digest, submission_version: 1,
      immutable_source_reference: {kind: 'GIT_COMMIT', value: 'PRIVATE_H6_RESTORE_SOURCE'},
      artifact_digest: 'd'.repeat(64), evidence_references: ['PRIVATE_H6_RESTORE_EVIDENCE'], accepted_at: 0,
    },
  });
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('idempotency_key', '=', `challenge.submission.archive:${submissionId}`).execute();
  assert.equal((await runOneJob(db, {
    challengeSubmissionArchiveClient: {
      capture: async () => ({outcome: 'CAPTURED', archive_digest: 'e'.repeat(64), archive_reference: 'r2://private/h6-restore-object'}),
    },
  })).status, 'succeeded');
  await db.updateTable('challenges').set({status: 'RECEIPT_FILED'}).where('challenge_id', '=', challengeId).execute();
  await purgeChallengeSubmissionPrivateMaterial(db, submissionId, {delete: async () => {}});
  return {submissionId};
}

test('H6 restored privacy verifier preserves H2 purge tombstones and rejects resurrection', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const {submissionId} = await purgedFixture(db);
  try {
    const report = await verifyRestoredPrivacyRetention(db);
    assert.equal(report.violations.length, 0);
    assert.ok(report.purge_event_count >= 1);
    assert.ok(report.purged_archive_count >= 1);

    await db.updateTable('challenge_submission_archives').set({
      source_reference: 'RESURRECTED_PRIVATE_SOURCE',
      archive_reference: 'r2://private/resurrected-object',
    }).where('submission_id', '=', submissionId).execute();

    await assert.rejects(
      verifyRestoredPrivacyRetention(db),
      new RegExp(`restore_privacy_invalid:.*privacy_source_reference_resurrected:${submissionId}`),
    );
  } finally {
    await db.updateTable('challenge_submission_archives').set({
      source_reference: CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE,
      archive_reference: CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE,
    }).where('submission_id', '=', submissionId).execute();
    await db.destroy();
  }
});
