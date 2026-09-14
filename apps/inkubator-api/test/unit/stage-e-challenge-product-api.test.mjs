import assert from 'node:assert/strict';
import test from 'node:test';
import {compileOrganizerDraft, toPublicChallengeView} from '../../dist/challenge-product-api.js';

const SELECTION_KEYS = [
  'accounts',
  'persistence',
  'uploads_private',
  'realtime',
  'notifications',
  'onchain_read',
  'wallet_transactions',
  'custody_private_keys',
];

function proposal(overrides = {}) {
  const values = Object.fromEntries(SELECTION_KEYS.map((key) => [key, false]));
  Object.assign(values, overrides);
  return {
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: 'Build the thing described by explicit source requirements.',
    requirements: Object.entries(values).map(([key, value]) => ({key, value, provenance: 'SOURCE'})),
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  };
}

test('Stage E deterministic compiler changes machine state when source requirements change', () => {
  const staticState = compileOrganizerDraft(proposal());
  assert.equal(staticState.status, 'READY');
  assert.deepEqual(staticState.selected_blueprint, {id: 'WEB_STATIC', version: '1.0.0'});
  assert.equal(staticState.risk_profile.level, 'LOW');

  const realtimeState = compileOrganizerDraft(proposal({realtime: true}));
  assert.equal(realtimeState.status, 'NEEDS_DECISION');
  assert.deepEqual(realtimeState.selected_blueprint, {id: 'WEB_REALTIME', version: '1.0.0'});
  assert.equal(realtimeState.risk_profile.level, 'MEDIUM');
  assert.ok(realtimeState.causal_facts.some((fact) => fact.key === 'realtime_transport_required' && fact.value === true));
  assert.ok(realtimeState.acceptance_plan.modules.includes('realtime-consistency'));
  assert.ok(realtimeState.unresolved_decisions.some((decision) => decision.id === 'QUESTION:Q_REALTIME_TRANSPORT'));
});

test('Stage E compiler preserves the private-key custody prohibition', () => {
  const state = compileOrganizerDraft(proposal({custody_private_keys: true}));
  assert.equal(state.status, 'UNSUPPORTED');
  assert.ok(state.findings.some((finding) => finding.code === 'PRIVATE_KEY_CUSTODY'));
});

test('public Challenge projection cannot leak payout identities or private entry rows', () => {
  const now = new Date('2026-09-14T00:00:00.000Z');
  const view = toPublicChallengeView({
    challenge: {
      challenge_id: '11111111-1111-4111-8111-111111111111',
      organizer_player_id: '22222222-2222-4222-8222-222222222222',
      organizer_payout_identity: 'secret-organizer-wallet',
      funder_payout_identity: 'secret-funder-wallet',
      status: 'ENTRY_OPEN',
      mechanism_version: 'mechanism.v1',
      settlement_policy_version: 'settlement.v1',
      ip_terms_version: 'ip.v1',
      current_contract_version: '1',
      current_terms_digest: 'terms-digest',
      slot_limit: 4,
      activation_minimum: 2,
      entry_deadline: now,
      build_start: now,
      submission_deadline: now,
      appeal_window_ms: 3600000,
      review_deadline: now,
      created_at: now,
      updated_at: now,
    },
    contract: {
      challenge_id: '11111111-1111-4111-8111-111111111111',
      contract_version: '1',
      terms_digest: 'terms-digest',
      contract_json: {},
      created_at: now,
    },
    entries: [{payout_identity: 'secret-builder-wallet'}],
    submissions: [{submission_id: 'submission'}],
    qualifications: [{qualification_id: 'qualification'}],
    decisions: [{decision_id: 'decision'}],
    receipts: [{receipt_id: 'receipt'}],
  });

  assert.equal(view.entry_count, 1);
  assert.equal(view.submission_count, 1);
  assert.equal(view.qualification_count, 1);
  assert.equal(view.receipt_count, 1);
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('secret-organizer-wallet'), false);
  assert.equal(serialized.includes('secret-funder-wallet'), false);
  assert.equal(serialized.includes('secret-builder-wallet'), false);
  assert.equal('organizer_player_id' in view, false);
});
