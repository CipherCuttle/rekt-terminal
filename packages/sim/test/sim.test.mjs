import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEFAULT_FIRST_TICKET_WEI,
  DEFAULT_SPOT_FILL_CONFIG,
  INITIAL_BANKROLL_WEI,
  SimError,
  applySimEvent,
  bps,
  createFixedBuyAction,
  createGoldenReplay,
  createInitialSimState,
  createSessionOpenedEvent,
  createSpotFill,
  equityReconciliation,
  executeSpotAction,
  makeFixtureObservation,
  markSpot,
  priceX18,
  quantityAtoms,
  replayEvents,
  stableReplayDigest,
  wei,
} from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const start = 1_700_000_000_000;
const noImpact = { ...DEFAULT_SPOT_FILL_CONFIG, feeBps: bps(0n), baseSlippageBps: bps(0n), impactCoefficientBpsPerParticipationBps: 0n, maxParticipationBps: bps(10_000n) };

function opened(sessionId = 'test-session') {
  const initial = createInitialSimState({ sessionId, startedAtMs: start });
  return replayEvents([createSessionOpenedEvent(initial, start)], initial);
}

function observation(id, price, at = start) {
  return makeFixtureObservation({ observationId: id, referencePriceX18: priceX18(price), observedAtMs: at });
}

function buy(state, id, price, quote, at, config = noImpact) {
  return executeSpotAction(state, { type: 'BUY', intentId: `${id}-intent`, fillId: id, eventTimeMs: at, observation: observation(`${id}-obs`, price, at), quoteNotionalWei: wei(quote), config });
}

test('initial account is exactly 0.500000000000000000 ETH', () => {
  const state = createInitialSimState({ sessionId: 'initial', startedAtMs: start });
  assert.equal(state.account.freeEthWei, INITIAL_BANKROLL_WEI);
  assert.equal(state.account.equityWei, 500_000_000_000_000_000n);
});

test('fixed first ticket is represented as exact wei without floating-point drift', () => {
  const result = executeSpotAction(opened(), createFixedBuyAction({
    intentId: 'fixed-intent', fillId: 'fixed-fill', eventTimeMs: start,
    observation: observation('fixed-observation', 25_000_000_000_000_000n), config: noImpact,
  }));
  assert.equal(result.accepted, true);
  const fill = result.events.find((event) => event.type === 'FILL_APPLIED');
  assert.equal(fill?.type, 'FILL_APPLIED');
  assert.equal(fill.fill.requestedQuoteWei, DEFAULT_FIRST_TICKET_WEI);
  assert.equal(result.state.position?.openQuantityAtoms, 2_000_000_000_000_000_000n);
});

test('SPOT_FILL_V0 applies deterministic participation impact and conservative side rounding', () => {
  const buyFill = createSpotFill({
    fillId: 'model-buy', intentId: 'model-buy-intent', side: 'BUY',
    observation: observation('model-observation', 25_000_000_000_000_000n),
    requestedQuoteWei: wei(50_000_000_000_000_000n), executedAtMs: start, config: DEFAULT_SPOT_FILL_CONFIG,
  });
  assert.equal(buyFill.impactBps, 55n);
  assert.equal(buyFill.fillPriceX18, 25_137_500_000_000_000n);
  const sellFill = createSpotFill({
    fillId: 'model-sell', intentId: 'model-sell-intent', side: 'SELL',
    observation: observation('model-observation-sell', 25_000_000_000_000_000n),
    requestedQuoteWei: wei(50_000_000_000_000_000n), requestedQuantityAtoms: quantityAtoms(1_000_000_000_000_000_000n), executedAtMs: start, config: DEFAULT_SPOT_FILL_CONFIG,
  });
  assert.equal(sellFill.fillPriceX18, 24_862_500_000_000_000n);
});

test('scale-in recomputes weighted average entry from integer cost and quantity', () => {
  let state = opened('average');
  const first = buy(state, 'average-1', 1_000_000_000_000_000_000n, 100_000_000_000_000_000n, start);
  assert.equal(first.accepted, true);
  state = first.state;
  const second = executeSpotAction(state, { type: 'SCALE_IN', intentId: 'average-intent-2', fillId: 'average-fill-2', eventTimeMs: start + 1_000, observation: observation('average-obs-2', 2_000_000_000_000_000_000n, start + 1_000), quoteNotionalWei: wei(100_000_000_000_000_000n), config: noImpact });
  assert.equal(second.accepted, true);
  assert.equal(second.state.position?.costBasisWei, 200_000_000_000_000_000n);
  assert.equal(second.state.position?.openQuantityAtoms, 150_000_000_000_000_000n);
  assert.equal(second.state.position?.averageEntryPriceX18, 1_333_333_333_333_333_333n);
});

test('uneven entry sizes use the quantity-weighted median and exits do not change it', () => {
  let state = opened('median');
  state = buy(state, 'median-1', 1_000_000_000_000_000_000n, 50_000_000_000_000_000n, start).state;
  state = executeSpotAction(state, { type: 'SCALE_IN', intentId: 'median-intent-2', fillId: 'median-fill-2', eventTimeMs: start + 1_000, observation: observation('median-obs-2', 3_000_000_000_000_000_000n, start + 1_000), quoteNotionalWei: wei(300_000_000_000_000_000n), config: noImpact }).state;
  assert.equal(state.position?.medianEntryPriceX18, 3_000_000_000_000_000_000n);
  const partial = executeSpotAction(state, { type: 'PARTIAL_CLOSE', intentId: 'median-intent-3', fillId: 'median-fill-3', eventTimeMs: start + 2_000, observation: observation('median-obs-3', 2_000_000_000_000_000_000n, start + 2_000), quantityAtoms: quantityAtoms(25_000_000_000_000_000n), config: noImpact });
  assert.equal(partial.accepted, true);
  assert.equal(partial.state.position?.medianEntryPriceX18, 3_000_000_000_000_000_000n);
});

test('partial and full closes allocate cost basis and entry fees once', () => {
  const feeConfig = { ...noImpact, feeBps: bps(100n) };
  let state = opened('fees');
  state = buy(state, 'fees-1', 1_000_000_000_000_000_000n, 100_000_000_000_000_000n, start, feeConfig).state;
  const partial = executeSpotAction(state, { type: 'PARTIAL_CLOSE', intentId: 'fees-intent-2', fillId: 'fees-fill-2', eventTimeMs: start + 1_000, observation: observation('fees-obs-2', 2_000_000_000_000_000_000n, start + 1_000), quantityAtoms: quantityAtoms(50_000_000_000_000_000n), config: feeConfig });
  assert.equal(partial.accepted, true);
  assert.equal(partial.state.position?.costBasisWei, 50_000_000_000_000_000n);
  assert.equal(partial.state.position?.remainingEntryFeesWei, 500_000_000_000_000n);
  assert.equal(partial.state.account.realizedPnlWei, 48_500_000_000_000_000n);
  assert.deepEqual(equityReconciliation(partial.state).differenceWei, 0n);
  state = partial.state;
  const full = executeSpotAction(state, { type: 'FULL_CLOSE', intentId: 'fees-intent-3', fillId: 'fees-fill-3', eventTimeMs: start + 2_000, observation: observation('fees-obs-3', 1_500_000_000_000_000_000n, start + 2_000), config: feeConfig });
  assert.equal(full.accepted, true);
  assert.equal(full.state.position, null);
  assert.equal(full.state.account.realizedPnlWei, 72_250_000_000_000_000n);
  assert.equal(full.state.tradeSummaries[0].entryFeesWei, 1_000_000_000_000_000n);
  assert.equal(full.state.tradeSummaries[0].exitFeesWei, 1_750_000_000_000_000n);
  assert.deepEqual(equityReconciliation(full.state).differenceWei, 0n);
});

test('duplicate event and duplicate fill identity have no duplicate economic effect', () => {
  const first = buy(opened('dupes'), 'dupe-fill', 1_000_000_000_000_000_000n, 100_000_000_000_000_000n, start);
  assert.equal(first.accepted, true);
  const fillEvent = first.events.find((event) => event.type === 'FILL_APPLIED');
  assert.equal(fillEvent?.type, 'FILL_APPLIED');
  const sameEvent = applySimEvent(first.state, fillEvent);
  assert.deepEqual(sameEvent, first.state);
  const duplicateFill = applySimEvent(first.state, { ...fillEvent, eventId: 'same-economic-fill-again', sequence: first.state.lastSequence + 1 });
  assert.equal(duplicateFill.account.freeEthWei, first.state.account.freeEthWei);
  assert.equal(duplicateFill.position?.openQuantityAtoms, first.state.position?.openQuantityAtoms);
});

test('market marks update unrealized PnL and high-water drawdown without changing free ETH', () => {
  const openedState = buy(opened('drawdown'), 'drawdown-buy', 1_000_000_000_000_000_000n, 100_000_000_000_000_000n, start).state;
  const wrongInstrument = markSpot(openedState, makeFixtureObservation({ observationId: 'wrong-instrument', instrumentId: 'OTHER-PAIR', observedAtMs: start + 1_000 }), start + 1_000, noImpact);
  assert.equal(wrongInstrument.accepted, false);
  const marked = markSpot(openedState, observation('drawdown-mark', 500_000_000_000_000_000n, start + 1_000), start + 1_000, noImpact);
  assert.equal(marked.accepted, true);
  assert.equal(marked.state.account.freeEthWei, 400_000_000_000_000_000n);
  assert.equal(marked.state.account.unrealizedPnlWei, -50_000_000_000_000_000n);
  assert.equal(marked.state.account.equityWei, 450_000_000_000_000_000n);
  assert.equal(marked.state.account.highWaterEquityWei, 500_000_000_000_000_000n);
  assert.equal(marked.state.account.maxDrawdownBps, 1_000n);
});

test('out-of-order events, stale observations, unsupported quotes, and participation fail closed', () => {
  const state = opened('fail-closed');
  assert.throws(() => applySimEvent(state, { type: 'ACCOUNT_SNAPSHOT', eventId: 'gap', sequence: 3, sessionId: state.sessionId, modelVersion: state.modelVersion, eventTimeMs: start, markPriceX18: 1n, account: state.account }), (error) => error instanceof SimError && error.code === 'OUT_OF_ORDER_EVENT');
  assert.throws(() => createSpotFill({ fillId: 'stale-fill', intentId: 'stale-intent', side: 'BUY', observation: observation('stale-obs', 1_000_000_000_000_000_000n, start - 100_000), requestedQuoteWei: wei(1n), executedAtMs: start, config: noImpact }), (error) => error instanceof SimError && error.code === 'STALE_MARKET');
  assert.throws(() => createSpotFill({ fillId: 'quote-fill', intentId: 'quote-intent', side: 'BUY', observation: makeFixtureObservation({ quoteAsset: 'USDC' }), requestedQuoteWei: wei(1n), executedAtMs: start, config: noImpact }), (error) => error instanceof SimError && error.code === 'UNSUPPORTED_QUOTE');
  assert.throws(() => createSpotFill({ fillId: 'liquidity-fill', intentId: 'liquidity-intent', side: 'BUY', observation: makeFixtureObservation({ usableQuoteLiquidityWei: wei(0n) }), requestedQuoteWei: wei(1n), executedAtMs: start, config: noImpact }), (error) => error instanceof SimError && error.code === 'MISSING_LIQUIDITY');
  assert.throws(() => createSpotFill({ fillId: 'participation-fill', intentId: 'participation-intent', side: 'BUY', observation: makeFixtureObservation({ usableQuoteLiquidityWei: wei(1n) }), requestedQuoteWei: wei(2n), executedAtMs: start, config: noImpact }), (error) => error instanceof SimError && error.code === 'PARTICIPATION_LIMIT');
  assert.throws(() => createSpotFill({ fillId: 'model-fill', intentId: 'model-intent', side: 'BUY', observation: makeFixtureObservation(), requestedQuoteWei: wei(1n), executedAtMs: start, config: { ...noImpact, modelVersion: 'OTHER_MODEL' } }), (error) => error instanceof SimError && error.code === 'MODEL_INPUT_UNAVAILABLE');
  assert.throws(() => createSpotFill({ fillId: 'fee-fill', intentId: 'fee-intent', side: 'BUY', observation: makeFixtureObservation(), requestedQuoteWei: wei(1n), executedAtMs: start, config: { ...noImpact, feeBps: bps(10_001n) } }), (error) => error instanceof SimError && error.code === 'MODEL_INPUT_UNAVAILABLE');
});

test('replay digest is stable in two independent processes', () => {
  const expected = createGoldenReplay();
  const one = createGoldenReplay();
  const two = createGoldenReplay();
  assert.equal(one.digest, two.digest);
  assert.equal(one.digest, expected.digest);
  const replayed = replayEvents(expected.events, createInitialSimState({ sessionId: 'phase-0-golden-session', startedAtMs: 1_700_000_000_000 }));
  assert.equal(stableReplayDigest(replayed), expected.digest);
});

test('domain packages remain framework-free and expose no signing/execution integration', () => {
  const sourceRoot = join(here, '..', 'src');
  const files = readdirSync(sourceRoot, { recursive: true }).filter((file) => String(file).endsWith('.ts'));
  for (const file of files) {
    const source = readFileSync(join(sourceRoot, file), 'utf8');
    assert.doesNotMatch(source, /from ['"](?:react|react-dom)|require\(['"](?:react|react-dom)/);
    assert.doesNotMatch(source, /privateKey|sendTransaction|signMessage|broadcastTransaction/);
  }
});
