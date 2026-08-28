/**
 * Browser-side DEMO fallback data.
 *
 * MARKET_TRUTH_V1 invariant: everything this module produces is fabricated and
 * is therefore labelled `SYNTHETIC`. It previously claimed `CONFIRMED`, which
 * meant a seeded browser fallback outranked a real Dexscreener snapshot in the
 * truth taxonomy and could be fed to the simulator as economic evidence.
 *
 * `scripts/verify-source.mjs` fails the build if this file emits CONFIRMED.
 * It is only reachable from an explicitly selected DEMO environment.
 */
import type { Bar, Provenance, RadarAsset, WalletTrace } from '../types/api';

function hashStr(s: string) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h >>> 0; }
function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function addr(seed: string) { const r = rng(hashStr(seed)); let s = ''; for (let i = 0; i < 40; i++) s += Math.floor(r() * 16).toString(16); return `0x${s}`; }

const ETH_USD = 3284.15;
const AS_OF = '2026-01-30T21:00:00.000Z';
export const LOCAL_FIXTURE_SOURCE = 'LOCAL_FIXTURE_V1';

/** Single construction point for fixture provenance so the label cannot drift. */
function syntheticProvenance(method: string): Provenance {
  return { state: 'SYNTHETIC', source: LOCAL_FIXTURE_SOURCE, asOf: AS_OF, block: 4213, method };
}

const LOCAL_WETH = addr('TOKEN:WETH');
const LOCAL_USDC = addr('TOKEN:USDC');

const defs = [['REKT','REKT INDEX',0.184],['SQUID','SQUID PROTOCOL',0.0042],['BLOT','BLOTWORKS',0.00061],['NOIR','NOIR SYSTEMS',0.031],['VLT','VAULTA',0.0019],['PUMP','PUMPHOUSE',0.000082],['HEXA','HEXARRAY',0.0074],['ORB','ORBITAL INK',0.0206],['WICK','WICK FINANCE',0.000041],['SMOG','SMOGSTACK',0.0013],['GLCH','GLITCHWARE',0.0058],['DRIP','DRIPLINE',0.0009],['STBL','STABLEWORKS',0.51]] as const;

export const localAssets: RadarAsset[] = defs.map((d, i) => {
  const r = rng(hashStr(d[0]));
  const p = d[2] * (.88 + r() * .24);
  const usdcQuoted = d[0] === 'STBL';
  return {
    id: d[0], symbol: d[0], name: d[1], chainId: 57073 as const,
    quote: usdcQuoted ? 'USDC' : 'WETH',
    venue: `VNL-DX0${1 + i % 3}`,
    pairAddress: addr(`PAIR:${d[0]}`),
    tokenAddress: addr(`TOKEN:${d[0]}`),
    baseTokenAddress: addr(`TOKEN:${d[0]}`),
    quoteTokenAddress: usdcQuoted ? LOCAL_USDC : LOCAL_WETH,
    quoteIdentityResolved: true,
    verified: i < 8,
    priceEth: p, priceUsd: p * ETH_USD,
    change5m: (r() - .45) * 6, change1h: (r() - .45) * 18, change6h: (r() - .45) * 40,
    buys: 40 + Math.floor(r() * 900), sells: 40 + Math.floor(r() * 850), buyers: 20 + Math.floor(r() * 400),
    volume24hUsd: 2e4 + r() * 4e6, liquidityUsd: 8e3 + r() * 9e5,
    fdvUsd: p * ETH_USD * (4e6 + r() * 9e8),
    ageMinutes: 30 + Math.floor(r() * 29000), heat: 12 + Math.floor(r() * 86),
    freshness: 'SYNTHETIC' as const,
    provenance: syntheticProvenance('deterministic browser fallback; fabricated market'),
  };
});

export function localBars(symbol: string): Bar[] {
  const a = localAssets.find((x) => x.symbol === symbol) ?? localAssets[0];
  const r = rng(hashStr(symbol) ^ 0xbeef);
  let p = a.priceEth ?? .01;
  const start = Date.UTC(2026, 0, 30, 17, 40, 0) / 1000;
  const out: Bar[] = [];
  for (let i = 0; i < 200; i++) {
    const o = p, m = (r() - .494) * .014;
    p = o * (1 + m);
    out.push({ time: start + i * 60, open: o, high: Math.max(o, p) * (1 + r() * .005), low: Math.min(o, p) * (1 - r() * .005), close: p, volume: 40 + Math.floor(r() * 1400) });
  }
  return out;
}

const W0 = addr('WALLET:ACC'), W1 = addr('WALLET:FLIP'), W2 = addr('WALLET:MM');

/** Fabricated histories, therefore fabricated classifications. */
export const localWallets: Record<string, WalletTrace> = {
  [W0]: { address: W0, classifier: 'ACCUMULATOR', confidence: .87, visibleValueUsd: 184210.55, eth: 56.09, addressAgeDays: 412, rektHeld: 48220, rektBought30d: 61400, rektSold30d: 13180, medianHold: '21.4d', longestHold: '89.0d', reasons: ['14 dip-buys in 30d · zero sells into green candles', 'net position +48,220 REKT over 30d', 'address hold duration median 21.4d vs venue median 2.1d'], provenance: syntheticProvenance('deterministic browser fallback') },
  [W1]: { address: W1, classifier: 'FLIPPER', confidence: .91, visibleValueUsd: 26480.10, eth: 8.06, addressAgeDays: 38, rektHeld: 1840, rektBought30d: 19300, rektSold30d: 17460, medianHold: '38m', longestHold: '3.1d', reasons: ['23 round-trips in 7d', 'address hold duration median 38m', 'high inventory turnover'], provenance: syntheticProvenance('deterministic browser fallback') },
  [W2]: { address: W2, classifier: 'ROUTER / MM', confidence: .74, visibleValueUsd: 92440, eth: 28.15, addressAgeDays: 201, rektHeld: 7420, rektBought30d: 31900, rektSold30d: 31760, medianHold: '4m', longestHold: '9h', reasons: ['two-sided flow, near-zero net inventory', 'buy/sell ratio near 1.0', 'short inventory duration'], provenance: syntheticProvenance('rule-based browser fallback') },
};

export const localWalletList = Object.keys(localWallets);

export const localNft = {
  contract: addr('NFT:REKTGEN'), tokenId: '413', name: 'REKT GENESIS #0413',
  floorEth: .412, sales30d: 57, volume30dEth: 19.84, listings: 8, holders: 187, owner: W0,
  timeline: [
    { at: '2025-11-02T14:22:00Z', type: 'MINT', from: null, to: W2, priceEth: null, evidence: 'SYNTHETIC' },
    { at: '2025-12-18T09:41:00Z', type: 'SALE', from: W2, to: W1, priceEth: .380, evidence: 'SYNTHETIC' },
    { at: '2026-01-04T18:03:00Z', type: 'TRANSFER', from: W1, to: addr('WALLET:COLD'), priceEth: null, evidence: 'SYNTHETIC' },
    { at: '2026-01-29T21:15:00Z', type: 'SALE', from: addr('WALLET:COLD'), to: W0, priceEth: .412, evidence: 'SYNTHETIC' },
  ],
  provenance: syntheticProvenance('explicit sale-vs-transfer browser fallback; fabricated history'),
};

/** Deterministic DEMO tape event. Fabricated, therefore SYNTHETIC. */
export function localEvent(seq: number, symbol: string) {
  const side = seq % 2 ? 1 : -1;
  return {
    type: seq % 37 === 0 ? 'SWEEP' : side > 0 ? 'BUY' : 'SELL',
    seq,
    serverTime: Date.UTC(2026, 0, 30, 21, 0, 0) + seq * 200,
    payload: {
      symbol, side,
      priceEth: (localAssets.find((a) => a.symbol === symbol)?.priceEth ?? .01) * (1 + Math.sin(seq / 11) * .008),
      qty: 100 + (seq * 137) % 3900,
      wallet: localWalletList[seq % localWalletList.length],
      provenance: syntheticProvenance('deterministic browser fallback; fabricated market event'),
    },
  };
}
