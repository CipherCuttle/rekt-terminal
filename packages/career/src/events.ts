import type { CareerTradeSummaryFact } from './types.js';

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

export interface ScaleInUsedEvent {
  type: 'SCALE_IN_USED';
  eventId: string;
  sourceReceiptId: string;
}

export interface PartialExitUsedEvent {
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
  skillId: 'SPOT_BASIC' | 'SCALE_CONTROL';
}

export type CareerEvent =
  | CareerStartedEvent
  | TradeClosedEvent
  | ScaleInUsedEvent
  | PartialExitUsedEvent
  | CareerActionAttemptEvent
  | SkillUnlockedEvent;
