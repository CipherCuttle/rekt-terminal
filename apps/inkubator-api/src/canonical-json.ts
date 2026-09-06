import {createHash} from 'node:crypto';

export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};

function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JSON payload numbers must be finite');
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (typeof value === 'object') {
    const output = Object.create(null) as {[key: string]: JsonValue};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) throw new Error(`JSON payload field ${key} must not be undefined`);
      output[key] = normalizeJson(child);
    }
    return output;
  }
  throw new Error(`Unsupported JSON payload value: ${typeof value}`);
}

export function canonicalizeJson(value: unknown): {value: JsonValue; serialized: string; sha256: string} {
  const normalized = normalizeJson(value);
  const serialized = JSON.stringify(normalized);
  const sha256 = createHash('sha256').update(serialized, 'utf8').digest('hex');
  return {value: normalized, serialized, sha256};
}
