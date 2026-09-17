import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {toPublicChallengeView} from '../../dist/challenge-product-api.js';

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

test('H2 public challenge projection cannot leak restricted submission/archive material', () => {
  const sentinel = 'PRIVATE_SOURCE_SENTINEL_H2';
  const snapshot = {
    challenge: challengeRow(),
    contract: {contract_version: 'h2-fixture-v1', terms_digest: 'a'.repeat(64)},
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
