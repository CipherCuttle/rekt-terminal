/**
 * MARKET_TRUTH_V1 Career invariants.
 *
 * The central claim: qualification asserts the player demonstrated a behaviour
 * in a real market. Evidence that is not CONFIRMED or DERIVED demonstrates
 * nothing and must advance nothing.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialCareer, isGradableEvidence, reduceCareer } from '../dist/index.js';

const START = 1_700_000_000_000;

function closed(id, { lossBps = 0n, equity = 500_000_000_000_000_000n, exitReason = 'MANUAL', evidenceProvenance = 'DERIVED' } = {}) {
  return {
    type: 'TRADE_CLOSED',
    eventId: `${id}:closed`,
    sourceReceiptId: `${id}:sim-receipt`,
    summary: {
      tradeId: id,
      sessionId: 'market-truth-session',
      mode: 'SPOT',
      realizedPnlWei: lossBps > 0n ? -1n : 1n,
      accountEquityAtCloseWei: equity,
      lossBpsOfThenCurrentEquity: lossBps,
      accountEquityAtOpenWei: 500_000_000_000_000_000n,
      exitReason,
      stopUsed: false,
      partialExitUsed: false,
      liquidated: false,
      evidenceProvenance,
    },
  };
}

test('only CONFIRMED and DERIVED evidence is gradable', () => {
  assert.equal(isGradableEvidence('CONFIRMED'), true);
  assert.equal(isGradableEvidence('DERIVED'), true);
  for (const state of ['SYNTHETIC', 'STALE', 'UNAVAILABLE']) {
    assert.equal(isGradableEvidence(state), false);
  }
});

/* ------------------------------------- 3. DEMO cannot advance qualification */

test('3. a full run of SYNTHETIC trades advances no Career statistic at all', () => {
  let state = createInitialCareer('demo-isolation', START);
  for (let i = 1; i <= 12; i += 1) {
    state = reduceCareer(state, closed(`demo-${i}`, { lossBps: i % 3 === 0 ? 400n : 0n, evidenceProvenance: 'SYNTHETIC' }));
  }
  assert.equal(state.stats.closedSpotTrades, 0);
  assert.equal(state.stats.qualifyingScaleTrades, 0);
  assert.equal(state.stats.manualLossCuts, 0);
  assert.equal(state.stats.protectCapitalChallenges, 0);
  assert.equal(state.unlockedSkills.includes('SCALE_CONTROL'), false);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), false);
  assert.deepEqual(state.unlockedCapabilities.includes('STOP_MARKET'), false);
});

test('3b. STALE and UNAVAILABLE evidence is equally inert', () => {
  for (const evidenceProvenance of ['STALE', 'UNAVAILABLE']) {
    let state = createInitialCareer(`inert-${evidenceProvenance}`, START);
    for (let i = 1; i <= 6; i += 1) state = reduceCareer(state, closed(`t-${i}`, { evidenceProvenance }));
    assert.equal(state.stats.closedSpotTrades, 0, `${evidenceProvenance} must not advance`);
  }
});

test('3c. a synthetic trade cannot be replayed later under a stronger label', () => {
  let state = createInitialCareer('relabel', START);
  state = reduceCareer(state, closed('launder-1', { evidenceProvenance: 'SYNTHETIC' }));
  assert.equal(state.stats.closedSpotTrades, 0);
  // Same trade id, now claiming DERIVED. Idempotency by trade id refuses it.
  state = reduceCareer(state, { ...closed('launder-1', { evidenceProvenance: 'DERIVED' }), eventId: 'launder-1:closed:again' });
  assert.equal(state.stats.closedSpotTrades, 0);
});

test('3d. behavioural events without real evidence advance nothing', () => {
  let state = createInitialCareer('behaviour', START);
  for (const evidenceProvenance of ['SYNTHETIC', 'STALE', 'UNAVAILABLE', undefined]) {
    state = reduceCareer(state, { type: 'SCALE_IN_USED', eventId: `scale-${evidenceProvenance}`, sourceReceiptId: 'r', evidenceProvenance });
    state = reduceCareer(state, { type: 'PARTIAL_EXIT_USED', eventId: `partial-${evidenceProvenance}`, sourceReceiptId: 'r', evidenceProvenance });
    state = reduceCareer(state, { type: 'STOP_PLACED', eventId: `stop-${evidenceProvenance}`, sourceReceiptId: 'r', evidenceProvenance });
  }
  assert.equal(state.stats.scaleInsUsed, 0);
  assert.equal(state.stats.partialExitsUsed, 0);
  assert.equal(state.stats.stopUses, 0);
  // The same events with real evidence do count.
  state = reduceCareer(state, { type: 'SCALE_IN_USED', eventId: 'scale-real', sourceReceiptId: 'r', evidenceProvenance: 'DERIVED' });
  state = reduceCareer(state, { type: 'STOP_PLACED', eventId: 'stop-real', sourceReceiptId: 'r', evidenceProvenance: 'CONFIRMED' });
  assert.equal(state.stats.scaleInsUsed, 1);
  assert.equal(state.stats.stopUses, 1);
});

/* ------------------------- 14. fabricated PROTECT_CAPITAL cannot qualify */

test('14. a SYNTHETIC PROTECT_CAPITAL trade cannot advance STOP_LOSS', () => {
  let state = createInitialCareer('fake-protect', START);
  // Four legitimate trades, then the fabricated "challenge" as the fifth.
  for (let i = 1; i <= 4; i += 1) state = reduceCareer(state, closed(`real-${i}`));
  state = reduceCareer(state, closed('fabricated', { lossBps: 400n, exitReason: 'PROTECT_CAPITAL', evidenceProvenance: 'SYNTHETIC' }));
  assert.equal(state.stats.protectCapitalChallenges, 0);
  assert.equal(state.stats.closedSpotTrades, 4);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), false);
  assert.equal(state.qualification.stopLoss.qualified, false);
});

test('14b. the contract PROTECT_CAPITAL path survives for real evidence', () => {
  // CAREER_CONTRACT_V0 §7 keeps PROTECT_CAPITAL as an alternate route to
  // STOP_LOSS for a future historical Replay mission. It must still work when
  // the evidence behind it is real — it is the fabrication that was removed,
  // not the concept.
  let state = createInitialCareer('real-protect', START);
  for (let i = 1; i <= 4; i += 1) state = reduceCareer(state, closed(`rp-${i}`));
  state = reduceCareer(state, closed('replayed', { lossBps: 400n, exitReason: 'PROTECT_CAPITAL', evidenceProvenance: 'CONFIRMED' }));
  assert.equal(state.stats.protectCapitalChallenges, 1);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), true);
});

/* ------------------------- 15. genuine manual loss cut still qualifies */

test('15. genuine MANUAL_LOSS_CUT qualification still works end to end', () => {
  let state = createInitialCareer('manual-cut', START);
  for (let i = 1; i <= 4; i += 1) state = reduceCareer(state, closed(`mc-${i}`));
  assert.equal(state.unlockedSkills.includes('SCALE_CONTROL'), true);
  state = reduceCareer(state, closed('mc-5', { lossBps: 499n, exitReason: 'MANUAL', evidenceProvenance: 'DERIVED' }));
  assert.equal(state.stats.manualLossCuts, 1);
  assert.equal(state.stats.closedSpotTrades, 5);
  assert.equal(state.qualification.stopLoss.qualified, true);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), true);
  assert.equal(state.unlockedCapabilities.includes('STOP_MARKET'), true);
});

test('15b. DEMO trades interleaved with real ones do not contaminate the count', () => {
  let state = createInitialCareer('mixed', START);
  for (let i = 1; i <= 4; i += 1) {
    state = reduceCareer(state, closed(`mix-real-${i}`));
    state = reduceCareer(state, closed(`mix-demo-${i}`, { evidenceProvenance: 'SYNTHETIC' }));
  }
  assert.equal(state.stats.closedSpotTrades, 4);
  state = reduceCareer(state, closed('mix-real-5', { lossBps: 400n }));
  assert.equal(state.stats.closedSpotTrades, 5);
  assert.equal(state.stats.manualLossCuts, 1);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), true);
});
