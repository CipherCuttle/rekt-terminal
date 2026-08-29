export type FillMarkerLod = 'DETAIL' | 'COMPACT' | 'CLUSTER';

export interface FillMarkerSource {
  id: string;
  side: 'BUY' | 'SELL';
  timeSeconds: number;
  price: number;
  label: string;
}

export interface ProjectedFillMarker {
  id: string;
  timeSeconds: number;
  side: 'BUY' | 'SELL' | 'MIXED';
  price: number | null;
  text: string;
  count: number;
  exactPrice: boolean;
}

const DETAIL_EXIT_BARS = 96;
const DETAIL_REENTER_BARS = 72;
const CLUSTER_ENTER_BARS = 220;
const CLUSTER_EXIT_BARS = 170;

/**
 * Hysteretic marker LOD. The gap between enter/exit thresholds prevents labels
 * from flickering when a wheel or pinch gesture hovers around one boundary.
 */
export function nextFillMarkerLod(current: FillMarkerLod, visibleBars: number): FillMarkerLod {
  if (!Number.isFinite(visibleBars) || visibleBars <= 0) return current;
  if (current === 'DETAIL') return visibleBars > DETAIL_EXIT_BARS ? 'COMPACT' : 'DETAIL';
  if (current === 'CLUSTER') return visibleBars < CLUSTER_EXIT_BARS ? 'COMPACT' : 'CLUSTER';
  if (visibleBars < DETAIL_REENTER_BARS) return 'DETAIL';
  if (visibleBars > CLUSTER_ENTER_BARS) return 'CLUSTER';
  return 'COMPACT';
}

/** Cluster width only changes at coarse zoom tiers, not on every pixel of zoom. */
export function clusterBucketSeconds(visibleBars: number): number {
  if (visibleBars >= 720) return 60 * 60;
  if (visibleBars >= 360) return 30 * 60;
  return 15 * 60;
}

export function markerProjectionKey(lod: FillMarkerLod, visibleBars: number): string {
  return lod === 'CLUSTER' ? `${lod}:${clusterBucketSeconds(visibleBars)}` : lod;
}

/**
 * Project immutable fill truth into a zoom-appropriate presentation.
 * DETAIL/COMPACT preserve exact price anchoring. CLUSTER deliberately drops a
 * single-price claim and only states how many fills occurred in the time bucket.
 */
export function projectFillMarkers(
  input: readonly FillMarkerSource[],
  lod: FillMarkerLod,
  visibleBars: number,
): ProjectedFillMarker[] {
  const stamps = [...input].sort((a, b) => a.timeSeconds - b.timeSeconds || a.id.localeCompare(b.id));

  if (lod === 'DETAIL') {
    return stamps.map((stamp) => ({
      id: stamp.id,
      timeSeconds: stamp.timeSeconds,
      side: stamp.side,
      price: stamp.price,
      text: stamp.label,
      count: 1,
      exactPrice: true,
    }));
  }

  if (lod === 'COMPACT') {
    return stamps.map((stamp) => ({
      id: stamp.id,
      timeSeconds: stamp.timeSeconds,
      side: stamp.side,
      price: stamp.price,
      text: stamp.side === 'BUY' ? 'B' : 'S',
      count: 1,
      exactPrice: true,
    }));
  }

  const bucketSeconds = clusterBucketSeconds(visibleBars);
  const groups = new Map<number, FillMarkerSource[]>();
  for (const stamp of stamps) {
    const bucket = Math.floor(stamp.timeSeconds / bucketSeconds) * bucketSeconds;
    const group = groups.get(bucket);
    if (group) group.push(stamp);
    else groups.set(bucket, [stamp]);
  }

  return [...groups.entries()].map(([bucket, group]) => {
    const first = group[0];
    const last = group[group.length - 1];
    const allBuy = group.every((stamp) => stamp.side === 'BUY');
    const allSell = group.every((stamp) => stamp.side === 'SELL');
    const side: ProjectedFillMarker['side'] = allBuy ? 'BUY' : allSell ? 'SELL' : 'MIXED';
    const text = side === 'BUY' ? `B×${group.length}` : side === 'SELL' ? `S×${group.length}` : `${group.length} FILLS`;
    return {
      id: `cluster:${bucket}:${first.id}:${last.id}`,
      timeSeconds: first.timeSeconds,
      side,
      price: null,
      text,
      count: group.length,
      exactPrice: false,
    };
  });
}
