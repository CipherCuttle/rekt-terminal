import assert from 'node:assert/strict';
import {generateKeyPairSync, randomUUID} from 'node:crypto';
import test from 'node:test';
import {sql} from 'kysely';
import {buildSettlementIntent, fileReceipt, freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {createSignedBackupManifest} from '../../dist/backup-trust.js';
import {runIsolatedBackupRestoreDrill} from '../../dist/backup-restore-drill.js';
import {recordProtocolChallengeReceipt} from '../../dist/challenge-receipt-store.js';
import {
  acceptChallengeSubmission,
  acquireChallengeSeat,
  createChallenge,
  markFinalChallengeSubmission,
  persistFrozenBuildContract,
  recordChallengeDecision,
  recordChallengeQualification,
} from '../../dist/challenge-store.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

function safeDatabaseName(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function databaseUrlFor(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function quotedDatabaseName(name) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error('unsafe_test_database_name');
  return `"${name}"`;
}

async function createDatabaseFrom(adminDb, name, template = null) {
  const clause = template ? ` with template ${quotedDatabaseName(template)}` : '';
  await sql.raw(`create database ${quotedDatabaseName(name)}${clause}`).execute(adminDb);
}

async function dropDatabase(adminDb, name) {
  await sql`select pg_terminate_backend(pid) from pg_stat_activity where datname = ${name} and pid <> pg_backend_pid()`.execute(adminDb);
  await sql.raw(`drop database if exists ${quotedDatabaseName(name)}`).execute(adminDb);
}

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, now) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'h6-restore-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'H6 restore authority fixture',
    brief: 'Prove restored Challenge authority survives through the canonical receipt.',
    outcome_contract: {criteria: [{id: 'H6-QUAL', description: 'Restored evidence remains authoritative.', mandatory: true}]},
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

async function populateCanonicalAuthority(db) {
  await migrateToLatest(db);
  const now = (await readDatabaseNow(db)).getTime();
  const organizer = await player(db, 'h6-organizer');
  const builder = await player(db, 'h6-builder');
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
  await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(db);
  const entry = await acquireChallengeSeat(db, {
    requestId: randomUUID(), entryId, challengeId, builderPlayerId: builder, payoutIdentity: `builder-${challengeId}`,
  });
  await sql`update challenges set status = 'BUILDING' where challenge_id = ${challengeId}`.execute(db);
  await acceptChallengeSubmission(db, {
    requestId: randomUUID(), submissionId, challengeId, entryId,
    manifest: {
      schema_version: 'inkubator.submission-manifest/1.0', challenge_id: challengeId, entry_id: entryId,
      terms_digest: contract.terms_digest, submission_version: 1,
      immutable_source_reference: {kind: 'GIT_COMMIT', value: 'a'.repeat(40)},
      artifact_digest: 'b'.repeat(64), evidence_references: ['h6-restore-evidence'], accepted_at: 0,
    },
  });

  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('idempotency_key', '=', `challenge.submission.archive:${submissionId}`).execute();
  const archived = await runOneJob(db, {
    challengeSubmissionArchiveClient: {
      capture: async () => ({outcome: 'CAPTURED', archive_digest: 'c'.repeat(64), archive_reference: `r2://h6-restore/${submissionId}`}),
    },
  });
  assert.equal(archived.status, 'succeeded');

  await sql`update challenges set status = 'SUBMISSIONS_LOCKED' where challenge_id = ${challengeId}`.execute(db);
  await markFinalChallengeSubmission(db, {requestId: randomUUID(), challengeId, entryId, submissionId});
  await sql`update challenges set status = 'QUALIFICATION' where challenge_id = ${challengeId}`.execute(db);
  await recordChallengeQualification(db, {
    requestId: randomUUID(), qualificationId: randomUUID(), challengeId, entryId, submissionId,
    qualificationVersion: 'h6-qualification-v1',
    criterionResults: [{criterion_id: 'H6-QUAL', result: 'PASS', evidence_refs: ['h6-qualified']}],
  });

  await sql`
    update challenges
    set status = 'APPEAL_WINDOW', appeal_opened_at = clock_timestamp() - interval '2 seconds'
    where challenge_id = ${challengeId}
  `.execute(db);
  await recordChallengeDecision(db, {
    requestId: randomUUID(), decisionId: randomUUID(), challengeId,
    decisionType: 'FINAL_QUALIFIERS', decisionVersion: 'stage-c-effective-v1',
    decision: {final_qualifier_ids: [entryId]},
  });
  await sql`update challenges set status = 'SELECTION' where challenge_id = ${challengeId}`.execute(db);
  await recordChallengeDecision(db, {
    requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId,
    decisionType: 'SELECTION', decisionVersion: 'stage-g3-selection-v1',
    decision: {selected_entry_id: entryId},
  });

  const settlementIntent = buildSettlementIntent({
    contract,
    resolution: {type: 'WINNER_PAYOUT', winner_entry_id: entryId, distributions: [{entry_id: entryId, amount_minor_units: 100}]},
    recipientByEntryId: {[entryId]: entry.payout_identity},
  });
  await recordChallengeDecision(db, {
    requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId,
    decisionType: 'SETTLEMENT_INTENT', decisionVersion: 'h6-settlement-intent-v1', decision: settlementIntent,
  });
  const settlementExecutionFact = {
    challenge_id: challengeId, terms_digest: contract.terms_digest,
    settlement_policy_version: contract.settlement_policy_version, asset: contract.settlement_asset,
    total_minor_units: contract.prize_minor_units, recipients: settlementIntent.recipients,
    finality: 'FINALIZED', execution_id: `h6-execution-${challengeId}`,
  };
  await recordChallengeDecision(db, {
    requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId,
    decisionType: 'SETTLEMENT_EXECUTION_FACT', decisionVersion: 'h6-execution-v1', decision: settlementExecutionFact,
  });
  const receipt = fileReceipt({contract, settlementIntent, settlementExecutionFact});
  await recordProtocolChallengeReceipt(db, {requestId: randomUUID(), challengeId, receipt});
  return {challengeId};
}

function trustFixture(sourceDatabaseId, targetDatabaseId) {
  const artifact = Buffer.from(`provider-snapshot-evidence:${sourceDatabaseId}`, 'utf8');
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const now = new Date();
  const manifest = createSignedBackupManifest({
    backup_id: randomUUID(),
    created_at: new Date(now.getTime() - 1_000).toISOString(),
    source: {environment: 'production', database_id: sourceDatabaseId},
    retention: {policy_version: 'inkubator.backup-retention/h6-ci-v1', expires_at: new Date(now.getTime() + 3_600_000).toISOString()},
    encryption: {at_rest: true, key_scope: 'BACKUP_ONLY', evidence_ref: 'ci://backup-encryption'},
    access: {
      backup_reader: {credential_id: 'ci-h6-backup-reader', scopes: ['BACKUP_READ'], audit_ref: 'ci://backup-reader-audit'},
      restore_writer: {credential_id: 'ci-h6-restore-writer', scopes: ['RESTORE_WRITE'], audit_ref: 'ci://restore-writer-audit'},
    },
    provenance: {provider: 'postgres-template-ci', snapshot_id: sourceDatabaseId, evidence_ref: `ci://snapshot/${sourceDatabaseId}`},
  }, artifact, {key_id: 'ci-h6-ed25519', private_key: privateKey});
  return {
    artifact,
    manifest,
    admission_policy: {
      now,
      max_backup_age_ms: 60_000,
      expected_source_environment: 'production',
      expected_source_database_id: sourceDatabaseId,
      expected_retention_policy_version: 'inkubator.backup-retention/h6-ci-v1',
      trusted_signer_key_id: 'ci-h6-ed25519',
      trusted_signer_public_key: publicKey,
      ordinary_application_credential_ids: ['ci-app-runtime'],
    },
    isolation_policy: {
      mode: 'ISOLATED_RESTORE',
      target_environment: 'ci-h6-isolated-restore',
      source_database_id: sourceDatabaseId,
      target_database_id: targetDatabaseId,
      production_environment_ids: ['production', 'rehearsal'],
      external_effects: {github: false, archive_writes: false, provider_inference: false, settlement: false},
    },
    retention_evidence: {
      policy_version: 'inkubator.backup-retention/h6-ci-v1',
      policy_document_ref: 'docs/inkubator/INKUBATOR_PRIVATE_DATA_RETENTION_V1.md',
      private_material_erasure_evidence_ref: 'apps/inkubator-api/test/integration/stage-h2-private-retention.test.mjs',
      backup_deletion_evidence_ref: 'ci://backup-retention/delete-proof',
    },
  };
}

test('H6 isolated Postgres restore preserves Challenge-to-receipt authority and emits receipt only after verification', async () => {
  const adminDb = createDatabase(databaseUrl);
  const sourceName = safeDatabaseName('h6_source');
  const targetName = safeDatabaseName('h6_restore');
  let sourceDb = null;
  try {
    await createDatabaseFrom(adminDb, sourceName);
    sourceDb = createDatabase(databaseUrlFor(sourceName));
    const fixture = await populateCanonicalAuthority(sourceDb);
    await sourceDb.destroy();
    sourceDb = null;

    const trust = trustFixture(sourceName, targetName);
    let restoreCalls = 0;
    const drill = await runIsolatedBackupRestoreDrill({
      ...trust,
      restore_artifact: async ({isolation}) => {
        restoreCalls += 1;
        assert.equal(isolation.target_database_id, targetName);
        await createDatabaseFrom(adminDb, targetName, sourceName);
        const restoredDb = createDatabase(databaseUrlFor(targetName));
        return {
          db: restoredDb,
          target_environment: isolation.target_environment,
          target_database_id: targetName,
          close: () => restoredDb.destroy(),
        };
      },
    });

    assert.equal(restoreCalls, 1);
    assert.equal(drill.authority_report.challenge_count, 1);
    assert.equal(drill.authority_report.contract_count, 1);
    assert.equal(drill.authority_report.submission_count, 1);
    assert.equal(drill.authority_report.qualification_count, 1);
    assert.equal(drill.authority_report.decision_count, 4);
    assert.equal(drill.authority_report.receipt_count, 1);
    assert.equal(drill.authority_report.archive_count, 1);
    assert.deepEqual(drill.authority_report.violations, []);
    assert.equal(drill.retention_report.status, 'CONSISTENT');
    assert.equal(drill.target_database_id, targetName);
    assert.match(drill.receipt_sha256, /^[0-9a-f]{64}$/);
    assert.ok(fixture.challengeId);
  } finally {
    if (sourceDb) await sourceDb.destroy();
    await dropDatabase(adminDb, targetName);
    await dropDatabase(adminDb, sourceName);
    await adminDb.destroy();
  }
});

test('H6 restored authority tampering blocks the drill receipt', async () => {
  const adminDb = createDatabase(databaseUrl);
  const sourceName = safeDatabaseName('h6_tamper_source');
  const targetName = safeDatabaseName('h6_tamper_restore');
  let sourceDb = null;
  try {
    await createDatabaseFrom(adminDb, sourceName);
    sourceDb = createDatabase(databaseUrlFor(sourceName));
    await populateCanonicalAuthority(sourceDb);
    await sourceDb.destroy();
    sourceDb = null;

    const trust = trustFixture(sourceName, targetName);
    await assert.rejects(
      runIsolatedBackupRestoreDrill({
        ...trust,
        restore_artifact: async ({isolation}) => {
          await createDatabaseFrom(adminDb, targetName, sourceName);
          const restoredDb = createDatabase(databaseUrlFor(targetName));
          await restoredDb.updateTable('challenge_receipts').set({receipt_digest: '0'.repeat(64)}).execute();
          return {
            db: restoredDb,
            target_environment: isolation.target_environment,
            target_database_id: targetName,
            close: () => restoredDb.destroy(),
          };
        },
      }),
      /restore_authority_invalid:.*receipt_lineage_invalid/,
    );
  } finally {
    if (sourceDb) await sourceDb.destroy();
    await dropDatabase(adminDb, targetName);
    await dropDatabase(adminDb, sourceName);
    await adminDb.destroy();
  }
});
