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
}

export interface ScaleControlQualification {
  closedSpotTrades: number;
  targetClosedSpotTrades: 3;
  maxClosedLossBps: number;
  lossLimitBps: 1_000;
  positiveAccountEquity: boolean;
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
}

export type ObjectiveKind = 'CLOSE_SPOT' | 'PROTECT_EQUITY' | 'SCALE_CONTROL_UNLOCKED' | 'STOP_LOSS_UNLOCKED';

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
  exitReason: 'MANUAL' | 'STOP' | 'PROTECT_CAPITAL';
  stopUsed: boolean;
  partialExitUsed: boolean;
  liquidated: false;
}
