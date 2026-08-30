import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_BANKROLL_WEI,
  MARGIN_TRAINING_EPISODES,
  advanceMarginShortMark,
  closeMarginLong,
  closeMarginShort,
  createMarginSession,
  createShortMarginSession,
  deriveLongMarginCompletion,
  estimateShortLiquidationPrice,
  openMarginLong,
  openMarginShort,
  placeMarginShortStop,
  placeMarginStop,
  replayMarginShortActions,
  serializeShortMarginState,
  usdMicros,
} from '../dist/index.js';

function episode(prices, funding = []) {
  const start = 1_700_100_000_000;
  return {
    episodeId: `SHORT_TEST_${prices.join('_')}_${funding.length}`,
    instrumentId: 'ETHUSDT-PERP', sourceVenue: 'TEST', sourceLabel: 'TEST',
    startTimeMs: start, endTimeMs: start + (prices.length - 1) * 60_000,
    startEthUsdPriceMicros: usdMicros(String(prices[0])),
    marks: prices.map((price, index) => ({ markId: `m${index}`, eventTimeMs: start + index * 60_000, priceUsdMicros: usdMicros(String(price)), sourceId: `TEST:${index}`, provenance: 'DERIVED' })),
    funding,
    maintenanceMarginBps: 50n, takerFeeBps: 5n, liquidationFeeBps: 50n, fillSlippageBps: 5n, liquidationSlippageBps: 25n,
    marketProvenance: 'DERIVED', intrabarRule: 'OHLC_PATH_V0', modelVersion: 'SIM_MARGIN_V0',
  };
}

function shortSession(id, ep) { return createShortMarginSession({ sessionId: id, careerEquityWei: INITIAL_BANKROLL_WEI, episode: ep }); }

test('SHORT opens at 1x and 2x, receives adverse SELL entry fill, and >2x is rejected', () => {
  const ep = episode([2500, 2450]);
  for (const leverage of [1, 2]) {
    const result = openMarginShort(shortSession(`open-${leverage}`, ep), ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage, stopPriceUsdMicros: usdMicros('3000') });
    assert.equal(result.accepted, true);
    assert.equal(result.state.position.leverage, leverage);
    assert.ok(result.state.position.entryFillPriceUsdMicros < usdMicros('2500'));
  }
  const rejected = openMarginShort(shortSession('open-3', ep), ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 3, stopPriceUsdMicros: usdMicros('3000') });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.code, 'LEVERAGE_LIMIT');
});

test('falling price profits SHORT; rising price loses; closing BUY is adverse', () => {
  const down = episode([2500, 2400, 2400]);
  let state = openMarginShort(shortSession('down', down), down, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('3000') }).state;
  state = advanceMarginShortMark(state, down, { actionId: 'advance' }).state;
  const closedDown = closeMarginShort(state, down, { actionId: 'close' });
  assert.ok(closedDown.state.lastTrade.netPnlUsdMicros > 0n);
  assert.ok(closedDown.state.lastTrade.exitPriceUsdMicros > usdMicros('2400'));

  const up = episode([2500, 2550, 2550]);
  state = openMarginShort(shortSession('up', up), up, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('3000') }).state;
  state = advanceMarginShortMark(state, up, { actionId: 'advance' }).state;
  const closedUp = closeMarginShort(state, up, { actionId: 'close' });
  assert.ok(closedUp.state.lastTrade.netPnlUsdMicros < 0n);
  assert.ok(closedUp.state.lastTrade.entryFeeUsdMicros > 0n);
  assert.ok(closedUp.state.lastTrade.exitFeeUsdMicros > 0n);
});

test('positive funding benefits SHORT and negative funding costs SHORT', () => {
  const start = 1_700_100_000_000;
  const positive = [{ fundingId: 'f+', eventTimeMs: start + 30_000, ratePpm: 1_000n, markPriceUsdMicros: usdMicros('2500'), sourceId: 'TEST:F+', provenance: 'DERIVED' }];
  const negative = [{ ...positive[0], fundingId: 'f-', ratePpm: -1_000n, sourceId: 'TEST:F-' }];
  for (const [funding, sign] of [[positive, -1], [negative, 1]]) {
    const ep = episode([2500, 2500, 2500], funding);
    let state = openMarginShort(shortSession(`fund-${sign}`, ep), ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('3000') }).state;
    state = advanceMarginShortMark(state, ep, { actionId: 'advance' }).state;
    assert.equal(Math.sign(Number(state.position.accruedFundingUsdMicros)), sign);
  }
});

test('SHORT liquidation is above entry even at 1x and forced liquidation never makes free collateral negative', () => {
  const ep = episode([2500, 5200]);
  for (const leverage of [1, 2]) {
    let state = openMarginShort(shortSession(`liq-${leverage}`, ep), ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage, stopPriceUsdMicros: null }).state;
    const liq = estimateShortLiquidationPrice(state.position, ep);
    assert.ok(liq > state.position.entryFillPriceUsdMicros);
    state = advanceMarginShortMark(state, ep, { actionId: 'up' }).state;
    if (leverage === 2) {
      assert.equal(state.liquidated, true);
      assert.equal(state.lastTrade.closeReason, 'LIQUIDATION');
      assert.ok(state.freeCollateralUsdMicros >= 0n);
    }
  }
});

test('SHORT stop geometry is symmetric: above current accepted, at/below current rejected, liquidation buffer enforced', () => {
  const ep = episode([2500, 2400, 2400]);
  let state = openMarginShort(shortSession('stops', ep), ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('3000') }).state;
  state = advanceMarginShortMark(state, ep, { actionId: 'down' }).state;
  const stale = placeMarginShortStop(state, ep, { actionId: 'stale', stopPriceUsdMicros: usdMicros('2350') });
  assert.equal(stale.accepted, false);
  assert.equal(stale.code, 'INVALID_STOP');
  const safe = placeMarginShortStop(state, ep, { actionId: 'safe', stopPriceUsdMicros: usdMicros('2900') });
  assert.equal(safe.accepted, true);
  const liq = estimateShortLiquidationPrice(state.position, ep);
  const nearLiq = placeMarginShortStop(state, ep, { actionId: 'near-liq', stopPriceUsdMicros: liq - usdMicros('1') });
  assert.equal(nearLiq.accepted, false);
  assert.equal(nearLiq.code, 'STOP_TOO_CLOSE_TO_LIQUIDATION');
});

test('sampled gap that crosses both SHORT stop and liquidation liquidates first', () => {
  const ep = episode([2500, 5000]);
  let state = openMarginShort(shortSession('gap', ep), ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('3000') }).state;
  state = advanceMarginShortMark(state, ep, { actionId: 'gap-up' }).state;
  assert.equal(state.lastTrade.closeReason, 'LIQUIDATION');
  assert.equal(state.liquidated, true);
});

test('SHORT duplicate action ids are idempotent and replay is byte-identical to interactive public execution', () => {
  const ep = episode([2500, 2400, 2450]);
  let state = shortSession('replay', ep);
  state = openMarginShort(state, ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('3000') }).state;
  const duplicate = openMarginShort(state, ep, { actionId: 'open', marginUsdMicros: usdMicros('999'), leverage: 1 });
  assert.equal(serializeShortMarginState(duplicate.state), serializeShortMarginState(state));
  state = advanceMarginShortMark(state, ep, { actionId: 'advance' }).state;
  state = placeMarginShortStop(state, ep, { actionId: 'stale', stopPriceUsdMicros: usdMicros('2350') }).state;
  const replayed = replayMarginShortActions({
    sessionId: 'replay', careerEquityWei: INITIAL_BANKROLL_WEI, episode: ep,
    actions: [
      { type: 'OPEN_SHORT', actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('3000') },
      { type: 'ADVANCE', actionId: 'advance' },
      { type: 'PLACE_SHORT_STOP', actionId: 'stale', stopPriceUsdMicros: usdMicros('2350') },
    ],
  });
  assert.equal(serializeShortMarginState(replayed), serializeShortMarginState(state));
});

test('LONG completion receipt uses only entry-time stop and computes conservative planned account risk', () => {
  const ep = MARGIN_TRAINING_EPISODES[0];
  let state = createMarginSession({ sessionId: 'long-completion', careerEquityWei: INITIAL_BANKROLL_WEI, episode: ep });
  state = openMarginLong(state, ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('2450') }).state;
  state = closeMarginLong(state, ep, { actionId: 'close' }).state;
  const completion = deriveLongMarginCompletion(state, ep);
  assert.equal(completion.side, 'LONG');
  assert.equal(completion.protectiveStopUsed, true);
  assert.ok(completion.plannedMaxAccountRiskBps !== null);
  assert.ok(completion.plannedMaxAccountRiskBps < 500n);

  let late = createMarginSession({ sessionId: 'late-stop', careerEquityWei: INITIAL_BANKROLL_WEI, episode: ep });
  late = openMarginLong(late, ep, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: null }).state;
  late = placeMarginStop(late, ep, { actionId: 'later-stop', stopPriceUsdMicros: usdMicros('2450') }).state;
  late = closeMarginLong(late, ep, { actionId: 'close' }).state;
  assert.equal(deriveLongMarginCompletion(late, ep).plannedMaxAccountRiskBps, null);
});
