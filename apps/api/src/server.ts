import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { fixtureAssets, fixtureBars, wallets, nftFixture, walletList } from './fixtures.js';
import { inkStatus, topInkPools, searchPairs, dexPair, ohlcv, recentTrades, rpc, createInkHeadFeed } from './live.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(websocket);

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const FIXTURE_STREAM_EPOCH = Date.UTC(2026, 0, 30, 21, 0, 0);

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
  const mode = String(req.query?.mode || 'fixture');
  if (mode !== 'live') return { mode: 'fixture', items: fixtureAssets };
  try {
    return { mode: 'live', items: await topInkPools(Number(req.query?.limit || 30)) };
  } catch (error: any) {
    return reply.code(503).send({
      mode: 'live-unavailable',
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

app.get('/v1/assets/:symbol/bars', async (req: any) => ({
  symbol: String(req.params.symbol).toUpperCase(),
  bars: fixtureBars(String(req.params.symbol).toUpperCase()),
}));

app.get('/v1/pairs/:pair', async (req: any, reply) => {
  try {
    return { pair: await dexPair(req.params.pair) };
  } catch (error: any) {
    return reply.code(502).send({ error: String(error?.message || error) });
  }
});

app.get('/v1/pairs/:pair/ohlcv', async (req: any, reply) => {
  try {
    return {
      pair: req.params.pair,
      currency: 'usd',
      bars: await ohlcv(
        req.params.pair,
        String(req.query?.timeframe || 'minute'),
        Number(req.query?.aggregate || 1),
        Number(req.query?.limit || 200),
      ),
    };
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
  const fixture = Object.entries(wallets).find(([k]) => k.toLowerCase() === address)?.[1];
  if (fixture) return fixture;
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
  if (!configured && requested === nftFixture.contract.toLowerCase()) return nftFixture;
  return reply.code(501).send({
    error: 'Live REKT NFT sale semantics are fail-closed until REKT_NFT_CONTRACT and marketplace/payment evidence adapters are configured.',
  });
});

function makeFixtureEvent(symbol: string, seq: number) {
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
        state: 'CONFIRMED',
        source: 'FIXTURE_STREAM',
        asOf: new Date(serverTime).toISOString(),
        method: 'deterministic replay',
      },
    },
  };
}

app.get('/v1/stream', { websocket: true }, (socket: any, req: any) => {
  const url = new URL(req.url, 'http://local');
  const mode = url.searchParams.get('mode') || 'fixture';
  const symbol = (url.searchParams.get('symbol') || 'REKT').toUpperCase();
  const pair = url.searchParams.get('pair') || '';
  const scenario = (url.searchParams.get('scenario') || 'NORMAL').toUpperCase();
  let closed = false;
  let envelopeSeq = 0;
  let fixtureSeq = 0;
  let lastPair = '';
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopHeads: () => void = () => {};

  const send = (value: unknown) => {
    if (!closed && socket.readyState === 1) socket.send(JSON.stringify(value));
  };

  const helloTime = mode === 'fixture' ? FIXTURE_STREAM_EPOCH : Date.now();
  send({ type: 'HELLO', seq: envelopeSeq++, serverTime: helloTime, payload: { mode, chainId: 57073, currency: 'ETH' } });

  if (mode === 'fixture') {
    const rates: Record<string, number> = { NORMAL: 5, ACTIVE: 50, MANIA: 250, PATHOLOGICAL: 100 };
    const rate = rates[scenario] || 5;
    const emitFixture = () => send(makeFixtureEvent(symbol, ++fixtureSeq));
    if (scenario === 'PATHOLOGICAL') {
      for (let i = 0; i < 1000; i++) emitFixture();
    }
    timer = setInterval(emitFixture, Math.max(4, Math.floor(1000 / rate)));
  } else {
    stopHeads = createInkHeadFeed(
      (head) =>
        send({
          type: 'HEAD',
          seq: envelopeSeq++,
          serverTime: Date.now(),
          payload: {
            ...head,
            provenance: {
              state: 'CONFIRMED',
              source: 'INK_WSS',
              asOf: new Date().toISOString(),
              method: 'eth_subscribe newHeads',
            },
          },
        }),
      (state) => send({ type: 'SOURCE_STATUS', seq: envelopeSeq++, serverTime: Date.now(), payload: { state } }),
    );

    if (pair) {
      timer = setInterval(async () => {
        try {
          const p: any = await dexPair(pair);
          if (!p) return;
          const fingerprint = JSON.stringify([p.priceUsd, p.priceNative, p.txns?.m5, p.volume?.m5, p.liquidity?.usd]);
          if (fingerprint === lastPair) return;
          lastPair = fingerprint;
          send({
            type: 'MARKET_UPDATE',
            seq: envelopeSeq++,
            serverTime: Date.now(),
            payload: {
              pairAddress: pair,
              priceUsd: Number(p.priceUsd || 0) || null,
              priceNative: Number(p.priceNative || 0) || null,
              txns: p.txns || null,
              volume: p.volume || null,
              liquidity: p.liquidity || null,
              provenance: {
                state: 'DERIVED',
                source: 'DEXSCREENER',
                asOf: new Date().toISOString(),
                method: 'polling pair snapshot; aggregate data only',
              },
            },
          });
        } catch (error: any) {
          send({
            type: 'SOURCE_STATUS',
            seq: envelopeSeq++,
            serverTime: Date.now(),
            payload: { state: 'DEGRADED', error: String(error?.message || error) },
          });
        }
      }, 2000);
    }
  }

  socket.on('close', () => {
    closed = true;
    if (timer) clearInterval(timer);
    stopHeads();
  });
});

await app.listen({ port: PORT, host: HOST });
