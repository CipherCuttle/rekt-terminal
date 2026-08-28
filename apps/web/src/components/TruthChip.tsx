import type { ProvenanceState } from '@rekt-ink/sim';
import type { Provenance } from '../types/api';

/**
 * Truth label for a piece of market information.
 *
 * The state word is always rendered as text. Colour is a secondary cue only —
 * source state is never communicated by colour alone.
 */
const CLASS_FOR_STATE: Record<ProvenanceState, string> = {
  CONFIRMED: 'truth-confirmed',
  DERIVED: 'truth-derived',
  SYNTHETIC: 'truth-synthetic',
  STALE: 'truth-stale',
  UNAVAILABLE: 'truth-unavailable',
};

export function TruthChip({ state, title }: { state: ProvenanceState; title?: string }) {
  return (
    <span className={`truth ${CLASS_FOR_STATE[state]}`} title={title}>
      {state}
    </span>
  );
}

/** Legacy web-provenance shape used by Radar rows and the dormant dev screens. */
export function ProvenanceChip({ p }: { p: Provenance }) {
  const state: ProvenanceState = p.state === 'ESTIMATED' ? 'SYNTHETIC' : p.state;
  return <TruthChip state={state} title={`${p.source} · ${p.asOf} · ${p.method}${p.block ? ` · block ${p.block}` : ''}`} />;
}
