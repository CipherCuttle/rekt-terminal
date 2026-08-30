import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_BANKROLL_WEI,
  advanceMarginMark,
  createMarginSession,
  openMarginLong,
  placeMarginStop,
  usdMicros,
} from '../dist/index.js';

const episode = {
  episodeId: 'STOP_CURRENT_MARK_TEST',
  instrumentId: 'ETHUSDT-PERP',
  sourceVenue: 'TEST',
  sourceLabel: 'TEST',
  startTimeMs: 1_700_000_000_000,
  endTimeMs: 1_700_000_120_000,
  startEthUsdPriceMicros: usdMicros('2500'),
  marks: [
    { markId: 'open', eventTimeMs: 1_700_000_000_000, priceUsdMicros: usdMicros('2500'), sourceId: 'TEST:open', provenance: 'DERIVED' },
    { markId: 'down', eventTimeMs: 1_700_000_060_000, priceUsdMicros: usdMicros('2450'), sourceId: 'TEST:down', provenance: 'DERIVED' },
    { markId: 'end', eventTimeMs: 1_700_000_120_000, priceUsdMicros: usdMicros('2460'), sourceId: 'TEST:end', provenance: 'DERIVED' },
  ],
  funding: [],
  maintenanceMarginBps: 50n,
  takerFeeBps: 5n,
  liquidationFeeBps: 50n,
  fillSlippageBps: 5n,
  liquidationSlippageBps: 25n,
  marketProvenance: 'DERIVED',
  intrabarRule: 'OHLC_PATH_V0',
  modelVersion: 'SIM_MARGIN_V0',
};

function session(id) {
  return createMarginSession({ sessionId: id, careerEquityWei: INITIAL_BANKROLL_WEI, episode });
}

test('entry refuses a stop that is below the adverse fill but already at/above the current mark', () => {
  const result = openMarginLong(session('entry-stop'), episode, {
    actionId: 'open',
    marginUsdMicros: usdMicros('100'),
    leverage: 2,
    // BUY fill is slightly above 2500, but 2500 has already been reached.
    stopPriceUsdMicros: usdMicros('2500'),
  });
  assert.equal(result.accepted, false);
  assert.equal(result.code, 'INVALID_STOP');
  assert.equal(result.state.position, null);
  assert.equal(result.state.events.at(-1).type, 'ORDER_INTENT_REJECTED');
});

test('replacement refuses a stop above the current mark after price has moved through it', () => {
  let state = openMarginLong(session('replacement-stop'), episode, {
    actionId: 'open', marginUsdMicros: usdMicros('100'), leverage: 2, stopPriceUsdMicros: usdMicros('2400'),
  }).state;
  state = advanceMarginMark(state, episode, { actionId: 'down' }).state;
  assert.equal(state.currentMarkPriceUsdMicros, usdMicros('2450'));
  const result = placeMarginStop(state, episode, { actionId: 'stale-stop', stopPriceUsdMicros: usdMicros('2475') });
  assert.equal(result.accepted, false);
  assert.equal(result.code, 'INVALID_STOP');
  assert.equal(result.state.position.stopPriceUsdMicros, usdMicros('2400'));
  assert.equal(result.state.events.at(-1).type, 'ORDER_INTENT_REJECTED');
});
