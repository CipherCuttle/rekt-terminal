import { CAREER_SAVE_VERSION, createInitialCareer } from './reducer.js';
import { createInitialRiskSizingQualification } from './qualification.js';
import type { CareerState } from './types.js';

export interface CareerSaveEnvelope {
  kind: 'REKT_INK_CAREER_SAVE';
  saveVersion: number;
  state: CareerState;
}

export function createCareerSave(state: CareerState): CareerSaveEnvelope {
  return { kind: 'REKT_INK_CAREER_SAVE', saveVersion: CAREER_SAVE_VERSION, state: structuredClone(state) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCareerState(value: unknown): value is CareerState {
  if (!isRecord(value)) return false;
  return typeof value.careerId === 'string'
    && Number.isSafeInteger(value.startedAtMs)
    && Array.isArray(value.unlockedSkills)
    && Array.isArray(value.unlockedCapabilities)
    && isRecord(value.stats)
    && isRecord(value.qualification)
    && isRecord(value.objective)
    && Array.isArray(value.recentEffects)
    && Array.isArray(value.processedEventIds)
    && Array.isArray(value.processedTradeIds);
}

/**
 * v1 -> v2 added the STOP_LOSS statistics.
 *
 * A v1 save has no record of *when* a stop was placed relative to entry, so it
 * cannot claim any qualifying trades. Zero is the honest reconstruction.
 */
function migrateV1ToV2(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = { ...next.stats, manualLossCuts: 0, protectCapitalChallenges: 0, stopUses: 0, accountEquityAtLeast70Percent: true };
  next.qualification = {
    ...next.qualification,
    stopLoss: { totalClosedSpotTrades: next.stats.closedSpotTrades, targetClosedSpotTrades: 5, manualLossCuts: 0, protectCapitalChallenges: 0, accountEquityAtLeast70Percent: true, qualified: false },
  };
  return next;
}

/**
 * v2 -> v3 added the RISK_SIZING statistics and qualification.
 *
 * Same principle: the pre-RISK_SIZING save carries no evidence about stop
 * timing, widening, or risk plans, so every new counter starts at zero and the
 * player earns the unlock from facts recorded after the migration. Nothing is
 * back-credited, because a migration must never invent demonstrated behaviour.
 */
function migrateV2ToV3(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = {
    ...next.stats,
    stopPlannedTrades: 0,
    riskPlannedTrades: 0,
    riskPlansCreated: 0,
    riskBudgetsRespected: 0,
    riskBudgetViolations: 0,
  };
  next.qualification = {
    ...next.qualification,
    riskSizing: { ...createInitialRiskSizingQualification(), partialExitsUsed: next.stats.partialExitsUsed },
  };
  return next;
}

export function migrateCareerSave(input: unknown): CareerSaveEnvelope | null {
  if (!isRecord(input)) return null;
  if (input.kind !== 'REKT_INK_CAREER_SAVE' || !Number.isSafeInteger(input.saveVersion)) return null;
  if (!isCareerState(input.state)) return null;

  let state = structuredClone(input.state) as CareerState;
  let version = input.saveVersion as number;
  if (version === 1) {
    state = migrateV1ToV2(state);
    version = 2;
  }
  if (version === 2) {
    state = migrateV2ToV3(state);
    version = 3;
  }
  if (version !== CAREER_SAVE_VERSION) return null;

  state.saveVersion = CAREER_SAVE_VERSION;
  return { kind: 'REKT_INK_CAREER_SAVE', saveVersion: CAREER_SAVE_VERSION, state };
}

export function parseCareerSave(serialized: string): CareerSaveEnvelope | null {
  try {
    return migrateCareerSave(JSON.parse(serialized));
  } catch {
    return null;
  }
}

export function emptyCareerSave(careerId: string, startedAtMs: number): CareerSaveEnvelope {
  return createCareerSave(createInitialCareer(careerId, startedAtMs));
}
