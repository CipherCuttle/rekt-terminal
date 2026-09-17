export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function assertString(value, label) {
  invariant(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

export function assertSafeInt(value, label, {min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER} = {}) {
  invariant(Number.isSafeInteger(value), `${label} must be a safe integer`);
  invariant(value >= min && value <= max, `${label} out of range`);
}

export function deepClone(value) {
  return structuredClone(value);
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function byteCompare(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) if (left[i] !== right[i]) return left[i] - right[i];
  return left.length - right.length;
}

export function canonicalIds(values, label) {
  invariant(Array.isArray(values), `${label} must be an array`);
  values.forEach((value, index) => assertString(value, `${label}[${index}]`));
  const unique = new Set(values);
  invariant(unique.size === values.length, `${label} must be unique`);
  return [...values].sort(byteCompare);
}
