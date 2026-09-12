import {createHmac, randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const webhookSecret = 'phase1-exit-webhook-secret-123456789';
const installationId = '91001';
const repositoryId = '51001';
const fullName = 'private-org/phase1-exit-proof';
const runtime = {appSlug: 'rekt-inkubator-test', clientId: 'Iv1.test-client', clientSecret: 'test-client-secret', webhookSecret};

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

async function createSession(app, displayName) {
  const response = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: displayName}});
  assert.equal(response.statusCode, 201);
  return {cookie: cookieFrom(response), playerId: response.json().player.player_id};
}

async function installRepository(app, cookie) {
  const install = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin, cookie}});
  assert.equal(install.statusCode, 201);
  const state = new URL(install.json().install_url).searchParams.get('state');
  assert.ok(state);
  const setup = await app.inject({method: 'GET', url: `/v1/github/setup?code=phase1-code&installation_id=${installationId}&state=${encodeURIComponent(state)}`, headers: {cookie}});
  assert.equal(setup.statusCode, 200);
  assert.equal(setup.json().repositories_connected, 1);
}

async function sendPush(app, deliveryId) {
  const payload = {
    ref: 'refs/heads/main', before: '1'.repeat(40), after: '2'.repeat(40),
    installation: {id: Number(installationId)},
    repository: {id: Number(repositoryId), private: true, full_name: fullName},
    head_commit: {message: 'PRIVATE COMMIT MESSAGE MUST NOT ENTER PUBLIC PROJECTION'},
  };
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  return app.inject({method: 'POST', url: '/v1/github/webhook', headers: {
    'content-type': 'application/json', 'x-github-delivery': deliveryId, 'x-github-event': 'push',
    'x-hub-signature-256': `sha256=${createHmac('sha256', webhookSecret).update(raw).digest('hex')}`,
  }, payload: raw});
}

async function countProjectObservations(db, projectId) {
  const row = await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count'))
    .where('event_type', '=', 'project.github_repository_push.observed').where('subject_type', '=', 'project').where('subject_id', '=', projectId).executeTakeFirstOrThrow();
  return Number(row.count);
}

test('Phase-1 exit vertical assembles auth, Project/Mission, GitHub observation, projections, dedupe, and worker retry', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const verifier = {
    async verifyInstallation(code, requestedInstallationId) {
      if (code !== 'phase1-code' || requestedInstallationId !== installationId) throw new Error('github_installation_not_accessible_to_user');
      return {githubUserId: '71001', installationId, accountId: '81001', accountType: 'Organization', repositorySelection: 'selected', repositories: [{repositoryId, fullName, private: true}]};
    },
  };
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: {runtime, verifier}});

  try {
    const owner = await createSession(app, `Phase1 Owner ${randomUUID().slice(0, 8)}`);
    const stranger = await createSession(app, `Phase1 Stranger ${randomUUID().slice(0, 8)}`);

    const create = await app.inject({method: 'POST', url: '/v1/development/projects', headers: {origin: appOrigin, cookie: owner.cookie}, payload: {
      name: 'Phase One Exit Proof', goal: 'Prove the foundation spine end to end', ship_condition: 'One signed push becomes one project observation',
      current_focus: 'Connect the repository', next_move: 'Send the signed push',
    }});
    assert.equal(create.statusCode, 201);
    const project = create.json();
    const projectId = project.project_id;
    assert.equal(project.mission_state, 'DECLARED');
    assert.equal(project.source_connected, false);
    assert.equal(project.observation_state, 'UNKNOWN');

    const publicBefore = await app.inject({method: 'GET', url: `/v1/projects/${projectId}`});
    assert.equal(publicBefore.statusCode, 200);
    assert.equal(publicBefore.json().source_connected, false);
    assert.equal(JSON.stringify(publicBefore.json()).includes('ship_condition'), false);

    const strangerPrivate = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/private`, headers: {cookie: stranger.cookie}});
    assert.equal(strangerPrivate.statusCode, 403);

    await installRepository(app, owner.cookie);
    const link = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/github-repositories`, headers: {origin: appOrigin, cookie: owner.cookie}, payload: {repository_id: repositoryId}});
    assert.equal(link.statusCode, 200);
    assert.equal(link.json().repository_id, repositoryId);
    assert.equal(link.json().repository_full_name, fullName);
    assert.equal(link.json().source_visibility, 'PRIVATE');

    const strangerLink = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/github-repositories`, headers: {origin: appOrigin, cookie: stranger.cookie}, payload: {repository_id: repositoryId}});
    assert.equal(strangerLink.statusCode, 403);

    const deliveryId = randomUUID();
    const push = await sendPush(app, deliveryId);
    assert.equal(push.statusCode, 202);
    assert.equal(push.json().status, 'observed');
    const duplicate = await sendPush(app, deliveryId);
    assert.equal(duplicate.statusCode, 200);
    assert.equal(duplicate.json().status, 'duplicate');

    const repoObservationCount = Number((await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count'))
      .where('event_type', '=', 'github.repository_push.observed').where('dedupe_key', '=', `github:delivery:${deliveryId}`).executeTakeFirstOrThrow()).count);
    assert.equal(repoObservationCount, 1);

    const jobKey = `project.github_observation:${projectId}:${deliveryId}`;
    let job = await db.selectFrom('outbox_jobs').selectAll().where('idempotency_key', '=', jobKey).executeTakeFirstOrThrow();
    assert.equal(job.state, 'pending');
    assert.equal(await countProjectObservations(db, projectId), 0);

    let workerResult = await runOneJob(db, {leaseMs: 10, retryBaseMs: 1});
    if (workerResult.status !== 'succeeded' || workerResult.jobId !== job.job_id) {
      for (let attempt = 0; attempt < 10 && (workerResult.status !== 'succeeded' || workerResult.jobId !== job.job_id); attempt += 1) {
        workerResult = await runOneJob(db, {leaseMs: 10, retryBaseMs: 1});
      }
    }
    assert.equal(workerResult.status, 'succeeded');
    assert.equal(workerResult.jobId, job.job_id);
    assert.equal(await countProjectObservations(db, projectId), 1);

    job = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(job.state, 'succeeded');
    await db.updateTable('outbox_jobs').set({state: 'running', attempts: Math.max(1, job.attempts), locked_at: new Date(0), lock_token: randomUUID(), completed_at: null}).where('job_id', '=', job.job_id).execute();
    const retry = await runOneJob(db, {leaseMs: 1, retryBaseMs: 1});
    assert.equal(retry.status, 'succeeded');
    assert.equal(retry.jobId, job.job_id);
    assert.equal(await countProjectObservations(db, projectId), 1);

    const publicAfter = await app.inject({method: 'GET', url: `/v1/projects/${projectId}`});
    assert.equal(publicAfter.statusCode, 200);
    assert.equal(publicAfter.json().source_connected, true);
    assert.equal(publicAfter.json().source_visibility, 'PRIVATE');
    assert.equal(publicAfter.json().observation_state, 'OBSERVED');
    const publicSerialized = JSON.stringify(publicAfter.json());
    assert.equal(publicSerialized.includes(repositoryId), false);
    assert.equal(publicSerialized.includes(fullName), false);
    assert.equal(publicSerialized.includes('refs/heads/main'), false);
    assert.equal(publicSerialized.includes('2'.repeat(40)), false);

    const privateAfter = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/private`, headers: {cookie: owner.cookie}});
    assert.equal(privateAfter.statusCode, 200);
    assert.equal(privateAfter.json().repository_id, repositoryId);
    assert.equal(privateAfter.json().repository_full_name, fullName);
    assert.equal(privateAfter.json().last_delivery_id, deliveryId);
    assert.equal(privateAfter.json().last_ref, 'refs/heads/main');
    assert.equal(privateAfter.json().last_after, '2'.repeat(40));

    const projectObservation = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'project.github_repository_push.observed').where('subject_id', '=', projectId).executeTakeFirstOrThrow();
    assert.equal(projectObservation.payload.truth_state, 'OBSERVED');
    assert.equal(projectObservation.payload.schema_version, 'project.github_repository_push.observed.v1');
    assert.equal(JSON.stringify(projectObservation.payload).includes(fullName), false);
    assert.equal(JSON.stringify(projectObservation.payload).includes('PRIVATE COMMIT MESSAGE'), false);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('development creation stays disabled while graduated Project routes remain registered', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: false, sessionTtlSeconds: 3600, github: null});
  const projectId = randomUUID();
  try {
    const create = await app.inject({method: 'POST', url: '/v1/development/projects', headers: {origin: appOrigin}, payload: {
      name: 'must not exist', goal: 'must not exist', ship_condition: 'must not exist', current_focus: 'must not exist', next_move: 'must not exist',
    }});
    assert.equal(create.statusCode, 404);
    const publicProject = await app.inject({method: 'GET', url: `/v1/projects/${projectId}`});
    assert.equal(publicProject.statusCode, 404);
    assert.equal(publicProject.json().error, 'project_not_found');
    assert.equal((await app.inject({method: 'GET', url: `/v1/projects/${projectId}/private`})).statusCode, 401);
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/github-repositories`, headers: {origin: appOrigin}, payload: {repository_id: repositoryId}})).statusCode, 401);
  } finally {
    await app.close();
    await db.destroy();
  }
});
