import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {appendHistoryEvent} from '../../dist/events.js';
import {createDevelopmentProject, getDevelopmentProject, linkDevelopmentProjectRepository} from '../../dist/projects.js';
import {getCurrentCommand} from '../../dist/mission-command.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');

function numericId(offset) {
  return String(BigInt(Date.now()) * 10000n + BigInt(Math.floor(Math.random() * 9000) + 1000 + offset));
}

async function cleanup(db, {playerId, projectId, missionId, installationId}) {
  await db.deleteFrom('history_events').where('actor_player_id', '=', playerId).execute();
  if (projectId) {
    await db.deleteFrom('mission_gates').where('mission_id', '=', missionId).execute();
    await db.deleteFrom('missions').where('mission_id', '=', missionId).execute();
    await db.deleteFrom('projects').where('project_id', '=', projectId).execute();
  }
  await db.deleteFrom('github_repositories').where('installation_id', '=', installationId).execute();
  await db.deleteFrom('github_installations').where('installation_id', '=', installationId).execute();
  await db.deleteFrom('players').where('player_id', '=', playerId).execute();
}

async function appendPushObservation(db, {projectId, playerId, repositoryId, deliveryId, occurredAt}) {
  return appendHistoryEvent(db, {
    eventFamily: 'evidence',
    eventType: 'project.github_repository_push.observed',
    dedupeKey: `evidence:project.github_repository_push.observed:${deliveryId}`,
    actorPlayerId: playerId,
    subjectType: 'project',
    subjectId: projectId,
    occurredAt,
    payload: {
      schema_version: 'project.github_repository_push.observed.v1',
      truth_state: 'OBSERVED',
      delivery_id: deliveryId,
      repository_id: repositoryId,
      repository_private: true,
      ref: 'refs/heads/main',
      before: '0'.repeat(40),
      after: '1'.repeat(40),
    },
  });
}

async function appendStackObservation(db, {projectId, playerId, deliveryId, stacks}) {
  return appendHistoryEvent(db, {
    eventFamily: 'evidence',
    eventType: 'project.github_repository_stack.observed',
    dedupeKey: `evidence:project.github_repository_stack.observed:${deliveryId}`,
    actorPlayerId: playerId,
    subjectType: 'project',
    subjectId: projectId,
    payload: {
      schema_version: 'project.github_repository_stack.observed.v1',
      truth_state: 'OBSERVED',
      delivery_id: deliveryId,
      ref: 'refs/heads/main',
      observed_at: new Date().toISOString(),
      previous_observed_stacks: [],
      current_observed_stacks: stacks,
    },
  });
}

test('changing Mission source retains history but current evidence restarts from the new repository', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);

  const playerId = randomUUID();
  const installationId = numericId(1);
  const repositoryA = numericId(2);
  const repositoryB = numericId(3);
  let projectId;
  let missionId;

  try {
    await db.insertInto('players').values({player_id: playerId, display_name: 'Source Switch Test'}).execute();
    await db.insertInto('github_installations').values({
      installation_id: installationId,
      player_id: playerId,
      github_user_id: numericId(4),
      account_id: numericId(5),
      account_type: 'User',
      repository_selection: 'selected',
      revoked_at: null,
    }).execute();
    await db.insertInto('github_repositories').values([
      {repository_id: repositoryA, installation_id: installationId, full_name: 'test/source-a', private: true, active: true},
      {repository_id: repositoryB, installation_id: installationId, full_name: 'test/source-b', private: true, active: true},
    ]).execute();

    const created = await createDevelopmentProject(db, playerId, {
      name: 'Source replacement fixture',
      goal: 'Keep provenance scoped to the active repository.',
      shipCondition: 'Current source evidence is isolated.',
      currentFocus: 'Observe source A.',
      nextMove: 'Switch to source B.',
    });
    projectId = created.projectId;
    missionId = created.missionId;

    await linkDevelopmentProjectRepository(db, projectId, playerId, repositoryA);
    const observedAt = new Date(Date.now() - 1000);
    await appendPushObservation(db, {projectId, playerId, repositoryId: repositoryA, deliveryId: randomUUID(), occurredAt: observedAt});
    await db.updateTable('projects').set({
      observed_stack_labels: ['JAVASCRIPT_TYPESCRIPT'],
      observed_manifest_fingerprints: {'package.json': 'source-a'},
      observed_manifest_ref: 'refs/heads/main',
    }).where('project_id', '=', projectId).execute();

    const before = await getCurrentCommand(db, playerId);
    assert.equal(before?.repository?.repository_id, repositoryA);
    assert.equal(before?.githubEvidence.signalState, 'OBSERVED');
    assert.deepEqual(before?.observedStacks, ['JAVASCRIPT_TYPESCRIPT']);

    const switched = await linkDevelopmentProjectRepository(db, projectId, playerId, repositoryB);
    assert.equal(switched.repository?.repository_id, repositoryB);
    assert.equal(switched.observation, null);
    assert.notEqual(switched.githubEvidence.signalState, 'OBSERVED');

    const stored = await db.selectFrom('projects').selectAll().where('project_id', '=', projectId).executeTakeFirstOrThrow();
    assert.deepEqual(stored.observed_stack_labels, []);
    assert.deepEqual(stored.observed_manifest_fingerprints, {});
    assert.equal(stored.observed_manifest_ref, null);

    const afterSwitch = await getCurrentCommand(db, playerId);
    assert.equal(afterSwitch?.repository?.repository_id, repositoryB);
    assert.notEqual(afterSwitch?.githubEvidence.signalState, 'OBSERVED');
    assert.deepEqual(afterSwitch?.observedStacks, []);

    const oldObservation = await db.selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', 'project.github_repository_push.observed')
      .where('subject_id', '=', projectId)
      .executeTakeFirstOrThrow();
    assert.equal(oldObservation.payload.repository_id, repositoryA);

    const linkHistory = await db.selectFrom('history_events')
      .select(['event_type', 'payload'])
      .where('event_type', '=', 'project.github_repository.linked')
      .where('subject_id', '=', projectId)
      .orderBy('occurred_at', 'asc')
      .execute();
    assert.equal(linkHistory.length, 2);
    assert.equal(linkHistory[1].payload.previous_repository_id, repositoryA);
    assert.equal(linkHistory[1].payload.repository_id, repositoryB);

    const deliveryB = randomUUID();
    await appendPushObservation(db, {projectId, playerId, repositoryId: repositoryB, deliveryId: deliveryB, occurredAt: new Date()});
    await appendStackObservation(db, {projectId, playerId, deliveryId: deliveryB, stacks: ['PYTHON']});
    await db.updateTable('projects').set({observed_stack_labels: ['PYTHON']}).where('project_id', '=', projectId).execute();

    const afterBObservation = await getCurrentCommand(db, playerId);
    assert.equal(afterBObservation?.repository?.repository_id, repositoryB);
    assert.equal(afterBObservation?.githubEvidence.signalState, 'OBSERVED');
    assert.deepEqual(afterBObservation?.observedStacks, ['PYTHON']);

    await db.updateTable('missions').set({state: 'SUBMITTED'}).where('mission_id', '=', missionId).execute();
    await assert.rejects(
      () => linkDevelopmentProjectRepository(db, projectId, playerId, repositoryA),
      /project_repository_already_linked/,
    );
  } finally {
    await cleanup(db, {playerId, projectId, missionId, installationId});
    await db.destroy();
  }
});
