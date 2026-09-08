import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {runOneJob, SHIP_VERIFICATION_JOB_TYPE} from '../../dist/jobs.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookieFrom(response) {
  const value = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'][0] : response.headers['set-cookie'];
  assert.ok(value);
  return value.split(';')[0];
}

async function createSession(app, label) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/dev/session',
    headers: {origin: appOrigin},
    payload: {display_name: `${label} ${randomUUID().slice(0, 6)}`},
  });
  assert.equal(response.statusCode, 201, response.body);
  return cookieFrom(response);
}

async function createShipReadyMission(app, cookie) {
  const headers = {origin: appOrigin, cookie};
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie}});
  assert.equal(rounds.statusCode, 200, rounds.body);
  const founding = rounds.json().find((round) => round.code === 'ROUND_01');
  assert.ok(founding);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers})).statusCode, 200);

  const created = await app.inject({
    method: 'POST',
    url: '/v1/missions',
    headers,
    payload: {
      request_id: randomUUID(),
      round_id: founding.round_id,
      project_name: `P9 H03 ${randomUUID().slice(0, 8)}`,
      goal: 'Prove post-commit worker replay safety',
      ship_condition: 'Public HTTPS artifact is observed without duplicate history',
      current_focus: 'Exercise worker crash boundary',
      next_move: 'Submit Ship',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const missionId = created.json().mission.mission_id;
  const projectId = created.json().project.project_id;

  for (const state of ['BUILDING', 'SHIP_READY']) {
    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/missions/${missionId}`,
      headers,
      payload: {request_id: randomUUID(), state},
    });
    assert.equal(updated.statusCode, 200, updated.body);
  }
  return {missionId, projectId, headers};
}

test('P9-H03 replay after verifier DB commit but before durable job completion does not duplicate authoritative evidence', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});

  try {
    const cookie = await createSession(app, 'P9 H03 Builder');
    const {missionId, projectId, headers} = await createShipReadyMission(app, cookie);
    const submit = await app.inject({
      method: 'POST',
      url: `/v1/missions/${missionId}/ship-submissions`,
      headers,
      payload: {request_id: randomUUID(), title: 'H03 artifact', url: 'https://example.com/p9-h03'},
    });
    assert.equal(submit.statusCode, 201, submit.body);
    const submissionId = submit.json().submission_id;

    const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
    const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
    assert.ok(job, 'ship verification job must exist');
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();

    let verifierCalls = 0;
    const first = await runOneJob(db, {
      shipVerifierClient: {
        verify: async ({submissionId: id, url}) => {
          verifierCalls += 1;
          return {
            schema_version: 'ship-verifier.observation.v1',
            submission_id: id,
            outcome: 'PASS',
            reason_code: 'PUBLIC_HTTPS_OK',
            final_url: url,
            http_status: 200,
            duration_ms: 7,
            redirects: 0,
          };
        },
      },
    });
    assert.deepEqual(first, {status: 'succeeded', jobId: job.job_id});
    assert.equal(verifierCalls, 1);

    const beforeObservation = await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute();
    const beforeHistory = await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.ship_verifier.observed')
      .where('subject_id', '=', projectId)
      .execute();
    assert.equal(beforeObservation.length, 1);
    assert.equal(beforeHistory.length, 1);
    assert.equal(beforeHistory[0].payload.truth_state, 'OBSERVED');

    // Fault injection only: model the durable state left by a worker dying after the
    // handler transaction committed but before completeJob() durably acknowledged it.
    await db.updateTable('outbox_jobs').set({
      state: 'running',
      locked_at: new Date(0),
      lock_token: randomUUID(),
      completed_at: null,
    }).where('job_id', '=', job.job_id).execute();

    const replay = await runOneJob(db, {
      leaseMs: 10,
      shipVerifierClient: {
        verify: async () => {
          verifierCalls += 1;
          throw new Error('verifier_must_not_be_called_after_committed_observation');
        },
      },
    });
    assert.deepEqual(replay, {status: 'succeeded', jobId: job.job_id});
    assert.equal(verifierCalls, 1, 'reclaim must detect committed verifier observation before external work repeats');

    const afterObservation = await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute();
    const afterHistory = await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.ship_verifier.observed')
      .where('subject_id', '=', projectId)
      .execute();
    assert.equal(afterObservation.length, 1, 'post-commit replay must not duplicate verifier observation authority');
    assert.equal(afterHistory.length, 1, 'post-commit replay must not duplicate authoritative history');

    const submission = await db.selectFrom('ship_submissions').select(['state']).where('submission_id', '=', submissionId).executeTakeFirstOrThrow();
    assert.equal(submission.state, 'OBSERVED');
    const finalJob = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(finalJob.state, 'succeeded');
    assert.equal(finalJob.attempts, 2, 'stale lease reclaim is an explicit second attempt');
  } finally {
    await app.close();
    await db.destroy();
  }
});
