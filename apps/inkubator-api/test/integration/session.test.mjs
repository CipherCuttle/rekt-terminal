import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {enqueueOutboxJob, runOneJob, SESSION_EXPIRY_JOB_TYPE} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {hashSessionToken, SESSION_COOKIE_NAME} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

function tokenFromCookie(cookie) {
  const prefix = `${SESSION_COOKIE_NAME}=`;
  assert.ok(cookie.startsWith(prefix));
  return cookie.slice(prefix.length);
}

async function resetDatabase(db) {
  await db.deleteFrom('outbox_jobs').execute();
  await db.deleteFrom('history_events').execute();
  await db.deleteFrom('sessions').execute();
  await db.deleteFrom('players').execute();
}

test('real Postgres session boundary preserves auth and projection invariants', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);

  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600});
  try {
    const deniedPreflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/dev/session',
      headers: {origin: 'https://evil.example', 'access-control-request-method': 'POST'},
    });
    assert.equal(deniedPreflight.statusCode, 403);

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/dev/session',
      headers: {
        origin: appOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], appOrigin);
    assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
    assert.match(preflight.headers['access-control-allow-methods'] ?? '', /\bPOST\b/);
    assert.match(preflight.headers['access-control-allow-headers'] ?? '', /\bcontent-type\b/);

    const deniedOrigin = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: 'https://evil.example'}, payload: {display_name: 'Nope'},
    });
    assert.equal(deniedOrigin.statusCode, 403);

    const first = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: ' First Builder '},
    });
    assert.equal(first.statusCode, 201);
    assert.equal(first.headers['access-control-allow-origin'], appOrigin);
    assert.equal(first.headers['access-control-allow-credentials'], 'true');
    const firstBody = first.json();
    const firstCookie = cookieFrom(first);
    const firstToken = tokenFromCookie(firstCookie);
    assert.equal(firstBody.player.display_name, 'First Builder');
    assert.equal(JSON.stringify(firstBody).includes(firstToken), false);

    const stored = await db.selectFrom('sessions').select(['token_hash', 'expires_at']).executeTakeFirstOrThrow();
    assert.equal(stored.token_hash, hashSessionToken(firstToken));
    assert.notEqual(stored.token_hash, firstToken);
    const databaseNow = await readDatabaseNow(db);
    assert.ok(stored.expires_at.getTime() > databaseNow.getTime());
    assert.ok(stored.expires_at.getTime() <= databaseNow.getTime() + 3_605_000);

    const me = await app.inject({method: 'GET', url: '/v1/me', headers: {origin: appOrigin, cookie: firstCookie}});
    assert.equal(me.statusCode, 200);
    assert.equal(me.headers['cache-control'], 'no-store');
    assert.equal(me.headers['access-control-allow-origin'], appOrigin);
    assert.equal(me.headers['access-control-allow-credentials'], 'true');

    const malformedPublic = await app.inject({method: 'GET', url: '/v1/players/not-a-uuid'});
    assert.equal(malformedPublic.statusCode, 400);
    assert.equal(malformedPublic.json().error, 'invalid_player_id');

    const publicView = await app.inject({
      method: 'GET',
      url: `/v1/players/${firstBody.player.player_id}`,
      headers: {origin: appOrigin},
    });
    assert.equal(publicView.statusCode, 200);
    assert.equal(publicView.headers['access-control-allow-origin'], appOrigin);
    const publicBody = publicView.json();
    assert.deepEqual(Object.keys(publicBody).sort(), ['can_help_with', 'display_name', 'player_id', 'schema_version', 'skills_needed']);
    assert.equal(publicBody.schema_version, 'player.public.v2');
    assert.deepEqual(publicBody.skills_needed, []);
    assert.deepEqual(publicBody.can_help_with, []);
    assert.equal('created_at' in publicBody, false);
    assert.equal('updated_at' in publicBody, false);

    const second = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'Second Builder'},
    });
    assert.equal(second.statusCode, 201);
    const secondCookie = cookieFrom(second);

    const malformedPrivate = await app.inject({
      method: 'GET', url: '/v1/players/not-a-uuid/private', headers: {cookie: firstCookie},
    });
    assert.equal(malformedPrivate.statusCode, 400);
    assert.equal(malformedPrivate.json().error, 'invalid_player_id');

    const crossPlayer = await app.inject({
      method: 'GET', url: `/v1/players/${firstBody.player.player_id}/private`, headers: {cookie: secondCookie},
    });
    assert.equal(crossPlayer.statusCode, 403);

    const ownPrivate = await app.inject({
      method: 'GET', url: `/v1/players/${firstBody.player.player_id}/private`, headers: {cookie: firstCookie},
    });
    assert.equal(ownPrivate.statusCode, 200);
    assert.equal(ownPrivate.json().schema_version, 'player.private.v1');

    const contract = await app.inject({method: 'GET', url: '/openapi.json'});
    assert.equal(contract.statusCode, 200);
    assert.equal(contract.json().openapi, '3.1.0');
    assert.equal(contract.json().paths['/v1/players/{playerId}'].get.responses['400'].content['application/json'].schema.$ref, '#/components/schemas/Error');

    const logout = await app.inject({method: 'DELETE', url: '/v1/session', headers: {origin: appOrigin, cookie: firstCookie}});
    assert.equal(logout.statusCode, 204);
    const afterLogout = await app.inject({method: 'GET', url: '/v1/me', headers: {cookie: firstCookie}});
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('development identity bootstrap is absent when disabled', async () => {
  const db = createDatabase(databaseUrl);
  const app = buildApp({db, appOrigin, allowDevAuth: false, sessionTtlSeconds: 3600});
  try {
    const response = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'Builder'},
    });
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('event and outbox foundation is atomic, database-clocked, leased, idempotent, and bounded', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600});

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/dev/session',
      headers: {origin: appOrigin},
      payload: {display_name: 'Worker Builder'},
    });
    assert.equal(created.statusCode, 201);
    const player = created.json().player;

    const history = await db
      .selectFrom('history_events')
      .selectAll()
      .where('subject_type', '=', 'player')
      .where('subject_id', '=', player.player_id)
      .executeTakeFirstOrThrow();
    assert.equal(history.event_family, 'activity');
    assert.equal(history.event_version, 'history.v1');
    assert.equal(history.event_type, 'player.created');
    assert.deepEqual(history.payload, {display_name: 'Worker Builder'});

    const expiryJob = await db
      .selectFrom('outbox_jobs')
      .selectAll()
      .where('job_type', '=', SESSION_EXPIRY_JOB_TYPE)
      .executeTakeFirstOrThrow();
    assert.equal(expiryJob.job_version, 'job.v1');
    assert.equal(expiryJob.state, 'pending');
    assert.equal(expiryJob.attempts, 0);
    assert.equal(typeof expiryJob.payload.session_id, 'string');

    const duplicate = await enqueueOutboxJob(db, {
      jobType: SESSION_EXPIRY_JOB_TYPE,
      idempotencyKey: expiryJob.idempotency_key,
      payload: expiryJob.payload,
      nextAttemptAt: new Date(expiryJob.next_attempt_at.getTime() + 60_000),
      maxAttempts: expiryJob.max_attempts,
    });
    assert.equal(duplicate.job_id, expiryJob.job_id);
    assert.equal(await db.selectFrom('outbox_jobs').select(({fn}) => fn.countAll().as('count')).executeTakeFirstOrThrow().then((row) => Number(row.count)), 1);

    await assert.rejects(
      enqueueOutboxJob(db, {
        jobType: SESSION_EXPIRY_JOB_TYPE,
        idempotencyKey: expiryJob.idempotency_key,
        payload: {session_id: randomUUID()},
        maxAttempts: expiryJob.max_attempts,
      }),
      /outbox_job_idempotency_conflict/,
    );

    const dueClock = await readDatabaseNow(db);
    const dueAt = new Date(dueClock.getTime() - 1_000);
    const sessionId = expiryJob.payload.session_id;
    await db.updateTable('sessions').set({expires_at: dueAt, revoked_at: null}).where('session_id', '=', sessionId).execute();
    await db.updateTable('outbox_jobs').set({next_attempt_at: dueAt}).where('job_id', '=', expiryJob.job_id).execute();

    const processed = await runOneJob(db, {leaseMs: 30_000, retryBaseMs: 1});
    assert.deepEqual(processed, {status: 'succeeded', jobId: expiryJob.job_id});
    const revoked = await db.selectFrom('sessions').select('revoked_at').where('session_id', '=', sessionId).executeTakeFirstOrThrow();
    assert.ok(revoked.revoked_at);
    const firstRevokedAt = revoked.revoked_at.getTime();

    const staleClock = await readDatabaseNow(db);
    await db
      .updateTable('outbox_jobs')
      .set({
        state: 'running',
        attempts: 1,
        locked_at: new Date(staleClock.getTime() - 120_000),
        lock_token: randomUUID(),
        completed_at: null,
      })
      .where('job_id', '=', expiryJob.job_id)
      .execute();

    const recovered = await runOneJob(db, {leaseMs: 30_000, retryBaseMs: 1});
    assert.deepEqual(recovered, {status: 'succeeded', jobId: expiryJob.job_id});
    const afterRecovery = await db.selectFrom('sessions').select('revoked_at').where('session_id', '=', sessionId).executeTakeFirstOrThrow();
    assert.equal(afterRecovery.revoked_at.getTime(), firstRevokedAt);

    const poisonClock = await readDatabaseNow(db);
    const poison = await enqueueOutboxJob(db, {
      jobType: 'unsupported.test',
      idempotencyKey: `test:unsupported:${randomUUID()}`,
      payload: {reason: 'bounded retry proof'},
      nextAttemptAt: new Date(poisonClock.getTime() - 1_000),
      maxAttempts: 2,
    });

    const firstFailure = await runOneJob(db, {leaseMs: 30_000, retryBaseMs: 1});
    assert.deepEqual(firstFailure, {status: 'retry', jobId: poison.job_id, attempts: 1});
    const retryClock = await readDatabaseNow(db);
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(retryClock.getTime() - 1_000)}).where('job_id', '=', poison.job_id).execute();
    const secondFailure = await runOneJob(db, {leaseMs: 30_000, retryBaseMs: 1});
    assert.deepEqual(secondFailure, {status: 'failed', jobId: poison.job_id, attempts: 2});

    const failed = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', poison.job_id).executeTakeFirstOrThrow();
    assert.equal(failed.state, 'failed');
    assert.equal(failed.attempts, 2);
    assert.match(failed.last_error ?? '', /unsupported_job_type/);
    assert.deepEqual(await runOneJob(db, {leaseMs: 30_000, retryBaseMs: 1}), {status: 'idle'});

    const futureClock = await readDatabaseNow(db);
    await enqueueOutboxJob(db, {
      jobType: 'unsupported.future',
      idempotencyKey: `test:future:${randomUUID()}`,
      payload: {reason: 'database clock due-time proof'},
      nextAttemptAt: new Date(futureClock.getTime() + 60_000),
      maxAttempts: 1,
    });
    assert.deepEqual(await runOneJob(db, {leaseMs: 30_000, retryBaseMs: 1}), {status: 'idle'});
  } finally {
    await app.close();
    await db.destroy();
  }
});
