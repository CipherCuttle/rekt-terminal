import type { CareerTradeSummaryFact, ProvenanceState } from './types.js';

/**
 * Behavioural events carry the provenance of the market evidence the behaviour
 * was performed against, for the same reason TradeSummary facts do: a scale-in
 * or a stop placed against fabricated DEMO data is not a demonstrated
 * behaviour. Omitted is treated as UNGRADABLE, never as real evidence.
 */
export interface EvidenceBacked {
  evidenceProvenance?: ProvenanceState;
}

export interface CareerStartedEvent {
  type: 'CAREER_STARTED';
  eventId: string;
  careerId: string;
  startedAtMs: number;
}

export interface TradeClosedEvent {
  type: 'TRADE_CLOSED';
  eventId: string;
  sourceReceiptId?: string;
  summary: CareerTradeSummaryFact;
}

export interface ScaleInUsedEvent extends EvidenceBacked {
  type: 'SCALE_IN_USED';
  eventId: string;
  sourceReceiptId: string;
}

export interface PartialExitUsedEvent extends EvidenceBacked {
  type: 'PARTIAL_EXIT_USED';
  eventId: string;
  sourceReceiptId: string;
}

export interface CareerActionAttemptEvent {
  type: 'NON_ECONOMIC_ACTION';
  eventId: string;
  action: string;
}

export interface SkillUnlockedEvent {
  type: 'SKILL_UNLOCKED';
  eventId: string;
  skillId: 'SPOT_BASIC' | 'SCALE_CONTROL' | 'STOP_LOSS' | 'RISK_SIZING';
}

/**
 * A risk plan was frozen in the simulator.
 *
 * Recorded so MARGIN_2X can later require explicit risk plans and so the
 * RISK OFFICER receipt has a countable fact. It grants nothing on its own —
 * freezing plans in a loop is an action, not a demonstrated behaviour.
 */
export interface RiskPlanCreatedEvent extends EvidenceBacked {
  type: 'RISK_PLAN_CREATED';
  eventId: string;
  sourceReceiptId: string;
  planId: string;
}

/** A risk-planned trade closed without ever breaching its budget. */
export interface RiskBudgetRespectedEvent extends EvidenceBacked {
  type: 'RISK_BUDGET_RESPECTED';
  eventId: string;
  sourceReceiptId: string;
  tradeId: string;
}

/**
 * A risk-planned trade's projected exposure passed budget plus tolerance —
 * the player widened a stop or increased exposure past their own plan.
 */
export interface RiskBudgetViolatedEvent extends EvidenceBacked {
  type: 'RISK_BUDGET_VIOLATED';
  eventId: string;
  sourceReceiptId: string;
  tradeId: string;
}

export interface StopPlacedEvent extends EvidenceBacked { type: 'STOP_PLACED'; eventId: string; sourceReceiptId: string; }
export interface StopHitEvent extends EvidenceBacked { type: 'STOP_HIT'; eventId: string; sourceReceiptId: string; }

export type CareerEvent =
  | CareerStartedEvent
  | TradeClosedEvent
  | ScaleInUsedEvent
  | PartialExitUsedEvent
  | CareerActionAttemptEvent
  | SkillUnlockedEvent
  | StopPlacedEvent
  | StopHitEvent
  | RiskPlanCreatedEvent
  | RiskBudgetRespectedEvent
  | RiskBudgetViolatedEvent;
