import {InkubatorApiClient, InkubatorApiError, type FetchLike} from './generated/inkubator-api-client';

const platformFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export interface ProjectPendingAssistView {
  assist_id: string;
  beacon_id: string;
  project_id: string;
  offered_by_player_id: string;
  offered_by_display_name: string;
  message: string;
  state: 'OFFERED';
  offered_at: string;
}

export interface ProjectPendingAssistsView {
  schema_version: 'project.pending_assists.private.v1';
  project_id: string;
  assists: ProjectPendingAssistView[];
}

export interface GitHubReconcileView {
  schema_version: 'github.reconcile.private.v1';
  installation_count: number;
  repositories_connected: number;
  warnings: string[];
}

export interface PublicBuildContractSummary {
  contract_version: string;
  terms_digest: string;
  title: string;
  brief: string;
  outcome_criteria: Array<{id: string; description: string; mandatory: boolean}>;
  production_criteria: Array<{id: string; description: string; mandatory: boolean}>;
  delivery_criteria: Array<{id: string; description: string; mandatory: boolean}>;
  normative_constraints: Array<{id: string; description: string; mandatory: boolean}>;
  normative_references: Array<{id: string; kind: string; content_digest: string; source_url?: string}>;
  informational_references: Array<{id: string; url: string}>;
  prize_minor_units: number;
  prize_display?: string;
  settlement_asset: string;
}

export interface PublicChallengeView {
  schema_version: 'challenge.public.v1';
  challenge_id: string;
  status: string;
  mechanism_version: string;
  settlement_policy_version: string;
  ip_terms_version: string;
  current_contract_version: string | null;
  current_terms_digest: string | null;
  has_frozen_contract: boolean;
  contract_summary?: PublicBuildContractSummary | null;
  organizer?: {display_name: string; github_login: string | null} | null;
  slot_limit: number;
  activation_minimum: number;
  entry_deadline: string;
  build_start: string;
  submission_deadline: string;
  appeal_window_ms: number;
  review_deadline: string;
  entry_count: number;
  submission_count: number;
  qualification_count: number;
  receipt_count: number;
  created_at: string;
  updated_at: string;
}

export interface StageIChallengeCreateInput {
  request_id: string;
  challenge_id: string;
  slot_limit: number;
  activation_minimum: number;
  entry_deadline_ms: number;
  submission_deadline_ms: number;
  appeal_window_ms: number;
  review_deadline_ms: number;
}

export interface StageIChallengeEntryView {
  schema_version: 'challenge.entry.joined.v1';
  challenge_id: string;
  entry_id: string;
  state: string;
  terms_digest: string;
}

export interface BuilderCapsuleFileView {
  path: string;
  media_type: 'text/markdown' | 'application/json';
  sha256: string;
  content: string;
}

export interface BuilderCapsuleView {
  schema_version: 'builder-capsule.v1';
  challenge_id: string;
  entry_id: string;
  entry_state: string;
  contract_version: string;
  terms_digest: string;
  submission_deadline: string;
  files: BuilderCapsuleFileView[];
}

export interface StageISubmitCredentialView {
  schema_version: 'devkit.token.issued.v1';
  token_id: string;
  credential_class: 'CLI';
  label: string;
  scopes: ['challenge:submit'];
  token: string;
  expires_at: string;
  challenge_id: string;
  purpose: 'FINAL_SUBMISSION_ONLY';
}

export interface RevealArenaCriterionView {
  criterion_id: string;
  group: 'OUTCOME' | 'PRODUCTION_ENVELOPE' | 'DELIVERY' | 'NORMATIVE_CONSTRAINT';
  description: string;
}

export interface RevealArenaSubmissionView {
  entry_id: string;
  submission_id: string;
  submission_version: number;
  accepted_at: string;
  immutable_source_reference: {kind: string; value: string};
  artifact_digest: string;
  optional_live_url?: string;
  archive: {
    status: string;
    archive_digest: string | null;
    reason_code: string | null;
    observed_at: string | null;
  } | null;
}

export interface RevealArenaView {
  schema_version: 'challenge.reveal-arena/1.0';
  challenge_id: string;
  contract_version: string;
  terms_digest: string;
  reveal_state: 'REVEALED';
  criteria: RevealArenaCriterionView[];
  submissions: RevealArenaSubmissionView[];
}

export interface TestArenaModuleCatalogView {
  schema_version: 'challenge.test-module-catalog/1.0';
  modules: Array<Record<string, unknown>>;
}

export interface StageIHumanObservationInput {
  criterion_id: string;
  result: 'PASS' | 'FAIL' | 'DISPUTED';
  evidence_refs: string[];
}

export interface StageIQualificationInput {
  request_id: string;
  qualification_id: string;
  acceptance_manifest_reference_id: string;
  acceptance_manifest: Record<string, unknown>;
  human_observations: StageIHumanObservationInput[];
}

export interface StageIQualificationView {
  schema_version: 'challenge.test-arena-qualification/1.0';
  challenge_id: string;
  entry_id: string;
  submission_id: string;
  qualification_id: string;
  qualification_version: string;
  result: 'QUALIFIED' | 'NOT_QUALIFIED' | 'DISPUTED';
  execution_digest: string;
}

export interface QualifierComparisonView {
  schema_version: 'challenge.qualifier-comparison/1.0';
  challenge_id: string;
  contract_version: string;
  terms_digest: string;
  status: string;
  preferences: Record<string, unknown>;
  final_qualifier_ids: string[];
  selected_entry_id: string | null;
  qualifiers: RevealArenaSubmissionView[];
}

export interface StageISelectionInput {
  request_id: string;
  decision_id: string;
  selected_entry_id: string;
}

export interface StageISelectionView {
  schema_version: 'challenge.selection/1.0';
  challenge_id: string;
  decision_id: string;
  decision_version: string;
  selected_entry_id: string;
  decision_digest: string;
}

export interface ChallengeBaseReceiptView {
  protocol_receipt_id: string;
  schema_version: 'inkubator.challenge-receipt/1.0';
  digest: string;
  created_at: string;
  challenge_id: string;
  terms_digest: string;
  contract_version: string;
  mechanism_version: string;
  settlement_policy_version: string;
  ip_terms_version: string;
  terminal_outcome: string;
  ip_transfer_fact: string;
  settlement_asset: string;
  total_minor_units: number;
  winner_entry_id: string | null;
}

export interface ChallengeReceiptCorrectionView {
  protocol_receipt_id: string;
  schema_version: 'inkubator.challenge-receipt-correction/1.0';
  digest: string;
  created_at: string;
  supersedes_protocol_receipt_id: string;
}

export interface ChallengeReceiptTransportView {
  schema_version: 'challenge.receipt-transport/1.0';
  challenge_id: string;
  receipts: Array<ChallengeBaseReceiptView | ChallengeReceiptCorrectionView>;
}

export type CompilerInputProvenance = 'SOURCE' | 'MODEL_PROPOSAL' | 'ORGANIZER_ACCEPTED';
export interface CompilerProposalInput {
  schema_version: 'inkubator.compiler-proposal/1.0';
  source_intent: string;
  requirements: Array<{key: string; value: string | number | boolean | null; provenance: CompilerInputProvenance}>;
  knowledge: Array<{kind: 'KNOWN' | 'ASSUMED' | 'UNKNOWN'; key: string; material: boolean; value?: string | number | boolean | null; provenance: CompilerInputProvenance}>;
  outcome_criteria: Array<{id: string; description: string; mandatory: boolean; provenance: CompilerInputProvenance}>;
  delivery_criteria: Array<{id: string; description: string; mandatory: boolean; provenance: CompilerInputProvenance}>;
  preferences: Record<string, unknown>;
}

export interface CompilerStateView {
  schema_version: 'inkubator.compiler-state/1.0';
  compiler_version: string;
  source_intent: string;
  project_fingerprint: {project_class: string; signals: string[]};
  knowledge: Array<{kind: 'KNOWN' | 'ASSUMED' | 'UNKNOWN'; key: string; material: boolean; value?: unknown; provenance: string}>;
  requirements: Array<{key: string; value: unknown; provenance: string}>;
  production_envelope: {
    criteria: Array<{id: string; description: string; mandatory: boolean; provenance: string}>;
    facts: Array<{key: string; value: unknown; provenance: 'DETERMINISTIC_RULE'; rule_id: string}>;
  };
  risk_profile: {level: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[]};
  quality_profile: {level: 'STANDARD' | 'ELEVATED' | 'STRICT'; reasons: string[]};
  blueprint_candidates: Array<{id: string; version: string}>;
  selected_blueprint: {id: string; version: string} | null;
  causal_facts: Array<{key: string; value: unknown; provenance: 'DETERMINISTIC_RULE'; rule_id: string}>;
  sensitivity_points: string[];
  outcome_contract_candidate: {criteria: Array<{id: string; description: string; mandatory: boolean; provenance: string}>};
  delivery_contract_candidate: {criteria: Array<{id: string; description: string; mandatory: boolean; provenance: string}>};
  preferences: Record<string, unknown>;
  acceptance_plan: {modules: string[]};
  questions: Array<{id: string; prompt: string; blocking: boolean; rule_id: string}>;
  findings: Array<{severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; code: string; message: string; rule_id: string}>;
  unresolved_decisions: Array<{id: string; reason: string}>;
  reference_architecture_candidate: Record<string, unknown>;
  status: 'READY' | 'NEEDS_DECISION' | 'UNSUPPORTED';
}

export interface BuildContractPreviewAuthorityInput {
  contract_version: string;
  title: string;
  brief: string;
  preferences: Record<string, unknown>;
  normative_constraints: Array<{id: string; description: string; mandatory: boolean}>;
  normative_references: Array<{id: string; kind: string; content_digest: string; source_url?: string}>;
  informational_references?: Array<{id: string; url: string}>;
  prize_minor_units: number;
  prize_display?: string;
  settlement_asset: string;
}

export interface FrozenBuildContractView extends Record<string, unknown> {
  schema_version: string;
  challenge_id: string;
  contract_version: string;
  title: string;
  brief: string;
  terms_digest: string;
}

export interface BuildContractPreviewView {
  schema_version: 'build-contract.preview.v1';
  canonical: false;
  persisted: false;
  contract: FrozenBuildContractView;
}

export interface CanonicalBuildContractView {
  schema_version: 'build-contract.canonical.v1';
  canonical: true;
  persisted: true;
  challenge_id: string;
  contract_version: string;
  terms_digest: string;
  frozen_at: string;
}

export class InkubatorProductApiClient extends InkubatorApiClient {
  constructor(
    private readonly productBaseUrl = '',
    private readonly productFetch: FetchLike = platformFetch,
  ) {
    super(productBaseUrl, productFetch);
  }

  private async productRequest<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.productFetch(
      `${this.productBaseUrl.replace(/\/$/, '')}${path}`,
      {...init, credentials: 'include'},
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {error?: unknown} | null;
      const message = typeof body?.error === 'string' ? body.error : `request_failed_${response.status}`;
      throw new InkubatorApiError(response.status, message);
    }
    return await response.json() as T;
  }

  async getProjectPendingAssists(projectId: string): Promise<ProjectPendingAssistsView> {
    return this.productRequest<ProjectPendingAssistsView>(
      `/v1/projects/${encodeURIComponent(projectId)}/pending-assists`,
      {method: 'GET'},
    );
  }

  async syncGitHubAccess(): Promise<GitHubReconcileView> {
    return this.productRequest<GitHubReconcileView>('/v1/github/reconcile', {method: 'POST'});
  }

  async createChallenge(input: StageIChallengeCreateInput): Promise<PublicChallengeView> {
    return this.productRequest<PublicChallengeView>('/v1/challenges', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(input),
    });
  }

  async getChallenge(challengeId: string): Promise<PublicChallengeView> {
    return this.productRequest<PublicChallengeView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}`,
      {method: 'GET'},
    );
  }

  async launchStageIMockChallenge(challengeId: string, requestId: string): Promise<PublicChallengeView> {
    return this.productRequest<PublicChallengeView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/stage-i-mock-launch`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({request_id: requestId}),
      },
    );
  }

  async joinChallenge(
    challengeId: string,
    requestId: string,
    entryId: string,
    expectedTermsDigest: string,
  ): Promise<StageIChallengeEntryView> {
    return this.productRequest<StageIChallengeEntryView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/entries`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          request_id: requestId,
          entry_id: entryId,
          expected_terms_digest: expectedTermsDigest,
        }),
      },
    );
  }

  async getMyBuild(challengeId: string): Promise<BuilderCapsuleView> {
    return this.productRequest<BuilderCapsuleView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/my-build`,
      {method: 'GET'},
    );
  }

  async mintSubmitCredential(
    challengeId: string,
    requestId: string,
    expiresInSeconds = 3600,
  ): Promise<StageISubmitCredentialView> {
    return this.productRequest<StageISubmitCredentialView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/submit-credential`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({request_id: requestId, expires_in_seconds: expiresInSeconds}),
      },
    );
  }

  async getRevealArena(challengeId: string): Promise<RevealArenaView> {
    return this.productRequest<RevealArenaView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/reveal-arena`,
      {method: 'GET'},
    );
  }

  async getTestArenaModules(): Promise<TestArenaModuleCatalogView> {
    return this.productRequest<TestArenaModuleCatalogView>('/v1/test-arena/modules', {method: 'GET'});
  }

  async qualifyEntry(
    challengeId: string,
    entryId: string,
    input: StageIQualificationInput,
  ): Promise<StageIQualificationView> {
    return this.productRequest<StageIQualificationView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/test-arena/entries/${encodeURIComponent(entryId)}/qualify`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(input),
      },
    );
  }

  async getQualifierComparison(challengeId: string): Promise<QualifierComparisonView> {
    return this.productRequest<QualifierComparisonView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/qualifier-comparison`,
      {method: 'GET'},
    );
  }

  async selectQualifier(challengeId: string, input: StageISelectionInput): Promise<StageISelectionView> {
    return this.productRequest<StageISelectionView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/selection`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(input),
      },
    );
  }

  async getReceipts(challengeId: string): Promise<ChallengeReceiptTransportView> {
    return this.productRequest<ChallengeReceiptTransportView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/receipts`,
      {method: 'GET'},
    );
  }

  async compileChallenge(body: CompilerProposalInput): Promise<CompilerStateView> {
    return this.productRequest<CompilerStateView>('/v1/compiler/compile', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body),
    });
  }

  async previewBuildContract(
    challengeId: string,
    compilerState: CompilerStateView,
    authority: BuildContractPreviewAuthorityInput,
  ): Promise<BuildContractPreviewView> {
    return this.productRequest<BuildContractPreviewView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/build-contract-preview`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({compiler_state: compilerState, authority}),
      },
    );
  }

  async persistBuildContract(
    challengeId: string,
    requestId: string,
    compilerState: CompilerStateView,
    authority: BuildContractPreviewAuthorityInput,
    expectedTermsDigest: string,
  ): Promise<CanonicalBuildContractView> {
    return this.productRequest<CanonicalBuildContractView>(
      `/v1/challenges/${encodeURIComponent(challengeId)}/build-contract`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          request_id: requestId,
          compiler_state: compilerState,
          authority,
          expected_terms_digest: expectedTermsDigest,
        }),
      },
    );
  }
}

export function createInkubatorApiClient(baseUrl = '', fetchImpl?: FetchLike): InkubatorProductApiClient {
  return new InkubatorProductApiClient(baseUrl, fetchImpl ?? platformFetch);
}
