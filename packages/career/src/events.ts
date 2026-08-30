import type { CareerTradeSummaryFact, MarginEpisodeCompletionFact, ProvenanceState } from './types.js';

export interface EvidenceBacked { evidenceProvenance?: ProvenanceState; }
export interface CareerStartedEvent { type: 'CAREER_STARTED'; eventId: string; careerId: string; startedAtMs: number; }
export interface TradeClosedEvent { type: 'TRADE_CLOSED'; eventId: string; sourceReceiptId?: string; summary: CareerTradeSummaryFact; }
export interface ScaleInUsedEvent extends EvidenceBacked { type: 'SCALE_IN_USED'; eventId: string; sourceReceiptId: string; }
export interface PartialExitUsedEvent extends EvidenceBacked { type: 'PARTIAL_EXIT_USED'; eventId: string; sourceReceiptId: string; }
export interface CareerActionAttemptEvent { type: 'NON_ECONOMIC_ACTION'; eventId: string; action: string; }
export interface AccountResetUsedEvent { type: 'ACCOUNT_RESET_USED'; eventId: string; }
export interface SkillUnlockedEvent { type: 'SKILL_UNLOCKED'; eventId: string; skillId: 'SPOT_BASIC' | 'SCALE_CONTROL' | 'STOP_LOSS' | 'RISK_SIZING' | 'MARGIN_2X' | 'SHORT'; }
export interface RiskPlanCreatedEvent extends EvidenceBacked { type: 'RISK_PLAN_CREATED'; eventId: string; sourceReceiptId: string; planId: string; }
export interface RiskBudgetRespectedEvent extends EvidenceBacked { type: 'RISK_BUDGET_RESPECTED'; eventId: string; sourceReceiptId: string; tradeId: string; }
export interface RiskBudgetViolatedEvent extends EvidenceBacked { type: 'RISK_BUDGET_VIOLATED'; eventId: string; sourceReceiptId: string; tradeId: string; }
export interface StopPlacedEvent extends EvidenceBacked { type: 'STOP_PLACED'; eventId: string; sourceReceiptId: string; }
export interface StopHitEvent extends EvidenceBacked { type: 'STOP_HIT'; eventId: string; sourceReceiptId: string; }
export interface MarginEpisodeCompletedEvent {
  type: 'MARGIN_EPISODE_COMPLETED';
  eventId: string;
  sourceReceiptId: string;
  summary: MarginEpisodeCompletionFact;
}

export type CareerEvent =
  | CareerStartedEvent
  | TradeClosedEvent
  | ScaleInUsedEvent
  | PartialExitUsedEvent
  | CareerActionAttemptEvent
  | AccountResetUsedEvent
  | SkillUnlockedEvent
  | StopPlacedEvent
  | StopHitEvent
  | RiskPlanCreatedEvent
  | RiskBudgetRespectedEvent
  | RiskBudgetViolatedEvent
  | MarginEpisodeCompletedEvent;
