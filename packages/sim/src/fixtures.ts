import { createInitialSimState, createSessionOpenedEvent, replayEvents } from './ledger.js';
import { DEFAULT_SPOT_FILL_CONFIG, makeFixtureObservation } from './fill-models/spot-fill-v0.js';
import { divRound } from './math.js';
import { executeSpotAction } from './spot.js';
import { stableReplayDigest } from './replay.js';
import { DEFAULT_FIRST_TICKET_WEI, priceX18, quantityAtoms, type SimState } from './types.js';
import type { SimEvent } from './events.js';

export const GOLDEN_SESSION_ID = 'phase-0-golden-session';
export const GOLDEN_START_MS = 1_700_000_000_000;

export function createGoldenReplay(): { state: SimState; events: readonly SimEvent[]; digest: string } {
  const initial = createInitialSimState({ sessionId: GOLDEN_SESSION_ID, startedAtMs: GOLDEN_START_MS });
  let state = replayEvents([createSessionOpenedEvent(initial, GOLDEN_START_MS)], initial);
  const observations = [
    makeFixtureObservation({ observationId: 'golden-entry-1', observedAtMs: GOLDEN_START_MS }),
    makeFixtureObservation({ observationId: 'golden-entry-2', referencePriceX18: priceX18(30_000_000_000_000_000n), observedAtMs: GOLDEN_START_MS + 1_000 }),
    makeFixtureObservation({ observationId: 'golden-exit-1', referencePriceX18: priceX18(32_000_000_000_000_000n), observedAtMs: GOLDEN_START_MS + 2_000 }),
    makeFixtureObservation({ observationId: 'golden-exit-2', referencePriceX18: priceX18(28_000_000_000_000_000n), observedAtMs: GOLDEN_START_MS + 3_000 }),
  ];
  const actions = [
    { type: 'BUY' as const, intentId: 'golden-intent-1', fillId: 'golden-fill-1', eventTimeMs: GOLDEN_START_MS, observation: observations[0], quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI, config: DEFAULT_SPOT_FILL_CONFIG },
    { type: 'SCALE_IN' as const, intentId: 'golden-intent-2', fillId: 'golden-fill-2', eventTimeMs: GOLDEN_START_MS + 1_000, observation: observations[1], quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI, config: DEFAULT_SPOT_FILL_CONFIG },
  ];
  for (const action of actions) {
    const result = executeSpotAction(state, action);
    if (!result.accepted) throw new Error(result.reason);
    state = result.state;
  }
  const partial = executeSpotAction(state, {
    type: 'PARTIAL_CLOSE', intentId: 'golden-intent-3', fillId: 'golden-fill-3', eventTimeMs: GOLDEN_START_MS + 2_000,
    observation: observations[2], quantityAtoms: quantityAtoms(divRound(state.position!.openQuantityAtoms, 3n, 'floor')), config: DEFAULT_SPOT_FILL_CONFIG,
  });
  if (!partial.accepted) throw new Error(partial.reason);
  state = partial.state;
  const full = executeSpotAction(state, {
    type: 'FULL_CLOSE', intentId: 'golden-intent-4', fillId: 'golden-fill-4', eventTimeMs: GOLDEN_START_MS + 3_000,
    observation: observations[3], config: DEFAULT_SPOT_FILL_CONFIG,
  });
  if (!full.accepted) throw new Error(full.reason);
  state = full.state;
  return { state, events: state.events, digest: stableReplayDigest(state) };
}
