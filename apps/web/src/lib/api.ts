import type { Bar, RadarAsset, WalletTrace } from '../types/api';
import { localAssets, localBars, localWallets, localNft } from './local-fixtures';

async function j<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const api = {
  status: () => j<any>('/v1/status'),

  radar: async (mode: 'fixture' | 'live') => {
    if (mode === 'fixture') {
      try {
        return await j<{ mode: string; items: RadarAsset[]; warning?: string }>('/v1/radar?mode=fixture');
      } catch {
        return { mode: 'browser-fixture', items: localAssets };
      }
    }
    // LIVE is fail-closed: never substitute fixture rows under a LIVE label.
    return j<{ mode: string; items: RadarAsset[]; warning?: string }>('/v1/radar?mode=live');
  },

  bars: async (asset: RadarAsset, mode: 'fixture' | 'live'): Promise<Bar[]> => {
    if (mode === 'fixture') {
      try {
        return (await j<{ bars: Bar[] }>(`/v1/assets/${asset.symbol}/bars`)).bars;
      } catch {
        return localBars(asset.symbol);
      }
    }
    return (
      await j<{ bars: Bar[]; currency?: string }>(
        `/v1/pairs/${asset.pairAddress}/ohlcv?timeframe=minute&limit=200`,
      )
    ).bars;
  },

  trades: (asset: RadarAsset) => j<any>(`/v1/pairs/${asset.pairAddress}/trades`),

  wallet: async (address: string, mode: 'fixture' | 'live'): Promise<WalletTrace> => {
    try {
      return await j<WalletTrace>(`/v1/wallets/${address}`);
    } catch (error) {
      if (mode === 'fixture') {
        const hit = Object.entries(localWallets).find(([k]) => k.toLowerCase() === address.toLowerCase())?.[1];
        if (hit) return hit;
      }
      throw error;
    }
  },

  nft: async (contract: string, tokenId: string, mode: 'fixture' | 'live') => {
    try {
      return await j<any>(`/v1/nfts/${contract}/${tokenId}`);
    } catch (error) {
      if (mode === 'fixture') return localNft;
      throw error;
    }
  },

  search: (q: string) => j<any>(`/v1/search?q=${encodeURIComponent(q)}`),
};

export function streamUrl(mode: 'fixture' | 'live', asset: RadarAsset, scenario = 'NORMAL') {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/v1/stream?mode=${mode}&symbol=${encodeURIComponent(asset.symbol)}&pair=${encodeURIComponent(asset.pairAddress)}&scenario=${encodeURIComponent(scenario)}`;
}
