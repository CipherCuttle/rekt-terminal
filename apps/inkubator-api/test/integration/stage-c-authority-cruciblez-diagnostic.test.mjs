import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

test('TEMP diagnostic: expose Stage C authority-crucible due-state retry cause', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const failed = await sql`
      select job_id, attempts, last_error, payload
      from outbox_jobs
      where job_type = 'challenge.due_state.v1'
        and state = 'pending'
        and last_error is not null
      order by next_attempt_at, created_at
    `.execute(db);
    assert.fail(`TEMP_STAGE_C_DUE_STATE_RETRY=${JSON.stringify(failed.rows)}`);
  } finally {
    await db.destroy();
  }
});
