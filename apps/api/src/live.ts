import WebSocket from 'ws';
import type { RadarAsset } from './types.js';

const RPC_HTTP = process.env.INK_RPC_HTTP || 'https://rpc-gel.inkonchain.com';
const RPC_WSS = process.env.INK_RPC_WSS || 'wss://ws-gel.inkonchain.com';
const DEX = process.env.DEXSCREENER_BASE || 'https://api.dexscreener.com';
const GECKO = process.env.GECKOTERMINAL_BASE || 'https://api.geckoterminal.com/api/v2';

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

export async function topInkPools(limit = 30): Promise<RadarAsset[]> {
  const j: any = await fetchJson(
    `${GECKO}/networks/ink/pools?page=1`,
    { headers: { Accept: 'application/json;version=20230203' } },
    7000,
  );
  const now = Date.now();
  return (j.data || []).slice(0, limit).map((d: any, i: number) => {
    const a = gtAttr(d);
    const base = (a.name || `INK POOL ${i + 1}`).split('/')[0]?.trim() || 'TOKEN';
    const quote = (a.name || 'TOKEN / WETH').split('/')[1]?.trim() || 'WETH';
    const created = a.pool_created_at ? Date.parse(a.pool_created_at) : now;
    const priceUsd = Number(a.base_token_price_usd || a.token_price_usd || 0) || null;
    return {
      id: d.id,
      symbol: base,
      name: a.name || base,
      chainId: 57073 as const,
      quote,
      venue: String(a.dex_id || 'INK DEX'),
      pairAddress: String(a.address || d.id.split('_').pop() || ''),
      tokenAddress: String(a.base_token_address || ''),
      verified: false,
      priceEth: null,
      priceUsd,
      change5m: Number(a.price_change_percentage?.m5 ?? 0) || 0,
      change1h: Number(a.price_change_percentage?.h1 ?? 0) || 0,
      change6h: Number(a.price_change_percentage?.h6 ?? 0) || 0,
      buys: Number(a.transactions?.h24?.buys ?? 0) || 0,
      sells: Number(a.transactions?.h24?.sells ?? 0) || 0,
      buyers: null,
      volume24hUsd: Number(a.volume_usd?.h24 ?? 0) || 0,
      liquidityUsd: Number(a.reserve_in_usd ?? 0) || 0,
      fdvUsd: Number(a.fdv_usd ?? 0) || null,
      ageMinutes: Number.isFinite(created) ? Math.max(0, (now - created) / 60000) : null,
      heat: null,
      freshness: 'ESTIMATED' as const,
      imageUrl: undefined,
      provenance: {
        state: 'ESTIMATED' as const,
        source: 'GECKOTERMINAL',
        asOf: new Date().toISOString(),
        method: 'public cached top-pools endpoint; no wallet identity inference',
      },
    };
  });
}

/** Live OHLCV is deliberately USD-denominated. The client must append USD ticks to this series. */
export async function ohlcv(pool: string, timeframe = 'minute', aggregate = 1, limit = 200) {
  const url = `${GECKO}/networks/ink/pools/${encodeURIComponent(pool)}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${Math.min(1000, limit)}&currency=usd`;
  const j: any = await fetchJson(url, { headers: { Accept: 'application/json;version=20230203' } }, 7000);
  const arr = j?.data?.attributes?.ohlcv_list || [];
  return arr
    .slice()
    .reverse()
    .map((r: any[]) => ({
      time: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5] || 0),
    }));
}

export async function recentTrades(pool: string) {
  const j: any = await fetchJson(
    `${GECKO}/networks/ink/pools/${encodeURIComponent(pool)}/trades`,
    { headers: { Accept: 'application/json;version=20230203' } },
    7000,
  );
  return (j.data || []).slice(0, 100).map((d: any) => {
    const a = gtAttr(d);
    return {
      id: d.id,
      side: String(a.kind || a.trade_kind || 'TRADE').toUpperCase(),
      txHash: a.tx_hash || null,
      wallet: a.tx_from_address || null,
      priceUsd: Number(a.price_to_in_usd || a.price_from_in_usd || 0) || null,
      volumeUsd: Number(a.volume_in_usd || 0) || null,
      blockNumber: Number(a.block_number || 0) || null,
      at: a.block_timestamp || null,
      provenance: {
        state: a.tx_hash ? 'CONFIRMED' : 'DERIVED',
        source: 'GECKOTERMINAL',
        asOf: new Date().toISOString(),
        method: 'pool trades endpoint; wallet shown only when upstream supplies tx_from_address',
      },
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
