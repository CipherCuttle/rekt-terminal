import type {
  BuildContract,
  QualificationCriterionResult,
  QualificationOverall,
  SubmissionManifest,
} from './challenge.js';
import type {AcceptanceManifest} from './acceptance-manifest.js';

export const TEST_ARENA_EXECUTION_SCHEMA_VERSION: 'inkubator.test-arena-execution/1.0';
export const TEST_ARENA_EXECUTION_PROFILE_VERSION: 'objective-test-arena/1.0';

export interface AutomatedTestArenaObservation {
  criterion_id: string;
  mode: 'AUTOMATED';
  module_id: string;
  module_version: string;
  module_digest: string;
  result: QualificationCriterionResult;
  evidence_refs: string[];
}

export interface HumanTestArenaObservation {
  criterion_id: string;
  mode: 'HUMAN_OBSERVATION';
  result: QualificationCriterionResult;
  evidence_refs: string[];
}

export type TestArenaObservation = AutomatedTestArenaObservation | HumanTestArenaObservation;

export interface TestArenaExecutionInput {
  contract: BuildContract;
  acceptanceManifest: AcceptanceManifest;
  acceptanceManifestReferenceId: string;
  submissionManifest: SubmissionManifest;
  observations: TestArenaObservation[];
}

export interface TestArenaExecution {
  schema_version: 'inkubator.test-arena-execution/1.0';
  execution_profile_version: 'objective-test-arena/1.0';
  challenge_id: string;
  contract_version: string;
  terms_digest: string;
  acceptance_manifest_digest: string;
  qualification_version: string;
  submission: {
    entry_id: string;
    submission_version: number;
    artifact_digest: string;
    immutable_source_reference: SubmissionManifest['immutable_source_reference'];
  };
  observations: TestArenaObservation[];
  qualification: {
    overall: QualificationOverall;
    criteria: Array<{
      criterion_id: string;
      result: QualificationCriterionResult;
      evidence_refs?: string[];
    }>;
  };
}

export interface TestArenaQualification {
  qualification_version: string;
  criterion_results: Array<{
    criterion_id: string;
    result: QualificationCriterionResult;
    evidence_refs: string[];
  }>;
  overall: QualificationOverall;
  execution_digest: string;
  execution: TestArenaExecution;
}

export function qualificationVersionForTestArena(contract: BuildContract, acceptanceManifest: AcceptanceManifest): string;
export function canonicalTestArenaExecution(input: TestArenaExecutionInput): TestArenaExecution;
export function digestTestArenaExecution(input: TestArenaExecutionInput): string;
export function buildTestArenaQualification(input: TestArenaExecutionInput): TestArenaQualification;
