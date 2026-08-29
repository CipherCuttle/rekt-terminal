const EXPECTED_POOL = '0x716ddc8df376488660e85eefda8df74f447c453a';
const EXPECTED_WETH = '0x4200000000000000000000000000000000000006';
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';

const providerRequests: string[] = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  if (url.startsWith(GECKO_BASE)) providerRequests.push(url);
  return originalFetch(input, init);
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNoSynthetic(value: unknown, label: string) {
  assert(!JSON.stringify(value).includes('SYNTHETIC'), `${label}: SYNTHETIC leaked into LIVE qualification`);
}

function assertFiniteBar(bar: { time: number; open: number; high: number; low: number; close: number; volume: number }, index: number) {
  assert(Number.isFinite(bar.time), `bar ${index}: non-finite time`);
  for (const key of ['open', 'high', 'low', 'close'] as const) {
    assert(Number.isFinite(bar[key]) && bar[key] > 0, `bar ${index}: invalid ${key}`);
  }
  assert(Number.isFinite(bar.volume) && bar.volume >= 0, `bar ${index}: invalid volume`);
}

try {
  const { topInkPools, ohlcv, recentTrades, isEthEquivalentQuoteAddress } = await import('../apps/api/src/live.ts');

  const pools = await topInkPools(30);
  const pool = pools.find((entry) => entry.pairAddress.toLowerCase() === EXPECTED_POOL);
  assert(pool, `frozen pool ${EXPECTED_POOL} not present in provider top-pools response`);
  assert(pool.quoteIdentityResolved, 'quote identity unresolved');
  assert(pool.quoteTokenAddress?.toLowerCase() === EXPECTED_WETH, `unexpected quote token ${pool.quoteTokenAddress}`);
  assert(isEthEquivalentQuoteAddress(pool.quoteTokenAddress), 'quote token is not ETH-equivalent');
  assert(pool.quote === 'WETH', `unexpected quote symbol ${pool.quote}`);
  assert(pool.baseTokenAddress && /^0x[0-9a-f]{40}$/.test(pool.baseTokenAddress), 'base token address unresolved');
  assert(pool.provenance.state === 'DERIVED', `pool aggregate provenance strengthened to ${pool.provenance.state}`);
  assert(pool.priceEth !== null && Number.isFinite(pool.priceEth) && pool.priceEth > 0, 'provider native/quote price invalid');
  assertNoSynthetic(pool, 'pool');

  const history = await ohlcv({
    pool: EXPECTED_POOL,
    timeframe: 'minute',
    aggregate: 5,
    limit: 20,
    currency: 'QUOTE_TOKEN',
    quoteTokenAddress: pool.quoteTokenAddress,
    quoteTokenSymbol: pool.quote,
  });
  assert(history.currency === 'QUOTE_TOKEN', `history currency mismatch: ${history.currency}`);
  assert(history.currencyLabel === 'WETH', `history currency label mismatch: ${history.currencyLabel}`);
  assert(history.quoteTokenAddress?.toLowerCase() === EXPECTED_WETH, 'history quote token address mismatch');
  assert(history.provenance.state === 'DERIVED', `OHLCV provenance strengthened to ${history.provenance.state}`);
  assert(history.bars.length > 0, 'OHLCV returned no bars');
  history.bars.forEach(assertFiniteBar);
  assertNoSynthetic(history, 'ohlcv');

  const trades = await recentTrades(EXPECTED_POOL);
  assert(trades.length > 0, 'trades endpoint returned no trades');
  for (const trade of trades) {
    const expected = trade.txHash ? 'CONFIRMED' : 'DERIVED';
    assert(trade.provenance.state === expected, `trade ${trade.id}: expected ${expected}, got ${trade.provenance.state}`);
  }
  assertNoSynthetic(trades, 'trades');

  assert(providerRequests.length === 3, `request budget violated: expected 3 GeckoTerminal requests, got ${providerRequests.length}`);
  assert(providerRequests[0]?.includes('/networks/ink/pools?'), 'request 1 was not pool metadata/top-pools');
  assert(providerRequests[1]?.includes(`/networks/ink/pools/${EXPECTED_POOL}/ohlcv/minute?`), 'request 2 was not OHLCV');
  assert(providerRequests[1]?.includes('currency=token') && providerRequests[1]?.includes('token=base'), 'OHLCV did not request direct quote-token denomination');
  assert(providerRequests[2]?.includes(`/networks/ink/pools/${EXPECTED_POOL}/trades`), 'request 3 was not trades');

  const receipt = {
    qualification: 'LIVE_PROVIDER_SMOKE_V0',
    verdict: 'PASS',
    observedAt: new Date().toISOString(),
    pool: {
      address: pool.pairAddress,
      id: pool.id,
      venue: pool.venue,
      baseTokenAddress: pool.baseTokenAddress,
      baseSymbol: pool.symbol,
      quoteTokenAddress: pool.quoteTokenAddress,
      quoteSymbol: pool.quote,
      quoteIdentityResolved: pool.quoteIdentityResolved,
    },
    requests: providerRequests.map((url, index) => ({ index: index + 1, url })),
    requestCount: providerRequests.length,
    assertions: {
      relationshipIdentity: true,
      expectedWethAddress: true,
      quoteCurrency: history.currency,
      quoteCurrencyLabel: history.currencyLabel,
      ohlcvBars: history.bars.length,
      aggregatesProvenance: pool.provenance.state,
      ohlcvProvenance: history.provenance.state,
      tradeCount: trades.length,
      confirmedTrades: trades.filter((trade) => trade.provenance.state === 'CONFIRMED').length,
      derivedTrades: trades.filter((trade) => trade.provenance.state === 'DERIVED').length,
      syntheticLeakage: false,
      currentFxConversion: false,
      demoFallback: false,
    },
  };

  console.log(JSON.stringify(receipt, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
