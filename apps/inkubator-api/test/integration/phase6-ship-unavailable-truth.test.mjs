import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {evaluateShipAcceptance, reconcileShipAcceptances} from '../../dist/ship-acceptance.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');

test('Phase 6B verifier UNAVAILABLE remains non-authoritative and cannot reject or Ship', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const playerId = randomUUID();
    const projectId = randomUUID();
    const missionId = randomUUID();
    const submissionId = randomUUID();

    await db.insertInto('players').values({player_id: playerId, display_name: `Unavailable ${playerId.slice(0, 5)}`}).execute();
    await db.insertInto('projects').values({project_id: projectId, schema_version: 'project.current.v1', owner_player_id: playerId, name: 'Unavailable truth fixture'}).execute();
    await db.insertInto('missions').values({
      mission_id: missionId,
      schema_version: 'mission.current.v1',
      project_id: projectId,
      owner_player_id: playerId,
      round_id: null,
      goal: 'Preserve unavailable truth semantics',
      ship_condition: 'Require positive verifier evidence',
      state: 'SUBMITTED',
      current_focus: 'Verify',
      next_move: 'Observe',
      progress_model_version: 'mission.progress.v1',
    }).execute();
    await db.insertInto('ship_submissions').values({
      submission_id: submissionId,
      mission_id: missionId,
      project_id: projectId,
      owner_player_id: playerId,
      creation_request_id: randomUUID(),
      artifact_title: 'Unavailable artifact',
      artifact_url: 'https://example.com/unavailable',
      demo_url: null,
      source_url: null,
      state: 'ATTENTION',
    }).execute();
    await db.insertInto('ship_verifier_observations').values({
      observation_id: randomUUID(),
      submission_id: submissionId,
      outcome: 'UNAVAILABLE',
      reason_code: 'NETWORK_ERROR',
      final_url: null,
      http_status: null,
      duration_ms: 17,
      redirects: 0,
    }).execute();
    await db.insertInto('ship_acceptance_reviews').values({
      review_id: randomUUID(),
      submission_id: submissionId,
      creation_request_id: randomUUID(),
      decision: 'ACCEPT',
      reason: 'Human review accepts while verifier authority is unavailable.',
      rule_version: 'ship.acceptance.v1',
    }).execute();

    const evaluated = await db.transaction().execute((tx) => evaluateShipAcceptance(tx, submissionId));
    assert.equal(evaluated, null);
    const reconciled = await reconcileShipAcceptances(db);
    assert.equal(reconciled.accepted, 0);

    const mission = await db.selectFrom('missions').select('state').where('mission_id', '=', missionId).executeTakeFirstOrThrow();
    const submission = await db.selectFrom('ship_submissions').select('state').where('submission_id', '=', submissionId).executeTakeFirstOrThrow();
    const receipts = await db.selectFrom('ship_receipts').select('receipt_id').where('submission_id', '=', submissionId).execute();
    const proven = await db.selectFrom('history_events').select('history_event_id').where('event_type', '=', 'project.ship.accepted').where('dedupe_key', '=', `evidence:project.ship.accepted:${submissionId}`).execute();

    assert.equal(mission.state, 'SUBMITTED');
    assert.equal(submission.state, 'ATTENTION');
    assert.equal(receipts.length, 0);
    assert.equal(proven.length, 0);
  } finally {
    await db.destroy();
  }
});
