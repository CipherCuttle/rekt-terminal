import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {sql} from 'kysely';
import {compileOrganizerDraft} from '../../dist/challenge-product-api.js';
import {handleChallengeDueStateJob} from '../../dist/challenge-due-state.js';
import {createDatabase} from '../../dist/database.js';
import {issueDevkitToken} from '../../dist/devkit.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {createPlayer} from '../../dist/players.js';
import {
  FORBIDDEN_PRODUCTION_ROUTE_PREFIXES,
  FUNDED_CHALLENGE_CORE_ROUTES,
} from '../../dist/production-route-manifest.js';
import {buildFundedChallengeProductionApp} from '../../dist/production-app.js';
import {createSession, SESSION_COOKIE_NAME} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const t0 = 1_900_000_000_000;

function cookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function createActor(db, label) {
  const player = await createPlayer(db, `${label} ${randomUUID().slice(0, 8)}`);
  const session = await createSession(db, player.player_id, 3600);
  return {playerId: player.player_id, cookie: cookie(session.token)};
}

function acceptedCompilerState() {
  return compileOrganizerDraft({
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: 'Build a deterministic public static launch page.',
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
}

function authority(settlementAsset = 'TEST') {
  return {
    contract_version: 'stage-i-alpha-v1',
    title: 'Stage I Alpha Challenge',
    brief: 'Exercise the production transport without real settlement.',
    preferences: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    prize_minor_units: 100,
    prize_display: `100 ${settlementAsset}`,
    settlement_asset: settlementAsset,
  };
}

function challengeInput(challengeId = randomUUID()) {
  return {
    request_id: randomUUID(),
    challenge_id: challengeId,
    slot_limit: 2,
    activation_minimum: 1,
    entry_deadline_ms: t0 + 100,
    submission_deadline_ms: t0 + 10_000,
    appeal_window_ms: 100,
    review_deadline_ms: t0 + 20_000,
  };
}

async function createChallengeThroughStageI(app, actor, input = challengeInput()) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/challenges',
    headers: {origin: appOrigin, cookie: actor.cookie, 'content-type': 'application/json'},
    payload: input,
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().challenge_id, input.challenge_id);
  assert.equal(response.json().status, 'DRAFT');
  return {input, response};
}

async function freezeChallenge(app, actor, challengeId, settlementAsset = 'TEST') {
  const compilerState = acceptedCompilerState();
  assert.equal(compilerState.status, 'READY');
  const frozenAuthority = authority(settlementAsset);
  const preview = await app.inject({
    method: 'POST',
    url: `/v1/challenges/${challengeId}/build-contract-preview`,
    headers: {origin: appOrigin, 'content-type': 'application/json'},
    payload: {compiler_state: compilerState, authority: frozenAuthority},
  });
  assert.equal(preview.statusCode, 200, preview.body);
  const persisted = await app.inject({
    method: 'POST',
    url: `/v1/challenges/${challengeId}/build-contract`,
    headers: {origin: appOrigin, cookie: actor.cookie, 'content-type': 'application/json'},
    payload: {
      request_id: randomUUID(),
      compiler_state: compilerState,
      authority: frozenAuthority,
      expected_terms_digest: preview.json().contract.terms_digest,
    },
  });
  assert.equal(persisted.statusCode, 200, persisted.body);
  return persisted.json().terms_digest;
}

function submissionPayload(entryId, termsDigest, overrides = {}) {
  return {
    request_id: randomUUID(),
    submission_id: randomUUID(),
    entry_id: entryId,
    expected_terms_digest: termsDigest,
    submission_version: 1,
    immutable_source_reference: {
      kind: 'GIT_COMMIT',
      value: '0123456789abcdef0123456789abcdef01234567',
    },
    artifact_digest: 'a'.repeat(64),
    evidence_references: ['stage-i-alpha-evidence'],
    ...overrides,
  };
}

test('Stage I production transport preserves Challenge, submission, route and incident authority boundaries', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildFundedChallengeProductionApp({
    db,
    appOrigin,
    sessionTtlSeconds: 3600,
    github: null,
  });
  await app.ready();

  try {
    const organizer = await createActor(db, 'Stage I Organizer');
    const builder = await createActor(db, 'Stage I Builder');
    const outsider = await createActor(db, 'Stage I Outsider');

    // 1. Unauthenticated creation fails without weakening the normal browser Origin boundary.
    const mainInput = challengeInput();
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: {origin: appOrigin, 'content-type': 'application/json'},
      payload: mainInput,
    });
    assert.equal(unauthenticated.statusCode, 401, unauthenticated.body);
    assert.deepEqual(unauthenticated.json(), {error: 'authentication_required'});

    // 2. An authenticated organizer creates exactly a DRAFT Challenge.
    await createChallengeThroughStageI(app, organizer, mainInput);
    const mainChallengeId = mainInput.challenge_id;

    // 3. Mock launch fails closed until a canonical Build Contract is frozen.
    const unfrozenInput = challengeInput();
    await createChallengeThroughStageI(app, organizer, unfrozenInput);
    const unfrozenLaunch = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${unfrozenInput.challenge_id}/stage-i-mock-launch`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: {request_id: randomUUID()},
    });
    assert.equal(unfrozenLaunch.statusCode, 409, unfrozenLaunch.body);
    assert.equal(unfrozenLaunch.json().error, 'challenge_contract_not_frozen');

    // 4 + 8. A frozen non-TEST Challenge cannot mock-launch, and DRAFT cannot accept entries.
    const nonTestInput = challengeInput();
    await createChallengeThroughStageI(app, organizer, nonTestInput);
    const nonTestTerms = await freezeChallenge(app, organizer, nonTestInput.challenge_id, 'USDC');
    const prematureJoin = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${nonTestInput.challenge_id}/entries`,
      headers: {origin: appOrigin, cookie: builder.cookie, 'content-type': 'application/json'},
      payload: {
        request_id: randomUUID(),
        entry_id: randomUUID(),
        expected_terms_digest: nonTestTerms,
      },
    });
    assert.equal(prematureJoin.statusCode, 409, prematureJoin.body);

    const nonTestLaunch = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${nonTestInput.challenge_id}/stage-i-mock-launch`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: {request_id: randomUUID()},
    });
    assert.equal(nonTestLaunch.statusCode, 409, nonTestLaunch.body);
    assert.equal(nonTestLaunch.json().error, 'stage_i_mock_settlement_asset_required');

    const termsDigest = await freezeChallenge(app, organizer, mainChallengeId, 'TEST');

    // 5. Mock launch is Challenge-organizer authority, not any authenticated session.
    const outsiderLaunch = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${mainChallengeId}/stage-i-mock-launch`,
      headers: {origin: appOrigin, cookie: outsider.cookie, 'content-type': 'application/json'},
      payload: {request_id: randomUUID()},
    });
    assert.equal(outsiderLaunch.statusCode, 403, outsiderLaunch.body);
    assert.equal(outsiderLaunch.json().error, 'challenge_organizer_required');

    const launchRequestId = randomUUID();
    const launched = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${mainChallengeId}/stage-i-mock-launch`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: {request_id: launchRequestId},
    });
    assert.equal(launched.statusCode, 200, launched.body);
    assert.equal(launched.json().status, 'ENTRY_OPEN');

    // 6. The successful route proves protocol validation completed; its immutable event records the exact legal sequence and zero real value.
    const launchEvent = await db.selectFrom('history_events')
      .select(['event_type', 'payload'])
      .where('dedupe_key', '=', `activity:challenge.stage_i_mock_launched:${mainChallengeId}:${launchRequestId}`)
      .executeTakeFirstOrThrow();
    assert.equal(launchEvent.event_type, 'challenge.stage_i_mock_launched');
    assert.deepEqual(launchEvent.payload.validated_transitions, ['AWAITING_FUNDING', 'FUNDED', 'ENTRY_OPEN']);
    assert.equal(launchEvent.payload.settlement_asset, 'TEST');
    assert.equal(launchEvent.payload.real_value_moved, false);

    // 7. Launch schedules the normal hardened due-state worker input, not a manual lifecycle endpoint.
    const dueKey = `challenge.due_state.v1:${mainChallengeId}:ENTRY_OPEN:${mainInput.entry_deadline_ms}`;
    const dueJob = await db.selectFrom('outbox_jobs').selectAll().where('idempotency_key', '=', dueKey).executeTakeFirstOrThrow();
    assert.equal(dueJob.job_type, 'challenge.due_state.v1');
    assert.equal(dueJob.payload.expected_status, 'ENTRY_OPEN');
    assert.equal(dueJob.payload.due_at_ms, mainInput.entry_deadline_ms);

    // 9. Entry acquisition is frozen-terms-bound.
    const staleJoin = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${mainChallengeId}/entries`,
      headers: {origin: appOrigin, cookie: builder.cookie, 'content-type': 'application/json'},
      payload: {
        request_id: randomUUID(),
        entry_id: randomUUID(),
        expected_terms_digest: 'b'.repeat(64),
      },
    });
    assert.equal(staleJoin.statusCode, 409, staleJoin.body);
    assert.equal(staleJoin.json().error, 'challenge_terms_digest_stale');

    const entryId = randomUUID();
    const joined = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${mainChallengeId}/entries`,
      headers: {origin: appOrigin, cookie: builder.cookie, 'content-type': 'application/json'},
      payload: {
        request_id: randomUUID(),
        entry_id: entryId,
        expected_terms_digest: termsDigest,
      },
    });
    assert.equal(joined.statusCode, 201, joined.body);
    assert.equal(joined.json().entry_id, entryId);
    assert.equal(joined.json().terms_digest, termsDigest);

    // 10. Builder Capsule is participant-private and remains bound to the canonical contract pointer.
    const outsiderBuild = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${mainChallengeId}/my-build`,
      headers: {cookie: outsider.cookie},
    });
    assert.equal(outsiderBuild.statusCode, 403, outsiderBuild.body);
    assert.equal(outsiderBuild.json().error, 'challenge_entry_required');

    const myBuild = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${mainChallengeId}/my-build`,
      headers: {cookie: builder.cookie},
    });
    assert.equal(myBuild.statusCode, 200, myBuild.body);
    assert.equal(myBuild.json().entry_id, entryId);
    assert.equal(myBuild.json().terms_digest, termsDigest);
    assert.ok(Array.isArray(myBuild.json().files));

    // 11. Browser session may mint only the narrow final-submission credential.
    const tokenResponse = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${mainChallengeId}/submit-credential`,
      headers: {origin: appOrigin, cookie: builder.cookie, 'content-type': 'application/json'},
      payload: {request_id: randomUUID(), expires_in_seconds: 3600},
    });
    assert.equal(tokenResponse.statusCode, 201, tokenResponse.body);
    assert.deepEqual(tokenResponse.json().scopes, ['challenge:submit']);
    assert.equal(tokenResponse.json().credential_class, 'CLI');
    assert.equal(tokenResponse.json().purpose, 'FINAL_SUBMISSION_ONLY');
    const builderToken = tokenResponse.json().token;
    const storedToken = await db.selectFrom('devkit_tokens')
      .select(['scopes', 'credential_class'])
      .where('token_id', '=', tokenResponse.json().token_id)
      .executeTakeFirstOrThrow();
    assert.deepEqual(storedToken.scopes, ['challenge:submit']);
    assert.equal(storedToken.credential_class, 'CLI');

    // Move through the existing due-state authority so immutable submission is tested in BUILDING.
    await handleChallengeDueStateJob(db, dueJob, new Date(mainInput.entry_deadline_ms));
    const building = (await sql`select status from challenges where challenge_id = ${mainChallengeId}`.execute(db)).rows[0];
    assert.equal(building.status, 'BUILDING');
    const activeEntry = (await sql`select state from challenge_entries where entry_id = ${entryId}`.execute(db)).rows[0];
    assert.equal(activeEntry.state, 'ACTIVE');

    const firstSubmission = submissionPayload(entryId, termsDigest);
    const submitUrl = `/v1/challenges/${mainChallengeId}/submissions`;

    // 12. A browser session cookie is not final-submission authority.
    const sessionOnly = await app.inject({
      method: 'POST',
      url: submitUrl,
      headers: {origin: appOrigin, cookie: builder.cookie, 'content-type': 'application/json'},
      payload: firstSubmission,
    });
    assert.equal(sessionOnly.statusCode, 401, sessionOnly.body);
    assert.equal(sessionOnly.json().error, 'challenge_submit_credential_required');

    // 13. Bearer-shaped transport does not weaken DevKit scope authorization.
    const readOnly = await issueDevkitToken(db, builder.playerId, {
      requestId: randomUUID(),
      credentialClass: 'CLI',
      label: 'Stage I read only',
      scopes: ['project:read'],
      expiresInSeconds: 3600,
    });
    const wrongScope = await app.inject({
      method: 'POST',
      url: submitUrl,
      headers: {authorization: `Bearer ${readOnly.token}`, 'content-type': 'application/json'},
      payload: firstSubmission,
    });
    assert.equal(wrongScope.statusCode, 403, wrongScope.body);
    assert.equal(wrongScope.json().error, 'challenge_submit_scope_denied');

    // 14. A correctly-scoped token cannot submit another Player's entry.
    const outsiderToken = await issueDevkitToken(db, outsider.playerId, {
      requestId: randomUUID(),
      credentialClass: 'CLI',
      label: 'Stage I outsider submit',
      scopes: ['challenge:submit'],
      expiresInSeconds: 3600,
    });
    const wrongOwner = await app.inject({
      method: 'POST',
      url: submitUrl,
      headers: {authorization: `Bearer ${outsiderToken.token}`, 'content-type': 'application/json'},
      payload: firstSubmission,
    });
    assert.equal(wrongOwner.statusCode, 403, wrongOwner.body);
    assert.equal(wrongOwner.json().error, 'challenge_entry_owner_required');

    // 15. Frozen terms are rechecked at immutable submission time.
    const staleSubmission = await app.inject({
      method: 'POST',
      url: submitUrl,
      headers: {authorization: `Bearer ${builderToken}`, 'content-type': 'application/json'},
      payload: submissionPayload(entryId, 'c'.repeat(64)),
    });
    assert.equal(staleSubmission.statusCode, 409, staleSubmission.body);
    assert.equal(staleSubmission.json().error, 'challenge_terms_digest_stale');

    // 16. The narrow bearer route reaches the existing immutable F2 authority.
    const accepted = await app.inject({
      method: 'POST',
      url: submitUrl,
      headers: {authorization: `Bearer ${builderToken}`, 'content-type': 'application/json'},
      payload: firstSubmission,
    });
    assert.equal(accepted.statusCode, 201, accepted.body);
    assert.equal(accepted.json().submission_id, firstSubmission.submission_id);
    assert.equal(accepted.json().entry_id, entryId);
    assert.equal(accepted.json().terms_digest, termsDigest);
    const durableSubmission = (await sql`
      select submission_id, entry_id, terms_digest, manifest_digest
      from challenge_submissions where submission_id = ${firstSubmission.submission_id}
    `.execute(db)).rows[0];
    assert.equal(durableSubmission.submission_id, firstSubmission.submission_id);
    assert.equal(durableSubmission.entry_id, entryId);
    assert.equal(durableSubmission.terms_digest, termsDigest);
    assert.equal(durableSubmission.manifest_digest, accepted.json().manifest_digest);

    // 17 + 18. Production route inventory remains exact and the broad legacy DevKit API stays absent.
    for (const route of [
      'POST /v1/challenges',
      'POST /v1/challenges/:challengeId/stage-i-mock-launch',
      'POST /v1/challenges/:challengeId/entries',
      'GET /v1/challenges/:challengeId/my-build',
      'POST /v1/challenges/:challengeId/submit-credential',
      'POST /v1/challenges/:challengeId/submissions',
    ]) {
      assert.ok(FUNDED_CHALLENGE_CORE_ROUTES.includes(route));
    }
    assert.ok(FORBIDDEN_PRODUCTION_ROUTE_PREFIXES.includes('/v1/devkit'));
    const legacyDevkit = await app.inject({
      method: 'POST',
      url: '/v1/devkit/tokens',
      headers: {origin: appOrigin, cookie: builder.cookie, 'content-type': 'application/json'},
      payload: {},
    });
    assert.equal(legacyDevkit.statusCode, 404, legacyDevkit.body);

    // 19. Incident write freeze executes before both ordinary browser writes and the bearer Origin exception.
    const frozenApp = buildFundedChallengeProductionApp({
      db,
      appOrigin,
      sessionTtlSeconds: 3600,
      incidentWriteFreeze: true,
      github: null,
    });
    await frozenApp.ready();
    try {
      const frozenCreate = await frozenApp.inject({
        method: 'POST',
        url: '/v1/challenges',
        headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
        payload: challengeInput(),
      });
      assert.equal(frozenCreate.statusCode, 503, frozenCreate.body);
      assert.equal(frozenCreate.json().error, 'incident_write_freeze');

      const frozenBearer = await frozenApp.inject({
        method: 'POST',
        url: submitUrl,
        headers: {authorization: `Bearer ${builderToken}`, 'content-type': 'application/json'},
        payload: submissionPayload(entryId, termsDigest, {submission_version: 2}),
      });
      assert.equal(frozenBearer.statusCode, 503, frozenBearer.body);
      assert.equal(frozenBearer.json().error, 'incident_write_freeze');
    } finally {
      await frozenApp.close();
    }
  } finally {
    await app.close();
    await db.destroy();
  }
});