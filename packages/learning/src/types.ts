export const LEARNING_SCHEMA_VERSION = 'LEARNING_VERTICAL_SLICE_V0' as const;
export const LEARNING_STATE_VERSION = 'LEARNING_STATE_V0' as const;
export const MISSION_RECEIPT_VERSION = 'MISSION_RECEIPT_V0' as const;
export const LEARNING_EVALUATOR_VERSION = 'LEARNING_EVALUATOR_V0' as const;

export const MISSION_IDS = Object.freeze(['MD-01', 'EX-01', 'LQ-01', 'ST-01', 'RS-01'] as const);
export type MissionId = (typeof MISSION_IDS)[number];
export type MissionVersion = 1;
export type MissionVerdict = 'PASS' | 'FAIL';
export type GuidanceLevel = 'WORKED_EXAMPLE' | 'GUIDED';
export type LearningScenarioProvenance = 'SYNTHETIC' | 'EPISODE';
export type EvidenceClassification = 'CONFIRMED' | 'DERIVED' | 'SYNTHETIC' | 'STALE';

export interface EpisodeIdentityV0 {
  readonly episodeId: string;
  readonly episodeVersion: string;
  readonly episodeDigest: string;
}

export interface SyntheticScenarioV0 {
  readonly kind: 'SYNTHETIC';
  readonly scenarioId: string;
  readonly label: 'TRAINING SIMULATION';
  readonly provenance: 'SYNTHETIC';
  readonly environment: 'DEMO';
}

export interface EpisodeScenarioV0 {
  readonly kind: 'EPISODE';
  readonly scenarioId: string;
  readonly label: 'RECORDED EPISODE';
  readonly provenance: 'EPISODE';
  readonly episode: EpisodeIdentityV0;
}

export type MissionScenarioV0 = SyntheticScenarioV0 | EpisodeScenarioV0;

export type CriterionCode =
  | 'CLASSIFICATIONS_CORRECT'
  | 'STALE_FAILS_CLOSED'
  | 'ENTRY_RECORDED'
  | 'MARK_NOT_FILL'
  | 'FEES_AFFECT_CLOSE'
  | 'CLOSE_RECORDED'
  | 'DEEP_DECISION_VALID'
  | 'THIN_DECISION_SAFE'
  | 'MODEL_LABEL_ACKNOWLEDGED'
  | 'STOP_PLACED'
  | 'STOP_NOT_WIDENED'
  | 'STOP_ACKNOWLEDGED'
  | 'STOP_EXIT_COMPLETED'
  | 'RISK_PLAN_VALID'
  | 'SIZE_WITHIN_BUDGET'
  | 'WIDER_STOP_SMALLER_SIZE'
  | 'PRODUCTION_MODEL_ACKNOWLEDGED';

export interface MissionDefinitionV0 {
  readonly schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  readonly id: MissionId;
  readonly version: MissionVersion;
  readonly title: string;
  readonly objective: string;
  readonly concept: string;
  readonly scenario: MissionScenarioV0;
  readonly guidanceLevel: GuidanceLevel;
  readonly requiredInputs: readonly string[];
  readonly deterministicCriteria: readonly CriterionCode[];
  readonly debriefTemplate: readonly string[];
}

export interface MarketTruthLearnerInput {
  readonly kind: 'MD-01';
  readonly classifications: Readonly<Record<string, EvidenceClassification>>;
  readonly freshnessAnswer: 'FRESH' | 'STALE';
}

export interface ExecutionLearnerInput {
  readonly kind: 'EX-01';
  readonly entered: boolean;
  readonly markAnswer: 'MARK_IS_OBSERVATION' | 'MARK_IS_FILL' | 'MARK_AND_FILL_ARE_IDENTICAL';
  readonly feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT' | 'FEES_DO_NOT_MATTER' | 'ONLY_PNL_MATTERS';
  readonly closed: boolean;
}

export type LiquidityDecision = 'SEND' | 'RESIZE' | 'DECLINE';

export interface LiquidityLearnerInput {
  readonly kind: 'LQ-01';
  readonly deepDecision: LiquidityDecision;
  readonly thinDecision: LiquidityDecision;
  readonly resizedQuoteWei?: string;
  readonly modelAnswer: 'SPOT_FILL_V0_MODEL' | 'EXCHANGE_QUOTE' | 'EXACT_ORDER_BOOK';
}

export interface StopLearnerInput {
  readonly kind: 'ST-01';
  readonly entered: boolean;
  readonly stopPlaced: boolean;
  readonly acknowledgement: 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL' | 'STOP_GUARANTEES_FILL' | 'STOP_IS_MARK_PRICE';
  readonly allowedWidening: 'NEVER_WIDEN' | 'WIDEN_IF_LOSING' | 'MOVE_AFTER_TRIGGER';
  readonly allowedExit: 'ALLOW_PLANNED_EXIT' | 'CANCEL_STOP' | 'WAIT_FOR_PROFIT';
}

export interface RiskLearnerInput {
  readonly kind: 'RS-01';
  readonly selectedPositionSizeAtoms: string;
  readonly widthAnswer: 'WIDER_STOP_SMALLER_SIZE' | 'WIDER_STOP_SAME_SIZE' | 'WIDER_STOP_LARGER_SIZE';
  readonly modelAnswer: 'RISK_PLAN_V0' | 'SIMPLE_UNCHECKED_FORMULA' | 'GUESS_FROM_PNL';
}

export type MissionLearnerInput =
  | MarketTruthLearnerInput
  | ExecutionLearnerInput
  | LiquidityLearnerInput
  | StopLearnerInput
  | RiskLearnerInput;

export interface MarketTruthFactsV0 {
  readonly kind: 'MD-01';
  readonly items: readonly {
    readonly itemId: string;
    readonly expected: EvidenceClassification;
    readonly publishedBy: string;
    readonly rektDerived: string;
    readonly evidencePath: string;
    readonly workedExample: boolean;
  }[];
  readonly freshnessExpected: 'STALE';
}

export interface ExecutionFactsV0 {
  readonly kind: 'EX-01';
  readonly scenarioId: string;
  readonly provenance: 'SYNTHETIC';
  readonly modelVersion: 'SPOT_FILL_V0';
  readonly entered: true;
  readonly closed: true;
  readonly referencePriceX18: string;
  readonly markPriceX18: string;
  readonly entryFillPriceX18: string;
  readonly exitFillPriceX18: string;
  readonly entryImpactBps: string;
  readonly exitImpactBps: string;
  readonly entryFeeWei: string;
  readonly exitFeeWei: string;
  readonly unrealizedPnlBeforeCloseWei: string;
  readonly realizedPnlWei: string;
}

export interface LiquidityCaseV0 {
  readonly requestedQuoteWei: string;
  readonly referencePriceX18: string;
  readonly liquidityWei: string;
  readonly participationBps: string;
  readonly modeledImpactBps: string | null;
  readonly accepted: boolean;
  readonly rejectionCode: string | null;
}

export interface LiquidityFactsV0 {
  readonly kind: 'LQ-01';
  readonly scenarioId: string;
  readonly provenance: 'SYNTHETIC';
  readonly modelVersion: 'SPOT_FILL_V0';
  readonly deep: LiquidityCaseV0;
  readonly thin: LiquidityCaseV0;
}

export interface StopFactsV0 {
  readonly kind: 'ST-01';
  readonly scenarioId: string;
  readonly provenance: 'SYNTHETIC';
  readonly modelVersion: 'SPOT_FILL_V0';
  readonly entered: true;
  readonly stopPlaced: true;
  readonly stopTriggered: true;
  readonly stopWidened: boolean;
  readonly exitCompleted: true;
  readonly planPriceX18: string;
  readonly triggerPriceX18: string;
  readonly actualFillPriceX18: string;
  readonly impactBps: string;
  readonly feesWei: string;
  readonly realizedPnlWei: string;
}

export interface RiskPlanFactsV0 {
  readonly planId: string;
  readonly accepted: boolean;
  readonly equityAtPlanWei: string;
  readonly riskBudgetWei: string;
  readonly stopPriceX18: string;
  readonly stopDistanceBps: string;
  readonly positionSizeAtoms: string;
  readonly plannedNotionalWei: string;
  readonly projectedStopLossWei: string;
  readonly fillModelVersion: string;
  readonly modelVersion: 'RISK_PLAN_V0';
}

export interface RiskFactsV0 {
  readonly kind: 'RS-01';
  readonly scenarioId: string;
  readonly provenance: 'SYNTHETIC';
  readonly quoteAsset: 'WETH';
  readonly narrowStop: RiskPlanFactsV0;
  readonly widerStop: RiskPlanFactsV0;
}

export type MissionFacts = MarketTruthFactsV0 | ExecutionFactsV0 | LiquidityFactsV0 | StopFactsV0 | RiskFactsV0;

export interface MissionAttemptV0 {
  readonly missionId: MissionId;
  readonly missionVersion: MissionVersion;
  readonly learnerInput: MissionLearnerInput;
  /** Simulator/mission time supplied by the session, never Date.now() inside the evaluator. */
  readonly completedAtSimMs: number;
  /** Optional only for future episode-backed missions; V0's five missions are synthetic. */
  readonly episode?: EpisodeIdentityV0;
}

export interface MissionReceiptV0 {
  readonly receiptVersion: typeof MISSION_RECEIPT_VERSION;
  readonly receiptId: string;
  readonly missionId: MissionId;
  readonly missionVersion: MissionVersion;
  readonly scenario: MissionScenarioV0;
  readonly scenarioDigest: string;
  readonly episodeDigest?: string;
  readonly learnerInput: MissionLearnerInput;
  readonly relevantFacts: MissionFacts;
  readonly verdict: MissionVerdict;
  readonly reasonCodes: readonly string[];
  readonly completedAtSimMs: number;
  readonly evaluatorVersion: typeof LEARNING_EVALUATOR_VERSION;
}

export interface MissionCompletionV0 {
  readonly missionId: MissionId;
  readonly missionVersion: MissionVersion;
  readonly receiptId: string;
}

export interface LearningStateV0 {
  readonly stateVersion: typeof LEARNING_STATE_VERSION;
  readonly completed: readonly MissionCompletionV0[];
  readonly attempts: readonly MissionReceiptV0[];
  readonly currentMissionId: MissionId | null;
}

export type LearningAction =
  | { readonly type: 'MISSION_STARTED'; readonly missionId: MissionId }
  | { readonly type: 'MISSION_ATTEMPT_RECORDED'; readonly receipt: MissionReceiptV0 };
