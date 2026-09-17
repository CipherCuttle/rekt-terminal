import assert from 'node:assert/strict';
import {generateKeyPairSync, randomUUID} from 'node:crypto';
import test from 'node:test';
import {createSignedBackupManifest} from '../../dist/backup-trust.js';
import {runIsolatedBackupRestoreDrill} from '../../dist/backup-restore-drill.js';

const now = new Date('2026-09-17T12:00:00.000Z');

function fixture() {
  const artifact = Buffer.from('opaque-postgres-backup-bytes', 'utf8');
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const manifest = createSignedBackupManifest({
    backup_id: randomUUID(),
    created_at: '2026-09-17T11:30:00.000Z',
    source: {environment: 'production', database_id: 'render-postgres-primary'},
    retention: {policy_version: 'inkubator.backup-retention/test-v1', expires_at: '2026-09-18T11:30:00.000Z'},
    encryption: {at_rest: true, key_scope: 'BACKUP_ONLY', evidence_ref: 'provider://backup-encryption/evidence-1'},
    access: {
      backup_reader: {credential_id: 'backup-reader-credential', scopes: ['BACKUP_READ'], audit_ref: 'audit://backup-reader'},
      restore_writer: {credential_id: 'restore-writer-credential', scopes: ['RESTORE_WRITE'], audit_ref: 'audit://restore-writer'},
    },
    provenance: {provider: 'postgres-provider', snapshot_id: 'snapshot-20260917-1130', evidence_ref: 'provider://snapshot/evidence-1'},
  }, artifact, {key_id: 'backup-signing-key-v1', private_key: privateKey});
  return {
    artifact,
    manifest,
    admission_policy: {
      now,
      max_backup_age_ms: 2 * 60 * 60 * 1000,
      expected_source_environment: 'production',
      expected_source_database_id: 'render-postgres-primary',
      expected_retention_policy_version: 'inkubator.backup-retention/test-v1',
      trusted_signer_key_id: 'backup-signing-key-v1',
      trusted_signer_public_key: publicKey,
      ordinary_application_credential_ids: ['app-database-runtime'],
    },
    isolation_policy: {
      mode: 'ISOLATED_RESTORE',
      target_environment: 'restore-drill-ci',
      source_database_id: 'render-postgres-primary',
      target_database_id: 'ephemeral-restore-db',
      production_environment_ids: ['production', 'rehearsal'],
      external_effects: {github: false, archive_writes: false, provider_inference: false, settlement: false},
    },
    retention_evidence: {
      policy_version: 'inkubator.backup-retention/test-v1',
      policy_document_ref: 'docs/inkubator/INKUBATOR_PRIVATE_DATA_RETENTION_V1.md',
      private_material_erasure_evidence_ref: 'apps/inkubator-api/test/integration/stage-h2-private-retention.test.mjs',
      backup_deletion_evidence_ref: 'provider://backup-retention/delete-proof-1',
    },
  };
}

test('H6 does not invoke provider restore before artifact admission passes', async () => {
  const input = fixture();
  let restoreCalls = 0;
  await assert.rejects(
    runIsolatedBackupRestoreDrill({
      ...input,
      artifact: Buffer.from('tampered'),
      restore_artifact: async () => {
        restoreCalls += 1;
        throw new Error('restore_must_not_run');
      },
    }),
    /backup_artifact_integrity_mismatch/,
  );
  assert.equal(restoreCalls, 0);
});

test('H6 does not invoke provider restore before isolation and retention evidence pass', async () => {
  const input = fixture();
  let restoreCalls = 0;
  const restore_artifact = async () => {
    restoreCalls += 1;
    throw new Error('restore_must_not_run');
  };

  await assert.rejects(
    runIsolatedBackupRestoreDrill({
      ...input,
      isolation_policy: {...input.isolation_policy, target_environment: 'production'},
      restore_artifact,
    }),
    /restore_target_environment_not_isolated/,
  );
  assert.equal(restoreCalls, 0);

  await assert.rejects(
    runIsolatedBackupRestoreDrill({
      ...input,
      retention_evidence: {...input.retention_evidence, policy_version: 'different-policy'},
      restore_artifact,
    }),
    /backup_retention_evidence_policy_mismatch/,
  );
  assert.equal(restoreCalls, 0);
});
