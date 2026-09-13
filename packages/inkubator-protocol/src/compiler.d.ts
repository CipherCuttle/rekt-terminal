export type CompilerInputProvenance = 'SOURCE' | 'MODEL_PROPOSAL' | 'ORGANIZER_ACCEPTED';
export type CompilerProvenance = CompilerInputProvenance | 'DETERMINISTIC_RULE';
export type CompilerStatus = 'READY' | 'NEEDS_DECISION' | 'UNSUPPORTED';
export type CompilerRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type CompilerQualityLevel = 'STANDARD' | 'ELEVATED' | 'STRICT';

export interface CompilerRequirement {
  key: string;
  value: string | number | boolean | null;
  provenance: CompilerInputProvenance;
}

export interface CompilerKnowledgeItem {
  kind: 'KNOWN' | 'ASSUMED' | 'UNKNOWN';
  key: string;
  material: boolean;
  value?: string | number | boolean | null;
  provenance: CompilerInputProvenance;
}

export interface CompilerStateKnowledgeItem extends Omit<CompilerKnowledgeItem, 'provenance'> {
  provenance: CompilerProvenance;
}

export interface CompilerCriterion {
  id: string;
  description: string;
  mandatory: boolean;
  provenance: CompilerProvenance;
}

export interface CompilerInputCriterion extends Omit<CompilerCriterion, 'provenance'> {
  provenance: CompilerInputProvenance;
}

export interface CompilerProposal {
  schema_version: 'inkubator.compiler-proposal/1.0';
  source_intent: string;
  requirements: CompilerRequirement[];
  knowledge: CompilerKnowledgeItem[];
  outcome_criteria: CompilerInputCriterion[];
  delivery_criteria: CompilerInputCriterion[];
  preferences: Record<string, unknown>;
}

export interface CompilerBlueprint {
  schema_version: 'inkubator.compiler-blueprint/1.0';
  id: string;
  version: string;
  applicability: {
    required_true: string[];
    any_true: string[];
    excluded_true: string[];
  };
  default_assumptions: CompilerStateKnowledgeItem[];
  required_questions: string[];
  sensitivity_points: string[];
  reference_architecture: Record<string, unknown>;
  supported_production_envelope: Record<string, unknown>;
  risk_profile: CompilerRiskLevel;
  acceptance_modules: string[];
  known_limits: string[];
  health: 'ACTIVE' | 'EXPERIMENTAL' | 'RETIRED';
}

export interface CompilerState {
  schema_version: 'inkubator.compiler-state/1.0';
  compiler_version: 'inkubator.compiler/1.0';
  source_intent: string;
  project_fingerprint: {project_class: string; signals: string[]};
  knowledge: CompilerStateKnowledgeItem[];
  requirements: CompilerRequirement[];
  production_envelope: {
    criteria: CompilerCriterion[];
    facts: Array<{key: string; value: string | number | boolean | null; provenance: 'DETERMINISTIC_RULE'; rule_id: string}>;
  };
  risk_profile: {level: CompilerRiskLevel; reasons: string[]};
  quality_profile: {level: CompilerQualityLevel; reasons: string[]};
  blueprint_candidates: Array<{id: string; version: string}>;
  selected_blueprint: {id: string; version: string} | null;
  causal_facts: Array<{key: string; value: string | number | boolean | null; provenance: 'DETERMINISTIC_RULE'; rule_id: string}>;
  sensitivity_points: string[];
  outcome_contract_candidate: {criteria: CompilerCriterion[]};
  delivery_contract_candidate: {criteria: CompilerCriterion[]};
  preferences: Record<string, unknown>;
  reference_architecture_candidate: Record<string, unknown>;
  acceptance_plan: {modules: string[]};
  questions: Array<{id: string; prompt: string; blocking: boolean; rule_id: string}>;
  findings: Array<{severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; code: string; message: string; rule_id: string}>;
  unresolved_decisions: Array<{id: string; reason: string}>;
  status: CompilerStatus;
}

export declare const COMPILER_PROPOSAL_SCHEMA_VERSION: 'inkubator.compiler-proposal/1.0';
export declare const COMPILER_STATE_SCHEMA_VERSION: 'inkubator.compiler-state/1.0';
export declare const COMPILER_BLUEPRINT_SCHEMA_VERSION: 'inkubator.compiler-blueprint/1.0';
export declare const COMPILER_VERSION: 'inkubator.compiler/1.0';
export declare const COMPILER_STATUSES: readonly CompilerStatus[];
export declare const PROVENANCE_KINDS: readonly CompilerProvenance[];
export declare const INPUT_PROVENANCE_KINDS: readonly CompilerInputProvenance[];
export declare const RISK_LEVELS: readonly CompilerRiskLevel[];
export declare const QUALITY_LEVELS: readonly CompilerQualityLevel[];
export declare const BLUEPRINT_HEALTH: readonly ['ACTIVE', 'EXPERIMENTAL', 'RETIRED'];
export declare const CAUSAL_RULES: readonly unknown[];

export declare function assertCompilerProposal(proposal: unknown): CompilerProposal;
export declare function assertCompilerBlueprint(blueprint: unknown): CompilerBlueprint;
export declare function compileProposal(proposal: CompilerProposal, options?: {blueprints?: CompilerBlueprint[]}): CompilerState;
export declare function assertCompilerState(state: unknown): CompilerState;
export declare function buildBuildContractCandidate(compilerState: CompilerState, authorityFields: Record<string, unknown>): Readonly<Record<string, unknown>>;
