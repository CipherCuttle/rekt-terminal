import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  buildFrozenBuildContractPreview,
  compileOrganizerDraft,
  toPublicChallengeView,
} from '../../dist/challenge-product-api.js';

function challengeRow() {
  const now = new Date('2026-09-16T00:00:00.000Z');
  return {
    challenge_id: '11111111-1111-4111-8111-111111111111',
    organizer_player_id: '22222222-2222-4222-8222-222222222222',
    status: 'BUILDING',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    current_contract_version: 'h2-fixture-v1',
    current_terms_digest: 'a'.repeat(64),
    slot_limit: 2,
    activation_minimum: 1,
    entry_deadline: now,
    build_start: now,
    submission_deadline: now,
    appeal_window_ms: 100,
    review_deadline: now,
    created_at: now,
    updated_at: now,
  };
}

function frozenContractFixture() {
  const draft = challengeRow();
  draft.status = 'DRAFT';
  draft.current_contract_version = null;
  draft.current_terms_digest = null;

  const compilerState = compileOrganizerDraft({
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: 'Build the H2 privacy boundary fixture.',
    requirements: [
      'accounts',
      'persistence',
      'uploads_private',
      'realtime',
      'notifications',
      'onchain_read',
      'wallet_transactions',
      'custody_private_keys',
    ].map((key) => ({key, value: false, provenance: 'ORGANIZER_ACCEPTED'})),
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  });
  const preview = buildFrozenBuildContractPreview(
    compilerState,
    {
      contract_version: 'h2-fixture-v1',
      title: 'H2 privacy fixture',
      brief: 'Exercise the public projection without exposing private submission material.',
      preferences: {},
      normative_constraints: [],
      normative_references: [],
      informational_references: [],
      prize_minor_units: 100,
      prize_display: '100 TEST',
      settlement_asset: 'TEST',
    },
    {
      challenge: draft,
      contract: null,
      entries: [],
      submissions: [],
      qualifications: [],
      decisions: [],
      receipts: [],
    },
  );
  return preview.contract;
}

test('H2 public challenge projection cannot leak restricted submission/archive material', () => {
  const sentinel = 'PRIVATE_SOURCE_SENTINEL_H2';
  const contract = frozenContractFixture();
  const challenge = challengeRow();
  challenge.current_contract_version = contract.contract_version;
  challenge.current_terms_digest = contract.terms_digest;
  const snapshot = {
    challenge,
    contract: {
      challenge_id: challenge.challenge_id,
      contract_version: contract.contract_version,
      schema_version: contract.schema_version,
      terms_digest: contract.terms_digest,
      contract_json: contract,
      frozen_at: new Date('2026-09-16T00:00:00.000Z'),
    },
    entries: [],
    submissions: [{
      submission_id: '33333333-3333-4333-8333-333333333333',
      manifest_json: {
        immutable_source_reference: {kind: 'GIT_COMMIT', value: sentinel},
        evidence_references: ['PRIVATE_EVIDENCE_SENTINEL_H2'],
        optional_live_url: 'https://private.invalid/h2',
      },
    }],
    qualifications: [],
    decisions: [],
    receipts: [],
  };
  const serialized = JSON.stringify(toPublicChallengeView(snapshot));
  for (const forbidden of [sentinel, 'PRIVATE_EVIDENCE_SENTINEL_H2', 'private.invalid', 'manifest_json', 'source_reference', 'archive_reference']) {
    assert.equal(serialized.includes(forbidden), false, `public Challenge projection leaked ${forbidden}`);
  }
});

test('H2 production assembly stays provider-network free and request logging disabled', () => {
  const source = readFileSync(new URL('../../src/production-app.ts', import.meta.url), 'utf8');
  assert.match(source, /Fastify\(\{logger: false\}\)/);
  assert.doesNotMatch(source, /compiler-provider|createOpenAICompatibleInterpreter|createPrivacyBoundOpenAICompatibleInterpreter/);
  assert.doesNotMatch(source, /fetch\s*\(/);
});

test('H2 reveal of source references remains organizer-authenticated and post-seal only', () => {
  const source = readFileSync(new URL('../../src/challenge-reveal-api.ts', import.meta.url), 'utf8');
  assert.match(source, /authenticatedPlayerId/);
  assert.match(source, /challenge_organizer_required/);
  assert.match(source, /REVEALABLE_STATES/);
  assert.match(source, /challenge_reveal_sealed/);
  assert.match(source, /cache-control', 'no-store/);
});
