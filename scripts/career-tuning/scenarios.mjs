/**
 * CAREER_TUNING_HARNESS_V0 — TUNING_SYNTHETIC market scenarios.
 *
 * ## Synthetic-tuning boundary (read this)
 *
 * These price paths are fabricated. They are deterministic functions of an
 * integer seed and nothing else. They are:
 *
 *   - identified everywhere as `TUNING_SYNTHETIC` (regime id + sourceId tag);
 *   - never written into product provenance, product docs, or any CONFIRMED /
 *     DERIVED real-market claim;
 *   - used only to exercise the *real* shipped simulator math and the *real*
 *     shipped Career reducer offline.
 *
 * They enter the real simulator through observations labelled `DERIVED`, which
 * is the exact mechanism `packages/sim`'s own golden-replay fixture
 * (`createGoldenReplay`, `makeFixtureObservation`) uses to test the simulator.
 * `DERIVED` here means precisely what the provenance taxonomy says — "a
 * deterministic calculation from observed inputs" — where the observed input is
 * the committed synthetic scenario definition. No fabricated *market history* is
 * ever presented as real; the harness is falsification tooling, not a data
 * source.
 *
 * Every agent at a given seed trades the identical frozen price array. Only
 * policy behaviour differs between agents.
 */
import { makePrng } from './prng.mjs';
import {
  MAX_TICKS,
  REGIMES,
  SPOT_INSTRUMENT_ID,
  SPOT_QUOTE_ASSET,
  START_MS,
  START_PRICE_X18,
  TICK_MS,
  TUNING_SYNTHETIC_TAG,
  USABLE_LIQUIDITY_WEI,
} from './config.mjs';

const PRICE_FLOOR = START_PRICE_X18 / 4n;
const PRICE_CEIL = START_PRICE_X18 * 4n;

function clampPrice(value) {
  if (value < PRICE_FLOOR) return PRICE_FLOOR;
  if (value > PRICE_CEIL) return PRICE_CEIL;
  return value;
}

/**
 * Build the frozen scenario for `seed`. The full price array is precomputed at
 * construction so `priceAt` is a pure lookup and the market cannot drift between
 * agents.
 */
export function buildScenario(seed) {
  const regime = REGIMES[((seed % REGIMES.length) + REGIMES.length) % REGIMES.length];
  const rng = makePrng((BigInt.asUintN(64, BigInt(seed)) ^ 0x5ca1ab1e5ca1ab1en));

  const prices = new Array(MAX_TICKS + 1);
  let price = START_PRICE_X18;
  prices[0] = price;
  for (let tick = 1; tick <= MAX_TICKS; tick += 1) {
    const noise = rng.nextInt(-regime.volBps, regime.volBps);
    let factorBps = 10_000 + regime.driftBps + noise;
    if (factorBps < 1) factorBps = 1;
    price = clampPrice((price * BigInt(factorBps)) / 10_000n);
    if (regime.shock && tick === regime.shock.atTick) {
      price = clampPrice((price * BigInt(regime.shock.factorBps)) / 10_000n);
    }
    prices[tick] = price;
  }

  const frozenPrices = Object.freeze(prices);

  return Object.freeze({
    seed,
    regimeId: regime.id,
    instrumentId: SPOT_INSTRUMENT_ID,
    quoteAsset: SPOT_QUOTE_ASSET,
    priceCount: frozenPrices.length,
    /** Price at tick (clamped to the last mark once the path is exhausted). */
    priceAt(tick) {
      const index = tick < 0 ? 0 : tick >= frozenPrices.length ? frozenPrices.length - 1 : tick;
      return frozenPrices[index];
    },
    /** A fresh DERIVED observation for a tick — matches the sim's fixture shape. */
    observationAt(tick) {
      const eventTimeMs = START_MS + tick * TICK_MS;
      return {
        observationId: `${TUNING_SYNTHETIC_TAG}:${seed}:${tick}`,
        instrumentId: SPOT_INSTRUMENT_ID,
        quoteAsset: SPOT_QUOTE_ASSET,
        referencePriceX18: this.priceAt(tick),
        usableQuoteLiquidityWei: USABLE_LIQUIDITY_WEI,
        observedAtMs: eventTimeMs,
        sourceId: `${TUNING_SYNTHETIC_TAG}:${seed}`,
        provenance: 'DERIVED',
      };
    },
    eventTimeAt(tick) {
      return START_MS + tick * TICK_MS;
    },
    /** Stable fingerprint of the whole price path — used to prove all agents
     *  at a seed see the identical market. */
    priceDigest() {
      let hash = 14695981039346656037n;
      for (const value of frozenPrices) {
        const text = value.toString();
        for (let i = 0; i < text.length; i += 1) {
          hash ^= BigInt(text.charCodeAt(i));
          hash = BigInt.asUintN(64, hash * 1099511628211n);
        }
        hash ^= 44n;
        hash = BigInt.asUintN(64, hash * 1099511628211n);
      }
      return `FNV1A64-${hash.toString(16).padStart(16, '0')}`;
    },
  });
}
