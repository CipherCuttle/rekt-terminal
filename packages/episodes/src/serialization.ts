function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Canonical JSON-like encoding used by episode digests.
 *
 * Object keys are sorted by code unit and BigInt values carry an explicit tag;
 * arrays retain order. No locale, clock, entropy source, or insertion order is
 * consulted.
 */
export function canonicalEpisodeJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical serialization rejects non-finite numbers');
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return `{"$type":"bigint","value":${JSON.stringify(value.toString())}}`;
  }
  if (typeof value !== 'object') throw new TypeError(`canonical serialization rejects ${typeof value}`);
  if (Array.isArray(value)) return `[${value.map(canonicalEpisodeJson).join(',')}]`;
  if (!isPlainObject(value)) throw new TypeError('canonical serialization accepts plain objects only');

  const entries = Object.entries(value).sort(([left], [right]) => compareCodeUnits(left, right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalEpisodeJson(entry)}`).join(',')}}`;
}
