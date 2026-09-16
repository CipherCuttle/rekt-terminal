import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {
  enqueueOutboxJob,
  runOneJob,
  SHIP_VERIFICATION_JOB_TYPE,
} from '../../dist/jobs.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

function deferred() {
  let resolve;
  const promise = new Promise((value) => { resolve = value; });
  return {promise, resolve};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function verifierJob(submissionId, maxAttempts = 2) {
  return {
    jobType: SHIP_VERIFICATION_JOB_TYPE,
    idempotencyKey: `h5-observability:${submissionId}`,
    maxAttempts,
    nextAttemptAt: new Date(0),
    payload: {
      schema_version: 'ship.verification.job.v1',
      submission_id: submissionId,
      artifact_url: `https://example.com/h5-observability-${submissionId}`,
    },
  };
}

test('H5 heartbeat loss emits renewal + lost-lease signals without creating verifier authority', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const submissionId = randomUUID();
    const job = await enqueueOutboxJob(db, verifierJob(submissionId));
    const started = deferred();
    const release = deferred();
    const events = [];

    const worker = runOneJob(db, {
      leaseMs: 120,
      onEvent: (event) => events.push(event),
      shipVerifierClient: {
        verify: async ({submissionId: id, url}) => {
          started.resolve();
          await release.promise;
          return {
            schema_version: 'ship-verifier.observation.v1',
            submission_id: id,
            outcome: 'PASS',
            reason_code: 'PUBLIC_HTTPS_OK',
            final_url: url,
            http_status: 200,
            duration_ms: 5,
            redirects: 0,
          };
        },
      },
    });

    await started.promise;
    const claimed = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(claimed.state, 'running');
    assert.ok(claimed.lock_token);

    await db.updateTable('outbox_jobs').set({
      lock_token: randomUUID(),
      locked_at: new Date(),
    }).where('job_id', '=', job.job_id).execute();

    for (let attempt = 0; attempt < 20 && !events.some((event) => event.event === 'lease_renewal_failed'); attempt += 1) {
      await sleep(20);
    }
    assert.equal(events.some((event) => event.event === 'lease_renewal_failed' && event.jobId === job.job_id), true);

    release.resolve();
    const result = await worker;
    assert.deepEqual(result, {status: 'lost_lease', jobId: job.job_id, attempts: 1});
    assert.equal(events.some((event) => event.event === 'lost_lease' && event.jobId === job.job_id && event.reason === 'heartbeat'), true);

    const durable = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(durable.state, 'running');
    assert.notEqual(durable.lock_token, claimed.lock_token);
    assert.equal(durable.attempts, 1);
    assert.equal((await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute()).length, 0);
  } finally {
    await db.destroy();
  }
});

test('H5 retry exhaustion is observable and matches terminal durable job state', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const submissionId = randomUUID();
    const job = await enqueueOutboxJob(db, verifierJob(submissionId, 2));
    const events = [];

    const first = await runOneJob(db, {retryBaseMs: 1, onEvent: (event) => events.push(event)});
    assert.deepEqual(first, {status: 'retry', jobId: job.job_id, attempts: 1});
    assert.equal(events.some((event) => event.event === 'retry_exhausted'), false);

    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
    const second = await runOneJob(db, {retryBaseMs: 1, onEvent: (event) => events.push(event)});
    assert.deepEqual(second, {status: 'failed', jobId: job.job_id, attempts: 2});

    const exhausted = events.filter((event) => event.event === 'retry_exhausted');
    assert.equal(exhausted.length, 1);
    assert.equal(exhausted[0].jobId, job.job_id);
    assert.equal(exhausted[0].attempts, 2);
    assert.match(exhausted[0].error, /ship_verifier_unavailable/);

    const durable = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(durable.state, 'failed');
    assert.equal(durable.attempts, 2);
    assert.match(durable.last_error ?? '', /ship_verifier_unavailable/);
    assert.ok(durable.completed_at instanceof Date);
    assert.equal(durable.lock_token, null);
    assert.equal(durable.locked_at, null);
    assert.equal((await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', submissionId).execute()).length, 0);
  } finally {
    await db.destroy();
  }
});
