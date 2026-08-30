import { CAREER_SAVE_VERSION, createInitialCareer } from './reducer.js';
import { createInitialMargin2xQualification, createInitialRiskSizingQualification, createInitialShortQualification } from './qualification.js';
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

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
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

function migrateV1ToV2(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = { ...next.stats, manualLossCuts: 0, protectCapitalChallenges: 0, stopUses: 0, accountEquityAtLeast70Percent: true };
  next.qualification = { ...next.qualification, stopLoss: { totalClosedSpotTrades: next.stats.closedSpotTrades, targetClosedSpotTrades: 5, manualLossCuts: 0, protectCapitalChallenges: 0, accountEquityAtLeast70Percent: true, qualified: false } };
  return next;
}

function migrateV2ToV3(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = { ...next.stats, stopPlannedTrades: 0, riskPlannedTrades: 0, riskPlansCreated: 0, riskBudgetsRespected: 0, riskBudgetViolations: 0 };
  next.qualification = { ...next.qualification, riskSizing: { ...createInitialRiskSizingQualification(), partialExitsUsed: next.stats.partialExitsUsed } };
  return next;
}

function migrateV3ToV4(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = { ...next.stats, recentRiskPlannedOutcomes: [], maxAccountDrawdownBps: null, accountResetsUsed: null };
  next.qualification = {
    ...next.qualification,
    margin2x: { ...createInitialMargin2xQualification(), closedSpotTrades: next.stats.closedSpotTrades, riskPlannedTrades: next.stats.riskPlannedTrades, partialExitsUsed: next.stats.partialExitsUsed, accountResetsUsed: null },
  };
  return next;
}

/** v4 had no persisted margin-completion history, so SHORT receives zero back-credit. */
function migrateV4ToV5(state: CareerState): CareerState {
  const next = structuredClone(state);
  next.stats = { ...next.stats, qualifyingLongMarginEpisodeIds: [] };
  next.qualification = { ...next.qualification, short: createInitialShortQualification() };
  return next;
}

export function migrateCareerSave(input: unknown): CareerSaveEnvelope | null {
  if (!isRecord(input)) return null;
  if (input.kind !== 'REKT_INK_CAREER_SAVE' || !Number.isSafeInteger(input.saveVersion)) return null;
  if (!isCareerState(input.state)) return null;
  let state = structuredClone(input.state) as CareerState;
  let version = input.saveVersion as number;
  if (version === 1) { state = migrateV1ToV2(state); version = 2; }
  if (version === 2) { state = migrateV2ToV3(state); version = 3; }
  if (version === 3) { state = migrateV3ToV4(state); version = 4; }
  if (version === 4) { state = migrateV4ToV5(state); version = 5; }
  if (version !== CAREER_SAVE_VERSION) return null;
  state.saveVersion = CAREER_SAVE_VERSION;
  if (input.saveVersion !== CAREER_SAVE_VERSION) state.objective = getNextObjective(state);
  return { kind: 'REKT_INK_CAREER_SAVE', saveVersion: CAREER_SAVE_VERSION, state };
}

export function parseCareerSave(serialized: string): CareerSaveEnvelope | null {
  try { return migrateCareerSave(JSON.parse(serialized)); } catch { return null; }
}
export function emptyCareerSave(careerId: string, startedAtMs: number): CareerSaveEnvelope { return createCareerSave(createInitialCareer(careerId, startedAtMs)); }
