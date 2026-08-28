import { CAREER_SAVE_VERSION, createInitialCareer } from './reducer.js';
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

export function migrateCareerSave(input: unknown): CareerSaveEnvelope | null {
  if (!isRecord(input)) return null;
  if (input.kind !== 'REKT_INK_CAREER_SAVE' || !Number.isSafeInteger(input.saveVersion)) return null;
  if (input.saveVersion === CAREER_SAVE_VERSION && isCareerState(input.state)) {
    return { kind: 'REKT_INK_CAREER_SAVE', saveVersion: CAREER_SAVE_VERSION, state: structuredClone(input.state) };
  }
  return null;
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
