import {createHash} from 'node:crypto';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function byteCompare(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function assertString(value, label) {
  invariant(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assertAddress(value, label) {
  invariant(typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value), `${label} must be an EVM address`);
  return value.toLowerCase();
}

function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

export function buildCanonicalPayoutRoster(entries, {maxRecipients = 3, label = 'payout'} = {}) {
  invariant(Number.isSafeInteger(maxRecipients) && maxRecipients > 0, 'max recipients must be a positive safe integer');
  invariant(Array.isArray(entries) && entries.length > 0, `${label} payout entries must be a non-empty array`);
  invariant(entries.length <= maxRecipients, `${label} supports at most ${maxRecipients} payout recipients`);

  const normalized = entries.map((entry, index) => {
    invariant(entry && typeof entry === 'object' && !Array.isArray(entry), `${label} payout entry[${index}] must be an object`);
    assertString(entry.entry_id, `${label} payout entry[${index}].entry_id`);
    return {
      entry_id: entry.entry_id,
      payout_address: assertAddress(entry.payout_address, `${label} payout entry[${index}].payout_address`),
    };
  }).sort((left, right) => byteCompare(left.entry_id, right.entry_id));

  invariant(new Set(normalized.map((entry) => entry.entry_id)).size === normalized.length, `${label} payout entry ids must be unique`);
  invariant(new Set(normalized.map((entry) => entry.payout_address)).size === normalized.length, `${label} payout addresses must be unique`);

  return freeze(normalized.map((entry, payoutOrder) => ({
    ...entry,
    entry_digest: `0x${sha256Hex(entry.entry_id)}`,
    payout_order: payoutOrder,
  })));
}
