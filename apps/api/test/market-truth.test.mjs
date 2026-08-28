/**
 * MARKET_TRUTH_V1 API invariants.
 *
 * Run against the compiled adapters so the shipped artefact is what is tested.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureAssets, fixtureBars, wallets, nftFixture } from '../dist/fixtures.js';
import {
  ChainHeadHub,
  MarketHub,
  DEFAULT_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  DEXSCREENER_PAIRS_RATE_LIMIT_PER_MINUTE,
} from '../dist/market-hub.js';
import {
  indexIncludedTokens,
  isEthEquivalentQuoteAddress,
  resolveTokenSide,
  tokenAddressFromRelationshipId,
} from '../dist/live.js';

const CANONICAL = ['CONFIRMED', 'DERIVED', 'SYNTHETIC', 'STALE', 'UNAVAILABLE'];
const WETH = '0x4200000000000000000000000000000000000006';

/* ------------------------------------------------- 1 + 2. fixture truth */

test('1 + 2. every fixture market row is SYNTHETIC and none claims CONFIRMED', () => {
  assert.ok(fixtureAssets.length > 0);
  for (const asset of fixtureAssets) {
    assert.equal(asset.provenance.state, 'SYNTHETIC', `${asset.symbol} provenance`);
    assert.equal(asset.freshness, 'SYNTHETIC', `${asset.symbol} freshness`);
    assert.ok(CANONICAL.includes(asset.provenance.state));
  }
});

test('2b. fictional wallet histories and the fictional NFT source are SYNTHETIC', () => {
  for (const wallet of Object.values(wallets)) {
    assert.equal(wallet.provenance.state, 'SYNTHETIC', `${wallet.address} provenance`);
  }
  assert.equal(nftFixture.provenance.state, 'SYNTHETIC');
  for (const entry of nftFixture.timeline) {
    assert.equal(entry.evidence, 'SYNTHETIC', `${entry.type} evidence`);
  }
});

test('2c. fixture rows still carry resolvable quote identity so DEMO gates the same way', () => {
  const weth = fixtureAssets.filter((asset) => asset.quote === 'WETH');
  const usdc = fixtureAssets.filter((asset) => asset.quote === 'USDC');
  assert.ok(weth.length > 0 && usdc.length > 0);
  for (const asset of fixtureAssets) {
    assert.equal(asset.quoteIdentityResolved, true);
    assert.match(asset.quoteTokenAddress, /^0x[0-9a-f]{40}$/);
  }
});

test('2d. fixture bars are deterministic', () => {
  assert.deepEqual(fixtureBars('REKT'), fixtureBars('REKT'));
  assert.equal(fixtureBars('REKT').length, 200);
});

/* --------------------------------------- 6. pool identity, not name parsing */

test('6. quote identity comes from provider relationships, never the pool name', () => {
  const pool = {
    id: 'ink_0xaaaabbbbccccddddeeeeffff0000111122223333',
    attributes: {
      // A name that would defeat any split('/') based parser.
      name: 'A / B PERP / WETH v2',
      address: '0xaaaabbbbccccddddeeeeffff0000111122223333',
    },
    relationships: {
      base_token: { data: { id: 'ink_0x1111111111111111111111111111111111111111' } },
      quote_token: { data: { id: `ink_${WETH}` } },
    },
  };
  const tokens = indexIncludedTokens([
    { id: 'ink_0x1111111111111111111111111111111111111111', type: 'token', attributes: { address: '0x1111111111111111111111111111111111111111', symbol: 'foo' } },
    { id: `ink_${WETH}`, type: 'token', attributes: { address: WETH, symbol: 'weth' } },
  ]);
  const base = resolveTokenSide(pool, 'base_token', tokens);
  const quote = resolveTokenSide(pool, 'quote_token', tokens);
  assert.equal(base.symbol, 'FOO');
  assert.equal(quote.symbol, 'WETH');
  assert.equal(quote.address, WETH);
  // Name parsing would have produced "B PERP" for the quote side.
  assert.notEqual(quote.symbol, 'B PERP');
  assert.equal(isEthEquivalentQuoteAddress(quote.address), true);
});

test('6b. ETH-equivalence is decided by address, not by a display symbol', () => {
  assert.equal(isEthEquivalentQuoteAddress(WETH), true);
  assert.equal(isEthEquivalentQuoteAddress(WETH.toUpperCase()), true);
  // An impostor token that merely renders as WETH is not ETH-equivalent.
  assert.equal(isEthEquivalentQuoteAddress('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'), false);
  assert.equal(isEthEquivalentQuoteAddress(null), false);
  assert.equal(isEthEquivalentQuoteAddress(undefined), false);
});

test('6c. an unresolvable quote side yields null identity rather than a guess', () => {
  const pool = { id: 'ink_0xpool', attributes: { name: 'MYSTERY / WETH' }, relationships: {} };
  const quote = resolveTokenSide(pool, 'quote_token', new Map());
  assert.equal(quote.address, null);
  assert.equal(quote.symbol, null);
  assert.equal(tokenAddressFromRelationshipId('not-an-id'), null);
  assert.equal(tokenAddressFromRelationshipId(undefined), null);
  assert.equal(tokenAddressFromRelationshipId(`ink_${WETH}`), WETH);
});

/* ------------------------------- 12. shared polling, not per-client polling */

function makeHub(overrides = {}) {
  let calls = 0;
  const hub = new MarketHub({
    fetchPair: async (pair) => {
      calls += 1;
      return { priceUsd: 1 + calls, priceNative: 0.001, txns: {}, volume: {}, liquidity: { usd: 1000 } };
    },
    pollIntervalMs: 1_000,
    lingerMs: 5_000,
    setTimer: () => 1,
    clearTimer: () => {},
    ...overrides,
  });
  return { hub, calls: () => calls };
}

test('12. many subscribers on one pair share exactly one provider poller', async () => {
  const { hub } = makeHub();
  const received = [0, 0, 0, 0, 0];
  const offs = received.map((_, index) => hub.subscribe('0xPAIR', () => { received[index] += 1; }));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(hub.activePollerCount(), 1);
  assert.equal(hub.subscriberCount('0xPAIR'), 5);
  // Every client got the snapshot; only one provider request produced it.
  assert.equal(hub.providerRequests, 1);
  for (const count of received) assert.ok(count >= 1);
  for (const off of offs) off();
  hub.dispose();
});

test('12b. reconnecting clients cannot multiply provider polling', async () => {
  const { hub } = makeHub();
  for (let i = 0; i < 25; i += 1) {
    const off = hub.subscribe('0xPAIR', () => {});
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(hub.activePollerCount(), 1, `poller count after ${i + 1} connections`);
    off();
  }
  // 25 connect/disconnect cycles, still one poll issued by the shared stream.
  assert.equal(hub.providerRequests, 1);
  hub.dispose();
});

test('12c. distinct pairs get their own stream, and pair keys are case-insensitive', async () => {
  const { hub } = makeHub();
  hub.subscribe('0xAAA', () => {});
  hub.subscribe('0xaaa', () => {});
  hub.subscribe('0xBBB', () => {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hub.activePollerCount(), 2);
  assert.equal(hub.subscriberCount('0xaaa'), 2);
  hub.dispose();
});

test('12d. a late subscriber is served the cached snapshot without a new request', async () => {
  const { hub } = makeHub();
  hub.subscribe('0xPAIR', () => {});
  await new Promise((resolve) => setImmediate(resolve));
  const before = hub.providerRequests;
  let served = null;
  hub.subscribe('0xPAIR', (event) => { if (event.kind === 'SNAPSHOT') served = event.snapshot; });
  assert.equal(hub.providerRequests, before);
  assert.ok(served, 'late subscriber received the cached snapshot');
  assert.equal(served.provenance.state, 'DERIVED');
  hub.dispose();
});

test('12e. the poller stops after the last subscriber leaves', () => {
  const timers = new Map();
  let nextId = 1;
  const hub = new MarketHub({
    fetchPair: async () => ({ priceUsd: 1, priceNative: 1, liquidity: { usd: 1 } }),
    pollIntervalMs: 1_000,
    lingerMs: 5_000,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, fn); return id; },
    clearTimer: (id) => timers.delete(id),
  });
  const off = hub.subscribe('0xPAIR', () => {});
  assert.equal(hub.activePollerCount(), 1);
  off();
  // Linger timer is armed, not yet fired.
  assert.equal(hub.activePollerCount(), 1);
  for (const fn of [...timers.values()]) fn();
  assert.equal(hub.activePollerCount(), 0);
  hub.dispose();
});

test('12f. retry backoff is bounded and never tighter than the configured budget', () => {
  const hub = new MarketHub({ fetchPair: async () => null, pollIntervalMs: 2_000, maxBackoffMs: 30_000, setTimer: () => 1, clearTimer: () => {} });
  assert.equal(hub.backoffMs(0), 2_000);
  assert.equal(hub.backoffMs(1), 4_000);
  assert.equal(hub.backoffMs(3), 16_000);
  assert.equal(hub.backoffMs(50), 30_000);
  for (let failures = 0; failures < 60; failures += 1) {
    const delay = hub.backoffMs(failures);
    assert.ok(delay >= 2_000 && delay <= 30_000, `backoff ${delay} out of bounds`);
  }
  hub.dispose();
});

test('12g. a provider failure is reported as an explicit degraded state', async () => {
  const events = [];
  const hub = new MarketHub({
    fetchPair: async () => { throw new Error('provider 429'); },
    pollIntervalMs: 1_000,
    setTimer: () => 1,
    clearTimer: () => {},
  });
  hub.subscribe('0xPAIR', (event) => events.push(event));
  await new Promise((resolve) => setImmediate(resolve));
  const status = events.find((event) => event.kind === 'STATUS');
  assert.ok(status, 'a status event was emitted');
  assert.equal(status.state, 'DEGRADED');
  assert.match(status.detail, /provider 429/);
  // Degraded, never a silent substitution of fabricated data.
  assert.equal(events.some((event) => event.kind === 'SNAPSHOT'), false);
  hub.dispose();
});

test('the configured polling budget respects the documented provider rate limit', () => {
  assert.equal(DEFAULT_POLL_INTERVAL_MS, 2_000);
  const perPairPerMinute = 60_000 / DEFAULT_POLL_INTERVAL_MS;
  assert.ok(perPairPerMinute * 1 <= DEXSCREENER_PAIRS_RATE_LIMIT_PER_MINUTE);
  // A configured value below the floor is clamped, not honoured.
  const hub = new MarketHub({ fetchPair: async () => null, pollIntervalMs: 1, setTimer: () => 1, clearTimer: () => {} });
  assert.equal(hub.backoffMs(0), MIN_POLL_INTERVAL_MS);
  hub.dispose();
});

/* -------------------------------- 11. confirmed swap vs derived mark */

test('11. confirmed swaps and derived marks keep different provenance on one stream', async () => {
  const trades = [
    { id: 't1', side: 'BUY', txHash: '0xabc', wallet: '0xw', priceUsd: 1, priceQuoteToken: 0.001, volumeUsd: 10, blockNumber: 42, at: 'now', provenance: { state: 'CONFIRMED', source: 'GECKOTERMINAL', asOf: 'now', method: 'tx hash present' } },
    { id: 't2', side: 'SELL', txHash: null, wallet: null, priceUsd: 1, priceQuoteToken: 0.001, volumeUsd: 10, blockNumber: null, at: 'now', provenance: { state: 'DERIVED', source: 'GECKOTERMINAL', asOf: 'now', method: 'no tx identity' } },
  ];
  const events = [];
  const hub = new MarketHub({
    fetchPair: async () => ({ priceUsd: 1, priceNative: 0.001, liquidity: { usd: 1 } }),
    fetchTrades: async () => trades,
    tradePollEveryNCycles: 1,
    pollIntervalMs: 1_000,
    setTimer: () => 1,
    clearTimer: () => {},
  });
  hub.subscribe('0xPAIR', (event) => events.push(event));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  const snapshot = events.find((event) => event.kind === 'SNAPSHOT');
  const swaps = events.find((event) => event.kind === 'SWAPS');
  assert.ok(snapshot && swaps);
  // The polled aggregate is DERIVED; it is not one confirmed trade.
  assert.equal(snapshot.snapshot.provenance.state, 'DERIVED');
  assert.match(snapshot.snapshot.provenance.method, /not a confirmed swap/);
  // Swap provenance is preserved per trade, with transaction identity intact.
  assert.equal(swaps.trades[0].provenance.state, 'CONFIRMED');
  assert.equal(swaps.trades[0].txHash, '0xabc');
  assert.equal(swaps.trades[0].blockNumber, 42);
  assert.equal(swaps.trades[1].provenance.state, 'DERIVED');
  hub.dispose();
});

test('11b. swaps already delivered are not re-emitted', async () => {
  const trades = [{ id: 'dup', side: 'BUY', txHash: '0x1', wallet: null, priceUsd: 1, priceQuoteToken: 1, volumeUsd: 1, blockNumber: 1, at: 'now', provenance: { state: 'CONFIRMED', source: 'GT', asOf: 'now', method: 'tx' } }];
  let swapEvents = 0;
  const hub = new MarketHub({
    fetchPair: async () => ({ priceUsd: 1, priceNative: 1, liquidity: { usd: 1 } }),
    fetchTrades: async () => trades,
    tradePollEveryNCycles: 1,
    pollIntervalMs: 1_000,
    setTimer: () => 1,
    clearTimer: () => {},
  });
  hub.subscribe('0xPAIR', (event) => { if (event.kind === 'SWAPS') swapEvents += 1; });
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(swapEvents, 1);
  hub.dispose();
});

/* ----------- 12h. chain-head fan-out (hostile review finding) ------------- */

test('12h. many websocket clients share one upstream chain-head subscription', () => {
  let opened = 0;
  let closed = 0;
  const heads = [];
  const timers = new Map();
  let nextId = 1;
  const hub = new ChainHeadHub({
    connect: (onHead, onState) => {
      opened += 1;
      onState('LIVE');
      onHead({ number: 4213, hash: '0xhead' });
      return () => { closed += 1; };
    },
    lingerMs: 5_000,
    setTimer: (fn) => { const id = nextId++; timers.set(id, fn); return id; },
    clearTimer: (id) => timers.delete(id),
  });

  const offs = [];
  for (let i = 0; i < 20; i += 1) {
    offs.push(hub.subscribe((event) => { if (event.kind === 'HEAD') heads.push(event.head.number); }));
  }
  // Twenty clients, one upstream RPC socket.
  assert.equal(opened, 1);
  assert.equal(hub.upstreamConnections, 1);
  assert.equal(hub.subscriberCount(), 20);
  // Every client saw the head, including the ones that joined after it arrived.
  assert.equal(heads.length, 20);

  for (const off of offs) off();
  assert.equal(hub.isActive(), true, 'linger keeps the stream briefly');
  for (const fn of [...timers.values()]) fn();
  assert.equal(hub.isActive(), false);
  assert.equal(closed, 1);
  hub.dispose();
});

test('12i. reconnect churn does not reopen the upstream head subscription', () => {
  let opened = 0;
  const hub = new ChainHeadHub({
    connect: (onHead, onState) => { opened += 1; onState('LIVE'); return () => {}; },
    lingerMs: 60_000,
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const keepAlive = hub.subscribe(() => {});
  for (let i = 0; i < 30; i += 1) hub.subscribe(() => {})();
  assert.equal(opened, 1);
  keepAlive();
  hub.dispose();
});
