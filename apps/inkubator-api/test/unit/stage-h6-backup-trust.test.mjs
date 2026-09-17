import assert from 'node:assert/strict';
import {generateKeyPairSync, randomUUID} from 'node:crypto';
import test from 'node:test';
import {
  assertIsolatedRestore,
  createSignedBackupManifest,
  verifyBackupForRestore,
} from '../../dist/backup-trust.js';

const now = new Date('2026-09-17T12:00:00.000Z');
const artifact = Buffer.from('opaque-postgres-backup-bytes', 'utf8');
const {privateKey, publicKey} = generateKeyPairSync('ed25519');

function manifestInput(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function policy(overrides = {}) {
  return {
    now,
    max_backup_age_ms: 2 * 60 * 60 * 1000,
    expected_source_environment: 'production',
    expected_source_database_id: 'render-postgres-primary',
    expected_retention_policy_version: 'inkubator.backup-retention/test-v1',
    trusted_signer_key_id: 'backup-signing-key-v1',
    trusted_signer_public_key: publicKey,
    ordinary_application_credential_ids: ['app-database-runtime', 'github-app-runtime'],
    ...overrides,
  };
}

function signed(input = manifestInput()) {
  return createSignedBackupManifest(input, artifact, {key_id: 'backup-signing-key-v1', private_key: privateKey});
}

test('H6 admits only a fresh authentic backup with separated least-privilege credentials', () => {
  const manifest = signed();
  const accepted = verifyBackupForRestore(manifest, artifact, policy());
  assert.equal(accepted.backup_id, manifest.backup_id);
  assert.equal(accepted.artifact.bytes, artifact.byteLength);
});

test('H6 rejects tampered bytes and tampered signed provenance before restore authority', () => {
  const manifest = signed();
  assert.throws(() => verifyBackupForRestore(manifest, Buffer.from('tampered'), policy()), /backup_artifact_integrity_mismatch/);

  const tampered = structuredClone(manifest);
  tampered.provenance.snapshot_id = 'attacker-snapshot';
  assert.throws(() => verifyBackupForRestore(tampered, artifact, policy()), /backup_signature_invalid/);
});

test('H6 rejects stale or expired backups even when their signatures are valid', () => {
  const old = signed(manifestInput({
    created_at: '2026-09-15T11:30:00.000Z',
    retention: {policy_version: 'inkubator.backup-retention/test-v1', expires_at: '2026-09-20T11:30:00.000Z'},
  }));
  assert.throws(() => verifyBackupForRestore(old, artifact, policy()), /backup_stale_or_expired/);

  const expired = signed(manifestInput({
    created_at: '2026-09-17T10:30:00.000Z',
    retention: {policy_version: 'inkubator.backup-retention/test-v1', expires_at: '2026-09-17T11:45:00.000Z'},
  }));
  assert.throws(() => verifyBackupForRestore(expired, artifact, policy()), /backup_stale_or_expired/);
});

test('H6 rejects backup or restore credentials that overlap ordinary app authority', () => {
  const overlap = signed(manifestInput({
    access: {
      backup_reader: {credential_id: 'app-database-runtime', scopes: ['BACKUP_READ'], audit_ref: 'audit://reader'},
      restore_writer: {credential_id: 'restore-writer-credential', scopes: ['RESTORE_WRITE'], audit_ref: 'audit://writer'},
    },
  }));
  assert.throws(() => verifyBackupForRestore(overlap, artifact, policy()), /backup_credentials_overlap_application/);

  const shared = signed(manifestInput({
    access: {
      backup_reader: {credential_id: 'shared-backup-restore', scopes: ['BACKUP_READ'], audit_ref: 'audit://reader'},
      restore_writer: {credential_id: 'shared-backup-restore', scopes: ['RESTORE_WRITE'], audit_ref: 'audit://writer'},
    },
  }));
  assert.throws(() => verifyBackupForRestore(shared, artifact, policy()), /backup_restore_credentials_not_separated/);
});

test('H6 restore target must be isolated and all external side effects disabled', () => {
  assert.doesNotThrow(() => assertIsolatedRestore({
    mode: 'ISOLATED_RESTORE',
    target_environment: 'restore-drill-20260917',
    source_database_id: 'render-postgres-primary',
    target_database_id: 'ephemeral-restore-db',
    production_environment_ids: ['production', 'rehearsal'],
    external_effects: {github: false, archive_writes: false, provider_inference: false, settlement: false},
  }, 'production'));

  assert.throws(() => assertIsolatedRestore({
    mode: 'ISOLATED_RESTORE',
    target_environment: 'production',
    source_database_id: 'render-postgres-primary',
    target_database_id: 'ephemeral-restore-db',
    production_environment_ids: ['production'],
    external_effects: {github: false, archive_writes: false, provider_inference: false, settlement: false},
  }, 'production'), /restore_target_environment_not_isolated/);

  assert.throws(() => assertIsolatedRestore({
    mode: 'ISOLATED_RESTORE',
    target_environment: 'restore-drill',
    source_database_id: 'render-postgres-primary',
    target_database_id: 'render-postgres-primary',
    production_environment_ids: ['production'],
    external_effects: {github: false, archive_writes: false, provider_inference: false, settlement: false},
  }, 'production'), /restore_target_matches_source_database/);
});
