import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ETHUSDT_PERP_TRAINING_20260828_0530,
  INITIAL_BANKROLL_WEI,
  MARGIN_INTRABAR_MODEL_VERSION,
  SIM_MARGIN_MODEL_VERSION,
  advanceMarginMark,
  careerEthToMarginUsdMicros,
  createMarginSession,
  estimateLongLiquidationPrice,
  marginPositionSnapshot,
  openMarginLong,
  placeMarginStop,
  replayMarginActions,
  serializeMarginState,
  usdMicros,
} from '../dist/index.js';

const EPISODE = ETHUSDT_PERP_TRAINING_20260828_0530;

function customEpisode(overrides = {}) {
  return {
    ...EPISODE,
    episodeId: 'TEST_MARGIN_EPISODE',
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_120_000,
    startEthUsdPriceMicros: usdMicros('2500'),
    marks: [
      { markId: 'm0', eventTimeMs: 1_700_000_000_000, priceUsdMicros: usdMicros('2500'), sourceId: 'TEST:m0', provenance: 'DERIVED' },
      { markId: 'm1', eventTimeMs: 1_700_000_060_000, priceUsdMicros: usdMicros('2501'), sourceId: 'TEST:m1', provenance: 'DERIVED' },
      { markId: 'm2', eventTimeMs: 1_700_000_120_000, priceUsdMicros: usdMicros('2502'), sourceId: 'TEST:m2', provenance: 'DERIVED' },
    ],
    funding: [],
    ...overrides,
  };
}

function session(episode = EPISODE, id = 'margin-test') {
  return createMarginSession({ sessionId: id, careerEquityWei: INITIAL_BANKROLL_WEI, episode });
}

test('MARGIN_FX_V0 converts 0.5 ETH at the frozen episode-start price exactly', () => {
  assert.equal(careerEthToMarginUsdMicros(INITIAL_BANKROLL_WEI, usdMicros('2488.93')), usdMicros('1244.465'));
  const state = session();
  assert.equal(state.initialCollateralUsdMicros, usdMicros('1244.465'));
  assert.equal(state.freeCollateralUsdMicros, usdMicros('1244.465'));
  assert.equal(state.events[0].reason, 'MARGIN_FX_V0:SYNTHETIC_BOOKKEEPING');
});

test('1x and 2x use the same isolated margin but 2x creates roughly twice the notional without cross-margin borrowing', () => {
  const margin = usdMicros('100');
  const one = openMarginLong(session(EPISODE, 'one-x'), EPISODE, { actionId: 'open', marginUsdMicros: margin, leverage: 1 });
  const two = openMarginLong(session(EPISODE, 'two-x'), EPISODE, { actionId: 'open', marginUsdMicros: margin, leverage: 2 });
  assert.equal(one.accepted, true);
  assert.equal(two.accepted, true);
  assert.equal(one.state.position.leverage, 1);
  assert.equal(two.state.position.leverage, 2);
  assert.equal(two.state.position.quantityMicros > one.state.position.quantityMicros, true);
  const oneNotional = one.state.position.quantityMicros * one.state.position.entryFillPriceUsdMicros / 1_000_000n;
  const twoNotional = two.state.position.quantityMicros * two.state.position.entryFillPriceUsdMicros / 1_000_000n;
  assert.equal(twoNotional >= oneNotional * 2n - 2n, true);
  assert.equal(one.state.freeCollateralUsdMicros >= 0n, true);
  assert.equal(two.state.freeCollateralUsdMicros >= 0n, true);
  assert.equal(two.state.position.entryFeeUsdMicros > one.state.position.entryFeeUsdMicros, true);
});

test('runtime rejects leverage above 2x and never records an open position', () => {
  const result = openMarginLong(session(), EPISODE, { actionId: 'open-3x', marginUsdMicros: usdMicros('100'), leverage: 3 });
  assert.equal(result.accepted, false);
  assert.equal(result.code, 'LEVERAGE_LIMIT');
  assert.equal(result.state.position, null);
  assert.equal(result.state.events.at(-1).type, 'ORDER_INTENT_REJECTED');
});

test('estimated long liquidation is below entry and stops inside its safety buffer fail closed', () => {
  const opened = openMarginLong(session(), EPISODE, { actionId: 'open', marginUsdMicros: usdMicros('200'), leverage: 2 });
  assert.equal(opened.accepted, true);
  const position = opened.state.position;
  const liquidation = estimateLongLiquidationPrice(position, EPISODE);
  assert.notEqual(liquidation, null);
  assert.equal(liquidation > 0n, true);
  assert.equal(liquidation < position.entryFillPriceUsdMicros, true);

  const tooClose = placeMarginStop(opened.state, EPISODE, { actionId: 'bad-stop', stopPriceUsdMicros: liquidation });
  assert.equal(tooClose.accepted, false);
  assert.equal(tooClose.code, 'STOP_TOO_CLOSE_TO_LIQUIDATION');

  const protectedStop = usdMicros('2400');
  const valid = placeMarginStop(opened.state, EPISODE, { actionId: 'good-stop', stopPriceUsdMicros: protectedStop });
  assert.equal(valid.accepted, true);
  assert.equal(valid.state.position.stopPriceUsdMicros, protectedStop);
});

test('discrete funding events alter position equity exactly once', () => {
  const episode = customEpisode({
    funding: [
      {
        fundingId: 'fund-1',
        eventTimeMs: 1_700_000_030_000,
        ratePpm: 1_000n,
        markPriceUsdMicros: usdMicros('2500'),
        sourceId: 'TEST:fund-1',
        provenance: 'DERIVED',
      },
    ],
  });
  const opened = openMarginLong(session(episode, 'funding'), episode, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2 });
  const before = marginPositionSnapshot(opened.state, episode);
  const advanced = advanceMarginMark(opened.state, episode, { actionId: 'next' });
  assert.equal(advanced.accepted, true);
  assert.equal(advanced.state.position.accruedFundingUsdMicros > 0n, true);
  const after = marginPositionSnapshot(advanced.state, episode);
  assert.equal(after.positionEquityUsdMicros < before.positionEquityUsdMicros + usdMicros('1'), true);
  assert.equal(advanced.events.filter((event) => event.type === 'FUNDING_APPLIED').length, 1);
  const duplicate = advanceMarginMark(opened.state, episode, { actionId: 'next' });
  assert.equal(duplicate.state.position.accruedFundingUsdMicros, advanced.state.position.accruedFundingUsdMicros);
});

test('a mark that destroys maintenance equity liquidates and never creates negative free collateral', () => {
  const episode = customEpisode({
    marks: [
      { markId: 'm0', eventTimeMs: 1_700_000_000_000, priceUsdMicros: usdMicros('2500'), sourceId: 'TEST:m0', provenance: 'DERIVED' },
      { markId: 'crash', eventTimeMs: 1_700_000_060_000, priceUsdMicros: usdMicros('1000'), sourceId: 'TEST:crash', provenance: 'DERIVED' },
    ],
    endTimeMs: 1_700_000_060_000,
  });
  const opened = openMarginLong(session(episode, 'liq'), episode, { actionId: 'open', marginUsdMicros: usdMicros('500'), leverage: 2 });
  const advanced = advanceMarginMark(opened.state, episode, { actionId: 'crash' });
  assert.equal(advanced.accepted, true);
  assert.equal(advanced.state.closed, true);
  assert.equal(advanced.state.liquidated, true);
  assert.equal(advanced.state.position, null);
  assert.equal(advanced.state.freeCollateralUsdMicros >= 0n, true);
  assert.equal(advanced.state.lastTrade.closeReason, 'LIQUIDATION');
  assert.equal(advanced.state.lastTrade.liquidationFeeUsdMicros > 0n, true);
  assert.equal(advanced.events.some((event) => event.type === 'LIQUIDATION_TRIGGERED'), true);
  assert.equal(advanced.events.some((event) => event.type === 'LIQUIDATION_FILLED'), true);
});

test('when one sampled mark crosses both stop and liquidation, liquidation has deterministic priority', () => {
  const episode = customEpisode({
    marks: [
      { markId: 'm0', eventTimeMs: 1_700_000_000_000, priceUsdMicros: usdMicros('2500'), sourceId: 'TEST:m0', provenance: 'DERIVED' },
      { markId: 'gap', eventTimeMs: 1_700_000_060_000, priceUsdMicros: usdMicros('1000'), sourceId: 'TEST:gap', provenance: 'DERIVED' },
    ],
    endTimeMs: 1_700_000_060_000,
  });
  const opened = openMarginLong(session(episode, 'gap'), episode, {
    actionId: 'open',
    marginUsdMicros: usdMicros('500'),
    leverage: 2,
    stopPriceUsdMicros: usdMicros('1800'),
  });
  assert.equal(opened.accepted, true);
  const advanced = advanceMarginMark(opened.state, episode, { actionId: 'gap-down' });
  assert.equal(advanced.state.lastTrade.closeReason, 'LIQUIDATION');
  assert.equal(advanced.state.lastTrade.liquidated, true);
});

test('the frozen real episode is ordered, venue-neutral and closes an unliquidated long at episode end', () => {
  assert.equal(EPISODE.modelVersion, SIM_MARGIN_MODEL_VERSION);
  assert.equal(EPISODE.intrabarRule, MARGIN_INTRABAR_MODEL_VERSION);
  assert.deepEqual(EPISODE.marks.map((mark) => mark.priceUsdMicros), [
    usdMicros('2488.93'),
    usdMicros('2488.62'),
    usdMicros('2488.99'),
    usdMicros('2488.84'),
  ]);
  let state = openMarginLong(session(EPISODE, 'real-episode'), EPISODE, {
    actionId: 'open',
    marginUsdMicros: usdMicros('100'),
    leverage: 2,
    stopPriceUsdMicros: usdMicros('2400'),
  }).state;
  state = advanceMarginMark(state, EPISODE, { actionId: 'm1' }).state;
  state = advanceMarginMark(state, EPISODE, { actionId: 'm2' }).state;
  state = advanceMarginMark(state, EPISODE, { actionId: 'm3' }).state;
  assert.equal(state.closed, true);
  assert.equal(state.liquidated, false);
  assert.equal(state.lastTrade.closeReason, 'EPISODE_END');
  assert.equal(state.lastTrade.marketProvenance, 'DERIVED');
  assert.equal(state.lastTrade.simulationProvenance, 'SYNTHETIC');
  assert.deepEqual(state.lastTrade.modelVersions, ['SIM_MARGIN_V0', 'PERP_FILL_V0', 'MARGIN_FX_V0']);
});

test('duplicate action IDs are idempotent and cannot duplicate margin allocation', () => {
  const initial = session(EPISODE, 'dup');
  const first = openMarginLong(initial, EPISODE, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2 });
  const again = openMarginLong(first.state, EPISODE, { actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2 });
  assert.equal(again.accepted, true);
  assert.equal(again.events.length, 0);
  assert.equal(serializeMarginState(again.state), serializeMarginState(first.state));
});

test('replaying the same episode and action stream produces byte-identical serialized state', () => {
  const actions = [
    { type: 'OPEN_LONG', actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('2400') },
    { type: 'ADVANCE', actionId: 'one' },
    { type: 'ADVANCE', actionId: 'two' },
    { type: 'ADVANCE', actionId: 'three' },
  ];
  const a = replayMarginActions({ sessionId: 'replay', careerEquityWei: INITIAL_BANKROLL_WEI, episode: EPISODE, actions });
  const b = replayMarginActions({ sessionId: 'replay', careerEquityWei: INITIAL_BANKROLL_WEI, episode: EPISODE, actions });
  assert.equal(serializeMarginState(a), serializeMarginState(b));
});
