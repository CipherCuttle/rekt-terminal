import type { BarSeries, MarketEnvironment, PoolTrade, RadarAsset, WalletTrace } from '../types/api';
import { localAssets, localBars, localWallets, localNft } from './local-fixtures';

/**
 * Surface a readable reason rather than the raw response body. The API's
 * fail-closed envelopes carry a `warning`/`error` string; anything else falls
 * back to the status line. A user reading a degraded state should see why, not
 * a serialized payload.
 */
async function j<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    let reason = `${response.status} ${response.statusText || 'request failed'}`;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.warning === 'string') reason = parsed.warning;
      else if (typeof parsed?.error === 'string') reason = parsed.error;
    } catch {
      if (body && body.length <= 200) reason = body;
    }
    throw new Error(reason);
  }
  return response.json();
}

const query = (environment: MarketEnvironment) => `environment=${environment}`;

export const api = {
  status: () => j<any>('/v1/status'),

  /**
   * LIVE is fail-closed: never substitute DEMO rows under a LIVE label. A LIVE
   * failure propagates as a rejection so the caller can show a degraded state.
   * The browser fixture fallback exists only inside an explicitly chosen DEMO
   * environment, where the rows are already labelled SYNTHETIC.
   */
  radar: async (environment: MarketEnvironment) => {
    if (environment === 'DEMO') {
      try {
        return await j<{ environment: string; items: RadarAsset[]; warning?: string }>(`/v1/radar?${query('DEMO')}`);
      } catch {
        return { environment: 'DEMO_BROWSER', items: localAssets };
      }
    }
    const response = await j<{ environment: string; items: RadarAsset[]; warning?: string }>(`/v1/radar?${query('LIVE')}&limit=30`);
    // Trust the label, but verify it. A LIVE request that comes back marked as
    // anything else is treated as a LIVE failure rather than rendered.
    if (response.environment !== 'LIVE') {
      throw new Error(`Requested LIVE evidence but the API responded with ${response.environment}.`);
    }
    return response;
  },

  /**
   * Historical bars, always returned with their denomination attached.
   *
   * LIVE requests the pool's own quote-token denomination so the series is
   * directly comparable with the simulator's ETH overlays. If the provider
   * cannot supply that, the caller fails closed — it must not rescale.
   */
  bars: async (asset: RadarAsset, environment: MarketEnvironment): Promise<BarSeries> => {
    if (environment === 'DEMO') {
      try {
        const response = await j<{ bars: BarSeries['bars']; currency?: BarSeries['currency']; currencyLabel?: string }>(
          `/v1/assets/${asset.symbol}/bars`,
        );
        return { bars: response.bars, currency: response.currency ?? 'QUOTE_TOKEN', currencyLabel: response.currencyLabel ?? 'WETH' };
      } catch {
        return { bars: localBars(asset.symbol), currency: 'QUOTE_TOKEN', currencyLabel: 'WETH' };
      }
    }
    const params = new URLSearchParams({ timeframe: 'minute', limit: '200', currency: 'QUOTE_TOKEN' });
    if (asset.quoteTokenAddress) params.set('quoteTokenAddress', asset.quoteTokenAddress);
    if (asset.quote) params.set('quoteTokenSymbol', asset.quote);
    const response = await j<{ bars: BarSeries['bars']; currency: BarSeries['currency']; currencyLabel: string }>(
      `/v1/pairs/${asset.pairAddress}/ohlcv?${params.toString()}`,
    );
    return { bars: response.bars, currency: response.currency, currencyLabel: response.currencyLabel };
  },

  trades: (asset: RadarAsset) => j<{ pair: string; trades: PoolTrade[] }>(`/v1/pairs/${asset.pairAddress}/trades`),

  wallet: async (address: string, environment: MarketEnvironment): Promise<WalletTrace> => {
    try {
      return await j<WalletTrace>(`/v1/wallets/${address}?${query(environment)}`);
    } catch (error) {
      if (environment === 'DEMO') {
        const hit = Object.entries(localWallets).find(([k]) => k.toLowerCase() === address.toLowerCase())?.[1];
        if (hit) return hit;
      }
      throw error;
    }
  },

  nft: async (contract: string, tokenId: string, environment: MarketEnvironment) => {
    try {
      return await j<any>(`/v1/nfts/${contract}/${tokenId}?${query(environment)}`);
    } catch (error) {
      if (environment === 'DEMO') return localNft;
      throw error;
    }
  },

  search: (q: string) => j<any>(`/v1/search?q=${encodeURIComponent(q)}`),
};

export function streamUrl(environment: MarketEnvironment, asset: RadarAsset, scenario = 'NORMAL') {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/v1/stream?environment=${environment}&symbol=${encodeURIComponent(asset.symbol)}&pair=${encodeURIComponent(asset.pairAddress)}&scenario=${encodeURIComponent(scenario)}`;
}
