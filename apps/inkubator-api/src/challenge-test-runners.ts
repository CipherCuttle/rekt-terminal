import type {AcceptanceBinding} from '@rekt-ink/protocol/acceptance-manifest';
import type {QualificationCriterionResult} from '@rekt-ink/protocol/challenge';
import {canonicalizeJson} from './canonical-json.js';
import type {ChallengeSubmissionArchiveStatus} from './database.js';

export const TRUSTED_TEST_MODULE_SCHEMA_VERSION = 'inkubator.test-module/1.0' as const;

export interface TrustedTestModuleDescriptor {
  schema_version: typeof TRUSTED_TEST_MODULE_SCHEMA_VERSION;
  module_id: string;
  module_version: string;
  authority: string;
  semantics: string;
  result_map: Record<string, QualificationCriterionResult>;
}

export interface TrustedTestModuleView extends TrustedTestModuleDescriptor {
  module_digest: string;
}

export interface TrustedRunnerContext {
  challenge_id: string;
  entry_id: string;
  submission_id: string;
  terms_digest: string;
  selected_manifest_digest: string;
  stored_manifest_digest: string;
  stored_is_final: boolean;
  archive: null | {
    submission_id: string;
    challenge_id: string;
    entry_id: string;
    terms_digest: string;
    manifest_digest: string;
    status: ChallengeSubmissionArchiveStatus;
    archive_digest: string | null;
    reason_code: string | null;
  };
}

export interface TrustedRunnerObservation {
  criterion_id: string;
  mode: 'AUTOMATED';
  module_id: string;
  module_version: string;
  module_digest: string;
  result: QualificationCriterionResult;
  evidence_refs: string[];
}

const SUBMISSION_LINEAGE = Object.freeze({
  schema_version: TRUSTED_TEST_MODULE_SCHEMA_VERSION,
  module_id: 'submission-lineage-integrity',
  module_version: '1.0.0',
  authority: 'canonical challenge_submissions row + Stage-B final-submission law',
  semantics: 'PASS iff the durable final row matches the protocol-selected complete submission manifest under the frozen terms digest.',
  result_map: {MATCH: 'PASS'},
} satisfies TrustedTestModuleDescriptor);

const ARCHIVE_CAPTURE = Object.freeze({
  schema_version: TRUSTED_TEST_MODULE_SCHEMA_VERSION,
  module_id: 'archive-capture-integrity',
  module_version: '1.0.0',
  authority: 'canonical challenge_submission_archives row',
  semantics: 'PENDING is not an observation and cannot qualify; PASS for CAPTURED; DISPUTED for terminal PLATFORM_UNAVAILABLE; FAIL for BUILDER_CAUSED_UNAVAILABLE or UNSUPPORTED_SOURCE, after exact final-submission lineage validation.',
  result_map: {
    CAPTURED: 'PASS',
    PLATFORM_UNAVAILABLE: 'DISPUTED',
    BUILDER_CAUSED_UNAVAILABLE: 'FAIL',
    UNSUPPORTED_SOURCE: 'FAIL',
  },
} satisfies TrustedTestModuleDescriptor);

const MODULES = Object.freeze([SUBMISSION_LINEAGE, ARCHIVE_CAPTURE]);

function moduleDigest(descriptor: TrustedTestModuleDescriptor): string {
  return canonicalizeJson(descriptor).sha256;
}

export function trustedTestModuleCatalog(): TrustedTestModuleView[] {
  return MODULES.map((descriptor) => ({...descriptor, module_digest: moduleDigest(descriptor)}));
}

function exactEmptyConfig(binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>): void {
  if (binding.fixture_reference_ids.length !== 0 || Object.keys(binding.config).length !== 0) {
    throw new Error('challenge_test_runner_config_unsupported');
  }
}

function evidenceRef(kind: string, ...parts: Array<string | null>): string {
  return `urn:rekt:${kind}:${parts.map((part) => encodeURIComponent(part ?? 'none')).join(':')}`;
}

function requireSelectedLineage(context: TrustedRunnerContext): void {
  if (!context.stored_is_final) throw new Error('challenge_test_final_row_required');
  if (context.stored_manifest_digest !== context.selected_manifest_digest) {
    throw new Error('challenge_test_final_manifest_mismatch');
  }
}

function runSubmissionLineage(
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
  context: TrustedRunnerContext,
): TrustedRunnerObservation {
  requireSelectedLineage(context);
  return {
    criterion_id: binding.criterion_id,
    mode: 'AUTOMATED',
    module_id: binding.module_id,
    module_version: binding.module_version,
    module_digest: binding.module_digest,
    result: 'PASS',
    evidence_refs: [
      evidenceRef('challenge-submission', context.submission_id, context.selected_manifest_digest),
    ],
  };
}

function runArchiveCapture(
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
  context: TrustedRunnerContext,
  descriptor: TrustedTestModuleDescriptor,
): TrustedRunnerObservation {
  requireSelectedLineage(context);
  const archive = context.archive;
  if (!archive) throw new Error('challenge_test_archive_missing');
  if (
    archive.submission_id !== context.submission_id
    || archive.challenge_id !== context.challenge_id
    || archive.entry_id !== context.entry_id
    || archive.terms_digest !== context.terms_digest
    || archive.manifest_digest !== context.selected_manifest_digest
  ) {
    throw new Error('challenge_test_archive_lineage_mismatch');
  }
  if (archive.status === 'PENDING') throw new Error('challenge_test_archive_pending');
  const result = descriptor.result_map[archive.status];
  if (!result) throw new Error('challenge_test_archive_status_unsupported');
  if (archive.status === 'CAPTURED' && !/^[0-9a-f]{64}$/.test(archive.archive_digest ?? '')) {
    throw new Error('challenge_test_archive_digest_missing');
  }
  return {
    criterion_id: binding.criterion_id,
    mode: 'AUTOMATED',
    module_id: binding.module_id,
    module_version: binding.module_version,
    module_digest: binding.module_digest,
    result,
    evidence_refs: [
      evidenceRef('challenge-submission', context.submission_id, context.selected_manifest_digest),
      evidenceRef('challenge-archive', context.submission_id, archive.status, archive.archive_digest ?? archive.reason_code),
    ],
  };
}

export function runTrustedTestModule(
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
  context: TrustedRunnerContext,
): TrustedRunnerObservation {
  exactEmptyConfig(binding);
  const descriptor = MODULES.find((candidate) =>
    candidate.module_id === binding.module_id
    && candidate.module_version === binding.module_version
    && moduleDigest(candidate) === binding.module_digest,
  );
  if (!descriptor) throw new Error('challenge_test_runner_unsupported');
  if (descriptor.module_id === SUBMISSION_LINEAGE.module_id) return runSubmissionLineage(binding, context);
  if (descriptor.module_id === ARCHIVE_CAPTURE.module_id) return runArchiveCapture(binding, context, descriptor);
  throw new Error('challenge_test_runner_unsupported');
}
