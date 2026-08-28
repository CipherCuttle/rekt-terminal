import WebSocket from 'ws';
import type { Bar, ChartCurrency, OhlcvSeries, PoolTrade, Provenance, RadarAsset } from './types.js';

const RPC_HTTP = process.env.INK_RPC_HTTP || 'https://rpc-gel.inkonchain.com';
const RPC_WSS = process.env.INK_RPC_WSS || 'wss://ws-gel.inkonchain.com';
const DEX = process.env.DEXSCREENER_BASE || 'https://api.dexscreener.com';
const GECKO = process.env.GECKOTERMINAL_BASE || 'https://api.geckoterminal.com/api/v2';
const GECKO_HEADERS = { Accept: 'application/json;version=20230203' };

/**
 * Token identities that make a pool's quote side ETH-equivalent.
 *
 * Practice eligibility is decided from these addresses, never from splitting a
 * human-readable pool name on `/`. Ink is an OP-stack chain, so WETH sits at the
 * standard predeploy; override with INK_WETH_ADDRESSES (comma separated) rather
 * than editing code.
 */
export const ETH_EQUIVALENT_QUOTE_ADDRESSES: readonly string[] = (
  process.env.INK_WETH_ADDRESSES || '0x4200000000000000000000000000000000000006'
)
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

export function isEthEquivalentQuoteAddress(address: string | null | undefined): boolean {
  return typeof address === 'string' && ETH_EQUIVALENT_QUOTE_ADDRESSES.includes(address.toLowerCase());
}

async function fetchJson(url: string, init?: RequestInit, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { accept: 'application/json', ...(init?.headers || {}) },
    });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function rpc(method: string, params: unknown[] = []) {
  const body: any = await fetchJson(RPC_HTTP, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (body.error) throw new Error(body.error.message || 'RPC error');
  return body.result;
}

export async function inkStatus() {
  const [cid, bn] = await Promise.all([rpc('eth_chainId'), rpc('eth_blockNumber')]);
  return {
    chainId: Number(BigInt(cid)),
    blockNumber: Number(BigInt(bn)),
    rpc: RPC_HTTP,
    wss: RPC_WSS,
    at: new Date().toISOString(),
  };
}

export async function searchPairs(q: string) {
  const j: any = await fetchJson(`${DEX}/latest/dex/search?q=${encodeURIComponent(q)}`);
  return (j.pairs || []).filter((p: any) => p.chainId === 'ink').slice(0, 30);
}

export async function dexPair(pairAddress: string) {
  const j: any = await fetchJson(`${DEX}/latest/dex/pairs/ink/${encodeURIComponent(pairAddress)}`);
  return (j.pairs || [])[0] || null;
}

function gtAttr(x: any) {
  return x?.attributes || {};
}

const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * GeckoTerminal token relationship ids are `<network>_<address>`; the address is
 * the last `_`-separated segment. Returns null rather than guessing.
 */
export function tokenAddressFromRelationshipId(id: unknown): string | null {
  if (typeof id !== 'string' || id.length === 0) return null;
  const candidate = id.split('_').pop() ?? '';
  return /^0x[0-9a-fA-F]{40}$/.test(candidate) ? candidate.toLowerCase() : null;
}

export interface TokenIdentity {
  address: string | null;
  symbol: string | null;
}

/** Index `included[]` token records by relationship id so symbols come from provider identity. */
export function indexIncludedTokens(included: unknown): Map<string, TokenIdentity> {
  const out = new Map<string, TokenIdentity>();
  if (!Array.isArray(included)) return out;
  for (const entry of included as any[]) {
    if (!entry || entry.type !== 'token' || typeof entry.id !== 'string') continue;
    const attributes = gtAttr(entry);
    out.set(entry.id, {
      address: typeof attributes.address === 'string' ? attributes.address.toLowerCase() : tokenAddressFromRelationshipId(entry.id),
      symbol: typeof attributes.symbol === 'string' && attributes.symbol.length > 0 ? attributes.symbol.toUpperCase() : null,
    });
  }
  return out;
}

/**
 * Resolve one side of a pool from explicit provider relationship/identity
 * fields. Never parses `attributes.name`.
 */
export function resolveTokenSide(pool: any, side: 'base_token' | 'quote_token', tokens: Map<string, TokenIdentity>): TokenIdentity {
  const relationshipId = pool?.relationships?.[side]?.data?.id;
  const included = typeof relationshipId === 'string' ? tokens.get(relationshipId) : undefined;
  const address = included?.address ?? tokenAddressFromRelationshipId(relationshipId);
  let symbol = included?.symbol ?? null;
  // Attribute-level identity is a legitimate provider field; the pool *name* is not.
  if (!symbol) {
    const attributeSymbol = gtAttr(pool)[side === 'base_token' ? 'base_token_symbol' : 'quote_token_symbol'];
    if (typeof attributeSymbol === 'string' && attributeSymbol.length > 0) symbol = attributeSymbol.toUpperCase();
  }
  if (!symbol && isEthEquivalentQuoteAddress(address)) symbol = 'WETH';
  return { address, symbol };
}

/**
 * Top Ink pools.
 *
 * These are aggregate facts computed by the provider over on-chain activity, so
 * they are `DERIVED`. They are not upgraded to `CONFIRMED` merely because the
 * activity underneath them happened on a blockchain — this response carries no
 * transaction identity.
 */
export async function topInkPools(limit = 30): Promise<RadarAsset[]> {
  const j: any = await fetchJson(
    `${GECKO}/networks/ink/pools?page=1&include=base_token%2Cquote_token`,
    { headers: GECKO_HEADERS },
    7000,
  );
  const tokens = indexIncludedTokens(j?.included);
  const now = Date.now();
  const asOf = new Date(now).toISOString();
  return ((j.data || []) as any[]).slice(0, limit).map((d, i): RadarAsset => {
    const a = gtAttr(d);
    const base = resolveTokenSide(d, 'base_token', tokens);
    const quote = resolveTokenSide(d, 'quote_token', tokens);
    const created = a.pool_created_at ? Date.parse(a.pool_created_at) : now;
    // Native currency on Ink is ETH, so this is a real provider-supplied ETH
    // price for the base token. `base_token_price_quote_token` is preferred for
    // an ETH-quoted pool because it is the pool's own ratio.
    const priceEth = isEthEquivalentQuoteAddress(quote.address)
      ? num(a.base_token_price_quote_token) ?? num(a.base_token_price_native_currency)
      : num(a.base_token_price_native_currency);
    const quoteIdentityResolved = quote.address !== null || quote.symbol !== null;
    return {
      id: String(d.id),
      symbol: base.symbol ?? 'TOKEN',
      name: typeof a.name === 'string' && a.name.length > 0 ? a.name : (base.symbol ?? `INK POOL ${i + 1}`),
      chainId: 57073 as const,
      // Unresolved quote identity stays UNKNOWN, which fails the practice gate
      // closed. It is never inferred by splitting the display name.
      quote: quote.symbol ?? 'UNKNOWN',
      venue: String(a.dex_id || d?.relationships?.dex?.data?.id || 'INK DEX'),
      pairAddress: String(a.address || tokenAddressFromRelationshipId(d.id) || ''),
      tokenAddress: base.address ?? '',
      baseTokenAddress: base.address,
      quoteTokenAddress: quote.address,
      quoteIdentityResolved,
      verified: false,
      priceEth,
      priceUsd: num(a.base_token_price_usd) ?? num(a.token_price_usd),
      change5m: Number(a.price_change_percentage?.m5 ?? 0) || 0,
      change1h: Number(a.price_change_percentage?.h1 ?? 0) || 0,
      change6h: Number(a.price_change_percentage?.h6 ?? 0) || 0,
      buys: Number(a.transactions?.h24?.buys ?? 0) || 0,
      sells: Number(a.transactions?.h24?.sells ?? 0) || 0,
      buyers: null,
      volume24hUsd: Number(a.volume_usd?.h24 ?? 0) || 0,
      liquidityUsd: Number(a.reserve_in_usd ?? 0) || 0,
      fdvUsd: num(a.fdv_usd),
      ageMinutes: Number.isFinite(created) ? Math.max(0, (now - created) / 60000) : null,
      heat: null,
      freshness: 'DERIVED' as const,
      imageUrl: undefined,
      provenance: {
        state: 'DERIVED' as const,
        source: 'GECKOTERMINAL',
        asOf,
        method: 'public top-pools endpoint with base/quote token identity; aggregate figures, no transaction identity, no wallet inference',
      },
    };
  });
}

function mapOhlcvRows(rows: unknown): Bar[] {
  if (!Array.isArray(rows)) return [];
  return (rows as any[][])
    .slice()
    .reverse()
    .map((r) => ({
      time: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5] || 0),
    }))
    .filter((bar) => Number.isFinite(bar.time) && [bar.open, bar.high, bar.low, bar.close].every((v) => Number.isFinite(v) && v > 0));
}

export interface OhlcvRequest {
  pool: string;
  timeframe?: string;
  aggregate?: number;
  limit?: number;
  /** Denomination to request. Defaults to the pool's own quote token. */
  currency?: ChartCurrency;
  /** Quote token address, echoed back so the client can verify the denomination. */
  quoteTokenAddress?: string | null;
  quoteTokenSymbol?: string | null;
}

/**
 * Historical OHLCV in an explicit denomination.
 *
 * MARKET_TRUTH_V1 repair. The chart used to fetch USD candles and the client
 * divided all 200 of them by one *current* ETH/USD ratio to fake an ETH axis.
 * That is numerically false for every bar except the newest, so it is gone.
 *
 * Instead the series is requested directly in the pool's quote-token
 * denomination using GeckoTerminal's own token parameter (`currency=token`,
 * `token=base` returns the base token priced in the quote token). The returned
 * currency is always stated explicitly and travels with the bars; a client that
 * needs ETH bars and receives USD bars must fail closed, not rescale.
 */
export async function ohlcv(request: OhlcvRequest): Promise<OhlcvSeries> {
  const { pool, timeframe = 'minute', aggregate = 1, limit = 200 } = request;
  const currency: ChartCurrency = request.currency ?? 'QUOTE_TOKEN';
  const params = new URLSearchParams({
    aggregate: String(aggregate),
    limit: String(Math.min(1000, limit)),
  });
  if (currency === 'QUOTE_TOKEN') {
    // Price the base token in terms of the other side of the pool.
    params.set('currency', 'token');
    params.set('token', 'base');
  } else {
    params.set('currency', 'usd');
  }
  const url = `${GECKO}/networks/ink/pools/${encodeURIComponent(pool)}/ohlcv/${encodeURIComponent(timeframe)}?${params.toString()}`;
  const j: any = await fetchJson(url, { headers: GECKO_HEADERS }, 7000);
  const bars = mapOhlcvRows(j?.data?.attributes?.ohlcv_list);
  const currencyLabel = currency === 'USD' ? 'USD' : (request.quoteTokenSymbol || 'QUOTE');
  return {
    pair: pool,
    currency,
    currencyLabel,
    quoteTokenAddress: request.quoteTokenAddress ?? null,
    bars,
    provenance: {
      state: 'DERIVED',
      source: 'GECKOTERMINAL',
      asOf: new Date().toISOString(),
      method: `pool OHLCV aggregated by the provider, denominated in ${currencyLabel}; no per-bar transaction identity`,
    },
  };
}

/**
 * Recent pool trades.
 *
 * A trade carrying a transaction hash has identity strong enough for
 * `CONFIRMED`. Without one it is only a `DERIVED` provider record. No
 * wallet-behaviour claim is made from these events in this phase — the address
 * is passed through verbatim when the provider supplies it, and nothing more.
 */
export async function recentTrades(pool: string): Promise<PoolTrade[]> {
  const j: any = await fetchJson(
    `${GECKO}/networks/ink/pools/${encodeURIComponent(pool)}/trades`,
    { headers: GECKO_HEADERS },
    7000,
  );
  const asOf = new Date().toISOString();
  return ((j.data || []) as any[]).slice(0, 100).map((d): PoolTrade => {
    const a = gtAttr(d);
    const txHash = typeof a.tx_hash === 'string' && a.tx_hash.length > 0 ? a.tx_hash : null;
    const blockNumber = Number(a.block_number || 0) || null;
    return {
      id: String(d.id ?? txHash ?? `${a.block_number}:${a.block_timestamp}`),
      side: String(a.kind || a.trade_kind || 'TRADE').toUpperCase(),
      txHash,
      wallet: a.tx_from_address || null,
      priceUsd: num(a.price_to_in_usd) ?? num(a.price_from_in_usd),
      priceQuoteToken: num(a.price_to_in_currency_token) ?? num(a.price_from_in_currency_token),
      volumeUsd: num(a.volume_in_usd),
      blockNumber,
      at: a.block_timestamp || null,
      provenance: {
        state: txHash ? 'CONFIRMED' : 'DERIVED',
        source: 'GECKOTERMINAL',
        asOf,
        method: txHash
          ? 'pool trades endpoint; transaction hash present, block and address preserved as supplied'
          : 'pool trades endpoint; no transaction identity supplied, so this stays a derived provider record',
      } satisfies Provenance,
    };
  });
}

export function createInkHeadFeed(
  onHead: (h: { number: number; hash?: string; parentHash?: string }) => void,
  onState?: (s: string) => void,
) {
  let ws: WebSocket | null = null;
  let stopped = false;
  let backoff = 500;

  const start = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(RPC_WSS);
      ws.onopen = () => {
        backoff = 500;
        onState?.('LIVE');
        ws?.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_subscribe', params: ['newHeads'] }));
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data));
          const h = message?.params?.result;
          if (h?.number) onHead({ number: Number(BigInt(h.number)), hash: h.hash, parentHash: h.parentHash });
        } catch {
        }
      };
      ws.onerror = () => onState?.('DEGRADED');
      ws.onclose = () => {
        onState?.('RECONNECTING');
        if (!stopped) setTimeout(start, (backoff = Math.min(backoff * 2, 10000)));
      };
    } catch {
      if (!stopped) setTimeout(start, (backoff = Math.min(backoff * 2, 10000)));
    }
  };

  start();
  return () => {
    stopped = true;
    ws?.close();
  };
}
