/**
 * DEMO fixture source.
 *
 * MARKET_TRUTH_V1 invariant: every fact produced by this module is fabricated,
 * so every fact produced by this module is labelled `SYNTHETIC`. Nothing here
 * may emit `CONFIRMED` — not a seeded pool, not a fictional wallet history, not
 * a fictional NFT sale. `scripts/verify-source.mjs` fails the build if it does,
 * and no adapter downstream is permitted to relabel a fixture upward.
 *
 * These rows exist to exercise the terminal during development. They are only
 * ever served under an explicitly selected DEMO environment.
 */
import type { Provenance, RadarAsset } from './types.js';

const SIM_EPOCH = '2026-01-30T21:00:00.000Z';
export const FIXTURE_SOURCE = 'FIXTURE_V1';

/** Every fixture provenance is built here so the label cannot drift per call site. */
function syntheticProvenance(method: string): Provenance {
  return { state: 'SYNTHETIC', source: FIXTURE_SOURCE, asOf: SIM_EPOCH, block: 4213, method };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h >>> 0;
}

export function evmAddr(seed: string) {
  const r = mulberry32(hashStr(seed));
  let s = '';
  for (let i = 0; i < 40; i++) s += Math.floor(r() * 16).toString(16);
  return `0x${s}`;
}

const defs = [
  ['REKT', 'REKT INDEX', 0.184], ['SQUID', 'SQUID PROTOCOL', 0.0042], ['BLOT', 'BLOTWORKS', 0.00061],
  ['NOIR', 'NOIR SYSTEMS', 0.031], ['VLT', 'VAULTA', 0.0019], ['PUMP', 'PUMPHOUSE', 0.000082],
  ['HEXA', 'HEXARRAY', 0.0074], ['ORB', 'ORBITAL INK', 0.0206], ['WICK', 'WICK FINANCE', 0.000041],
  ['SMOG', 'SMOGSTACK', 0.0013], ['GLCH', 'GLITCHWARE', 0.0058], ['DRIP', 'DRIPLINE', 0.0009],
  ['STBL', 'STABLEWORKS', 0.51],
] as const;

const ETH_USD = 3284.15;

/** Fictional token identities, so DEMO rows resolve a quote the same way LIVE does. */
export const FIXTURE_WETH_ADDRESS = evmAddr('TOKEN:WETH');
const FIXTURE_USDC_ADDRESS = evmAddr('TOKEN:USDC');

// Quote assets other than ETH/WETH remain discoverable but are PRACTICE_UNAVAILABLE_V0.
const unsupportedQuote = new Set(['STBL']);

export const fixtureAssets: RadarAsset[] = defs.map((d, i) => {
  const r = mulberry32(hashStr(d[0]));
  const p = d[2] * (0.88 + r() * 0.24);
  const usdcQuoted = unsupportedQuote.has(d[0]);
  return {
    id: d[0],
    symbol: d[0],
    name: d[1],
    chainId: 57073 as const,
    quote: usdcQuoted ? 'USDC' : 'WETH',
    venue: `VNL-DX0${1 + (i % 3)}`,
    pairAddress: evmAddr(`PAIR:${d[0]}`),
    tokenAddress: evmAddr(`TOKEN:${d[0]}`),
    baseTokenAddress: evmAddr(`TOKEN:${d[0]}`),
    quoteTokenAddress: usdcQuoted ? FIXTURE_USDC_ADDRESS : FIXTURE_WETH_ADDRESS,
    quoteIdentityResolved: true,
    verified: i < 8,
    priceEth: p,
    priceUsd: p * ETH_USD,
    change5m: (r() - 0.45) * 6,
    change1h: (r() - 0.45) * 18,
    change6h: (r() - 0.45) * 40,
    buys: 40 + Math.floor(r() * 900),
    sells: 40 + Math.floor(r() * 850),
    buyers: 20 + Math.floor(r() * 400),
    volume24hUsd: 2e4 + r() * 4e6,
    liquidityUsd: 8e3 + r() * 9e5,
    fdvUsd: p * ETH_USD * (4e6 + r() * 9e8),
    ageMinutes: 30 + Math.floor(r() * 29000),
    heat: 12 + Math.floor(r() * 86),
    freshness: 'SYNTHETIC' as const,
    provenance: syntheticProvenance('deterministic seeded replay; fabricated market'),
  };
});

export function fixtureBars(symbol: string) {
  const asset = fixtureAssets.find((a) => a.symbol === symbol) ?? fixtureAssets[0];
  const r = mulberry32(hashStr(symbol) ^ 0xbeef);
  let p = asset.priceEth ?? 0.01;
  const start = Date.UTC(2026, 0, 30, 17, 40, 0) / 1000;
  const out = [];
  for (let i = 0; i < 200; i++) {
    const o = p;
    const m = (r() - 0.494) * 0.014;
    p = o * (1 + m);
    out.push({ time: start + i * 60, open: o, high: Math.max(o, p) * (1 + r() * 0.005), low: Math.min(o, p) * (1 - r() * 0.005), close: p, volume: 40 + Math.floor(r() * 1400) });
  }
  return out;
}

/**
 * Fictional wallet histories. Behavioural classifications over fabricated
 * activity are fabricated conclusions, so these are SYNTHETIC, not DERIVED.
 */
export const wallets = (() => {
  const a = evmAddr('WALLET:ACC');
  const b = evmAddr('WALLET:FLIP');
  const c = evmAddr('WALLET:MM');
  return {
    [a]: { address: a, classifier: 'ACCUMULATOR', confidence: 0.87, visibleValueUsd: 184210.55, eth: 56.09, addressAgeDays: 412, rektHeld: 48220, rektBought30d: 61400, rektSold30d: 13180, medianHold: '21.4d', longestHold: '89.0d', reasons: ['14 dip-buys in 30d · zero sells into green candles', 'net position +48,220 REKT over 30d', 'address hold duration median 21.4d vs venue median 2.1d'], provenance: syntheticProvenance('deterministic address-history fixture') },
    [b]: { address: b, classifier: 'FLIPPER', confidence: 0.91, visibleValueUsd: 26480.1, eth: 8.06, addressAgeDays: 38, rektHeld: 1840, rektBought30d: 19300, rektSold30d: 17460, medianHold: '38m', longestHold: '3.1d', reasons: ['23 round-trips in 7d', 'address hold duration median 38m', 'high inventory turnover'], provenance: syntheticProvenance('deterministic address-history fixture') },
    [c]: { address: c, classifier: 'ROUTER / MM', confidence: 0.74, visibleValueUsd: 92440, eth: 28.15, addressAgeDays: 201, rektHeld: 7420, rektBought30d: 31900, rektSold30d: 31760, medianHold: '4m', longestHold: '9h', reasons: ['two-sided flow, near-zero net inventory', 'buy/sell ratio near 1.0', 'short inventory duration'], provenance: syntheticProvenance('rule-based behaviour fixture') },
  } as Record<string, any>;
})();

export const walletList = Object.keys(wallets);

/**
 * Fictional NFT provenance. The timeline still distinguishes a sale from a
 * transfer — that distinction is the point of the fixture — but every entry is
 * fabricated, so each `evidence` marker and the envelope are SYNTHETIC.
 */
export const nftFixture = {
  contract: evmAddr('NFT:REKTGEN'),
  tokenId: '413',
  name: 'REKT GENESIS #0413',
  floorEth: 0.412,
  sales30d: 57,
  volume30dEth: 19.84,
  listings: 8,
  holders: 187,
  owner: walletList[0],
  timeline: [
    { at: '2025-11-02T14:22:00Z', type: 'MINT', from: null, to: walletList[2], priceEth: null, evidence: 'SYNTHETIC' },
    { at: '2025-12-18T09:41:00Z', type: 'SALE', from: walletList[2], to: walletList[1], priceEth: 0.38, evidence: 'SYNTHETIC' },
    { at: '2026-01-04T18:03:00Z', type: 'TRANSFER', from: walletList[1], to: evmAddr('WALLET:COLD'), priceEth: null, evidence: 'SYNTHETIC' },
    { at: '2026-01-29T21:15:00Z', type: 'SALE', from: evmAddr('WALLET:COLD'), to: walletList[0], priceEth: 0.412, evidence: 'SYNTHETIC' },
  ],
  provenance: syntheticProvenance('explicit sale-vs-transfer fixture; fabricated history'),
};
