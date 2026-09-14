import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  IP_TERMS_VERSION,
  freezeBuildContract,
} from '@rekt-ink/protocol/challenge';
import {buildBuilderCapsule} from '../../dist/builder-capsule.js';

const challengeId = '11111111-1111-4111-8111-111111111111';
const builderId = '22222222-2222-4222-8222-222222222222';
const entryId = '33333333-3333-4333-8333-333333333333';
const t0 = 1_800_000_000_000;

function contract() {
  return freezeBuildContract({
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
    challenge_id: challengeId,
    contract_version: '1.0.0',
    mechanism_version: MECHANISM_VERSION,
    settlement_policy_version: SETTLEMENT_POLICY_VERSION,
    ip_terms_version: IP_TERMS_VERSION,
    title: 'Build a dashboard',
    brief: 'Build one bounded public dashboard.',
    outcome_contract: {criteria:[{id:'OUT-1',description:'Dashboard renders canonical data',mandatory:true}]},
    production_envelope: {criteria:[{id:'ENV-1',description:'Mobile viewport remains usable',mandatory:true}]},
    delivery_contract: {criteria:[{id:'DEL-1',description:'Source is delivered',mandatory:true}]},
    preferences: {style:'REKT'},
    reference_architecture: {stack:['React','Vite']},
    normative_constraints: [{id:'NORM-1',description:'Serve over HTTPS',mandatory:true}],
    normative_references: [{id:'REF-1',kind:'FIXTURE',content_digest:'a'.repeat(64),source_url:'https://example.com/frozen'}],
    informational_references: [{id:'INFO-1',url:'https://example.com/info'}],
    knowledge: [{kind:'KNOWN',key:'network',material:true,value:'Ink'}],
    slot_limit:4,
    activation_minimum:2,
    entry_deadline:t0+100,
    build_start:t0+100,
    submission_deadline:t0+1000,
    appeal_window_ms:200,
    review_deadline:t0+1800,
    prize_minor_units:1001,
    settlement_asset:'TEST',
  });
}

function snapshot(overrides = {}) {
  const frozen = contract();
  return {
    challenge: {
      challenge_id: challengeId,
      current_contract_version: frozen.contract_version,
      current_terms_digest: frozen.terms_digest,
      submission_deadline: new Date(frozen.submission_deadline),
    },
    contract: {
      challenge_id: challengeId,
      contract_version: frozen.contract_version,
      terms_digest: frozen.terms_digest,
      contract_json: frozen,
      frozen_at: new Date(t0),
    },
    entries: [{entry_id:entryId,builder_player_id:builderId,state:'ACTIVE'}],
    submissions: [], qualifications: [], decisions: [], receipts: [],
    ...overrides,
  };
}

test('F1 capsule is deterministic, frozen-contract-bound and builder-private', () => {
  const one = buildBuilderCapsule(snapshot(), builderId);
  const two = buildBuilderCapsule(snapshot(), builderId);
  assert.deepEqual(one, two);
  assert.equal(one.schema_version, 'builder-capsule.v1');
  assert.equal(one.entry_id, entryId);
  assert.equal(one.files.length, 4);
  assert.deepEqual(one.files.map((file) => file.path), [
    'CHALLENGE.md', 'contract.json', 'acceptance/manifest.json', 'references/manifest.json',
  ]);
  assert.ok(one.files.every((file) => /^[0-9a-f]{64}$/.test(file.sha256)));
  assert.equal(JSON.parse(one.files.find((file) => file.path === 'contract.json').content).terms_digest, one.terms_digest);
  assert.equal(JSON.parse(one.files.find((file) => file.path === 'acceptance/manifest.json').content).executable_checks_authorized, false);
});

test('F1 capsule denies a non-entry Player', () => {
  assert.throws(
    () => buildBuilderCapsule(snapshot(), '44444444-4444-4444-8444-444444444444'),
    /challenge_entry_required/,
  );
});

test('F1 capsule fails closed when contract is not frozen or pointer is inconsistent', () => {
  assert.throws(() => buildBuilderCapsule(snapshot({contract:null}), builderId), /challenge_contract_not_frozen/);
  const broken = snapshot();
  broken.challenge.current_terms_digest = 'b'.repeat(64);
  assert.throws(() => buildBuilderCapsule(broken, builderId), /challenge_contract_pointer_invalid/);
});
