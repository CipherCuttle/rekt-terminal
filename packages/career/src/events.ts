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
  skillId: 'SPOT_BASIC' | 'SCALE_CONTROL' | 'STOP_LOSS';
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
  | StopHitEvent;
