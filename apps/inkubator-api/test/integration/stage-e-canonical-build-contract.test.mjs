import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {buildApp} from '../../dist/app.js';
import {
  compileOrganizerDraft,
  registerStageEChallengeProductRoutes,
} from '../../dist/challenge-product-api.js';
import {createChallenge, readChallengeSnapshot} from '../../dist/challenge-store.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const t0 = 1_900_000_000_000;

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

async function createActor(app, displayName) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/dev/session',
    headers: {origin: appOrigin},
    payload: {display_name: displayName},
  });
  assert.equal(response.statusCode, 201);
  return {playerId: response.json().player.player_id, cookie: cookieFrom(response)};
}

function acceptedStaticState() {
  const keys = [
    'accounts',
    'persistence',
    'uploads_private',
    'realtime',
    'notifications',
    'onchain_read',
    'wallet_transactions',
    'custody_private_keys',
  ];
  return compileOrganizerDraft({
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: 'Build a public static launch page.',
    requirements: keys.map((key) => ({key, value: false, provenance: 'ORGANIZER_ACCEPTED'})),
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  });
}

function authority() {
  return {
    contract_version: '1.0.0',
    title: 'Static launch Challenge',
    brief: 'Build a public static launch page.',
    preferences: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    prize_minor_units: 100,
    prize_display: '100 TEST',
    settlement_asset: 'TEST',
  };
}

test('Stage E canonical Build Contract persistence is authenticated, organizer-bound, preview-bound and idempotent', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600});
  registerStageEChallengeProductRoutes(app, db);

  try {
    const organizer = await createActor(app, `Contract Organizer ${randomUUID().slice(0, 6)}`);
    const outsider = await createActor(app, `Contract Outsider ${randomUUID().slice(0, 6)}`);
    const challengeId = randomUUID();

    await createChallenge(db, {
      requestId: randomUUID(),
      challengeId,
      organizerPlayerId: organizer.playerId,
      organizerPayoutIdentity: `organizer-pay-${challengeId}`,
      funderPayoutIdentity: `funder-pay-${challengeId}`,
      mechanismVersion: 'funded-challenge/1.1',
      settlementPolicyVersion: 'funded-challenge-settlement/1.0',
      ipTermsVersion: 'bespoke-winner-transfer/1.0',
      slotLimit: 4,
      activationMinimum: 2,
      entryDeadlineMs: t0 + 100,
      buildStartMs: t0 + 100,
      submissionDeadlineMs: t0 + 1_000,
      appealWindowMs: 100,
      reviewDeadlineMs: t0 + 2_000,
    });

    const compilerState = acceptedStaticState();
    assert.equal(compilerState.status, 'READY');
    const previewResponse = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract-preview`,
      headers: {origin: appOrigin, 'content-type': 'application/json'},
      payload: {compiler_state: compilerState, authority: authority()},
    });
    assert.equal(previewResponse.statusCode, 200);
    const preview = previewResponse.json();
    assert.equal(preview.canonical, false);
    assert.equal(preview.persisted, false);
    assert.match(preview.contract.terms_digest, /^[0-9a-f]{64}$/);

    const requestId = randomUUID();
    const persistPayload = {
      request_id: requestId,
      compiler_state: compilerState,
      authority: authority(),
      expected_terms_digest: preview.contract.terms_digest,
    };

    const unauthenticated = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract`,
      headers: {origin: appOrigin, 'content-type': 'application/json'},
      payload: persistPayload,
    });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.json().error, 'authentication_required');

    const outsiderAttempt = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract`,
      headers: {origin: appOrigin, cookie: outsider.cookie, 'content-type': 'application/json'},
      payload: persistPayload,
    });
    assert.equal(outsiderAttempt.statusCode, 403);
    assert.equal(outsiderAttempt.json().error, 'challenge_organizer_required');

    const staleAttempt = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: {...persistPayload, expected_terms_digest: '0'.repeat(64)},
    });
    assert.equal(staleAttempt.statusCode, 409);
    assert.equal(staleAttempt.json().error, 'build_contract_preview_stale');
    const beforePersist = await readChallengeSnapshot(db, challengeId);
    assert.equal(beforePersist.challenge.status, 'DRAFT');
    assert.equal(beforePersist.challenge.current_terms_digest, null);
    assert.equal(beforePersist.contract, null);

    const persisted = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: persistPayload,
    });
    assert.equal(persisted.statusCode, 200);
    const canonical = persisted.json();
    assert.equal(canonical.schema_version, 'build-contract.canonical.v1');
    assert.equal(canonical.canonical, true);
    assert.equal(canonical.persisted, true);
    assert.equal(canonical.challenge_id, challengeId);
    assert.equal(canonical.contract_version, '1.0.0');
    assert.equal(canonical.terms_digest, preview.contract.terms_digest);

    const replay = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: persistPayload,
    });
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json().terms_digest, preview.contract.terms_digest);

    const snapshot = await readChallengeSnapshot(db, challengeId);
    assert.equal(snapshot.challenge.status, 'DRAFT');
    assert.equal(snapshot.challenge.current_contract_version, '1.0.0');
    assert.equal(snapshot.challenge.current_terms_digest, preview.contract.terms_digest);
    assert.equal(snapshot.contract.terms_digest, preview.contract.terms_digest);
    assert.deepEqual(snapshot.contract.contract_json, preview.contract);

    const publicRead = await app.inject({method: 'GET', url: `/v1/challenges/${challengeId}`});
    assert.equal(publicRead.statusCode, 200);
    assert.equal(publicRead.json().status, 'DRAFT');
    assert.equal(publicRead.json().has_frozen_contract, true);
    assert.equal(publicRead.json().current_terms_digest, preview.contract.terms_digest);
    assert.equal(publicRead.json().contract_summary.title, authority().title);
    assert.equal(publicRead.json().contract_summary.brief, authority().brief);
    assert.equal(publicRead.json().contract_summary.terms_digest, preview.contract.terms_digest);
    assert.equal(publicRead.body.includes(`organizer-pay-${challengeId}`), false);
    assert.equal(publicRead.body.includes(`funder-pay-${challengeId}`), false);
  } finally {
    await app.close();
    await db.destroy();
  }
});
