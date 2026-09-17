import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendReceiptCorrection,
  buildSettlementIntent,
  fileReceipt,
  freezeBuildContract,
} from '@rekt-ink/protocol/challenge';
import {
  buildStageG3QualifierComparison,
  buildStageG3ReceiptTransport,
} from '../../dist/challenge-g3-api.js';

const t0 = 2_000_000_000_000;

function contractFor(challengeId) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'g3-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'G3 challenge',
    brief: 'Compare qualified work and choose explicitly.',
    outcome_contract: {criteria: []},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    preferences: {visual_direction: 'technical-faceplate', note: 'non-normative'},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: 3,
    activation_minimum: 1,
    entry_deadline: t0 + 100,
    build_start: t0 + 100,
    submission_deadline: t0 + 10_000,
    appeal_window_ms: 1_000,
    review_deadline: t0 + 20_000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

function snapshot({status = 'SELECTION', withSelection = true, receipts = []} = {}) {
  const challengeId = randomUUID();
  const organizer = randomUUID();
  const q1 = randomUUID();
  const q2 = randomUUID();
  const nonQualifier = randomUUID();
  const contract = contractFor(challengeId);
  const decisions = [{
    decision_id: randomUUID(), challenge_id: challengeId, entry_id: null,
    decision_type: 'FINAL_QUALIFIERS', decision_version: 'stage-c-effective-v1',
    decision_json: {final_qualifier_ids: [q2, q1]}, decision_digest: 'a'.repeat(64), created_at: new Date(t0),
  }];
  if (withSelection) decisions.push({
    decision_id: randomUUID(), challenge_id: challengeId, entry_id: q2,
    decision_type: 'SELECTION', decision_version: 'stage-g3-selection-v1',
    decision_json: {selected_entry_id: q2}, decision_digest: 'b'.repeat(64), created_at: new Date(t0 + 1),
  });
  return {
    organizer, q1, q2, nonQualifier, contract,
    value: {
      challenge: {
        challenge_id: challengeId, organizer_player_id: organizer, status,
        current_contract_version: contract.contract_version, current_terms_digest: contract.terms_digest,
      },
      contract: {
        challenge_id: challengeId, contract_version: contract.contract_version,
        terms_digest: contract.terms_digest, contract_json: contract, frozen_at: new Date(t0),
      },
      entries: [], submissions: [], qualifications: [], decisions, receipts,
    },
  };
}

function reveal(state) {
  const submission = (entryId, suffix) => ({
    entry_id: entryId,
    submission_id: randomUUID(),
    submission_version: 1,
    accepted_at: new Date(t0 + suffix).toISOString(),
    immutable_source_reference: {kind: 'GIT_COMMIT', value: `commit-${suffix}`},
    artifact_digest: String(suffix).padStart(64, '0').slice(-64),
    optional_live_url: `https://example.test/${suffix}`,
    archive: {status: 'CAPTURED', archive_digest: 'c'.repeat(64), reason_code: null, observed_at: new Date(t0 + suffix).toISOString()},
  });
  return {
    schema_version: 'challenge.reveal-arena/1.0',
    challenge_id: state.value.challenge.challenge_id,
    contract_version: state.contract.contract_version,
    terms_digest: state.contract.terms_digest,
    reveal_state: 'REVEALED',
    criteria: [],
    submissions: [submission(state.nonQualifier, 3), submission(state.q2, 2), submission(state.q1, 1)],
  };
}

test('G3 comparison uses only durable final qualifiers and exposes preferences as context', () => {
  const state = snapshot();
  const view = buildStageG3QualifierComparison(state.value, reveal(state), state.organizer);
  assert.deepEqual(view.final_qualifier_ids, [state.q1, state.q2].sort());
  assert.deepEqual(view.qualifiers.map((item) => item.entry_id), [state.q1, state.q2].sort());
  assert.equal(view.qualifiers.some((item) => item.entry_id === state.nonQualifier), false);
  assert.deepEqual(view.preferences, state.contract.preferences);
  assert.equal(view.selected_entry_id, state.q2);
});

test('G3 comparison fails closed on missing durable final-qualifier authority', () => {
  const state = snapshot({withSelection: false});
  state.value.decisions = [];
  assert.throws(
    () => buildStageG3QualifierComparison(state.value, reveal(state), state.organizer),
    /challenge_final_qualifiers_authority_invalid/,
  );
});

test('G3 receipt transport redacts payout identities, execution ids and correction content', () => {
  const state = snapshot({status: 'RECEIPT_FILED', withSelection: true});
  const secretPayout = 'SECRET_PAYOUT_IDENTITY';
  const secretExecution = 'SECRET_EXECUTION_ID';
  const intent = buildSettlementIntent({
    contract: state.contract,
    resolution: {type: 'WINNER_PAYOUT', winner_entry_id: state.q2, distributions: [{entry_id: state.q2, amount_minor_units: 100}]},
    recipientByEntryId: {[state.q2]: secretPayout},
  });
  const executionFact = {
    challenge_id: state.value.challenge.challenge_id,
    terms_digest: state.contract.terms_digest,
    settlement_policy_version: state.contract.settlement_policy_version,
    asset: state.contract.settlement_asset,
    total_minor_units: 100,
    recipients: [{recipient_id: secretPayout, amount_minor_units: 100}],
    finality: 'FINALIZED',
    execution_id: secretExecution,
  };
  const base = fileReceipt({contract: state.contract, settlementIntent: intent, settlementExecutionFact: executionFact});
  const correction = appendReceiptCorrection([base], {
    supersedes: base.receipt_id,
    reason: 'SECRET_CORRECTION_REASON',
    authority: 'SECRET_CORRECTION_AUTHORITY',
    evidence_refs: ['SECRET_CORRECTION_EVIDENCE'],
    corrected_projection: {private_note: 'SECRET_CORRECTED_PROJECTION'},
  });
  const baseInternalId = randomUUID();
  state.value.receipts = [
    {
      receipt_id: baseInternalId, protocol_receipt_id: base.receipt_id,
      challenge_id: state.value.challenge.challenge_id, terms_digest: state.contract.terms_digest,
      receipt_version: base.schema_version, receipt_json: base, receipt_digest: base.digest,
      ship_receipt_id: null, supersedes_receipt_id: null, created_at: new Date(t0 + 10),
    },
    {
      receipt_id: randomUUID(), protocol_receipt_id: correction.receipt_id,
      challenge_id: state.value.challenge.challenge_id, terms_digest: state.contract.terms_digest,
      receipt_version: correction.schema_version, receipt_json: correction, receipt_digest: correction.digest,
      ship_receipt_id: null, supersedes_receipt_id: baseInternalId, created_at: new Date(t0 + 11),
    },
  ];

  const view = buildStageG3ReceiptTransport(state.value);
  assert.equal(view.receipts.length, 2);
  assert.equal(view.receipts[0].winner_entry_id, state.q2);
  assert.equal(view.receipts[1].supersedes_protocol_receipt_id, base.receipt_id);
  const serialized = JSON.stringify(view);
  for (const secret of [
    secretPayout,
    secretExecution,
    'SECRET_CORRECTION_REASON',
    'SECRET_CORRECTION_AUTHORITY',
    'SECRET_CORRECTION_EVIDENCE',
    'SECRET_CORRECTED_PROJECTION',
  ]) assert.equal(serialized.includes(secret), false, secret);
});
