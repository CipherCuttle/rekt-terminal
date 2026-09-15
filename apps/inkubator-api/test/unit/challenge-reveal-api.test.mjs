import assert from 'node:assert/strict';
import test from 'node:test';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {canonicalizeJson} from '../../dist/canonical-json.js';
import {buildStageGRevealArenaProjection} from '../../dist/challenge-reveal-api.js';

const organizer = '10000000-0000-4000-8000-000000000001';
const builder = '10000000-0000-4000-8000-000000000002';
const challengeId = '10000000-0000-4000-8000-000000000003';
const entryId = '10000000-0000-4000-8000-000000000004';

function frozenContract() {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'g1-test-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'G1 reveal contract',
    brief: 'Reveal only frozen qualification law.',
    outcome_contract: {criteria: [
      {id: 'OUT-1', description: 'Required outcome', mandatory: true},
      {id: 'OUT-OPTIONAL', description: 'Taste only', mandatory: false},
    ]},
    production_envelope: {criteria: [
      {id: 'ENV-1', description: 'Required envelope', mandatory: true},
    ]},
    delivery_contract: {criteria: [
      {id: 'DELIVERY-OPTIONAL', description: 'Optional delivery preference', mandatory: false},
    ]},
    preferences: {visual_taste: 'organizer preference only'},
    reference_architecture: {},
    normative_constraints: [
      {id: 'NORM-1', description: 'Required normative constraint', mandatory: true},
    ],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: 3,
    activation_minimum: 1,
    entry_deadline: 1_000,
    build_start: 1_000,
    submission_deadline: 2_000,
    appeal_window_ms: 100,
    review_deadline: 3_000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

function submissionRow(contract, {submissionId, version, acceptedAt, artifactDigest}) {
  const manifest = {
    schema_version: 'inkubator.submission-manifest/1.0',
    challenge_id: challengeId,
    entry_id: entryId,
    terms_digest: contract.terms_digest,
    submission_version: version,
    immutable_source_reference: {kind: 'GIT_COMMIT', value: String(version).repeat(40)},
    artifact_digest: artifactDigest,
    evidence_references: [`private-evidence-${version}`],
    optional_live_url: `https://example.test/build-${version}`,
    accepted_at: acceptedAt,
  };
  return {
    submission_id: submissionId,
    challenge_id: challengeId,
    entry_id: entryId,
    submission_version: String(version),
    terms_digest: contract.terms_digest,
    manifest_json: manifest,
    manifest_digest: canonicalizeJson(manifest).sha256,
    ship_submission_id: null,
    accepted_at: new Date(acceptedAt),
    is_final: false,
    created_at: new Date(acceptedAt),
  };
}

function snapshot(status = 'SUBMISSIONS_LOCKED') {
  const contract = frozenContract();
  const first = submissionRow(contract, {
    submissionId: '20000000-0000-4000-8000-000000000001',
    version: 1,
    acceptedAt: 1_500,
    artifactDigest: 'a'.repeat(64),
  });
  const selected = submissionRow(contract, {
    submissionId: '20000000-0000-4000-8000-000000000002',
    version: 2,
    acceptedAt: 1_800,
    artifactDigest: 'b'.repeat(64),
  });
  const afterDeadline = submissionRow(contract, {
    submissionId: '20000000-0000-4000-8000-000000000003',
    version: 3,
    acceptedAt: 2_500,
    artifactDigest: 'c'.repeat(64),
  });
  return {
    contract,
    selected,
    value: {
      challenge: {
        challenge_id: challengeId,
        organizer_player_id: organizer,
        organizer_payout_identity: null,
        funder_payout_identity: null,
        status,
        mechanism_version: contract.mechanism_version,
        settlement_policy_version: contract.settlement_policy_version,
        ip_terms_version: contract.ip_terms_version,
        current_contract_version: contract.contract_version,
        current_terms_digest: contract.terms_digest,
        slot_limit: contract.slot_limit,
        activation_minimum: contract.activation_minimum,
        entry_deadline: new Date(contract.entry_deadline),
        build_start: new Date(contract.build_start),
        submission_deadline: new Date(contract.submission_deadline),
        appeal_window_ms: String(contract.appeal_window_ms),
        review_deadline: new Date(contract.review_deadline),
        created_at: new Date(0),
        updated_at: new Date(0),
      },
      contract: {
        challenge_id: challengeId,
        contract_version: contract.contract_version,
        schema_version: contract.schema_version,
        terms_digest: contract.terms_digest,
        contract_json: contract,
        frozen_at: new Date(900),
      },
      entries: [{
        entry_id: entryId,
        challenge_id: challengeId,
        builder_player_id: builder,
        project_id: null,
        mission_id: null,
        payout_identity: 'builder-payout',
        state: 'ACTIVE',
        build_start: new Date(contract.build_start),
        submission_deadline: new Date(contract.submission_deadline),
        created_at: new Date(1_000),
        updated_at: new Date(1_000),
      }],
      submissions: [afterDeadline, first, selected],
      qualifications: [],
      decisions: [],
      receipts: [],
    },
  };
}

test('G1 stays sealed before durable SUBMISSIONS_LOCKED and denies non-organizers first', () => {
  const fixture = snapshot('BUILDING');
  assert.throws(
    () => buildStageGRevealArenaProjection(fixture.value, [], builder),
    /challenge_organizer_required/,
  );
  assert.throws(
    () => buildStageGRevealArenaProjection(fixture.value, [], organizer),
    /challenge_reveal_sealed/,
  );
});

test('G1 reveals one protocol-selected final submission and only frozen mandatory criteria', () => {
  const fixture = snapshot();
  const archives = [{
    submission_id: fixture.selected.submission_id,
    status: 'CAPTURED',
    archive_digest: 'd'.repeat(64),
    reason_code: null,
    observed_at: new Date(1_900),
    archive_reference: 'r2://private-bucket/must-never-leak',
  }];

  const view = buildStageGRevealArenaProjection(fixture.value, archives, organizer);
  assert.equal(view.reveal_state, 'REVEALED');
  assert.deepEqual(view.criteria, [
    {criterion_id: 'ENV-1', group: 'PRODUCTION_ENVELOPE', description: 'Required envelope'},
    {criterion_id: 'NORM-1', group: 'NORMATIVE_CONSTRAINT', description: 'Required normative constraint'},
    {criterion_id: 'OUT-1', group: 'OUTCOME', description: 'Required outcome'},
  ]);
  assert.equal(view.submissions.length, 1);
  assert.equal(view.submissions[0].submission_id, fixture.selected.submission_id);
  assert.equal(view.submissions[0].submission_version, 2);
  assert.equal(view.submissions[0].artifact_digest, 'b'.repeat(64));
  assert.equal(view.submissions[0].archive.status, 'CAPTURED');

  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('OUT-OPTIONAL'), false);
  assert.equal(serialized.includes('DELIVERY-OPTIONAL'), false);
  assert.equal(serialized.includes('private-evidence-'), false);
  assert.equal(serialized.includes('archive_reference'), false);
  assert.equal(serialized.includes('private-bucket'), false);
});

test('G1 projection is semantically stable across repeated unchanged reads', () => {
  const fixture = snapshot('QUALIFICATION');
  const archives = [{
    submission_id: fixture.selected.submission_id,
    status: 'PENDING',
    archive_digest: null,
    reason_code: null,
    observed_at: null,
  }];
  assert.deepEqual(
    buildStageGRevealArenaProjection(fixture.value, archives, organizer),
    buildStageGRevealArenaProjection(fixture.value, archives, organizer),
  );
});
