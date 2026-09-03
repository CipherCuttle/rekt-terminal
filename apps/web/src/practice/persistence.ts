/**
 * Narrow, versioned local persistence for the practice session.
 *
 * The domain engines are never handed a storage object. This module only
 * serialises the simulator's append-only event log plus the Career save
 * envelope, and restores by *replaying* those events through the simulator.
 * A restore that does not reproduce the recorded replay digest is discarded.
 */
import Dexie, { type Table } from 'dexie';
import {
  createInitialSimState,
  replayEvents,
  stableReplayDigest,
  type EvidencePolicy,
  type SimEvent,
  type SimState,
} from '@rekt-ink/sim';
import { CAREER_SAVE_VERSION, migrateCareerSave, type CareerSaveEnvelope } from '@rekt-ink/career';
import { createInitialLearningState, parseLearningState, type LearningStateV0 } from '@rekt-ink/learning';
import type { MarketEnvironment } from '../types/api';

// v2 records the data environment. A save written before MARKET_TRUTH_V1 has no
// environment, and its events could have come from fabricated data, so it is
// not migrated — it is discarded and the session starts clean.
export const PRACTICE_SAVE_VERSION = 2;
export const PRACTICE_SAVE_KIND = 'REKT_INK_PRACTICE_SAVE';
const PRACTICE_DB_NAME = 'rekt-ink-practice';
const ACTIVE_SAVE_ID = 'active';

export interface PracticeSaveEnvelope {
  kind: typeof PRACTICE_SAVE_KIND;
  saveVersion: number;
  sessionId: string;
  startedAtMs: number;
  modelVersion: string;
  /**
   * The environment this session's economic state belongs to. Persisted so a
   * DEMO session cannot be restored under a LIVE label, which would put
   * positions built from fabricated evidence behind a LIVE badge.
   */
  environment: MarketEnvironment;
  instrumentId: string | null;
  /** Tagged JSON of the simulator's event log. */
  simEventsJson: string;
  /** Digest of the event log at save time; verified on restore. */
  replayDigest: string;
  career: CareerSaveEnvelope;
  /** Independent, versioned learning progress. It never participates in sim replay. */
  learning?: LearningStateV0;
  savedAtMs: number;
}

/* -------------------------------------------------------------------------- */
/* bigint-safe codec                                                           */
/* -------------------------------------------------------------------------- */

const BIGINT_TAG = '@bigint:';

function encodeValue(value: unknown): unknown {
  if (typeof value === 'bigint') return `${BIGINT_TAG}${value.toString()}`;
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = encodeValue(entry);
    return out;
  }
  return value;
}

function decodeValue(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith(BIGINT_TAG)) return BigInt(value.slice(BIGINT_TAG.length));
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = decodeValue(entry);
    return out;
  }
  return value;
}

export function encodeSimEvents(events: readonly SimEvent[]): string {
  return JSON.stringify(encodeValue(events));
}

export function decodeSimEvents(json: string): SimEvent[] {
  const decoded = decodeValue(JSON.parse(json));
  if (!Array.isArray(decoded)) throw new Error('practice save does not contain an event array');
  return decoded as SimEvent[];
}

/* -------------------------------------------------------------------------- */
/* envelope                                                                    */
/* -------------------------------------------------------------------------- */

export function createPracticeSave(input: {
  sim: SimState;
  career: CareerSaveEnvelope;
  instrumentId: string | null;
  environment: MarketEnvironment;
  learning?: LearningStateV0;
  savedAtMs: number;
}): PracticeSaveEnvelope {
  return {
    kind: PRACTICE_SAVE_KIND,
    saveVersion: PRACTICE_SAVE_VERSION,
    sessionId: input.sim.sessionId,
    startedAtMs: input.sim.startedAtMs,
    modelVersion: input.sim.modelVersion,
    environment: input.environment,
    instrumentId: input.instrumentId,
    simEventsJson: encodeSimEvents(input.sim.events),
    replayDigest: stableReplayDigest(input.sim),
    career: input.career,
    learning: input.learning ?? createInitialLearningState(),
    savedAtMs: input.savedAtMs,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface PracticeRestore {
  sim: SimState;
  career: CareerSaveEnvelope;
  instrumentId: string | null;
  environment: MarketEnvironment;
  learning: LearningStateV0;
  learningReset: boolean;
}

const EVIDENCE_POLICY: Record<MarketEnvironment, EvidencePolicy> = {
  LIVE: 'LIVE_ONLY',
  DEMO: 'DEMO_ALLOW_SYNTHETIC',
};

/**
 * Rebuild practice state from a save. Throws on anything unexpected so the
 * caller can fall back to a clean session rather than presenting a
 * half-restored ledger as truth.
 */
export function restorePracticeSave(input: unknown): PracticeRestore {
  if (!isRecord(input)) throw new Error('practice save is not an object');
  if (input.kind !== PRACTICE_SAVE_KIND) throw new Error('practice save has an unknown kind');
  if (input.saveVersion !== PRACTICE_SAVE_VERSION) {
    throw new Error(`unsupported practice save version ${String(input.saveVersion)}`);
  }
  if (typeof input.sessionId !== 'string' || !input.sessionId) throw new Error('practice save has no session identity');
  if (!Number.isSafeInteger(input.startedAtMs)) throw new Error('practice save has an invalid session start');
  if (typeof input.modelVersion !== 'string' || !input.modelVersion) throw new Error('practice save has no model version');
  if (typeof input.simEventsJson !== 'string') throw new Error('practice save has no event log');
  if (typeof input.replayDigest !== 'string') throw new Error('practice save has no replay digest');
  if (input.environment !== 'LIVE' && input.environment !== 'DEMO') throw new Error('practice save has no data environment');
  const environment: MarketEnvironment = input.environment;

  const career = migrateCareerSave(input.career);
  if (!career || career.saveVersion !== CAREER_SAVE_VERSION) throw new Error('career save failed migration');

  const events = decodeSimEvents(input.simEventsJson);
  const sim = replayEvents(
    events,
    createInitialSimState({
      sessionId: input.sessionId,
      startedAtMs: input.startedAtMs as number,
      modelVersion: input.modelVersion,
      // Restored with the policy it was recorded under, so a DEMO ledger stays
      // a DEMO ledger rather than silently acquiring LIVE standing.
      evidencePolicy: EVIDENCE_POLICY[environment],
    }),
  );

  const digest = stableReplayDigest(sim);
  if (digest !== input.replayDigest) {
    throw new Error(`replay digest mismatch: expected ${input.replayDigest}, replayed ${digest}`);
  }

  let learning = createInitialLearningState();
  let learningReset = false;
  if (input.learning !== undefined) {
    try {
      learning = parseLearningState(input.learning);
    } catch {
      // Learning is intentionally separable from the economic replay. A future
      // or malformed learning save loses only its progress, never the ledger.
      learningReset = true;
    }
  }

  return {
    sim,
    career,
    instrumentId: typeof input.instrumentId === 'string' ? input.instrumentId : null,
    environment,
    learning,
    learningReset,
  };
}

/* -------------------------------------------------------------------------- */
/* storage ports                                                               */
/* -------------------------------------------------------------------------- */

export interface PracticeStorage {
  load(): Promise<unknown | null>;
  save(envelope: PracticeSaveEnvelope): Promise<void>;
  clear(): Promise<void>;
}

interface PracticeSaveRow {
  id: string;
  envelope: PracticeSaveEnvelope;
}

class PracticeDatabase extends Dexie {
  saves!: Table<PracticeSaveRow, string>;

  constructor(name: string) {
    super(name);
    this.version(PRACTICE_SAVE_VERSION).stores({ saves: 'id' });
  }
}

/** IndexedDB-backed storage. Any storage fault degrades to "no save". */
export function createDexiePracticeStorage(name = PRACTICE_DB_NAME): PracticeStorage {
  let db: PracticeDatabase | null = null;
  const open = (): PracticeDatabase => (db ??= new PracticeDatabase(name));
  return {
    async load() {
      try {
        return (await open().saves.get(ACTIVE_SAVE_ID))?.envelope ?? null;
      } catch {
        return null;
      }
    },
    async save(envelope) {
      try {
        await open().saves.put({ id: ACTIVE_SAVE_ID, envelope });
      } catch {
        /* persistence is best-effort; it must never break the trade loop */
      }
    },
    async clear() {
      try {
        await open().saves.delete(ACTIVE_SAVE_ID);
      } catch {
        /* ignore */
      }
    },
  };
}

/** In-memory storage for tests and for browsers without IndexedDB. */
export function createMemoryPracticeStorage(seed: unknown = null): PracticeStorage {
  let current: unknown = seed;
  return {
    async load() {
      return current;
    },
    async save(envelope) {
      current = JSON.parse(JSON.stringify(envelope));
    },
    async clear() {
      current = null;
    },
  };
}
