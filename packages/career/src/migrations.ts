import { CAREER_SAVE_VERSION, createInitialCareer } from './reducer.js';
import { createInitialMargin2xQualification, createInitialRiskSizingQualification } from './qualification.js';
import { getNextObjective } from './objective.js';
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

/** v1 -> v2 added STOP_LOSS statistics. */
function migrateV1ToV2(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = { ...next.stats, manualLossCuts: 0, protectCapitalChallenges: 0, stopUses: 0, accountEquityAtLeast70Percent: true };
  next.qualification = {
    ...next.qualification,
    stopLoss: { totalClosedSpotTrades: next.stats.closedSpotTrades, targetClosedSpotTrades: 5, manualLossCuts: 0, protectCapitalChallenges: 0, accountEquityAtLeast70Percent: true, qualified: false },
  };
  return next;
}

/** v2 -> v3 added RISK_SIZING evidence. Nothing is back-credited. */
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

/**
 * v3 -> v4 adds the evidence needed for MARGIN_2X.
 *
 * Old aggregate counts cannot reconstruct which risk-planned trades were the
 * most recent three, so the rolling outcomes start empty. A v3 Career save
 * alone also cannot prove cumulative simulator drawdown, or whether the
 * already-existing bankroll reset control was used. Both facts therefore
 * migrate to UNKNOWN (`null`) rather than invented clean history. A legacy
 * Career cannot earn leverage until the contract has evidence; starting a new
 * Career is the only way to establish a known zero-reset history.
 */
function migrateV3ToV4(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = {
    ...next.stats,
    recentRiskPlannedOutcomes: [],
    maxAccountDrawdownBps: null,
    accountResetsUsed: null,
  };
  next.qualification = {
    ...next.qualification,
    margin2x: {
      ...createInitialMargin2xQualification(),
      closedSpotTrades: next.stats.closedSpotTrades,
      riskPlannedTrades: next.stats.riskPlannedTrades,
      partialExitsUsed: next.stats.partialExitsUsed,
      accountResetsUsed: null,
    },
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
  if (version === 3) {
    state = migrateV3ToV4(state);
    version = 4;
  }
  if (version !== CAREER_SAVE_VERSION) return null;

  state.saveVersion = CAREER_SAVE_VERSION;
  if (input.saveVersion !== CAREER_SAVE_VERSION) state.objective = getNextObjective(state);
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
