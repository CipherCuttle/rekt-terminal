import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {getProjectShipState, submitShip} from '../../dist/ship.js';
import {runOneJob, SHIP_VERIFICATION_JOB_TYPE} from '../../dist/jobs.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');

async function fixture(db, label) {
  const playerId = randomUUID();
  const projectId = randomUUID();
  const missionId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label} ${playerId.slice(0, 5)}`}).execute();
  await db.insertInto('projects').values({project_id: projectId, schema_version: 'project.current.v1', owner_player_id: playerId, name: `${label} project`}).execute();
  await db.insertInto('missions').values({
    mission_id: missionId,
    schema_version: 'mission.current.v1',
    project_id: projectId,
    owner_player_id: playerId,
    round_id: null,
    goal: 'Bounded verification',
    ship_condition: 'Truthful Ship',
    state: 'SHIP_READY',
    current_focus: 'Verify',
    next_move: 'Ship',
    progress_model_version: 'mission.progress.v1',
  }).execute();
  return {playerId, projectId, missionId};
}

async function dueShipJob(db, submissionId) {
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job);
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  return job.job_id;
}

test('UNAVAILABLE retries are bounded, remain UNKNOWN, and release the Mission for a replacement submission', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const f = await fixture(db, 'Retry');
    const first = await submitShip(db, f.playerId, f.missionId, {
      requestId: randomUUID(),
      title: 'Retry artifact',
      url: 'https://example.com/retry',
    });
    const jobId = await dueShipJob(db, first.submission_id);
    const unavailableClient = {
      verify: async ({submissionId}) => ({
        schema_version: 'ship-verifier.observation.v1',
        submission_id: submissionId,
        outcome: 'UNAVAILABLE',
        reason_code: 'DNS_FAILURE',
        duration_ms: 5,
        redirects: 0,
      }),
    };

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', jobId).execute();
      const result = await runOneJob(db, {retryBaseMs: 1, shipVerifierClient: unavailableClient});
      assert.equal(result.status, 'retry');
      assert.equal((await db.selectFrom('ship_verifier_observations').select('observation_id').where('submission_id', '=', first.submission_id).execute()).length, 0);
      assert.equal((await db.selectFrom('missions').select('state').where('mission_id', '=', f.missionId).executeTakeFirstOrThrow()).state, 'SUBMITTED');
    }

    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', jobId).execute();
    const terminal = await runOneJob(db, {retryBaseMs: 1, shipVerifierClient: unavailableClient});
    assert.equal(terminal.status, 'succeeded');

    const observation = await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id', '=', first.submission_id).executeTakeFirstOrThrow();
    assert.equal(observation.outcome, 'UNAVAILABLE');
    assert.equal((await db.selectFrom('missions').select('state').where('mission_id', '=', f.missionId).executeTakeFirstOrThrow()).state, 'SHIP_READY');
    assert.equal((await db.selectFrom('ship_submissions').select('state').where('submission_id', '=', first.submission_id).executeTakeFirstOrThrow()).state, 'ATTENTION');

    const history = await db.selectFrom('history_events').select('payload').where('dedupe_key', '=', `evidence:project.ship_verifier.observed:${first.submission_id}`).executeTakeFirstOrThrow();
    assert.equal(history.payload.truth_state, 'UNKNOWN');

    const replacement = await submitShip(db, f.playerId, f.missionId, {
      requestId: randomUUID(),
      title: 'Retry artifact replacement',
      url: 'https://example.com/retry',
    });
    assert.notEqual(replacement.submission_id, first.submission_id);
    assert.equal((await db.selectFrom('ship_submissions').select('state').where('submission_id', '=', first.submission_id).executeTakeFirstOrThrow()).state, 'SUPERSEDED');
    assert.equal((await db.selectFrom('ship_submissions').select('state').where('submission_id', '=', replacement.submission_id).executeTakeFirstOrThrow()).state, 'SUBMITTED');
  } finally {
    await db.destroy();
  }
});

test('public Ship state never exposes a verifier redirect target or its query credential', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const f = await fixture(db, 'Redirect privacy');
    const submitted = await submitShip(db, f.playerId, f.missionId, {
      requestId: randomUUID(),
      title: 'Redirect artifact',
      url: 'https://example.com/public',
    });
    await dueShipJob(db, submitted.submission_id);

    const secret = `X-Amz-Credential=${randomUUID()}`;
    const result = await runOneJob(db, {
      shipVerifierClient: {
        verify: async ({submissionId}) => ({
          schema_version: 'ship-verifier.observation.v1',
          submission_id: submissionId,
          outcome: 'PASS',
          reason_code: 'PUBLIC_HTTPS_OK',
          final_url: `https://cdn.example/object?${secret}`,
          http_status: 200,
          duration_ms: 8,
          redirects: 1,
        }),
      },
    });
    assert.equal(result.status, 'succeeded');

    const stored = await db.selectFrom('ship_verifier_observations').select('final_url').where('submission_id', '=', submitted.submission_id).executeTakeFirstOrThrow();
    assert.ok(stored.final_url?.includes(secret));

    const encoded = JSON.stringify(await getProjectShipState(db, f.projectId));
    assert.equal(encoded.includes('final_url'), false);
    assert.equal(encoded.includes(secret), false);

    const history = await db.selectFrom('history_events').select('payload').where('dedupe_key', '=', `evidence:project.ship_verifier.observed:${submitted.submission_id}`).executeTakeFirstOrThrow();
    assert.equal(JSON.stringify(history.payload).includes(secret), false);
  } finally {
    await db.destroy();
  }
});
