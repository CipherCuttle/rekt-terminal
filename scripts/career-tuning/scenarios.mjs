/**
 * CAREER_TUNING_HARNESS_V0 — TUNING_SYNTHETIC market scenarios.
 *
 * ## Synthetic-tuning boundary (read this) — FINDING 1 repair
 *
 * These price paths are fabricated. They are deterministic functions of an
 * integer seed and nothing else. A deterministic transformation of a committed
 * scenario definition does not make the underlying market observation real, so
 * they are:
 *
 *   - identified everywhere as `TUNING_SYNTHETIC` (regime id + sourceId tag);
 *   - stamped with the canonical `SYNTHETIC` provenance — the taxonomy word for
 *     "fabricated / demo / simulator-generated market scenario evidence" — and
 *     NEVER relabelled `DERIVED`;
 *   - never written into product provenance, product docs, or any CONFIRMED /
 *     DERIVED real-market claim.
 *
 * Because they are `SYNTHETIC`, the real simulator only accepts them under a
 * session opened with `DEMO_ALLOW_SYNTHETIC` (`config.TUNING_EVIDENCE_POLICY`) —
 * the explicit synthetic/demo evidence policy the simulator already provides for
 * exactly this purpose. The resulting sim `TradeSummary` facts carry
 * `evidenceProvenance: 'SYNTHETIC'`, which the shipped `isGradableEvidence`
 * refuses. Progression is therefore measured by the harness-local,
 * NON-AUTHORITATIVE `TuningCareerEvaluator` (`TUNING_ANALYSIS_ONLY`), which
 * applies the current shipped qualification rules to these synthetic facts. The
 * real `reduceCareer` is still fed everything and — correctly — grades none of
 * it. Nothing here weakens a production evidence gate.
 *
 * Every agent at a given seed trades the identical frozen price array. Only
 * policy behaviour differs between agents.
 */
import { makePrng } from './prng.mjs';
import {
  GATE_F_REGIME,
  MAX_TICKS,
  REGIMES,
  SPOT_INSTRUMENT_ID,
  SPOT_QUOTE_ASSET,
  START_MS,
  START_PRICE_X18,
  SYNTHETIC_PROVENANCE,
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
export function buildScenario(seed, regimeOverride = null) {
  let regime;
  if (regimeOverride && typeof regimeOverride === 'object') regime = regimeOverride;
  else if (regimeOverride === GATE_F_REGIME.id) regime = GATE_F_REGIME;
  else if (regimeOverride) regime = REGIMES.find((r) => r.id === regimeOverride);
  else regime = REGIMES[((seed % REGIMES.length) + REGIMES.length) % REGIMES.length];
  if (!regime) throw new RangeError(`unknown regime override: ${regimeOverride}`);
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
    /** A fresh SYNTHETIC observation for a tick — matches the sim's fixture
     *  shape. `SYNTHETIC` is the truthful label for a fabricated scenario; the
     *  session's `DEMO_ALLOW_SYNTHETIC` policy is what lets it enter the sim. */
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
        provenance: SYNTHETIC_PROVENANCE,
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
