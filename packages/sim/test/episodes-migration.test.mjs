import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ETHUSDT_PERP_TRAINING_20260805_2055,
  ETHUSDT_PERP_TRAINING_20260828_0530,
  MARGIN_TRAINING_EPISODES,
  MARGIN_INTRABAR_MODEL_VERSION,
  SIM_MARGIN_MODEL_VERSION,
  usdMicros,
} from '../dist/index.js';

test('the two simulator compatibility exports are adapted from the canonical EPISODES_V0 source values', () => {
  assert.deepEqual(MARGIN_TRAINING_EPISODES.map((episode) => episode.episodeId), [
    'ETHUSDT_PERP_20260828_0530_OHLC_PATH_V0',
    'ETHUSDT_PERP_20260805_2055_OHLC_PATH_V0',
  ]);
  assert.deepEqual(ETHUSDT_PERP_TRAINING_20260828_0530.marks.map((mark) => [mark.markId, mark.eventTimeMs, mark.priceUsdMicros]), [
    ['open', 1_787_895_000_000, usdMicros('2488.93')],
    ['low', 1_787_895_900_000, usdMicros('2488.62')],
    ['high', 1_787_896_800_000, usdMicros('2488.99')],
    ['close', 1_787_897_700_000, usdMicros('2488.84')],
  ]);
  assert.deepEqual(ETHUSDT_PERP_TRAINING_20260805_2055.marks.map((mark) => [mark.markId, mark.eventTimeMs, mark.priceUsdMicros]), [
    ['open', 1_785_963_300_000, usdMicros('1919.99')],
    ['low', 1_785_963_360_000, usdMicros('1916.82')],
    ['high', 1_785_963_420_000, usdMicros('1919.99')],
    ['close', 1_785_963_480_000, usdMicros('1917.00')],
  ]);
  for (const episode of MARGIN_TRAINING_EPISODES) {
    assert.equal(episode.intrabarRule, MARGIN_INTRABAR_MODEL_VERSION);
    assert.equal(episode.modelVersion, SIM_MARGIN_MODEL_VERSION);
    assert.equal(episode.marketProvenance, 'DERIVED');
    assert.equal(Object.isFrozen(episode), true);
  }
});
