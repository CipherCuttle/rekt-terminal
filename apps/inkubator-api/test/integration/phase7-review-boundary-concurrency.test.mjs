import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {getPlayerReputation, reconcilePlayerCheevos} from '../../dist/reputation.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function backendPid(tx) {
  const result = await sql`select pg_backend_pid()::int as pid`.execute(tx);
  return Number(result.rows[0].pid);
}

async function waitForDatabaseLock(db, pid) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await sql`
      select wait_event_type, wait_event
      from pg_stat_activity
      where pid = ${pid}
    `.execute(db);
    if (state.rows[0]?.wait_event_type === 'Lock') return state.rows[0];
    await delay(10);
  }
  throw new Error(`backend_${pid}_did_not_wait_for_lock`);
}

async function seedShipCandidate(db, roundId, label) {
  const playerId = randomUUID();
  const projectId = randomUUID();
  const missionId = randomUUID();
  const submissionId = randomUUID();
  const observationId = randomUUID();
  const reviewId = randomUUID();
  const receiptId = randomUUID();

  await db.insertInto('players').values({player_id: playerId, display_name: `Boundary ${label}`}).execute();
  await db.insertInto('projects').values({
    project_id: projectId,
    schema_version: 'project.current.v1',
    owner_player_id: playerId,
    name: `Boundary Project ${label}`,
  }).execute();
  await db.insertInto('missions').values({
    mission_id: missionId,
    schema_version: 'mission.current.v1',
    creation_request_id: randomUUID(),
    project_id: projectId,
    owner_player_id: playerId,
    round_id: roundId,
    goal: 'Prove serialized Phase 7 history',
    ship_condition: 'Canonical accepted receipt',
    state: 'SUBMITTED',
    current_focus: 'Verify boundary',
    next_move: 'Accept Ship',
    blocker: null,
    progress_model_version: 'mission.progress.v1',
    stack_labels: [],
    stack_source: 'UNKNOWN',
  }).execute();
  await db.insertInto('ship_submissions').values({
    submission_id: submissionId,
    mission_id: missionId,
    project_id: projectId,
    owner_player_id: playerId,
    creation_request_id: randomUUID(),
    artifact_title: `Boundary Artifact ${label}`,
    artifact_url: `https://example.com/${label}`,
    demo_url: null,
    source_url: null,
    state: 'OBSERVED',
  }).execute();
  await db.insertInto('ship_verifier_observations').values({
    observation_id: observationId,
    submission_id: submissionId,
    outcome: 'PASS',
    reason_code: 'PUBLIC_HTTPS_OK',
    final_url: `https://example.com/${label}`,
    http_status: 200,
    duration_ms: 1,
    redirects: 0,
  }).execute();
  await db.insertInto('ship_acceptance_reviews').values({
    review_id: reviewId,
    submission_id: submissionId,
    creation_request_id: randomUUID(),
    decision: 'ACCEPT',
    reason: `Boundary review ${label}`,
    rule_version: 'ship.acceptance.v1',
  }).execute();

  return {
    playerId, projectId, missionId, submissionId, observationId, reviewId, receiptId,
    receiptValues: {
      receipt_id: receiptId,
      submission_id: submissionId,
      mission_id: missionId,
      project_id: projectId,
      owner_player_id: playerId,
      round_id: roundId,
      schema_version: 'inkubator.ship-receipt/1.0',
      acceptance_rule_version: 'ship.acceptance.v1',
      verifier_observation_id: observationId,
      acceptance_review_id: reviewId,
      artifact_title: `Boundary Artifact ${label}`,
      artifact_url: `https://example.com/${label}`,
      demo_url: null,
      // Deliberately wrong/old. The Phase-7 trigger must replace participant time/order.
      shipped_at: new Date(0),
    },
  };
}

test('Phase 7 serializes FIRST_BLOOD and external-test history at canonical DB boundaries', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const roundId = randomUUID();
  await db.insertInto('rounds').values({
    round_id: roundId,
    schema_version: 'round.current.v1',
    code: `BOUNDARY_${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    title: 'Phase 7 Boundary Round',
    constraint_text: 'Serialize durable history.',
    state: 'OPEN',
  }).execute();

  try {
    const first = await seedShipCandidate(db, roundId, 'first');
    const second = await seedShipCandidate(db, roundId, 'second');

    let releaseFirst;
    const firstHold = new Promise((resolve) => { releaseFirst = resolve; });
    let firstInsertedResolve;
    const firstInserted = new Promise((resolve) => { firstInsertedResolve = resolve; });

    const firstTransaction = db.transaction().execute(async (tx) => {
      const row = await tx.insertInto('ship_receipts').values(first.receiptValues).returningAll().executeTakeFirstOrThrow();
      firstInsertedResolve(row);
      await firstHold;
      return row;
    });

    const firstReceipt = await firstInserted;
    assert.notEqual(firstReceipt.shipped_at.getTime(), 0, 'Ship trigger must assign canonical shipped_at');
    assert.ok(Number(firstReceipt.project_boundary_order) > 0, 'Ship trigger must assign project boundary order');

    let secondPidResolve;
    const secondPidReady = new Promise((resolve) => { secondPidResolve = resolve; });
    const secondTransaction = db.transaction().execute(async (tx) => {
      secondPidResolve(await backendPid(tx));
      return tx.insertInto('ship_receipts').values(second.receiptValues).returningAll().executeTakeFirstOrThrow();
    });
    const secondPid = await secondPidReady;
    await waitForDatabaseLock(db, secondPid);

    // While the first canonical winner is uncommitted, the second receipt cannot become
    // visible and therefore cannot be materialized as FIRST_BLOOD by a public read.
    await reconcilePlayerCheevos(db, second.playerId);
    const prematureSecondAward = await db.selectFrom('player_cheevos')
      .select('award_id')
      .where('player_id', '=', second.playerId)
      .where('cheevo_key', '=', 'FIRST_BLOOD')
      .executeTakeFirst();
    assert.equal(prematureSecondAward, undefined);

    releaseFirst();
    const [committedFirst, committedSecond] = await Promise.all([firstTransaction, secondTransaction]);
    assert.ok(committedFirst.shipped_at.getTime() <= committedSecond.shipped_at.getTime());

    await reconcilePlayerCheevos(db, first.playerId);
    await reconcilePlayerCheevos(db, second.playerId);

    const canonical = await db.selectFrom('round_first_ship_receipts').selectAll().where('round_id', '=', roundId).executeTakeFirstOrThrow();
    assert.equal(canonical.receipt_id, first.receiptId);
    assert.equal(canonical.owner_player_id, first.playerId);

    const firstBloodAwards = await db.selectFrom('player_cheevos')
      .select(['player_id', 'source_id'])
      .where('cheevo_key', '=', 'FIRST_BLOOD')
      .where('rule_version', '=', 'cheevo.rules.v1')
      .where('source_id', 'in', [first.receiptId, second.receiptId])
      .execute();
    assert.deepEqual(firstBloodAwards, [{player_id: first.playerId, source_id: first.receiptId}]);

    // The second Project has already shipped. Hold its Project authority row, then prove
    // a later external-test insert waits and receives a strictly later DB order token.
    const testerId = randomUUID();
    const testRequestId = randomUUID();
    await db.insertInto('players').values({player_id: testerId, display_name: 'Boundary Tester'}).execute();
    await db.insertInto('external_test_requests').values({
      test_request_id: testRequestId,
      project_id: second.projectId,
      owner_player_id: second.playerId,
      creation_request_id: randomUUID(),
      prompt: 'Test the serialized boundary.',
      state: 'OPEN',
    }).execute();

    let releaseProject;
    const projectHold = new Promise((resolve) => { releaseProject = resolve; });
    let projectLockedResolve;
    const projectLocked = new Promise((resolve) => { projectLockedResolve = resolve; });
    const blocker = db.transaction().execute(async (tx) => {
      await tx.selectFrom('projects').select('project_id').where('project_id', '=', second.projectId).forUpdate().executeTakeFirstOrThrow();
      projectLockedResolve();
      await projectHold;
    });
    await projectLocked;

    const testResultId = randomUUID();
    let testPidResolve;
    const testPidReady = new Promise((resolve) => { testPidResolve = resolve; });
    const testInsert = db.transaction().execute(async (tx) => {
      testPidResolve(await backendPid(tx));
      return tx.insertInto('external_test_results').values({
        test_result_id: testResultId,
        test_request_id: testRequestId,
        project_id: second.projectId,
        tester_player_id: testerId,
        creation_request_id: randomUUID(),
        outcome: 'PASS',
        summary: 'Serialized result',
        // Deliberately stale. The trigger replaces timestamp and authoritative order.
        observed_at: new Date(0),
      }).returningAll().executeTakeFirstOrThrow();
    });
    const testPid = await testPidReady;
    await waitForDatabaseLock(db, testPid);
    releaseProject();
    await blocker;
    const committedTest = await testInsert;

    assert.ok(
      Number(committedTest.project_boundary_order) > Number(committedSecond.project_boundary_order),
      'Post-Ship external test must receive a later Project boundary order',
    );

    // Reproduce the rereview attack directly: even if the wall-clock value is exactly tied
    // with Ship, authority must still classify this committed-later result as post-Ship.
    await db.updateTable('external_test_results')
      .set({observed_at: committedSecond.shipped_at})
      .where('test_result_id', '=', testResultId)
      .execute();

    await reconcilePlayerCheevos(db, second.playerId);
    await reconcilePlayerCheevos(db, testerId);

    const touchGrass = await db.selectFrom('player_cheevos')
      .select('award_id')
      .where('player_id', '=', second.playerId)
      .where('cheevo_key', '=', 'TOUCH_GRASS')
      .executeTakeFirst();
    assert.equal(touchGrass, undefined, 'Post-Ship tied timestamp must not grant TOUCH_GRASS');

    const testerReputation = await getPlayerReputation(db, testerId);
    assert.ok(testerReputation);
    assert.equal(
      testerReputation.metrics.tested_shipped_projects,
      0,
      'Post-Ship tied timestamp must not count as a tested shipped Project',
    );
  } finally {
    // The application cannot erase Cheevos; test isolation deliberately truncates only
    // synthetic awards before deleting the synthetic Round and letting FK cascades work.
    await sql`truncate table player_cheevos`.execute(db);
    await db.deleteFrom('rounds').where('round_id', '=', roundId).execute();
    await db.destroy();
  }
});