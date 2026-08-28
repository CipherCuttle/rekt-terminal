import type { SimEvent, SimState } from './index-types.js';

function canonical(value: unknown): string {
  if (typeof value === 'bigint') return `"bigint:${value.toString()}"`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
}

export function canonicalReplayJson(value: unknown): string {
  return canonical(value);
}

export function stableReplayDigest(eventsOrState: readonly SimEvent[] | SimState): string {
  const events: readonly SimEvent[] = 'events' in eventsOrState ? eventsOrState.events : eventsOrState;
  const input = canonical(events);
  let hash = 14695981039346656037n;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `FNV1A64-${hash.toString(16).padStart(16, '0')}`;
}

export const replayDigest = stableReplayDigest;
