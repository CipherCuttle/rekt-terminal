import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  IP_TERMS_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  appendAppealEvent,
  appendReceiptCorrection,
  buildSettlementIntent,
  computeDefaultResolution,
  fileReceipt,
  freezeBuildContract,
  transitionChallenge,
} from '../src/challenge-hardened.mjs';

const t0 = 1_900_000_000_000;

function frozen() {
  return freezeBuildContract({
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
    challenge_id: 'CH-REVIEW',
    contract_version: '1',
    mechanism_version: MECHANISM_VERSION,
    settlement_policy_version: SETTLEMENT_POLICY_VERSION,
    ip_terms_version: IP_TERMS_VERSION,
    title: 'Reviewed challenge',
    brief: 'Regression fixture',
    outcome_contract: {criteria: [{id: 'OUT', description: 'Works', mandatory: true}]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: 4,
    activation_minimum: 2,
    entry_deadline: t0 + 100,
    build_start: t0 + 100,
    submission_deadline: t0 + 200,
    appeal_window_ms: 50,
    review_deadline: t0 + 400,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

function challenge(status, contract, extra = {}) {
  return {challenge_id: contract.challenge_id, status, contract, ...extra};
}

function finalizedFact(intent, executionId = 'tx-1') {
  return {
    challenge_id: intent.challenge_id,
    terms_digest: intent.terms_digest,
    settlement_policy_version: intent.settlement_policy_version,
    asset: intent.asset,
    total_minor_units: intent.total_minor_units,
    recipients: intent.recipients,
    finality: 'FINALIZED',
    execution_id: executionId,
  };
}

function selectionState(contract) {
  const appeal = challenge('APPEAL_WINDOW', contract, {appeal_opened_at: t0 + 250});
  const qualifiers = transitionChallenge(appeal, 'FINAL_QUALIFIERS', {
    now: t0 + 300,
    appealsResolved: true,
    finalQualifierIds: ['E2', 'E1'],
  });
  return transitionChallenge(qualifiers, 'SELECTION');
}

test('independent P1: FINAL_QUALIFIERS persists canonical immutable qualifier ids', () => {
  const c = frozen();
  const appeal = challenge('APPEAL_WINDOW', c, {appeal_opened_at: t0 + 250});
  const final = transitionChallenge(appeal, 'FINAL_QUALIFIERS', {
    now: t0 + 300,
    appealsResolved: true,
    finalQualifierIds: ['E2', 'E1'],
  });
  assert.deepEqual(final.final_qualifier_ids, ['E1', 'E2']);
  const selection = transitionChallenge(final, 'SELECTION', {finalQualifierIds: ['EVIL']});
  assert.deepEqual(selection.final_qualifier_ids, ['E1', 'E2']);
});

test('independent P1: stored qualifier set, not caller list, controls winner authorization', () => {
  const c = frozen();
  const selection = selectionState(c);
  const intent = buildSettlementIntent({
    contract: c,
    resolution: computeDefaultResolution(['E1'], c.prize_minor_units),
    recipientByEntryId: {E1: 'A'},
  });

  assert.throws(
    () => transitionChallenge(selection, 'SETTLEMENT_PENDING', {
      now: c.review_deadline - 1,
      selectedEntryId: 'EVIL',
      finalQualifierIds: ['EVIL'],
      settlementIntent: intent,
      recipientByEntryId: {E1: 'A', EVIL: 'X'},
    }),
    /not a final qualifier/,
  );
});

test('independent P1: pending state stores settlement authorization and finalization cannot replace it', () => {
  const c = frozen();
  const selection = selectionState(c);
  const intentE1 = buildSettlementIntent({
    contract: c,
    resolution: computeDefaultResolution(['E1'], c.prize_minor_units),
    recipientByEntryId: {E1: 'A'},
  });
  const pending = transitionChallenge(selection, 'SETTLEMENT_PENDING', {
    now: c.review_deadline - 1,
    selectedEntryId: 'E1',
    settlementIntent: intentE1,
    recipientByEntryId: {E1: 'A'},
  });
  assert.deepEqual(pending.authorized_settlement_intent, intentE1);

  const intentE2 = buildSettlementIntent({
    contract: c,
    resolution: computeDefaultResolution(['E2'], c.prize_minor_units),
    recipientByEntryId: {E2: 'B'},
  });
  assert.throws(
    () => transitionChallenge(pending, 'SETTLED', {
      settlementIntent: intentE2,
      executionFact: finalizedFact(intentE2, 'tx-evil'),
    }),
    /differs from stored authorization/,
  );

  const settled = transitionChallenge(pending, 'SETTLED', {executionFact: finalizedFact(intentE1)});
  assert.deepEqual(settled.settlement_execution_fact, finalizedFact(intentE1));

  const forgedReceipt = fileReceipt({
    contract: c,
    settlementIntent: intentE2,
    settlementExecutionFact: finalizedFact(intentE2, 'tx-evil'),
  });
  assert.throws(
    () => transitionChallenge(settled, 'RECEIPT_FILED', {receipt: forgedReceipt}),
    /stored authorization/,
  );
});

test('independent P1: organizer winner selection is impossible at or after review deadline', () => {
  const c = frozen();
  const selection = selectionState(c);
  const intent = buildSettlementIntent({
    contract: c,
    resolution: computeDefaultResolution(['E1'], c.prize_minor_units),
    recipientByEntryId: {E1: 'A'},
  });
  assert.throws(
    () => transitionChallenge(selection, 'SETTLEMENT_PENDING', {
      now: c.review_deadline,
      selectedEntryId: 'E1',
      settlementIntent: intent,
      recipientByEntryId: {E1: 'A'},
    }),
    /selection deadline elapsed/,
  );
});

test('independent P1: receipt corrections cannot rewrite derived authority facts', () => {
  const c = frozen();
  const intent = buildSettlementIntent({
    contract: c,
    resolution: computeDefaultResolution(['E1'], c.prize_minor_units),
    recipientByEntryId: {E1: 'A'},
  });
  const receipt = fileReceipt({contract: c, settlementIntent: intent, settlementExecutionFact: finalizedFact(intent)});
  assert.throws(
    () => appendReceiptCorrection([receipt], {
      supersedes: receipt.receipt_id,
      reason: 'lie',
      authority: 'resolver',
      corrected_projection: {terminal_outcome: 'REFUNDED_NO_QUALIFIER'},
    }),
    /cannot rewrite terminal_outcome/,
  );
  assert.throws(
    () => appendReceiptCorrection([receipt], {
      supersedes: receipt.receipt_id,
      reason: 'lie',
      authority: 'resolver',
      corrected_projection: {ip_transfer_fact: 'NOT_TRIGGERED'},
    }),
    /cannot rewrite ip_transfer_fact/,
  );
});

test('independent P2 invariant: appeal resolution requires a valid result and resolver id is validated', () => {
  const history = appendAppealEvent([], {type: 'APPEAL', reason: 'evidence'});
  assert.throws(() => appendAppealEvent(history, {type: 'RESOLUTION'}), /result invalid/);
  assert.throws(
    () => appendAppealEvent(history, {type: 'RESOLUTION', result: 'PASS', resolver_id: ''}),
    /non-empty string/,
  );
  assert.equal(
    appendAppealEvent(history, {type: 'RESOLUTION', result: 'PASS', resolver_id: 'resolver-1'}).length,
    2,
  );
});

test('independent P2 invariant: lifecycle activation cannot exceed frozen slot limit', () => {
  const c = frozen();
  assert.throws(
    () => transitionChallenge(challenge('ENTRY_OPEN', c), 'BUILDING', {
      now: c.entry_deadline,
      activeSeatCount: c.slot_limit + 1,
    }),
    /exceeds slot_limit/,
  );
});
