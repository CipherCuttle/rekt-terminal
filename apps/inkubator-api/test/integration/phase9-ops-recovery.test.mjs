import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {createDatabase} from '../../dist/database.js';
import {enqueueOutboxJob, SESSION_EXPIRY_JOB_TYPE} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const opsCli = fileURLToPath(new URL('../../dist/ops-recover-cli.js', import.meta.url));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRunning(db, jobId) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = await db.selectFrom('outbox_jobs').select(['state', 'attempts']).where('job_id', '=', jobId).executeTakeFirstOrThrow();
    if (job.state === 'running') return job;
    await sleep(10);
  }
  throw new Error('phase9_ops_job_never_entered_running');
}

async function runOps(extraEnv = {}) {
  const child = spawn(process.execPath, [opsCli], {
    env: {...process.env, DATABASE_URL: databaseUrl, ...extraEnv},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const [code, signal] = await once(child, 'exit');
  assert.equal(signal, null, stderr);
  assert.equal(code, 0, stderr);
  return JSON.parse(stdout.trim());
}

test('P9-H18 supported OPS recovery reclaims a crashed worker lease without outbox DB surgery', async () => {
  const db = createDatabase(databaseUrl);
  const blockerDb = createDatabase(databaseUrl);
  await migrateToLatest(db);

  const job = await enqueueOutboxJob(db, {
    jobType: SESSION_EXPIRY_JOB_TYPE,
    idempotencyKey: `phase9:ops-recovery:${randomUUID()}`,
    payload: {session_id: randomUUID()},
    nextAttemptAt: new Date(0),
    maxAttempts: 3,
  });

  let releaseLock;
  let lockReady;
  const releaseLockPromise = new Promise((resolve) => { releaseLock = resolve; });
  const lockReadyPromise = new Promise((resolve) => { lockReady = resolve; });
  const heldLock = blockerDb.transaction().execute(async (transaction) => {
    await sql`lock table sessions in access exclusive mode`.execute(transaction);
    lockReady();
    await releaseLockPromise;
  });

  let crashed;
  try {
    await lockReadyPromise;
    crashed = spawn(process.execPath, [opsCli], {
      env: {...process.env, DATABASE_URL: databaseUrl, INKUBATOR_WORKER_LEASE_MS: '1000'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const claimed = await waitForRunning(db, job.job_id);
    assert.equal(claimed.attempts, 1);

    crashed.kill('SIGKILL');
    await once(crashed, 'exit');
    releaseLock();
    await heldLock;

    const abandoned = await db.selectFrom('outbox_jobs').select(['state', 'attempts', 'completed_at'])
      .where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(abandoned.state, 'running');
    assert.equal(abandoned.attempts, 1);
    assert.equal(abandoned.completed_at, null);

    await sleep(1200);
    const receipt = await runOps({INKUBATOR_WORKER_LEASE_MS: '1000'});
    assert.equal(receipt.schema_version, 'inkubator.ops.recovery.v1');
    assert.equal(receipt.action, 'RUN_ONE_DUE_JOB');
    assert.equal(receipt.result.status, 'succeeded');
    assert.equal(receipt.result.jobId, job.job_id);

    const recovered = await db.selectFrom('outbox_jobs').select(['state', 'attempts', 'completed_at', 'last_error'])
      .where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(recovered.state, 'succeeded');
    assert.equal(recovered.attempts, 2);
    assert.ok(recovered.completed_at instanceof Date);
    assert.equal(recovered.last_error, null);

    const replay = await runOps({INKUBATOR_WORKER_LEASE_MS: '1000'});
    assert.equal(replay.result.status, 'idle');
  } finally {
    if (crashed && crashed.exitCode === null && crashed.signalCode === null) crashed.kill('SIGKILL');
    releaseLock?.();
    await heldLock.catch(() => undefined);
    await blockerDb.destroy();
    await db.destroy();
  }
});
