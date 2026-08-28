/**
 * Canonical provenance taxonomy — CANONICAL_PROVENANCE_V1.
 *
 * Exactly five states exist across API, web, simulator and presentation:
 *
 *   CONFIRMED    direct evidence with identity strong enough to justify the label
 *   DERIVED      deterministic/aggregate calculation from observed inputs
 *   SYNTHETIC    fabricated/demo/simulator-generated market scenario evidence
 *   STALE        exceeded the freshness contract
 *   UNAVAILABLE  evidence required for the requested claim/action does not exist
 *
 * There is no `ESTIMATED`, and no synonyms. A migration between vocabularies
 * must never *strengthen* a fact, so every combining helper here resolves to the
 * weakest input rather than the strongest.
 */
import type { ProvenanceState } from './types.js';

export const CANONICAL_PROVENANCE_STATES: readonly ProvenanceState[] = [
  'CONFIRMED',
  'DERIVED',
  'SYNTHETIC',
  'STALE',
  'UNAVAILABLE',
];

/**
 * Ordering used only to pick the weakest of several claims. A larger number is
 * a weaker claim. SYNTHETIC/STALE/UNAVAILABLE are all "not usable as real
 * economic evidence"; their relative order only decides which word is reported.
 */
const STRENGTH: Record<ProvenanceState, number> = {
  CONFIRMED: 0,
  DERIVED: 1,
  SYNTHETIC: 2,
  STALE: 3,
  UNAVAILABLE: 4,
};

export function isCanonicalProvenance(value: unknown): value is ProvenanceState {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STRENGTH, value);
}

/** Provenance classes the simulator accepts as real economic evidence. */
export function isRealEvidence(state: ProvenanceState): boolean {
  return state === 'CONFIRMED' || state === 'DERIVED';
}

/**
 * Combine claims without ever strengthening one. Used to stamp a closed trade
 * with the weakest evidence that contributed to it, so a single synthetic fill
 * can never be laundered into a confirmed trade record.
 */
export function weakestProvenance(...states: readonly ProvenanceState[]): ProvenanceState {
  if (states.length === 0) return 'UNAVAILABLE';
  return states.reduce((weakest, state) => (STRENGTH[state] > STRENGTH[weakest] ? state : weakest));
}
