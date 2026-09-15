import type {AcceptanceBinding} from '@rekt-ink/protocol/acceptance-manifest';
import type {QualificationCriterionResult} from '@rekt-ink/protocol/challenge';
import {canonicalizeJson} from './canonical-json.js';
import type {ChallengeSubmissionArchiveStatus} from './database.js';

export const TRUSTED_TEST_MODULE_SCHEMA_VERSION = 'inkubator.test-module/1.0' as const;
export const TRUSTED_TEST_RUNNER_ENGINE_VERSION = 'trusted-fact-runner/1.0' as const;

type TrustedExecutorKind = 'SUBMISSION_LINEAGE' | 'ARCHIVE_STATUS_MAP';
type EmptyInputPolicy = 'EMPTY';

export interface TrustedTestModuleDescriptor {
  schema_version: typeof TRUSTED_TEST_MODULE_SCHEMA_VERSION;
  runner_engine_version: typeof TRUSTED_TEST_RUNNER_ENGINE_VERSION;
  module_id: string;
  module_version: string;
  executor_kind: TrustedExecutorKind;
  authority: string;
  semantics: string;
  config_policy: EmptyInputPolicy;
  fixture_policy: EmptyInputPolicy;
  blocked_archive_states: ChallengeSubmissionArchiveStatus[];
  archive_digest_required_states: ChallengeSubmissionArchiveStatus[];
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
  runner_engine_version: TRUSTED_TEST_RUNNER_ENGINE_VERSION,
  module_id: 'submission-lineage-integrity',
  module_version: '1.0.0',
  executor_kind: 'SUBMISSION_LINEAGE',
  authority: 'canonical challenge_submissions row + Stage-B final-submission law',
  semantics: 'PASS iff the durable final row matches the protocol-selected complete submission manifest under the frozen terms digest.',
  config_policy: 'EMPTY',
  fixture_policy: 'EMPTY',
  blocked_archive_states: [],
  archive_digest_required_states: [],
  result_map: {MATCH: 'PASS'},
} satisfies TrustedTestModuleDescriptor);

const ARCHIVE_CAPTURE = Object.freeze({
  schema_version: TRUSTED_TEST_MODULE_SCHEMA_VERSION,
  runner_engine_version: TRUSTED_TEST_RUNNER_ENGINE_VERSION,
  module_id: 'archive-capture-integrity',
  module_version: '1.0.0',
  executor_kind: 'ARCHIVE_STATUS_MAP',
  authority: 'canonical challenge_submission_archives row',
  semantics: 'PENDING is not an observation and cannot qualify; PASS for CAPTURED; DISPUTED for terminal PLATFORM_UNAVAILABLE; FAIL for BUILDER_CAUSED_UNAVAILABLE or UNSUPPORTED_SOURCE, after exact final-submission lineage validation.',
  config_policy: 'EMPTY',
  fixture_policy: 'EMPTY',
  blocked_archive_states: ['PENDING'],
  archive_digest_required_states: ['CAPTURED'],
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

function assertBindingPolicy(
  descriptor: TrustedTestModuleDescriptor,
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
): void {
  if (descriptor.config_policy !== 'EMPTY' || Object.keys(binding.config).length !== 0) {
    throw new Error('challenge_test_runner_config_unsupported');
  }
  if (descriptor.fixture_policy !== 'EMPTY' || binding.fixture_reference_ids.length !== 0) {
    throw new Error('challenge_test_runner_fixture_unsupported');
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

function automatedObservation(
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
  result: QualificationCriterionResult,
  evidence_refs: string[],
): TrustedRunnerObservation {
  return {
    criterion_id: binding.criterion_id,
    mode: 'AUTOMATED',
    module_id: binding.module_id,
    module_version: binding.module_version,
    module_digest: binding.module_digest,
    result,
    evidence_refs,
  };
}

function runSubmissionLineage(
  descriptor: TrustedTestModuleDescriptor,
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
  context: TrustedRunnerContext,
): TrustedRunnerObservation {
  requireSelectedLineage(context);
  const result = descriptor.result_map.MATCH;
  if (!result) throw new Error('challenge_test_runner_contract_invalid');
  return automatedObservation(binding, result, [
    evidenceRef('challenge-submission', context.submission_id, context.selected_manifest_digest),
  ]);
}

function runArchiveStatusMap(
  descriptor: TrustedTestModuleDescriptor,
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
  context: TrustedRunnerContext,
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
  if (descriptor.blocked_archive_states.includes(archive.status)) throw new Error('challenge_test_archive_pending');
  const result = descriptor.result_map[archive.status];
  if (!result) throw new Error('challenge_test_archive_status_unsupported');
  if (
    descriptor.archive_digest_required_states.includes(archive.status)
    && !/^[0-9a-f]{64}$/.test(archive.archive_digest ?? '')
  ) {
    throw new Error('challenge_test_archive_digest_missing');
  }
  return automatedObservation(binding, result, [
    evidenceRef('challenge-submission', context.submission_id, context.selected_manifest_digest),
    evidenceRef('challenge-archive', context.submission_id, archive.status, archive.archive_digest ?? archive.reason_code),
  ]);
}

export function runTrustedTestModule(
  binding: Extract<AcceptanceBinding, {mode: 'AUTOMATED'}>,
  context: TrustedRunnerContext,
): TrustedRunnerObservation {
  const descriptor = MODULES.find((candidate) =>
    candidate.module_id === binding.module_id
    && candidate.module_version === binding.module_version
    && moduleDigest(candidate) === binding.module_digest,
  );
  if (!descriptor) throw new Error('challenge_test_runner_unsupported');
  assertBindingPolicy(descriptor, binding);
  if (descriptor.executor_kind === 'SUBMISSION_LINEAGE') return runSubmissionLineage(descriptor, binding, context);
  if (descriptor.executor_kind === 'ARCHIVE_STATUS_MAP') return runArchiveStatusMap(descriptor, binding, context);
  throw new Error('challenge_test_runner_contract_invalid');
}
