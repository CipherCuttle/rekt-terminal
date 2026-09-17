import {createHash, sign as cryptoSign, verify as cryptoVerify, type KeyLike} from 'node:crypto';
import {assertFrozenBuildContract, assertSubmissionManifest} from '@rekt-ink/protocol/challenge';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import {buildStageG3ReceiptTransport} from './challenge-g3-api.js';
import {readChallengeSnapshot} from './challenge-store.js';
import type {DatabaseSchema} from './database.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const BACKUP_SCHEMA_VERSION = 'inkubator.backup-manifest/1.0' as const;
const BACKUP_READ_SCOPE = 'BACKUP_READ' as const;
const RESTORE_WRITE_SCOPE = 'RESTORE_WRITE' as const;

export interface BackupTrustSource {
  environment: string;
  database_id: string;
}

export interface BackupArtifactIdentity {
  sha256: string;
  bytes: number;
}

export interface BackupRetentionPolicy {
  policy_version: string;
  expires_at: string;
}

export interface BackupEncryptionEvidence {
  at_rest: true;
  key_scope: 'BACKUP_ONLY';
  evidence_ref: string;
}

export interface BackupCredentialEvidence {
  credential_id: string;
  scopes: string[];
  audit_ref: string;
}

export interface BackupAccessEvidence {
  backup_reader: BackupCredentialEvidence;
  restore_writer: BackupCredentialEvidence;
}

export interface BackupProvenance {
  provider: string;
  snapshot_id: string;
  evidence_ref: string;
}

export interface UnsignedBackupManifest {
  schema_version: typeof BACKUP_SCHEMA_VERSION;
  backup_id: string;
  created_at: string;
  source: BackupTrustSource;
  artifact: BackupArtifactIdentity;
  retention: BackupRetentionPolicy;
  encryption: BackupEncryptionEvidence;
  access: BackupAccessEvidence;
  provenance: BackupProvenance;
}

export interface SignedBackupManifest extends UnsignedBackupManifest {
  signature: {
    algorithm: 'ED25519';
    key_id: string;
    value_base64: string;
  };
}

export interface RestoreAdmissionPolicy {
  now: Date;
  max_backup_age_ms: number;
  expected_source_environment: string;
  expected_source_database_id: string;
  expected_retention_policy_version: string;
  trusted_signer_key_id: string;
  trusted_signer_public_key: KeyLike;
  ordinary_application_credential_ids: string[];
}

export interface RestoreIsolationPolicy {
  mode: 'ISOLATED_RESTORE';
  target_environment: string;
  source_database_id: string;
  target_database_id: string;
  production_environment_ids: string[];
  external_effects: {
    github: false;
    archive_writes: false;
    provider_inference: false;
    settlement: false;
  };
}

export interface RestoredAuthorityReport {
  schema_version: 'inkubator.restore-authority-report/1.0';
  challenge_count: number;
  contract_count: number;
  submission_count: number;
  qualification_count: number;
  decision_count: number;
  receipt_count: number;
  archive_count: number;
  violations: string[];
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`backup_${label}_invalid`);
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`backup_${label}_shape_invalid`);
  }
}

function requireText(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string') throw new Error(`backup_${label}_invalid`);
  const text = value.trim();
  if (text.length === 0 || text.length > max) throw new Error(`backup_${label}_invalid`);
  return text;
}

function requireIsoDate(value: unknown, label: string): Date {
  const text = requireText(value, label, 80);
  const date = new Date(text);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== text) throw new Error(`backup_${label}_invalid`);
  return date;
}

function unsignedManifest(manifest: SignedBackupManifest): UnsignedBackupManifest {
  const {signature: _signature, ...unsigned} = manifest;
  return unsigned;
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalizeJson(value).serialized, 'utf8');
}

function artifactIdentity(artifact: Uint8Array): BackupArtifactIdentity {
  return {
    sha256: createHash('sha256').update(artifact).digest('hex'),
    bytes: artifact.byteLength,
  };
}

function assertCredentialEvidence(value: unknown, label: string, expectedScope: string): BackupCredentialEvidence {
  const row = requireObject(value, label);
  assertExactKeys(row, ['credential_id', 'scopes', 'audit_ref'], label);
  const credentialId = requireText(row.credential_id, `${label}_credential_id`, 160);
  const auditRef = requireText(row.audit_ref, `${label}_audit_ref`);
  if (!Array.isArray(row.scopes) || row.scopes.length !== 1 || row.scopes[0] !== expectedScope) {
    throw new Error(`backup_${label}_scope_invalid`);
  }
  return {credential_id: credentialId, scopes: [expectedScope], audit_ref: auditRef};
}

export function createSignedBackupManifest(
  input: Omit<UnsignedBackupManifest, 'schema_version' | 'artifact'>,
  artifact: Uint8Array,
  signer: {key_id: string; private_key: KeyLike},
): SignedBackupManifest {
  const unsigned: UnsignedBackupManifest = {
    schema_version: BACKUP_SCHEMA_VERSION,
    ...input,
    artifact: artifactIdentity(artifact),
  };
  const signature = cryptoSign(null, canonicalBytes(unsigned), signer.private_key).toString('base64');
  return {
    ...unsigned,
    signature: {algorithm: 'ED25519', key_id: signer.key_id, value_base64: signature},
  };
}

export function verifyBackupForRestore(
  manifestInput: unknown,
  artifact: Uint8Array,
  policy: RestoreAdmissionPolicy,
): SignedBackupManifest {
  const manifest = requireObject(manifestInput, 'manifest');
  assertExactKeys(manifest, [
    'schema_version', 'backup_id', 'created_at', 'source', 'artifact', 'retention',
    'encryption', 'access', 'provenance', 'signature',
  ], 'manifest');
  if (manifest.schema_version !== BACKUP_SCHEMA_VERSION) throw new Error('backup_schema_unsupported');
  const backupId = requireText(manifest.backup_id, 'id', 80);
  if (!UUID_PATTERN.test(backupId)) throw new Error('backup_id_invalid');
  const createdAt = requireIsoDate(manifest.created_at, 'created_at');

  const source = requireObject(manifest.source, 'source');
  assertExactKeys(source, ['environment', 'database_id'], 'source');
  const sourceEnvironment = requireText(source.environment, 'source_environment', 160);
  const sourceDatabaseId = requireText(source.database_id, 'source_database_id', 240);
  if (sourceEnvironment !== policy.expected_source_environment || sourceDatabaseId !== policy.expected_source_database_id) {
    throw new Error('backup_source_provenance_unexpected');
  }

  const artifactRow = requireObject(manifest.artifact, 'artifact');
  assertExactKeys(artifactRow, ['sha256', 'bytes'], 'artifact');
  if (typeof artifactRow.sha256 !== 'string' || !SHA256_PATTERN.test(artifactRow.sha256)) throw new Error('backup_artifact_digest_invalid');
  if (!Number.isSafeInteger(artifactRow.bytes) || Number(artifactRow.bytes) < 0) throw new Error('backup_artifact_size_invalid');
  const actualArtifact = artifactIdentity(artifact);
  if (artifactRow.sha256 !== actualArtifact.sha256 || artifactRow.bytes !== actualArtifact.bytes) throw new Error('backup_artifact_integrity_mismatch');

  const retention = requireObject(manifest.retention, 'retention');
  assertExactKeys(retention, ['policy_version', 'expires_at'], 'retention');
  const policyVersion = requireText(retention.policy_version, 'retention_policy_version', 160);
  if (policyVersion !== policy.expected_retention_policy_version) throw new Error('backup_retention_policy_unexpected');
  const expiresAt = requireIsoDate(retention.expires_at, 'expires_at');
  if (expiresAt.getTime() <= createdAt.getTime()) throw new Error('backup_retention_window_invalid');
  if (!Number.isSafeInteger(policy.max_backup_age_ms) || policy.max_backup_age_ms <= 0) throw new Error('backup_max_age_policy_invalid');
  const nowMs = policy.now.getTime();
  if (createdAt.getTime() > nowMs) throw new Error('backup_from_future');
  if (nowMs > expiresAt.getTime() || nowMs - createdAt.getTime() > policy.max_backup_age_ms) throw new Error('backup_stale_or_expired');

  const encryption = requireObject(manifest.encryption, 'encryption');
  assertExactKeys(encryption, ['at_rest', 'key_scope', 'evidence_ref'], 'encryption');
  if (encryption.at_rest !== true || encryption.key_scope !== 'BACKUP_ONLY') throw new Error('backup_encryption_evidence_invalid');
  requireText(encryption.evidence_ref, 'encryption_evidence_ref');

  const access = requireObject(manifest.access, 'access');
  assertExactKeys(access, ['backup_reader', 'restore_writer'], 'access');
  const backupReader = assertCredentialEvidence(access.backup_reader, 'backup_reader', BACKUP_READ_SCOPE);
  const restoreWriter = assertCredentialEvidence(access.restore_writer, 'restore_writer', RESTORE_WRITE_SCOPE);
  if (backupReader.credential_id === restoreWriter.credential_id) throw new Error('backup_restore_credentials_not_separated');
  const appCredentials = new Set(policy.ordinary_application_credential_ids);
  if (appCredentials.has(backupReader.credential_id) || appCredentials.has(restoreWriter.credential_id)) {
    throw new Error('backup_credentials_overlap_application');
  }

  const provenance = requireObject(manifest.provenance, 'provenance');
  assertExactKeys(provenance, ['provider', 'snapshot_id', 'evidence_ref'], 'provenance');
  requireText(provenance.provider, 'provenance_provider', 160);
  requireText(provenance.snapshot_id, 'provenance_snapshot_id', 240);
  requireText(provenance.evidence_ref, 'provenance_evidence_ref');

  const signature = requireObject(manifest.signature, 'signature');
  assertExactKeys(signature, ['algorithm', 'key_id', 'value_base64'], 'signature');
  if (signature.algorithm !== 'ED25519') throw new Error('backup_signature_algorithm_unsupported');
  const signerKeyId = requireText(signature.key_id, 'signature_key_id', 160);
  if (signerKeyId !== policy.trusted_signer_key_id) throw new Error('backup_signer_untrusted');
  const encodedSignature = requireText(signature.value_base64, 'signature_value', 512);
  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(encodedSignature, 'base64');
  } catch {
    throw new Error('backup_signature_invalid');
  }
  const signed = manifestInput as SignedBackupManifest;
  if (!cryptoVerify(null, canonicalBytes(unsignedManifest(signed)), policy.trusted_signer_public_key, signatureBytes)) {
    throw new Error('backup_signature_invalid');
  }

  return structuredClone(signed);
}

export function assertIsolatedRestore(policy: RestoreIsolationPolicy, sourceEnvironment: string): void {
  if (policy.mode !== 'ISOLATED_RESTORE') throw new Error('restore_mode_not_isolated');
  if (policy.target_database_id === policy.source_database_id) throw new Error('restore_target_matches_source_database');
  if (policy.target_environment === sourceEnvironment || policy.production_environment_ids.includes(policy.target_environment)) {
    throw new Error('restore_target_environment_not_isolated');
  }
  if (
    policy.external_effects.github !== false
    || policy.external_effects.archive_writes !== false
    || policy.external_effects.provider_inference !== false
    || policy.external_effects.settlement !== false
  ) throw new Error('restore_external_effects_not_disabled');
}

function recordViolation(violations: string[], code: string, id: string): void {
  violations.push(`${code}:${id}`);
}

export async function verifyRestoredChallengeAuthority(db: Kysely<DatabaseSchema>): Promise<RestoredAuthorityReport> {
  const challenges = (await sql<{challenge_id: string}>`select challenge_id from challenges order by challenge_id`.execute(db)).rows;
  const archiveRows = (await sql<{
    submission_id: string; challenge_id: string; entry_id: string; terms_digest: string; manifest_digest: string;
  }>`select submission_id, challenge_id, entry_id, terms_digest, manifest_digest from challenge_submission_archives order by submission_id`.execute(db)).rows;
  const archiveBySubmission = new Map(archiveRows.map((row) => [row.submission_id, row]));
  const violations: string[] = [];
  let contractCount = 0;
  let submissionCount = 0;
  let qualificationCount = 0;
  let decisionCount = 0;
  let receiptCount = 0;

  for (const {challenge_id: challengeId} of challenges) {
    const snapshot = await readChallengeSnapshot(db, challengeId);
    if (!snapshot) {
      recordViolation(violations, 'challenge_snapshot_missing', challengeId);
      continue;
    }
    submissionCount += snapshot.submissions.length;
    qualificationCount += snapshot.qualifications.length;
    decisionCount += snapshot.decisions.length;
    receiptCount += snapshot.receipts.length;

    const entryIds = new Set(snapshot.entries.map((row) => row.entry_id));
    if (!snapshot.contract) {
      if (snapshot.entries.length || snapshot.submissions.length || snapshot.qualifications.length || snapshot.decisions.length || snapshot.receipts.length) {
        recordViolation(violations, 'challenge_contract_missing_with_authority', challengeId);
      }
      continue;
    }
    contractCount += 1;

    try {
      const contract = assertFrozenBuildContract(snapshot.contract.contract_json);
      if (
        snapshot.challenge.current_contract_version !== snapshot.contract.contract_version
        || snapshot.challenge.current_terms_digest !== snapshot.contract.terms_digest
        || contract.contract_version !== snapshot.contract.contract_version
        || contract.terms_digest !== snapshot.contract.terms_digest
      ) recordViolation(violations, 'challenge_contract_pointer_invalid', challengeId);

      const durable = canonicalizeJson({
        mechanism_version: snapshot.challenge.mechanism_version,
        settlement_policy_version: snapshot.challenge.settlement_policy_version,
        ip_terms_version: snapshot.challenge.ip_terms_version,
        slot_limit: snapshot.challenge.slot_limit,
        activation_minimum: snapshot.challenge.activation_minimum,
        entry_deadline: snapshot.challenge.entry_deadline.getTime(),
        build_start: snapshot.challenge.build_start.getTime(),
        submission_deadline: snapshot.challenge.submission_deadline.getTime(),
        appeal_window_ms: Number(snapshot.challenge.appeal_window_ms),
        review_deadline: snapshot.challenge.review_deadline.getTime(),
      }).sha256;
      const frozen = canonicalizeJson({
        mechanism_version: contract.mechanism_version,
        settlement_policy_version: contract.settlement_policy_version,
        ip_terms_version: contract.ip_terms_version,
        slot_limit: contract.slot_limit,
        activation_minimum: contract.activation_minimum,
        entry_deadline: contract.entry_deadline,
        build_start: contract.build_start,
        submission_deadline: contract.submission_deadline,
        appeal_window_ms: contract.appeal_window_ms,
        review_deadline: contract.review_deadline,
      }).sha256;
      if (durable !== frozen) recordViolation(violations, 'challenge_contract_authority_diverged', challengeId);
    } catch {
      recordViolation(violations, 'challenge_contract_invalid', challengeId);
    }

    const submissionById = new Map(snapshot.submissions.map((row) => [row.submission_id, row]));
    for (const submission of snapshot.submissions) {
      try {
        const manifest = assertSubmissionManifest(submission.manifest_json);
        if (
          canonicalizeJson(manifest).sha256 !== submission.manifest_digest
          || manifest.challenge_id !== challengeId
          || manifest.entry_id !== submission.entry_id
          || manifest.terms_digest !== submission.terms_digest
          || !entryIds.has(submission.entry_id)
          || submission.terms_digest !== snapshot.contract.terms_digest
        ) recordViolation(violations, 'submission_lineage_invalid', submission.submission_id);
      } catch {
        recordViolation(violations, 'submission_manifest_invalid', submission.submission_id);
      }

      const archive = archiveBySubmission.get(submission.submission_id);
      if (archive && (
        archive.challenge_id !== submission.challenge_id
        || archive.entry_id !== submission.entry_id
        || archive.terms_digest !== submission.terms_digest
        || archive.manifest_digest !== submission.manifest_digest
      )) recordViolation(violations, 'archive_lineage_invalid', submission.submission_id);
    }

    for (const qualification of snapshot.qualifications) {
      const submission = submissionById.get(qualification.submission_id);
      const body = qualification.qualification_json as {overall?: unknown} | null;
      if (
        !submission
        || submission.challenge_id !== qualification.challenge_id
        || submission.entry_id !== qualification.entry_id
        || submission.terms_digest !== qualification.terms_digest
        || qualification.challenge_id !== challengeId
        || body?.overall !== qualification.result
      ) recordViolation(violations, 'qualification_lineage_invalid', qualification.qualification_id);
    }

    let finalQualifierIds: string[] | null = null;
    let selectedEntryId: string | null = null;
    for (const decision of snapshot.decisions) {
      if (canonicalizeJson(decision.decision_json).sha256 !== decision.decision_digest) {
        recordViolation(violations, 'decision_digest_invalid', decision.decision_id);
      }
      if (decision.entry_id && !entryIds.has(decision.entry_id)) recordViolation(violations, 'decision_entry_lineage_invalid', decision.decision_id);
      if (decision.decision_type === 'FINAL_QUALIFIERS') {
        const body = decision.decision_json as {final_qualifier_ids?: unknown} | null;
        if (!Array.isArray(body?.final_qualifier_ids) || body.final_qualifier_ids.some((id) => typeof id !== 'string' || !entryIds.has(id))) {
          recordViolation(violations, 'final_qualifiers_invalid', decision.decision_id);
        } else {
          finalQualifierIds = body.final_qualifier_ids as string[];
          if (new Set(finalQualifierIds).size !== finalQualifierIds.length) recordViolation(violations, 'final_qualifiers_duplicate', decision.decision_id);
        }
      }
      if (decision.decision_type === 'SELECTION') {
        const body = decision.decision_json as {selected_entry_id?: unknown} | null;
        if (typeof body?.selected_entry_id !== 'string' || !entryIds.has(body.selected_entry_id)) {
          recordViolation(violations, 'selection_invalid', decision.decision_id);
        } else selectedEntryId = body.selected_entry_id;
      }
    }
    if (selectedEntryId && (!finalQualifierIds || !finalQualifierIds.includes(selectedEntryId))) {
      recordViolation(violations, 'selection_not_final_qualifier', challengeId);
    }

    if (snapshot.receipts.length > 0) {
      try {
        buildStageG3ReceiptTransport(snapshot);
      } catch {
        recordViolation(violations, 'receipt_lineage_invalid', challengeId);
      }
    }
  }

  const report: RestoredAuthorityReport = {
    schema_version: 'inkubator.restore-authority-report/1.0',
    challenge_count: challenges.length,
    contract_count: contractCount,
    submission_count: submissionCount,
    qualification_count: qualificationCount,
    decision_count: decisionCount,
    receipt_count: receiptCount,
    archive_count: archiveRows.length,
    violations,
  };
  if (violations.length > 0) throw new Error(`restore_authority_invalid:${violations.join(',')}`);
  return report;
}
