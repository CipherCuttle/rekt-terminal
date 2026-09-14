import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFrozenBuildContractPreview,
  compileOrganizerDraft,
  toPublicChallengeView,
} from '../../dist/challenge-product-api.js';

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

function proposal(overrides = {}, provenance = 'SOURCE') {
  const values = Object.fromEntries(SELECTION_KEYS.map((key) => [key, false]));
  Object.assign(values, overrides);
  return {
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: 'Build the thing described by explicit source requirements.',
    requirements: Object.entries(values).map(([key, value]) => ({key, value, provenance})),
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  };
}

function draftSnapshot() {
  const createdAt = new Date('2026-09-14T00:00:00.000Z');
  const buildStart = new Date('2026-09-20T00:00:00.000Z');
  return {
    challenge: {
      challenge_id: '11111111-1111-4111-8111-111111111111',
      organizer_player_id: '22222222-2222-4222-8222-222222222222',
      organizer_payout_identity: 'secret-organizer-wallet',
      funder_payout_identity: 'secret-funder-wallet',
      status: 'DRAFT',
      mechanism_version: 'funded-challenge/1.1',
      settlement_policy_version: 'funded-challenge-settlement/1.0',
      ip_terms_version: 'bespoke-winner-transfer/1.0',
      current_contract_version: null,
      current_terms_digest: null,
      slot_limit: 4,
      activation_minimum: 2,
      entry_deadline: buildStart,
      build_start: buildStart,
      submission_deadline: new Date('2026-09-28T00:00:00.000Z'),
      appeal_window_ms: '3600000',
      review_deadline: new Date('2026-09-30T00:00:00.000Z'),
      created_at: createdAt,
      updated_at: createdAt,
    },
    contract: null,
    entries: [],
    submissions: [],
    qualifications: [],
    decisions: [],
    receipts: [],
  };
}

function previewAuthority() {
  return {
    contract_version: '1.0.0',
    title: 'Useful static Challenge',
    brief: 'Build the thing described by explicit source requirements.',
    preferences: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    prize_minor_units: 100,
    prize_display: '100 TEST',
    settlement_asset: 'TEST',
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

test('Build Contract preview requires explicit ORGANIZER_ACCEPTED provenance', () => {
  const sourceState = compileOrganizerDraft(proposal());
  assert.throws(
    () => buildFrozenBuildContractPreview(sourceState, previewAuthority(), draftSnapshot()),
    /compiler_organizer_acceptance_required/,
  );
});

test('Build Contract preview replays accepted state and freezes with the real Stage-B digest law without persistence', () => {
  const acceptedState = compileOrganizerDraft(proposal({}, 'ORGANIZER_ACCEPTED'));
  assert.equal(acceptedState.status, 'READY');
  const preview = buildFrozenBuildContractPreview(acceptedState, previewAuthority(), draftSnapshot());

  assert.equal(preview.schema_version, 'build-contract.preview.v1');
  assert.equal(preview.canonical, false);
  assert.equal(preview.persisted, false);
  assert.equal(preview.contract.challenge_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(preview.contract.contract_version, '1.0.0');
  assert.equal(preview.contract.mechanism_version, 'funded-challenge/1.1');
  assert.equal(preview.contract.reference_architecture.shape, 'STATIC_WEB_APP');
  assert.match(preview.contract.terms_digest, /^[0-9a-f]{64}$/);
});

test('Build Contract preview refuses a Challenge that is no longer an unfrozen DRAFT', () => {
  const acceptedState = compileOrganizerDraft(proposal({}, 'ORGANIZER_ACCEPTED'));
  const snapshot = draftSnapshot();
  snapshot.challenge.status = 'AWAITING_FUNDING';
  assert.throws(
    () => buildFrozenBuildContractPreview(acceptedState, previewAuthority(), snapshot),
    /challenge_contract_preview_requires_unfrozen_draft/,
  );
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