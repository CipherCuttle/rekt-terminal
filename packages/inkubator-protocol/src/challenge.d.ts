export type ChallengeState =
  | 'DRAFT' | 'AWAITING_FUNDING' | 'FUNDED' | 'ENTRY_OPEN' | 'NOT_ACTIVATED'
  | 'BUILDING' | 'SUBMISSIONS_LOCKED' | 'QUALIFICATION' | 'APPEAL_WINDOW'
  | 'FINAL_QUALIFIERS' | 'SELECTION' | 'DEFAULT_RESOLUTION'
  | 'SETTLEMENT_PENDING' | 'SETTLED' | 'RECEIPT_FILED';
export type EntryState = 'SEATED' | 'WITHDRAWN_PRE_BUILD' | 'ACTIVE' | 'SUBMITTED' | 'INVALID_SUBMISSION' | 'ABANDONED';
export type QualificationCriterionResult = 'PASS' | 'FAIL' | 'DISPUTED';
export type QualificationOverall = 'QUALIFIED' | 'NOT_QUALIFIED' | 'DISPUTED';
export type IpTransferFact = 'NOT_TRIGGERED' | 'TRANSFER_TRIGGERED';
export type SettlementIntentType = 'REFUND_PRE_BUILD' | 'REFUND_NO_QUALIFIER' | 'WINNER_PAYOUT' | 'DEFAULT_DISTRIBUTION' | 'CANCELLED_BY_RESOLUTION';

export interface Criterion { id: string; description: string; mandatory: boolean }
export interface CriteriaContainer { criteria?: Criterion[]; [key: string]: unknown }
export interface NormativeReference { id: string; kind: string; content_digest: string; source_url?: string }
export interface KnowledgeItem { kind: 'KNOWN' | 'ASSUMED' | 'UNKNOWN'; key: string; material: boolean; value?: unknown }
export interface BuildContract {
  schema_version: string; challenge_id: string; contract_version: string; mechanism_version: string;
  settlement_policy_version: string; ip_terms_version: string; title: string; brief: string;
  outcome_contract: CriteriaContainer; production_envelope: CriteriaContainer; delivery_contract: CriteriaContainer;
  preferences: Record<string, unknown>; reference_architecture: Record<string, unknown>;
  normative_constraints: Criterion[]; normative_references: NormativeReference[];
  informational_references?: Array<{id: string; url: string}>; knowledge: KnowledgeItem[];
  slot_limit: number; activation_minimum: number; entry_deadline: number; build_start: number;
  submission_deadline: number; appeal_window_ms: number; review_deadline: number;
  prize_minor_units: number; prize_display?: string; settlement_asset: string; terms_digest?: string;
}
export interface ChallengeEntry { entry_id: string; builder_id: string; payout_id: string; state: EntryState; build_start?: number; submission_deadline?: number }
export interface SubmissionManifest {
  schema_version: 'inkubator.submission-manifest/1.0'; challenge_id: string; entry_id: string; terms_digest: string;
  submission_version: number; immutable_source_reference: {kind: 'GIT_COMMIT' | 'CONTENT_ADDRESS' | 'ARCHIVE_DIGEST'; value: string};
  artifact_digest: string; evidence_references: string[]; optional_live_url?: string; accepted_at: number;
}
export interface SettlementRecipient { recipient_id: string; amount_minor_units: number }
export interface SettlementIntent {
  challenge_id: string; terms_digest: string; settlement_policy_version: string; asset: string; type: SettlementIntentType;
  total_minor_units: number; recipients: SettlementRecipient[]; winner_entry_id: string | null;
}
export interface SettlementExecutionFact {
  challenge_id: string; terms_digest: string; settlement_policy_version: string; asset: string;
  total_minor_units: number; recipients: SettlementRecipient[]; finality: 'FINALIZED' | 'PENDING' | 'REORGED' | 'DISPUTED'; execution_id: string;
}

export const BUILD_CONTRACT_SCHEMA_VERSION: string;
export const MECHANISM_VERSION: string;
export const SETTLEMENT_POLICY_VERSION: string;
export const IP_TERMS_VERSION: string;
export const DEFAULT_VERSION_REGISTRY: Readonly<Record<string, readonly string[]>>;
export const CHALLENGE_STATES: readonly ChallengeState[];
export const ENTRY_STATES: readonly EntryState[];
export const ARCHIVE_STATES: readonly string[];
export const QUALIFICATION_RESULTS: readonly QualificationCriterionResult[];
export const QUALIFICATION_OVERALL: readonly QualificationOverall[];
export const IP_TRANSFER_FACTS: readonly IpTransferFact[];
export const SETTLEMENT_INTENT_TYPES: readonly SettlementIntentType[];

export function assertBuildContract(contract: unknown): BuildContract;
export function assertSupportedVersions(contract: BuildContract, registry?: typeof DEFAULT_VERSION_REGISTRY): BuildContract;
export function validateBuildContractReady(contract: BuildContract, registry?: typeof DEFAULT_VERSION_REGISTRY): BuildContract;
export function canonicalBuildContractPayload(contract: BuildContract): BuildContract;
export function digestBuildContract(contract: BuildContract): string;
export function freezeBuildContract(contract: BuildContract, registry?: typeof DEFAULT_VERSION_REGISTRY): Readonly<BuildContract & {terms_digest: string}>;
export function assertFrozenBuildContract(contract: unknown, registry?: typeof DEFAULT_VERSION_REGISTRY): BuildContract;
export function assertContractMatchesTermsDigest(contract: BuildContract, expectedDigest: string): BuildContract;
export function validateFundingFact(contract: BuildContract, fact: Record<string, unknown>): Record<string, unknown>;
export function migrateDraftBuildContract(challenge: {challenge_id: string; status: ChallengeState; contract: BuildContract}, patch: Partial<BuildContract>, registry?: typeof DEFAULT_VERSION_REGISTRY): unknown;
export function canTransitionChallenge(from: ChallengeState, to: ChallengeState): boolean;
export function transitionChallenge(challenge: {challenge_id: string; status: ChallengeState; contract: BuildContract; appeal_opened_at?: number}, to: ChallengeState, context?: Record<string, unknown>): unknown;
export function assertEntry(entry: ChallengeEntry): ChallengeEntry;
export function validateEntrySet(entries: ChallengeEntry[], policy?: {organizerBuilderId?: string; organizerPayoutId?: string; funderPayoutId?: string}): ChallengeEntry[];
export function activateEntries(entries: ChallengeEntry[], contract: BuildContract, policy?: Record<string, unknown>): readonly ChallengeEntry[];
export function publicEntryProjection(entry: ChallengeEntry, options?: {revealed?: boolean}): Partial<ChallengeEntry>;
export function assertSubmissionManifest(manifest: unknown): SubmissionManifest;
export function isSubmissionEligible(manifest: SubmissionManifest, contract: BuildContract, entryId: string): boolean;
export function selectFinalSubmission(manifests: SubmissionManifest[], contract: BuildContract, entryId: string): SubmissionManifest | null;
export function recordArchiveObservation(manifest: SubmissionManifest, archiveState: string, reason?: string | null): unknown;
export function computeQualification(contract: BuildContract, criterionResults: Array<{criterion_id: string; result: QualificationCriterionResult; evidence_refs?: string[]}>): {overall: QualificationOverall; criteria: Array<{criterion_id: string; result: QualificationCriterionResult; evidence_refs?: string[]}>};
export function appendAppealEvent(history: unknown[], event: Record<string, unknown>): readonly unknown[];
export function validateSelection(selectedEntryId: string, finalQualifierIds: string[]): string;
export function computeDefaultDistribution(prizeMinorUnits: number, qualifierIds: string[]): Array<{entry_id: string; amount_minor_units: number}>;
export function computeDefaultResolution(finalQualifierIds: string[], prizeMinorUnits: number): {type: SettlementIntentType; winner_entry_id: string | null; distributions: Array<{entry_id: string; amount_minor_units: number}>};
export function assertSettlementIntent(intent: SettlementIntent): SettlementIntent;
export function assertSettlementIntentMatchesContract(contract: BuildContract, intent: SettlementIntent): SettlementIntent;
export function buildSettlementIntent(args: {contract: BuildContract; resolution: {type: SettlementIntentType; winner_entry_id: string | null; distributions: Array<{entry_id: string; amount_minor_units: number}>}; recipientByEntryId?: Record<string, string>; refundRecipientId?: string | null}): SettlementIntent;
export function applyFinalizedSettlementFact(intent: SettlementIntent, fact: SettlementExecutionFact, existingFact?: SettlementExecutionFact | null): SettlementExecutionFact;
export function computeIpTransferFact(intent: SettlementIntent, executionFact: SettlementExecutionFact): IpTransferFact;
export function terminalOutcomeFromIntent(intent: SettlementIntent): string;
export function fileReceipt(args: {contract: BuildContract; settlementIntent: SettlementIntent; settlementExecutionFact: SettlementExecutionFact}): Readonly<Record<string, unknown>>;
export function assertReceiptMatchesContract(contract: BuildContract, receipt: unknown): Record<string, unknown>;
export function appendReceiptCorrection(receipts: Array<Record<string, unknown>>, args: {supersedes: string; reason: string; authority: string; evidence_refs?: string[]; corrected_projection?: Record<string, unknown>}): Readonly<Record<string, unknown>>;
export function publicReceiptProjection(receipt: Record<string, unknown>): Record<string, unknown>;
