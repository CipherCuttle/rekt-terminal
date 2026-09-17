import type {Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import type {DatabaseSchema} from './database.js';
import {verifyRestoredPrivacyRetention, type RestoredPrivacyRetentionReport} from './restore-privacy.js';
import {
  assertIsolatedRestore,
  verifyBackupForRestore,
  verifyRestoredChallengeAuthority,
  type RestoreAdmissionPolicy,
  type RestoreIsolationPolicy,
  type RestoredAuthorityReport,
  type SignedBackupManifest,
} from './backup-trust.js';

export interface BackupRetentionConsistencyEvidence {
  policy_version: string;
  policy_document_ref: string;
  private_material_erasure_evidence_ref: string;
  backup_deletion_evidence_ref: string;
}

export interface BackupRetentionConsistencyReport {
  schema_version: 'inkubator.backup-retention-consistency/1.0';
  policy_version: string;
  policy_document_ref: string;
  bounded_until: string;
  private_material_erasure_evidence_ref: string;
  backup_deletion_evidence_ref: string;
  status: 'CONSISTENT';
}

export interface RestoreArtifactRequest {
  artifact: Uint8Array;
  manifest: SignedBackupManifest;
  isolation: RestoreIsolationPolicy;
}

export interface RestoredDatabaseHandle {
  db: Kysely<DatabaseSchema>;
  target_environment: string;
  target_database_id: string;
  close(): Promise<void>;
}

export interface RestoreDrillReceipt {
  schema_version: 'inkubator.backup-restore-drill-receipt/1.0';
  backup_id: string;
  source_environment: string;
  source_database_id: string;
  target_environment: string;
  target_database_id: string;
  artifact_sha256: string;
  manifest_signer_key_id: string;
  authority_report: RestoredAuthorityReport;
  authority_report_sha256: string;
  privacy_report: RestoredPrivacyRetentionReport;
  privacy_report_sha256: string;
  retention_report: BackupRetentionConsistencyReport;
  completed_at: string;
  receipt_sha256: string;
}

export interface RunRestoreDrillInput {
  manifest: unknown;
  artifact: Uint8Array;
  admission_policy: RestoreAdmissionPolicy;
  isolation_policy: RestoreIsolationPolicy;
  retention_evidence: BackupRetentionConsistencyEvidence;
  restore_artifact(request: RestoreArtifactRequest): Promise<RestoredDatabaseHandle>;
  clock?: () => Date;
}

function requireEvidenceRef(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 500) {
    throw new Error(`backup_retention_${label}_invalid`);
  }
  return value.trim();
}

export function buildBackupRetentionConsistencyReport(
  manifest: SignedBackupManifest,
  evidence: BackupRetentionConsistencyEvidence,
): BackupRetentionConsistencyReport {
  if (evidence.policy_version !== manifest.retention.policy_version) {
    throw new Error('backup_retention_evidence_policy_mismatch');
  }
  const createdAt = new Date(manifest.created_at);
  const expiresAt = new Date(manifest.retention.expires_at);
  if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= createdAt.getTime()) {
    throw new Error('backup_retention_window_invalid');
  }
  return {
    schema_version: 'inkubator.backup-retention-consistency/1.0',
    policy_version: evidence.policy_version,
    policy_document_ref: requireEvidenceRef(evidence.policy_document_ref, 'policy_document_ref'),
    bounded_until: expiresAt.toISOString(),
    private_material_erasure_evidence_ref: requireEvidenceRef(
      evidence.private_material_erasure_evidence_ref,
      'private_material_erasure_evidence_ref',
    ),
    backup_deletion_evidence_ref: requireEvidenceRef(evidence.backup_deletion_evidence_ref, 'backup_deletion_evidence_ref'),
    status: 'CONSISTENT',
  };
}

function receiptDigest(receipt: Omit<RestoreDrillReceipt, 'receipt_sha256'>): string {
  return canonicalizeJson(receipt).sha256;
}

export async function runIsolatedBackupRestoreDrill(input: RunRestoreDrillInput): Promise<RestoreDrillReceipt> {
  // Admission is intentionally first. No restore callback is reachable until the
  // artifact, source, freshness, retention, encryption, access and signature
  // evidence have all passed verification.
  const manifest = verifyBackupForRestore(input.manifest, input.artifact, input.admission_policy);

  if (input.isolation_policy.source_database_id !== manifest.source.database_id) {
    throw new Error('restore_source_database_identity_mismatch');
  }
  assertIsolatedRestore(input.isolation_policy, manifest.source.environment);
  const retentionReport = buildBackupRetentionConsistencyReport(manifest, input.retention_evidence);

  let restored: RestoredDatabaseHandle | null = null;
  try {
    restored = await input.restore_artifact({
      artifact: input.artifact,
      manifest,
      isolation: input.isolation_policy,
    });
    if (
      restored.target_environment !== input.isolation_policy.target_environment
      || restored.target_database_id !== input.isolation_policy.target_database_id
    ) throw new Error('restore_target_identity_mismatch');

    // A provider-level restore success is not authority. Canonical Challenge
    // lineage and H2 private-material purge tombstones must both survive before
    // any H6 trust receipt can exist.
    const authorityReport = await verifyRestoredChallengeAuthority(restored.db);
    const authorityReportSha256 = canonicalizeJson(authorityReport).sha256;
    const privacyReport = await verifyRestoredPrivacyRetention(restored.db);
    const privacyReportSha256 = canonicalizeJson(privacyReport).sha256;

    await restored.close();
    restored = null;

    const completedAt = (input.clock?.() ?? new Date()).toISOString();
    const unsignedReceipt: Omit<RestoreDrillReceipt, 'receipt_sha256'> = {
      schema_version: 'inkubator.backup-restore-drill-receipt/1.0',
      backup_id: manifest.backup_id,
      source_environment: manifest.source.environment,
      source_database_id: manifest.source.database_id,
      target_environment: input.isolation_policy.target_environment,
      target_database_id: input.isolation_policy.target_database_id,
      artifact_sha256: manifest.artifact.sha256,
      manifest_signer_key_id: manifest.signature.key_id,
      authority_report: authorityReport,
      authority_report_sha256: authorityReportSha256,
      privacy_report: privacyReport,
      privacy_report_sha256: privacyReportSha256,
      retention_report: retentionReport,
      completed_at: completedAt,
    };
    return {...unsignedReceipt, receipt_sha256: receiptDigest(unsignedReceipt)};
  } finally {
    if (restored) await restored.close();
  }
}
