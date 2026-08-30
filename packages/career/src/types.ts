/**
 * Canonical provenance taxonomy, mirrored from the simulator so the Career
 * package stays dependency-free. The five states are the only vocabulary.
 */
export type ProvenanceState = 'CONFIRMED' | 'DERIVED' | 'SYNTHETIC' | 'STALE' | 'UNAVAILABLE';

export type SkillId =
  | 'SPOT_BASIC'
  | 'SCALE_CONTROL'
  | 'STOP_LOSS'
  | 'RISK_SIZING'
  | 'MARGIN_2X'
  | 'SHORT';

export type CapabilityId =
  | 'SPOT_MARKET_BUY_FIXED'
  | 'SPOT_SELL_ALL'
  | 'SCALE_IN'
  | 'PARTIAL_EXIT'
  | 'STOP_MARKET'
  | 'CUSTOM_POSITION_SIZE'
  | 'RISK_PERCENT_SIZING'
  | 'PERP_LONG_2X'
  | 'PERP_SHORT_2X';

export interface RiskPlannedOutcome {
  tradeId: string;
  outcome: 'UNVERIFIED' | 'RESPECTED' | 'VIOLATED';
}

export interface CareerStats {
  closedSpotTrades: number;
  scaleInsUsed: number;
  partialExitsUsed: number;
  qualifyingScaleTrades: number;
  maxClosedLossBps: number;
  lastClosedTradeAccountPositive: boolean;
  manualLossCuts: number;
  protectCapitalChallenges: number;
  stopUses: number;
  accountEquityAtLeast70Percent: boolean;
  /**
   * Closed trades whose protective stop was placed within the frozen
   * STOP_PLAN_WINDOW_MS of the opening fill *and* was never widened.
   */
  stopPlannedTrades: number;
  /** Closed trades that carried an explicit risk plan. */
  riskPlannedTrades: number;
  /** Risk plans frozen. Recorded for MARGIN_2X and receipts; gates nothing alone. */
  riskPlansCreated: number;
  /** Closed risk-planned trades whose projected exposure stayed inside budget. */
  riskBudgetsRespected: number;
  /** Closed risk-planned trades that breached budget plus tolerance. */
  riskBudgetViolations: number;
  /** Rolling last three closed risk-planned simulator outcomes. */
  recentRiskPlannedOutcomes: RiskPlannedOutcome[];
  /** Cumulative simulator account drawdown seen on gradable closed trades. */
  maxAccountDrawdownBps: number | null;
  /**
   * Number of bankroll resets used in this Career. `null` means an older save
   * predates reset receipts, so "no reset used" cannot be proven.
   */
  accountResetsUsed: number | null;
}

export interface ScaleControlQualification {
  closedSpotTrades: number;
  targetClosedSpotTrades: 3;
  maxClosedLossBps: number;
  lossLimitBps: 1_000;
  positiveAccountEquity: boolean;
  qualified: boolean;
}

export interface RiskSizingQualification {
  stopPlannedTrades: number;
  targetStopPlannedTrades: 3;
  partialExitsUsed: number;
  targetPartialExits: 1;
  qualified: boolean;
}

export interface Margin2xQualification {
  closedSpotTrades: number;
  targetClosedSpotTrades: 8;
  riskPlannedTrades: number;
  targetRiskPlannedTrades: 3;
  partialExitsUsed: number;
  targetPartialExits: 2;
  recentRiskPlannedOutcomes: RiskPlannedOutcome[];
  targetCleanRecentRiskPlans: 3;
  maxAccountDrawdownBps: number | null;
  drawdownLimitBps: 2_000;
  accountResetsUsed: number | null;
  qualified: boolean;
}

export interface QualificationState {
  scaleControl: ScaleControlQualification;
  stopLoss: {
    totalClosedSpotTrades: number;
    targetClosedSpotTrades: 5;
    manualLossCuts: number;
    protectCapitalChallenges: number;
    accountEquityAtLeast70Percent: boolean;
    qualified: boolean;
  };
  riskSizing: RiskSizingQualification;
  margin2x: Margin2xQualification;
}

export type ObjectiveKind = 'CLOSE_SPOT' | 'PROTECT_EQUITY' | 'SCALE_CONTROL_UNLOCKED' | 'STOP_LOSS_UNLOCKED' | 'RISK_SIZING_UNLOCKED' | 'MARGIN_2X_UNLOCKED';

export interface ObjectiveState {
  id: string;
  kind: ObjectiveKind;
  text: string;
  progress: number;
  target: number;
}

export interface CareerEffect {
  effectId: string;
  effectSeq: number;
  kind: 'SKILL_UNLOCKED' | 'RECEIPT_AWARDED';
  text: string;
}

export interface CareerState {
  saveVersion: number;
  careerId: string;
  startedAtMs: number;
  unlockedSkills: SkillId[];
  unlockedCapabilities: CapabilityId[];
  stats: CareerStats;
  qualification: QualificationState;
  receipts: Record<string, number>;
  objective: ObjectiveState;
  effectSeq: number;
  recentEffects: CareerEffect[];
  processedEventIds: string[];
  processedTradeIds: string[];
}

export interface CareerTradeSummaryFact {
  tradeId: string;
  sessionId: string;
  mode: 'SPOT';
  realizedPnlWei: bigint;
  accountEquityAtCloseWei: bigint;
  lossBpsOfThenCurrentEquity: bigint;
  accountEquityAtOpenWei: bigint;
  /** Cumulative account drawdown recorded by the simulator at this close. */
  maxDrawdownBpsAtClose: bigint;
  exitReason: 'MANUAL' | 'STOP' | 'PROTECT_CAPITAL';
  stopUsed: boolean;
  partialExitUsed: boolean;
  liquidated: false;
  openedAtMs: number;
  firstStopPlacedAtMs: number | null;
  stopWidened: boolean;
  riskPlanned: boolean;
  riskBudgetViolated: boolean;
  /** False is "not demonstrated", never "violated" — and never compliance. */
  riskBudgetVerified: boolean;
  /** Only CONFIRMED and DERIVED evidence can advance qualification. */
  evidenceProvenance: ProvenanceState;
}
