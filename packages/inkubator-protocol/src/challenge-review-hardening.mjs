import * as base from './challenge.mjs';
import {assertString, invariant, isObject} from './challenge-hardening-util.mjs';

const RECEIPT_AUTHORITY_KEYS = new Set([
  'schema_version',
  'challenge_id',
  'receipt_id',
  'digest',
  'contract_version',
  'mechanism_version',
  'settlement_policy_version',
  'ip_terms_version',
  'terms_digest',
  'terminal_outcome',
  'settlement_intent',
  'settlement_execution_fact',
  'ip_transfer_fact',
]);

export function appendAppealEvent(history, event) {
  if (event?.type === 'RESOLUTION') {
    invariant(base.QUALIFICATION_RESULTS.includes(event.result), 'appeal resolution result invalid');
    if ('resolver_id' in event) assertString(event.resolver_id, 'appeal event.resolver_id');
  }
  return base.appendAppealEvent(history, event);
}

export function appendReceiptCorrection(receipts, args) {
  const correctedProjection = args?.corrected_projection ?? {};
  invariant(isObject(correctedProjection), 'corrected projection must be an object');
  for (const key of Object.keys(correctedProjection)) {
    invariant(!RECEIPT_AUTHORITY_KEYS.has(key), `correction cannot rewrite ${key}`);
  }
  return base.appendReceiptCorrection(receipts, args);
}
