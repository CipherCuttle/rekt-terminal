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

function deferred() {
  let resolve;
  const promise = new Promise((value) => { resolve = value; });
  return {promise, resolve};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    payload: {display_name: label + ' ' + randomUUID().slice(0, 6)},
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
  assert.equal((await app.inject({method: 'POST', url: '/v1/rounds/' + founding.round_id + '/join', headers})).statusCode, 200);

  const created = await app.inject({
    method: 'POST',
    url: '/v1/missions',
    headers,
    payload: {
      request_id: randomUUID(),
      round_id: founding.round_id,
      project_name: 'H5 ' + randomUUID().slice(0, 8),
      goal: 'Prove lease fencing',
      ship_condition: 'A long verifier job remains single-owner',
      current_focus: 'Exercise failure boundary',
      next_move: 'Submit Ship',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const missionId = created.json().mission.mission_id;
  const projectId = created.json().project.project_id;

  for (const state of ['BUILDING', 'SHIP_READY']) {
    const updated = await app.inject({
      method: 'PATCH',
      url: '/v1/missions/' + missionId,
      headers,
      payload: {request_id: randomUUID(), state},
    });
    assert.equal(updated.statusCode, 200, updated.body);
  }
  return {missionId, projectId, headers};
}

async function setupVerifier(db, app, label) {
  const cookie = await createSession(app, label);
  const {missionId, projectId, headers} = await createShipReadyMission(app, cookie);
  const submitted = await app.inject({
    method: 'POST',
    url: '/v1/missions/' + missionId + '/ship-submissions',
    headers,
    payload: {request_id: randomUUID(), title: 'H5 artifact', url: 'https://example.com/h5-' + randomUUID()},
  });
  assert.equal(submitted.statusCode, 201, submitted.body);
  const submissionId = submitted.json().submission_id;
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job, 'ship verification job must exist');
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  return {job, submissionId, projectId};
}

function verifierResult(submissionId, url) {
  return {
    schema_version: 'ship-verifier.observation.v1',
    submission_id: submissionId,
    outcome: 'PASS',
    reason_code: 'PUBLIC_HTTPS_OK',
    final_url: url,
    http_status: 200,
    duration_ms: 7,
    redirects: 0,
  };
}

test('H5 healthy long verifier heartbeat prevents replacement overlap', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const {job, submissionId} = await setupVerifier(db, app, 'H5 healthy');
    const started = deferred();
    const release = deferred();
    let verifierCalls = 0;

    const workerA = runOneJob(db, {
      leaseMs: 1_000,
      onEvent: () => {},
      shipVerifierClient: {
        verify: async ({submissionId: id, url}) => {
          verifierCalls += 1;
          started.resolve();
          await release.promise;
          return verifierResult(id, url);
        },
      },
    });
    await started.promise;
    await sleep(2_600);

    const workerB = await runOneJob(db, {
      leaseMs: 1_000,
      shipVerifierClient: {verify: async () => { throw new Error('replacement_must_not_run'); }},
    });
    assert.deepEqual(workerB, {status: 'idle'});

    release.resolve();
    assert.deepEqual(await workerA, {status: 'succeeded', jobId: job.job_id});
    assert.equal(verifierCalls, 1);
    const finalJob = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(finalJob.attempts, 1);
    assert.equal(finalJob.state, 'succeeded');
    assert.equal(submissionId.length, 36);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('H5 stale verifier cannot persist authority after token theft', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const {job, submissionId, projectId} = await setupVerifier(db, app, 'H5 stale');
    const started = deferred();
    const release = deferred();
    let verifierCalls = 0;

    const workerA = runOneJob(db, {
      leaseMs: 1000,
      shipVerifierClient: {
        verify: async ({submissionId: id, url}) => {
          verifierCalls += 1;
          started.resolve();
          await release.promise;
          return verifierResult(id, url);
        },
      },
    });
    await started.promise;

    await db.updateTable('outbox_jobs').set({
      state: 'running',
      locked_at: new Date(0),
      lock_token: randomUUID(),
    }).where('job_id', '=', job.job_id).execute();

    release.resolve();
    assert.deepEqual(await workerA, {status: 'lost_lease', jobId: job.job_id, attempts: 1});
    assert.equal(verifierCalls, 1);
    assert.equal((await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute()).length, 0);
    assert.equal((await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.ship_verifier.observed')
      .where('subject_id', '=', projectId)
      .execute()).length, 0);

    const replacement = await runOneJob(db, {
      leaseMs: 1000,
      shipVerifierClient: {
        verify: async ({submissionId: id, url}) => {
          verifierCalls += 1;
          return verifierResult(id, url);
        },
      },
    });
    assert.deepEqual(replacement, {status: 'succeeded', jobId: job.job_id});
    assert.equal(verifierCalls, 2);
    assert.equal((await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute()).length, 1);
    assert.equal((await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.ship_verifier.observed')
      .where('subject_id', '=', projectId)
      .execute()).length, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('H5 expired verifier lease cannot self-resurrect or commit before token theft', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const {job, submissionId, projectId} = await setupVerifier(db, app, 'H5 expired');
    const started = deferred();
    const release = deferred();
    let verifierCalls = 0;

    const workerA = runOneJob(db, {
      leaseMs: 60_000,
      shipVerifierClient: {
        verify: async ({submissionId: id, url}) => {
          verifierCalls += 1;
          started.resolve();
          await release.promise;
          return verifierResult(id, url);
        },
      },
    });
    await started.promise;
    await sleep(100);

    const claimed = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(claimed.state, 'running');
    assert.ok(claimed.lock_token);
    const originalToken = claimed.lock_token;

    await db.updateTable('outbox_jobs')
      .set({locked_at: new Date(0)})
      .where('job_id', '=', job.job_id)
      .where('lock_token', '=', originalToken)
      .execute();

    const expired = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(expired.lock_token, originalToken, 'expiry fixture must not steal the token');
    assert.equal(expired.locked_at?.getTime(), 0);

    release.resolve();
    assert.deepEqual(await workerA, {status: 'lost_lease', jobId: job.job_id, attempts: 1});
    assert.equal(verifierCalls, 1);
    assert.equal((await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute()).length, 0);
    assert.equal((await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.ship_verifier.observed')
      .where('subject_id', '=', projectId)
      .execute()).length, 0);

    const afterStaleWorker = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(afterStaleWorker.state, 'running');
    assert.equal(afterStaleWorker.attempts, 1);
    assert.equal(afterStaleWorker.lock_token, originalToken, 'stale worker must not rewrite job authority');
    assert.equal(afterStaleWorker.locked_at?.getTime(), 0, 'expired lease must not be renewed after expiry');

    const replacement = await runOneJob(db, {
      leaseMs: 1_000,
      shipVerifierClient: {
        verify: async ({submissionId: id, url}) => {
          verifierCalls += 1;
          return verifierResult(id, url);
        },
      },
    });
    assert.deepEqual(replacement, {status: 'succeeded', jobId: job.job_id});
    assert.equal(verifierCalls, 2);
    assert.equal((await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute()).length, 1);
    assert.equal((await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.ship_verifier.observed')
      .where('subject_id', '=', projectId)
      .execute()).length, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});