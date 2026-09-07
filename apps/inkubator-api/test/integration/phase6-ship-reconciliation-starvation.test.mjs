import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {reconcileShipAcceptances} from '../../dist/ship-acceptance.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookie(response) {
  const value = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'][0] : response.headers['set-cookie'];
  assert.ok(value);
  return value.split(';')[0];
}

async function createOwnerProject(app) {
  const session = await app.inject({
    method: 'POST',
    url: '/v1/dev/session',
    headers: {origin: appOrigin},
    payload: {display_name: `Reconcile Starvation ${randomUUID().slice(0, 8)}`},
  });
  assert.equal(session.statusCode, 201);
  const sessionCookie = cookie(session);
  const ownerPlayerId = session.json().player.player_id;

  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: sessionCookie}});
  const round = rounds.json().find((row) => row.code === 'ROUND_01');
  assert.ok(round);
  const joined = await app.inject({
    method: 'POST',
    url: `/v1/rounds/${round.round_id}/join`,
    headers: {origin: appOrigin, cookie: sessionCookie},
  });
  assert.equal(joined.statusCode, 200);

  const created = await app.inject({
    method: 'POST',
    url: '/v1/missions',
    headers: {origin: appOrigin, cookie: sessionCookie},
    payload: {
      request_id: randomUUID(),
      round_id: round.round_id,
      project_name: 'Phase 6B starvation fixture',
      goal: 'Exercise bounded Ship reconciliation',
      ship_condition: 'A later PASS cannot be starved by unavailable evidence',
      current_focus: 'Seed evidence',
      next_move: 'Reconcile',
    },
  });
  assert.equal(created.statusCode, 201);
  return {
    ownerPlayerId,
    projectId: created.json().project.project_id,
    roundId: round.round_id,
  };
}

test('Phase 6B reconciliation does not let 50 older ACCEPT + UNAVAILABLE rows starve a later PASS', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await db.deleteFrom('players').execute();
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});

  try {
    const {ownerPlayerId, projectId, roundId} = await createOwnerProject(app);
    const baseTime = Date.now() - 120_000;
    const fixtures = Array.from({length: 51}, (_, index) => ({
      missionId: randomUUID(),
      submissionId: randomUUID(),
      observationId: randomUUID(),
      reviewId: randomUUID(),
      requestId: randomUUID(),
      actionable: index === 50,
      reviewedAt: new Date(baseTime + index * 1000),
    }));

    await db.insertInto('missions').values(fixtures.map((fixture) => ({
      mission_id: fixture.missionId,
      schema_version: 'mission.current.v1',
      creation_request_id: null,
      project_id: projectId,
      owner_player_id: ownerPlayerId,
      round_id: roundId,
      goal: 'Starvation regression fixture',
      ship_condition: 'Bounded reconciliation reaches actionable evidence',
      state: 'SUBMITTED',
      current_focus: 'Await reconciliation',
      next_move: 'Reconcile Ship evidence',
      blocker: null,
      progress_model_version: 'mission.progress.v1',
      stack_labels: [],
      stack_source: 'UNKNOWN',
    }))).execute();

    await db.insertInto('ship_submissions').values(fixtures.map((fixture, index) => ({
      submission_id: fixture.submissionId,
      mission_id: fixture.missionId,
      project_id: projectId,
      owner_player_id: ownerPlayerId,
      creation_request_id: randomUUID(),
      artifact_title: `Starvation artifact ${index}`,
      artifact_url: `https://example.com/starvation-${index}`,
      demo_url: null,
      source_url: null,
      state: fixture.actionable ? 'OBSERVED' : 'ATTENTION',
    }))).execute();

    await db.insertInto('ship_verifier_observations').values(fixtures.map((fixture, index) => ({
      observation_id: fixture.observationId,
      submission_id: fixture.submissionId,
      outcome: fixture.actionable ? 'PASS' : 'UNAVAILABLE',
      reason_code: fixture.actionable ? 'PUBLIC_HTTPS_OK' : 'NETWORK_ERROR',
      final_url: `https://example.com/starvation-${index}`,
      http_status: fixture.actionable ? 200 : null,
      duration_ms: 1,
      redirects: 0,
      observed_at: fixture.reviewedAt,
    }))).execute();

    await db.insertInto('ship_acceptance_reviews').values(fixtures.map((fixture) => ({
      review_id: fixture.reviewId,
      submission_id: fixture.submissionId,
      creation_request_id: fixture.requestId,
      decision: 'ACCEPT',
      reason: 'Trusted bounded acceptance review.',
      rule_version: 'ship.acceptance.v1',
      reviewed_at: fixture.reviewedAt,
    }))).execute();

    const reconciled = await reconcileShipAcceptances(db);
    assert.deepEqual(reconciled, {examined: 1, accepted: 1});

    const actionable = fixtures[50];
    const actionableMission = await db.selectFrom('missions').select('state').where('mission_id', '=', actionable.missionId).executeTakeFirstOrThrow();
    const actionableReceipts = await db.selectFrom('ship_receipts').select('receipt_id').where('submission_id', '=', actionable.submissionId).execute();
    assert.equal(actionableMission.state, 'SHIPPED');
    assert.equal(actionableReceipts.length, 1);

    const unavailable = fixtures[0];
    const unavailableMission = await db.selectFrom('missions').select('state').where('mission_id', '=', unavailable.missionId).executeTakeFirstOrThrow();
    const unavailableSubmission = await db.selectFrom('ship_submissions').select('state').where('submission_id', '=', unavailable.submissionId).executeTakeFirstOrThrow();
    const unavailableReceipts = await db.selectFrom('ship_receipts').select('receipt_id').where('submission_id', '=', unavailable.submissionId).execute();
    assert.equal(unavailableMission.state, 'SUBMITTED');
    assert.equal(unavailableSubmission.state, 'ATTENTION');
    assert.equal(unavailableReceipts.length, 0);
  } finally {
    await app.close();
    await db.destroy();
  }
});
