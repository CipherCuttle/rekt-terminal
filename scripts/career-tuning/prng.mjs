/**
 * CAREER_TUNING_HARNESS_V0 — deterministic PRNG.
 *
 * Every stochastic decision in this harness (scenario shape, policy choices)
 * draws from an explicit seeded stream created here. There is no `Math.random`,
 * no `Date.now`, no wall-clock, and no ambient entropy anywhere in the harness
 * decision path — see `scripts/career-tuning/test/determinism.test.mjs`.
 *
 * Algorithm: SplitMix64. Chosen because it is tiny, well-distributed, and
 * advances with pure 64-bit integer arithmetic (`BigInt.asUintN`), so the same
 * seed produces a byte-identical stream on any Node 20+ runtime.
 */

const MASK64 = (1n << 64n) - 1n;
const GOLDEN_GAMMA = 0x9e3779b97f4a7c15n;

function mix64(z) {
  let x = z & MASK64;
  x = ((x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  x = ((x ^ (x >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return (x ^ (x >> 31n)) & MASK64;
}

/**
 * Fold an arbitrary label and a numeric seed into a stable 64-bit seed. Used so
 * each policy gets its own decision stream from the *same* scenario seed without
 * any policy sharing another's draws.
 */
export function deriveSeed(seedNumber, label = '') {
  let acc = BigInt.asUintN(64, BigInt(Math.trunc(seedNumber))) ^ 0xdeadbeefcafef00dn;
  for (let i = 0; i < label.length; i += 1) {
    acc = ((acc ^ BigInt(label.charCodeAt(i))) * 0x100000001b3n) & MASK64;
    acc = mix64(acc);
  }
  return mix64(acc);
}

export function makePrng(seed) {
  let state = BigInt.asUintN(64, typeof seed === 'bigint' ? seed : BigInt(Math.trunc(seed)));

  function nextUint64() {
    state = (state + GOLDEN_GAMMA) & MASK64;
    return mix64(state);
  }

  /** Uniform float in [0, 1) with 53 bits of resolution. */
  function nextFloat() {
    return Number(nextUint64() >> 11n) / 2 ** 53;
  }

  /** Uniform integer in [minInclusive, maxInclusive]. */
  function nextInt(minInclusive, maxInclusive) {
    const lo = Math.trunc(minInclusive);
    const hi = Math.trunc(maxInclusive);
    if (hi <= lo) return lo;
    const span = BigInt(hi - lo + 1);
    return lo + Number(nextUint64() % span);
  }

  /** True with probability p. */
  function chance(p) {
    return nextFloat() < p;
  }

  /** Uniformly pick one element of a non-empty array. */
  function pick(items) {
    if (items.length === 0) throw new RangeError('cannot pick from an empty list');
    return items[nextInt(0, items.length - 1)];
  }

  return { nextUint64, nextFloat, nextInt, chance, pick };
}
