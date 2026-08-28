import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { fixtureAssets, fixtureBars, wallets, nftFixture, walletList } from './fixtures.js';
import { inkStatus, topInkPools, searchPairs, dexPair, ohlcv, recentTrades, rpc, createInkHeadFeed, isEthEquivalentQuoteAddress } from './live.js';
import { ChainHeadHub, MarketHub, DEFAULT_POLL_INTERVAL_MS } from './market-hub.js';
import type { MarketEnvironment } from './types.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(websocket);

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const FIXTURE_STREAM_EPOCH = Date.UTC(2026, 0, 30, 21, 0, 0);

/**
 * One shared provider poller per actively requested pair, for the whole
 * process. Websocket connections attach to it; they never start their own.
 * See `market-hub.ts` — SHARED_MARKET_POLLING_V1.
 */
const marketHub = new MarketHub({
  fetchPair: (pairAddress) => dexPair(pairAddress),
  fetchTrades: (pairAddress) => recentTrades(pairAddress),
  pollIntervalMs: Number(process.env.MARKET_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS),
  tradePollEveryNCycles: Number(process.env.MARKET_TRADE_POLL_CYCLES || 5),
});

/**
 * One Ink chain-head subscription for the process, fanned out to every
 * websocket. Opening more browser connections does not open more upstream RPC
 * sockets.
 */
const headHub = new ChainHeadHub({
  connect: (onHead, onState) => createInkHeadFeed(onHead, onState),
});

/**
 * Resolve the requested data environment.
 *
 * LIVE is the default: a caller that says nothing gets real market evidence, or
 * an explicit failure. DEMO must be asked for by name. Nothing here ever
 * downgrades LIVE to DEMO because a provider was unreachable.
 */
function environmentFromQuery(raw: unknown): MarketEnvironment {
  return String(raw ?? '').toUpperCase() === 'DEMO' ? 'DEMO' : 'LIVE';
}

app.get('/health', async () => ({ ok: true, service: 'rekt-ink-api', time: new Date().toISOString() }));

app.get('/v1/status', async () => {
  try {
    return { ok: true, mode: 'LIVE_CAPABLE', ...(await inkStatus()) };
  } catch (error: any) {
    return {
      ok: false,
      mode: 'DEGRADED',
      chainId: 57073,
      error: String(error?.message || error),
      time: new Date().toISOString(),
    };
  }
});

app.get('/v1/radar', async (req: any, reply) => {
  const environment = environmentFromQuery(req.query?.environment ?? req.query?.mode);
  if (environment === 'DEMO') return { environment: 'DEMO', items: fixtureAssets };
  try {
    return { environment: 'LIVE', items: await topInkPools(Number(req.query?.limit || 30)) };
  } catch (error: any) {
    // Fail closed. An empty LIVE result is an honest degraded state; serving
    // fixtures here would put fabricated rows under a LIVE label.
    return reply.code(503).send({
      environment: 'LIVE_UNAVAILABLE',
      warning: String(error?.message || error),
      items: [],
    });
  }
});

app.get('/v1/search', async (req: any, reply) => {
  const q = String(req.query?.q || '').trim();
  if (!q) return reply.code(400).send({ error: 'q required' });
  try {
    return { items: await searchPairs(q) };
  } catch (error: any) {
    return reply.code(502).send({ error: String(error?.message || error) });
  }
});

app.get('/v1/assets/:symbol/bars', async (req: any) => {
  const symbol = String(req.params.symbol).toUpperCase();
  return {
    symbol,
    // Fixture history is fabricated and denominated in the fixture's own ETH
    // quote. Both facts are stated rather than implied.
    environment: 'DEMO' as const,
    currency: 'QUOTE_TOKEN' as const,
    currencyLabel: 'WETH',
    bars: fixtureBars(symbol),
    provenance: {
      state: 'SYNTHETIC' as const,
      source: 'FIXTURE_V1',
      asOf: new Date(FIXTURE_STREAM_EPOCH).toISOString(),
      method: 'deterministic seeded bar series; fabricated history',
    },
  };
});

app.get('/v1/pairs/:pair', async (req: any, reply) => {
  try {
    return { pair: await dexPair(req.params.pair) };
  } catch (error: any) {
    return reply.code(502).send({ error: String(error?.message || error) });
  }
});

/**
 * Historical OHLCV, always with its denomination attached.
 *
 * Defaults to the pool's own quote-token denomination so an ETH-quoted pool
 * yields ETH bars that the simulator's ETH overlays can legitimately share an
 * axis with. `currency=usd` is still available, and is labelled USD, so a
 * caller that asks for USD knows it received USD.
 */
app.get('/v1/pairs/:pair/ohlcv', async (req: any, reply) => {
  const requested = String(req.query?.currency || '').toUpperCase();
  const currency = requested === 'USD' ? 'USD' : 'QUOTE_TOKEN';
  try {
    const series = await ohlcv({
      pool: req.params.pair,
      timeframe: String(req.query?.timeframe || 'minute'),
      aggregate: Number(req.query?.aggregate || 1),
      limit: Number(req.query?.limit || 200),
      currency,
      quoteTokenAddress: req.query?.quoteTokenAddress ? String(req.query.quoteTokenAddress) : null,
      quoteTokenSymbol: req.query?.quoteTokenSymbol ? String(req.query.quoteTokenSymbol) : null,
    });
    if (series.bars.length === 0) {
      return reply.code(503).send({
        pair: req.params.pair,
        currency: series.currency,
        error: 'HISTORY_UNAVAILABLE',
        bars: [],
      });
    }
    return series;
  } catch (error: any) {
    return reply.code(502).send({ error: String(error?.message || error) });
  }
});

app.get('/v1/pairs/:pair/trades', async (req: any, reply) => {
  try {
    return { pair: req.params.pair, trades: await recentTrades(req.params.pair) };
  } catch (error: any) {
    return reply.code(502).send({ error: String(error?.message || error) });
  }
});

app.get('/v1/wallets/:address', async (req: any, reply) => {
  const address = String(req.params.address).toLowerCase();
  const environment = environmentFromQuery(req.query?.environment ?? req.query?.mode);
  // Fictional wallet histories exist only in DEMO. In LIVE they would be a
  // fabricated claim about a real address.
  if (environment === 'DEMO') {
    const fixture = Object.entries(wallets).find(([k]) => k.toLowerCase() === address)?.[1];
    if (fixture) return fixture;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return reply.code(400).send({ error: 'invalid EVM address' });
  try {
    const balance = await rpc('eth_getBalance', [address, 'latest']);
    return {
      address,
      classifier: 'UNAVAILABLE',
      confidence: null,
      visibleValueUsd: null,
      eth: Number(BigInt(balance)) / 1e18,
      addressAgeDays: null,
      rektHeld: null,
      rektBought30d: null,
      rektSold30d: null,
      medianHold: null,
      longestHold: null,
      reasons: ['Live RPC exposes ETH balance only; indexed history/classification is unavailable.'],
      provenance: {
        state: 'UNAVAILABLE',
        source: 'INK_RPC',
        asOf: new Date().toISOString(),
        method: 'eth_getBalance only; no fake net-worth or behavior inference',
      },
    };
  } catch (error: any) {
    return reply.code(502).send({ error: String(error?.message || error) });
  }
});

app.get('/v1/nfts/:contract/:tokenId', async (req: any, reply) => {
  const configured = (process.env.REKT_NFT_CONTRACT || '').toLowerCase();
  const requested = String(req.params.contract).toLowerCase();
  const environment = environmentFromQuery(req.query?.environment ?? req.query?.mode);
  if (environment === 'DEMO' && !configured && requested === nftFixture.contract.toLowerCase()) return nftFixture;
  return reply.code(501).send({
    error: 'Live REKT NFT sale semantics are fail-closed until REKT_NFT_CONTRACT and marketplace/payment evidence adapters are configured.',
  });
});

/**
 * DEMO tape event.
 *
 * Fabricated, and labelled SYNTHETIC. This previously claimed CONFIRMED, which
 * put seeded noise in the same truth class as a signed chain head.
 */
function makeDemoEvent(symbol: string, seq: number) {
  const side = seq % 2 ? 'BUY' : 'SELL';
  const wallet = walletList[seq % walletList.length];
  const serverTime = FIXTURE_STREAM_EPOCH + seq * 200;
  return {
    type: seq % 37 === 0 ? 'SWEEP' : side,
    seq,
    serverTime,
    payload: {
      symbol,
      side,
      priceEth:
        (fixtureAssets.find((asset) => asset.symbol === symbol)?.priceEth || 0.01) *
        (1 + Math.sin(seq / 11) * 0.008),
      qty: 100 + (seq * 137) % 3900,
      wallet,
      provenance: {
        state: 'SYNTHETIC',
        source: 'FIXTURE_STREAM',
        asOf: new Date(serverTime).toISOString(),
        method: 'deterministic replay; fabricated market event',
      },
    },
  };
}

app.get('/v1/stream', { websocket: true }, (socket: any, req: any) => {
  const url = new URL(req.url, 'http://local');
  const environment = environmentFromQuery(url.searchParams.get('environment') ?? url.searchParams.get('mode'));
  const symbol = (url.searchParams.get('symbol') || 'REKT').toUpperCase();
  const pair = url.searchParams.get('pair') || '';
  const scenario = (url.searchParams.get('scenario') || 'NORMAL').toUpperCase();
  let closed = false;
  let envelopeSeq = 0;
  let demoSeq = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopHeads: () => void = () => {};
  let unsubscribeMarket: () => void = () => {};

  const send = (value: unknown) => {
    if (!closed && socket.readyState === 1) socket.send(JSON.stringify(value));
  };

  const helloTime = environment === 'DEMO' ? FIXTURE_STREAM_EPOCH : Date.now();
  send({ type: 'HELLO', seq: envelopeSeq++, serverTime: helloTime, payload: { environment, chainId: 57073, currency: 'ETH' } });

  if (environment === 'DEMO') {
    const rates: Record<string, number> = { NORMAL: 5, ACTIVE: 50, MANIA: 250, PATHOLOGICAL: 100 };
    const rate = rates[scenario] || 5;
    const emitDemo = () => send(makeDemoEvent(symbol, ++demoSeq));
    if (scenario === 'PATHOLOGICAL') {
      for (let i = 0; i < 1000; i++) emitDemo();
    }
    timer = setInterval(emitDemo, Math.max(4, Math.floor(1000 / rate)));
  } else {
    stopHeads = headHub.subscribe((event) => {
      if (event.kind === 'HEAD') {
        send({
          type: 'HEAD',
          seq: envelopeSeq++,
          serverTime: Date.now(),
          payload: {
            ...event.head,
            provenance: {
              state: 'CONFIRMED',
              source: 'INK_WSS',
              asOf: new Date().toISOString(),
              method: 'eth_subscribe newHeads',
            },
          },
        });
        return;
      }
      send({ type: 'SOURCE_STATUS', seq: envelopeSeq++, serverTime: Date.now(), payload: { state: event.state } });
    });

    if (pair) {
      // Attach to the shared per-pair poller. Opening more websockets does not
      // create more provider polling.
      unsubscribeMarket = marketHub.subscribe(pair, (event) => {
        if (event.kind === 'SNAPSHOT') {
          const { snapshot } = event;
          send({
            type: 'MARKET_UPDATE',
            seq: envelopeSeq++,
            serverTime: snapshot.observedAtMs,
            payload: {
              pairAddress: snapshot.pairAddress,
              priceUsd: snapshot.priceUsd,
              priceNative: snapshot.priceNative,
              txns: snapshot.txns,
              volume: snapshot.volume,
              liquidity: snapshot.liquidity,
              provenance: snapshot.provenance,
            },
          });
          return;
        }
        if (event.kind === 'SWAPS') {
          // Confirmed swaps travel as their own envelope type so the client can
          // render them differently from a derived aggregate mark.
          send({
            type: 'SWAPS',
            seq: envelopeSeq++,
            serverTime: Date.now(),
            payload: { pairAddress: event.pairAddress, trades: event.trades },
          });
          return;
        }
        send({ type: 'SOURCE_STATUS', seq: envelopeSeq++, serverTime: Date.now(), payload: { state: event.state, error: event.detail } });
      });
    }
  }

  socket.on('close', () => {
    closed = true;
    if (timer) clearInterval(timer);
    stopHeads();
    unsubscribeMarket();
  });
});

export { marketHub, headHub, isEthEquivalentQuoteAddress };

await app.listen({ port: PORT, host: HOST });
