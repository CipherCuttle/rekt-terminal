/**
 * MARKET_TRUTH_V1 simulator invariants.
 *
 * These cover the economic boundary: what evidence may enter execution, how a
 * trade records the evidence behind it, and that the deterministic
 * PROTECT_CAPITAL rehearsal can no longer masquerade as real practice.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_PROVENANCE_STATES,
  DEFAULT_FIRST_TICKET_WEI,
  DEFAULT_SPOT_FILL_CONFIG,
  createInitialSimState,
  createSessionOpenedEvent,
  createSpotFill,
  executeSpotAction,
  executeSyntheticProtectCapitalRehearsal,
  isRealEvidence,
  makeFixtureObservation,
  markSpot,
  placeSpotStop,
  priceX18,
  replayEvents,
  stableReplayDigest,
  weakestProvenance,
  wei,
} from '../dist/index.js';

const START = 1_700_000_000_000;

function session(evidencePolicy = 'LIVE_ONLY') {
  const initial = createInitialSimState({ sessionId: `mt-${evidencePolicy}`, startedAtMs: START, evidencePolicy });
  return replayEvents([createSessionOpenedEvent(initial, START)], initial);
}

function observation(overrides = {}) {
  return makeFixtureObservation({ observationId: 'mt-obs-1', observedAtMs: START, ...overrides });
}

function buy(state, obs, ordinal = 1, at = START) {
  return executeSpotAction(state, {
    type: 'BUY',
    intentId: `mt-intent-${ordinal}`,
    fillId: `mt-fill-${ordinal}`,
    eventTimeMs: at,
    observation: obs,
    quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI,
    config: DEFAULT_SPOT_FILL_CONFIG,
  });
}

/* ------------------------------------------------------------- taxonomy */

test('the canonical taxonomy is exactly five states and contains no ESTIMATED', () => {
  assert.deepEqual([...CANONICAL_PROVENANCE_STATES].sort(), ['CONFIRMED', 'DERIVED', 'STALE', 'SYNTHETIC', 'UNAVAILABLE']);
  assert.equal(CANONICAL_PROVENANCE_STATES.includes('ESTIMATED'), false);
});

test('combining provenance never strengthens a claim', () => {
  assert.equal(weakestProvenance('CONFIRMED', 'DERIVED'), 'DERIVED');
  assert.equal(weakestProvenance('CONFIRMED', 'SYNTHETIC'), 'SYNTHETIC');
  assert.equal(weakestProvenance('DERIVED', 'STALE'), 'STALE');
  assert.equal(weakestProvenance('CONFIRMED', 'CONFIRMED'), 'CONFIRMED');
  assert.equal(weakestProvenance(), 'UNAVAILABLE');
  assert.equal(isRealEvidence('SYNTHETIC'), false);
  assert.equal(isRealEvidence('DERIVED'), true);
});

/* ------------------------------------------ 8. synthetic cannot execute LIVE */

test('8. SYNTHETIC evidence cannot enter normal LIVE economic execution', () => {
  const state = session('LIVE_ONLY');
  const result = buy(state, observation({ provenance: 'SYNTHETIC' }));
  assert.equal(result.accepted, false);
  assert.match(result.reason, /SYNTHETIC_EVIDENCE_REJECTED/);
  assert.equal(result.state.position, null);
  assert.equal(result.state.account.freeEthWei, state.account.freeEthWei);
});

test('8b. SYNTHETIC evidence is refused for stops and marks under LIVE too', () => {
  let state = session('LIVE_ONLY');
  state = buy(state, observation()).state;
  assert.ok(state.position);
  const synthetic = observation({ observationId: 'mt-obs-syn', provenance: 'SYNTHETIC' });
  const stop = placeSpotStop(state, { stopId: 'mt-stop-1', stopPriceX18: priceX18(20_000_000_000_000_000n), observation: synthetic, eventTimeMs: START });
  assert.equal(stop.accepted, false);
  assert.match(stop.reason, /SYNTHETIC_EVIDENCE_REJECTED/);
  const marked = markSpot(state, synthetic, START);
  assert.equal(marked.accepted, false);
});

test('8c. the LIVE gate is the default for a session created without a policy', () => {
  const implicit = createInitialSimState({ sessionId: 'implicit', startedAtMs: START });
  assert.equal(implicit.evidencePolicy, 'LIVE_ONLY');
  assert.throws(
    () => createSpotFill({
      fillId: 'f', intentId: 'i', side: 'BUY',
      observation: observation({ provenance: 'SYNTHETIC' }),
      requestedQuoteWei: DEFAULT_FIRST_TICKET_WEI, executedAtMs: START, config: DEFAULT_SPOT_FILL_CONFIG,
    }),
    /synthetic market evidence cannot enter LIVE economic execution/,
  );
});

test('STALE and UNAVAILABLE evidence is refused under every policy', () => {
  for (const policy of ['LIVE_ONLY', 'DEMO_ALLOW_SYNTHETIC']) {
    for (const provenance of ['STALE', 'UNAVAILABLE']) {
      const result = buy(session(policy), observation({ provenance }));
      assert.equal(result.accepted, false, `${policy}/${provenance} must fail closed`);
    }
  }
});

/* ------------------------------------- 7. derived real evidence is eligible */

test('7. DERIVED real market evidence is simulator-eligible and records its provenance', () => {
  let state = session('LIVE_ONLY');
  const opened = buy(state, observation({ provenance: 'DERIVED' }));
  assert.equal(opened.accepted, true);
  const fillEvent = opened.events.find((event) => event.type === 'FILL_APPLIED');
  assert.equal(fillEvent.fill.observationProvenance, 'DERIVED');
  // The fill model itself is always a DERIVED output; that is separate from
  // the provenance of the observation it consumed.
  assert.equal(fillEvent.fill.provenance, 'DERIVED');
  assert.equal(fillEvent.fill.modelVersion, 'SPOT_FILL_V0');
});

test('CONFIRMED evidence is accepted and is not downgraded by the model', () => {
  const opened = buy(session('LIVE_ONLY'), observation({ provenance: 'CONFIRMED' }));
  assert.equal(opened.accepted, true);
  const fill = opened.events.find((event) => event.type === 'FILL_APPLIED').fill;
  assert.equal(fill.observationProvenance, 'CONFIRMED');
});

/* -------------------------------------------- evidence stamped on summaries */

test('a closed trade records the weakest evidence that contributed to it', () => {
  let state = session('DEMO_ALLOW_SYNTHETIC');
  state = buy(state, observation({ provenance: 'CONFIRMED' })).state;
  const close = executeSpotAction(state, {
    type: 'FULL_CLOSE', intentId: 'mt-close', fillId: 'mt-close-fill', eventTimeMs: START + 1_000,
    observation: observation({ observationId: 'mt-obs-2', observedAtMs: START + 1_000, provenance: 'SYNTHETIC' }),
    config: DEFAULT_SPOT_FILL_CONFIG,
  });
  assert.equal(close.accepted, true);
  const summary = close.state.tradeSummaries.at(-1);
  // Opened on confirmed evidence, closed on synthetic: the trade is synthetic.
  assert.equal(summary.evidenceProvenance, 'SYNTHETIC');
});

test('a wholly real trade is stamped with real evidence', () => {
  let state = session('LIVE_ONLY');
  state = buy(state, observation({ provenance: 'DERIVED' })).state;
  const close = executeSpotAction(state, {
    type: 'FULL_CLOSE', intentId: 'mt-close-2', fillId: 'mt-close-fill-2', eventTimeMs: START + 1_000,
    observation: observation({ observationId: 'mt-obs-3', observedAtMs: START + 1_000, provenance: 'DERIVED' }),
    config: DEFAULT_SPOT_FILL_CONFIG,
  });
  assert.equal(close.state.tradeSummaries.at(-1).evidenceProvenance, 'DERIVED');
});

/* ------------------------------- 14. one-click PROTECT_CAPITAL is disarmed */

test('14. the PROTECT_CAPITAL rehearsal is refused outright in a LIVE session', () => {
  const state = session('LIVE_ONLY');
  const result = executeSyntheticProtectCapitalRehearsal(state, observation({ provenance: 'DERIVED' }), START);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /SYNTHETIC_EVIDENCE_REJECTED/);
  assert.equal(result.state.tradeSummaries.length, 0);
  assert.equal(result.state.account.freeEthWei, state.account.freeEthWei);
});

test('14b. in an explicit DEMO session the rehearsal produces SYNTHETIC evidence only', () => {
  const state = session('DEMO_ALLOW_SYNTHETIC');
  const result = executeSyntheticProtectCapitalRehearsal(state, observation({ provenance: 'DERIVED' }), START);
  assert.equal(result.accepted, true);
  const summary = result.state.tradeSummaries.at(-1);
  assert.equal(summary.exitReason, 'PROTECT_CAPITAL');
  // The fabricated adverse move is labelled for what it is, so Career refuses it.
  assert.equal(summary.evidenceProvenance, 'SYNTHETIC');
  assert.ok(summary.realizedPnlWei < 0n);
  for (const event of result.state.events) {
    if (event.type === 'FILL_APPLIED') assert.equal(event.fill.observationProvenance, 'SYNTHETIC');
  }
});

/* -------------------------------------------- 16/17. nothing else moved */

test('16 + 17. SPOT_FILL_V0 economics and replay determinism are unchanged', () => {
  const obs = observation({ provenance: 'DERIVED' });
  const a = buy(session('LIVE_ONLY'), obs);
  const b = buy(session('LIVE_ONLY'), obs);
  const fillA = a.events.find((e) => e.type === 'FILL_APPLIED').fill;
  const fillB = b.events.find((e) => e.type === 'FILL_APPLIED').fill;
  // Identical inputs produce byte-identical economics.
  assert.equal(fillA.fillPriceX18, fillB.fillPriceX18);
  assert.equal(fillA.executedQuoteWei, fillB.executedQuoteWei);
  assert.equal(fillA.feeQuoteWei, fillB.feeQuoteWei);
  assert.equal(fillA.quantityAtoms, fillB.quantityAtoms);
  assert.equal(fillA.impactBps, fillB.impactBps);
  // And the exact SPOT_FILL_V0 numbers for a 0.05 ETH ticket at 0.025 ETH:
  assert.equal(fillA.referencePriceX18, 25_000_000_000_000_000n);
  assert.equal(stableReplayDigest(a.state), stableReplayDigest(b.state));
  assert.equal(stableReplayDigest(replayEvents(a.state.events, session('LIVE_ONLY'))), stableReplayDigest(a.state));
});

test('a DEMO session cannot create ETH out of nothing', () => {
  const state = session('DEMO_ALLOW_SYNTHETIC');
  const result = buy(state, observation({ provenance: 'SYNTHETIC' }));
  assert.equal(result.accepted, true);
  // Fabricated evidence still buys at the fabricated price with real fees; no
  // economics were relaxed to make DEMO easier.
  assert.ok(result.state.account.freeEthWei < state.account.freeEthWei);
  assert.equal(result.state.evidencePolicy, 'DEMO_ALLOW_SYNTHETIC');
});

/* --------------------------------------------- 18. no real execution path */

test('18. the simulator exposes no signing or broadcast surface', async () => {
  const sim = await import('../dist/index.js');
  const forbidden = ['sendTransaction', 'signTransaction', 'writeContract', 'connectWallet', 'approve'];
  for (const name of forbidden) assert.equal(name in sim, false, `${name} must not be exported`);
  assert.equal(typeof wei, 'function');
});
