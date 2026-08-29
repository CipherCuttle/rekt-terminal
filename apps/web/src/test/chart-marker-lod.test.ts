import { describe, expect, it } from 'vitest';
import { clusterBucketSeconds, nextFillMarkerLod, projectFillMarkers, visibleDataBars } from '../lib/chart-marker-lod';

const stamps = [
  { id: 'b1', side: 'BUY' as const, timeSeconds: 60, price: 1.01, label: 'BUY 1.01' },
  { id: 'b2', side: 'BUY' as const, timeSeconds: 120, price: 1.02, label: 'BUY 1.02' },
  { id: 's1', side: 'SELL' as const, timeSeconds: 180, price: 1.03, label: 'SELL 1.03' },
];

describe('fill marker semantic zoom', () => {
  it('uses hysteresis at detail and cluster boundaries', () => {
    expect(nextFillMarkerLod('DETAIL', 96)).toBe('DETAIL');
    expect(nextFillMarkerLod('DETAIL', 97)).toBe('COMPACT');
    expect(nextFillMarkerLod('COMPACT', 80)).toBe('COMPACT');
    expect(nextFillMarkerLod('COMPACT', 71)).toBe('DETAIL');
    expect(nextFillMarkerLod('COMPACT', 221)).toBe('CLUSTER');
    expect(nextFillMarkerLod('CLUSTER', 180)).toBe('CLUSTER');
    expect(nextFillMarkerLod('CLUSTER', 169)).toBe('COMPACT');
  });

  it('resolves multi-tier jumps in one range update', () => {
    expect(nextFillMarkerLod('DETAIL', 500)).toBe('CLUSTER');
    expect(nextFillMarkerLod('CLUSTER', 50)).toBe('DETAIL');
  });

  it('excludes right-side whitespace from visible bar density', () => {
    expect(visibleDataBars({ from: 100, to: 195 }, 183)).toBe(84);
    expect(nextFillMarkerLod('DETAIL', visibleDataBars({ from: 100, to: 195 }, 183))).toBe('DETAIL');
  });

  it('keeps exact execution price in detail and compact modes', () => {
    const detail = projectFillMarkers(stamps, 'DETAIL', 50);
    const compact = projectFillMarkers(stamps, 'COMPACT', 120);
    expect(detail.map((marker) => marker.price)).toEqual([1.01, 1.02, 1.03]);
    expect(detail.map((marker) => marker.text)).toEqual(['BUY 1.01', 'BUY 1.02', 'SELL 1.03']);
    expect(compact.map((marker) => marker.price)).toEqual([1.01, 1.02, 1.03]);
    expect(compact.map((marker) => marker.text)).toEqual(['B', 'B', 'S']);
    expect(compact.every((marker) => marker.exactPrice)).toBe(true);
  });

  it('clusters without inventing one execution price', () => {
    const clustered = projectFillMarkers(stamps, 'CLUSTER', 240);
    expect(clustered).toHaveLength(1);
    expect(clustered[0]).toMatchObject({ side: 'MIXED', price: null, text: '3 FILLS', count: 3, exactPrice: false });
  });

  it('coarsens cluster buckets only at stable zoom tiers', () => {
    expect(clusterBucketSeconds(220)).toBe(15 * 60);
    expect(clusterBucketSeconds(360)).toBe(30 * 60);
    expect(clusterBucketSeconds(720)).toBe(60 * 60);
  });
});
