from pathlib import Path

# 1) Allow trusted source time to be recorded on append-only history events.
events = Path('apps/inkubator-api/src/events.ts')
text = events.read_text()
old = """  actorPlayerId?: string | null;
  subjectType: string;
  subjectId: string;
}
"""
new = """  actorPlayerId?: string | null;
  subjectType: string;
  subjectId: string;
  occurredAt?: Date;
}
"""
if old not in text:
    raise SystemExit('events input anchor drifted')
text = text.replace(old, new, 1)
old = """      subject_type: input.subjectType,
      subject_id: input.subjectId,
    })
"""
new = """      subject_type: input.subjectType,
      subject_id: input.subjectId,
      ...(input.occurredAt ? {occurred_at: input.occurredAt} : {}),
    })
"""
if old not in text:
    raise SystemExit('events insert anchor drifted')
text = text.replace(old, new, 1)
events.write_text(text)

# 2) Add a bounded current-state Project projection for trusted observed stack labels.
database = Path('apps/inkubator-api/src/database.ts')
text = database.read_text()
old = """  name: string;
  repository_id: string | null;
  created_at: Generated<Date>;
"""
new = """  name: string;
  repository_id: string | null;
  observed_stack_labels: Generated<unknown>;
  created_at: Generated<Date>;
"""
if old not in text:
    raise SystemExit('project table type anchor drifted')
text = text.replace(old, new, 1)
database.write_text(text)

migration_path = Path('apps/inkubator-api/src/migrations/007-phase4-project-evidence-projection.ts')
if migration_path.exists():
    raise SystemExit('phase4 projection migration already exists')
migration_path.write_text("""import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase4ProjectEvidenceProjectionMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('projects')
      .addColumn('observed_stack_labels', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .execute();
    await sql`
      alter table projects
      add constraint projects_observed_stack_labels_array
      check (jsonb_typeof(observed_stack_labels) = 'array')
    `.execute(db);
    await sql`
      update projects project
      set observed_stack_labels = evidence.observed_stack_labels
      from (
        select
          history.subject_id::uuid as project_id,
          to_jsonb(array_agg(distinct stacks.stack_label order by stacks.stack_label)) as observed_stack_labels
        from history_events history
        cross join lateral jsonb_array_elements_text(history.payload -> 'observed_stacks') as stacks(stack_label)
        where history.event_type = 'project.github_repository_stack.observed'
          and history.subject_type = 'project'
        group by history.subject_id
      ) evidence
      where project.project_id = evidence.project_id
    `.execute(db);
  },
  async down(db) {
    await db.schema.alterTable('projects').dropColumn('observed_stack_labels').execute();
  },
};
""")

migrations = Path('apps/inkubator-api/src/migrations.ts')
text = migrations.read_text()
old = """import {playerMissionCommandMigration} from './migrations/006-player-mission-command.js';
"""
new = """import {playerMissionCommandMigration} from './migrations/006-player-mission-command.js';
import {phase4ProjectEvidenceProjectionMigration} from './migrations/007-phase4-project-evidence-projection.js';
"""
if old not in text:
    raise SystemExit('migration import anchor drifted')
text = text.replace(old, new, 1)
old = """      '006_player_mission_command': playerMissionCommandMigration,
"""
new = """      '006_player_mission_command': playerMissionCommandMigration,
      '007_phase4_project_evidence_projection': phase4ProjectEvidenceProjectionMigration,
"""
if old not in text:
    raise SystemExit('migration registry anchor drifted')
text = text.replace(old, new, 1)
migrations.write_text(text)

# 3) Serialize Project evidence materialization, use immutable delivery receipt time, and atomically update current stack projection.
jobs = Path('apps/inkubator-api/src/jobs.ts')
text = jobs.read_text()

anchor = """function stackListFromEvidencePayload(payload: unknown): DetectedStack[] {
"""
helper = """function sameStackReceiptMatches(payload: unknown, deliveryId: string, observedStacks: readonly DetectedStack[]): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const value = payload as Record<string, unknown>;
  if (value.schema_version !== 'project.github_repository_stack.observed.v1' || value.delivery_id !== deliveryId || value.truth_state !== 'OBSERVED') return false;
  const stacks = value.observed_stacks;
  if (!Array.isArray(stacks) || stacks.some((stack) => !isDetectedStack(stack))) return false;
  const normalized = [...new Set(stacks as DetectedStack[])].sort();
  return normalized.length === observedStacks.length && normalized.every((stack, index) => stack === observedStacks[index]);
}

function stackListFromProjection(value: unknown): DetectedStack[] {
  if (!Array.isArray(value) || value.length > 9 || value.some((stack) => !isDetectedStack(stack))) {
    throw new Error('project_github_stack_projection_invalid');
  }
  return [...new Set(value as DetectedStack[])].sort();
}

"""
if anchor not in text:
    raise SystemExit('stack helper anchor drifted')
text = text.replace(anchor, helper + anchor, 1)

start = text.index("async function handleProjectGitHubObservation(db: Kysely<DatabaseSchema>, job: OutboxJobRow): Promise<void> {")
end = text.index("\nasync function handleJob", start)
replacement = """async function handleProjectGitHubObservation(db: Kysely<DatabaseSchema>, job: OutboxJobRow): Promise<void> {
  const payload = projectObservationPayload(job.payload);
  await db.transaction().execute(async (transaction) => {
    const project = await transaction
      .selectFrom('projects')
      .select(['project_id', 'repository_id', 'observed_stack_labels'])
      .where('project_id', '=', payload.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!project || project.repository_id !== payload.repositoryId) throw new Error('project_github_observation_project_binding_invalid');

    const delivery = await transaction
      .selectFrom('github_deliveries')
      .select(['event_name', 'repository_id', 'received_at'])
      .where('delivery_id', '=', payload.deliveryId)
      .executeTakeFirst();
    if (!delivery || delivery.event_name !== 'push' || delivery.repository_id !== payload.repositoryId || !(delivery.received_at instanceof Date)) {
      throw new Error('project_github_observation_delivery_receipt_invalid');
    }

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'project.github_repository_push.observed',
      dedupeKey: `evidence:project.github_repository_push.observed:${payload.projectId}:${payload.deliveryId}`,
      actorPlayerId: null,
      subjectType: 'project',
      subjectId: payload.projectId,
      occurredAt: delivery.received_at,
      payload: {
        schema_version: 'project.github_repository_push.observed.v1',
        provider: 'github',
        delivery_id: payload.deliveryId,
        repository_id: payload.repositoryId,
        ref: payload.ref,
        before: payload.before,
        after: payload.after,
        repository_private: payload.repositoryPrivate,
        truth_state: 'OBSERVED',
      },
    });

    if (payload.observedStacks.length === 0) return;

    const previousObservedStacks = stackListFromProjection(project.observed_stack_labels);
    const currentObservedStacks = [...new Set([...previousObservedStacks, ...payload.observedStacks])].sort();
    const stackDedupeKey = `evidence:project.github_repository_stack.observed:${payload.projectId}:${payload.deliveryId}`;
    const existingStackReceipt = await transaction
      .selectFrom('history_events')
      .select('payload')
      .where('dedupe_key', '=', stackDedupeKey)
      .executeTakeFirst();
    if (existingStackReceipt) {
      if (!sameStackReceiptMatches(existingStackReceipt.payload, payload.deliveryId, payload.observedStacks)) {
        throw new Error('project_github_stack_history_invalid');
      }
      if (currentObservedStacks.length !== previousObservedStacks.length) {
        await transaction.updateTable('projects').set({observed_stack_labels: currentObservedStacks}).where('project_id', '=', payload.projectId).execute();
      }
      return;
    }

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'project.github_repository_stack.observed',
      dedupeKey: stackDedupeKey,
      actorPlayerId: null,
      subjectType: 'project',
      subjectId: payload.projectId,
      occurredAt: delivery.received_at,
      payload: {
        schema_version: 'project.github_repository_stack.observed.v1',
        provider: 'github',
        delivery_id: payload.deliveryId,
        observed_stacks: payload.observedStacks,
        previous_observed_stacks: previousObservedStacks,
        current_observed_stacks: currentObservedStacks,
        truth_state: 'OBSERVED',
      },
    });
    await transaction.updateTable('projects').set({observed_stack_labels: currentObservedStacks}).where('project_id', '=', payload.projectId).execute();
  });
}
"""
text = text[:start] + replacement + text[end:]
jobs.write_text(text)

# 4) Command reads the serialized current projection, while immutable history remains provenance/advisory context.
mission = Path('apps/inkubator-api/src/mission-command.ts')
text = mission.read_text()
anchor = """function stacksFromProjectEvidence(payload: unknown, key: 'previous_observed_stacks' | 'current_observed_stacks'): DetectedStack[] {
"""
helper = """function stacksFromProjectProjection(value: unknown): DetectedStack[] {
  if (!Array.isArray(value) || value.some((stack) => !isDetectedStack(stack))) return [];
  return [...new Set(value as DetectedStack[])].sort();
}

"""
if anchor not in text:
    raise SystemExit('command stack helper anchor drifted')
text = text.replace(anchor, helper + anchor, 1)
old = """  const observedStacks = stackObservation ? stacksFromProjectEvidence(stackObservation.payload, 'current_observed_stacks') : [];
  const previousObservedStacks = stackObservation ? stacksFromProjectEvidence(stackObservation.payload, 'previous_observed_stacks') : [];
"""
new = """  const observedStacks = stacksFromProjectProjection(project.observed_stack_labels);
  const previousObservedStacks = stackObservation ? stacksFromProjectEvidence(stackObservation.payload, 'previous_observed_stacks') : [];
"""
if old not in text:
    raise SystemExit('command observed stack projection anchor drifted')
text = text.replace(old, new, 1)
mission.write_text(text)

# 5) Strengthen the existing Phase-4 integration regression.
test = Path('apps/inkubator-api/test/integration/phase4-github-evidence-daemon.test.mjs')
text = test.read_text()
text = text.replace(
    "async function sendWebhook(app, eventName, payload) {\n  const raw = Buffer.from(JSON.stringify(payload), 'utf8');\n  return app.inject({method: 'POST', url: '/v1/github/webhook', headers: {\n    'content-type': 'application/json',\n    'x-github-delivery': randomUUID(),",
    "async function sendWebhook(app, eventName, payload, deliveryId = randomUUID()) {\n  const raw = Buffer.from(JSON.stringify(payload), 'utf8');\n  return app.inject({method: 'POST', url: '/v1/github/webhook', headers: {\n    'content-type': 'application/json',\n    'x-github-delivery': deliveryId,",
    1,
)

stale_anchor = """    assert.equal(privateStale.json().schema_version, 'project.private.v2');
    assert.equal(privateStale.json().observation_state, 'STALE');

    const freshPush = await sendWebhook(app, 'push', {
"""
delayed_block = """    assert.equal(privateStale.json().schema_version, 'project.private.v2');
    assert.equal(privateStale.json().observation_state, 'STALE');

    const delayedDeliveryId = randomUUID();
    const delayedPush = await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: '9'.repeat(40), after: 'a'.repeat(40),
      installation: {id: Number(installationId)},
      repository: {id: Number(repositoryId), private: true, full_name: fullName},
      commits: [],
    }, delayedDeliveryId);
    assert.equal(delayedPush.statusCode, 202);
    const delayedReceiptTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await db.updateTable('github_deliveries').set({received_at: delayedReceiptTime}).where('delivery_id', '=', delayedDeliveryId).execute();
    observationCount = await drainOneProjectJob(db, projectId, observationCount);
    assert.equal(observationCount, 2);
    const delayedMaterialization = await db.selectFrom('history_events').select(['occurred_at', 'payload'])
      .where('event_type', '=', 'project.github_repository_push.observed').where('subject_id', '=', projectId)
      .where('dedupe_key', '=', `evidence:project.github_repository_push.observed:${projectId}:${delayedDeliveryId}`).executeTakeFirstOrThrow();
    assert.equal(delayedMaterialization.occurred_at.getTime(), delayedReceiptTime.getTime());
    const stillStale = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.equal(stillStale.json().github_evidence.signal_state, 'STALE');
    assert.equal(stillStale.json().project.observation_state, 'STALE');

    const freshPush = await sendWebhook(app, 'push', {
"""
if stale_anchor not in text:
    raise SystemExit('delayed evidence test anchor drifted')
text = text.replace(stale_anchor, delayed_block, 1)
text = text.replace("    assert.equal(observationCount, 2);\n    const expandedStack", "    assert.equal(observationCount, 3);\n    const expandedStack", 1)

expanded_anchor = """    assert.match(expandedStack.json().daemon.scope_damage_warning, /PYTHON/);
    assert.equal(expandedStack.json().gates.every((gate) => gate.state === 'UNKNOWN'), true);

    const suspend = await sendWebhook(app, 'installation', {action: 'suspend', installation: {id: Number(installationId)}});
"""
concurrency_block = """    assert.match(expandedStack.json().daemon.scope_damage_warning, /PYTHON/);
    assert.equal(expandedStack.json().gates.every((gate) => gate.state === 'UNKNOWN'), true);

    const rustDeliveryId = randomUUID();
    const goDeliveryId = randomUUID();
    assert.equal((await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: '3'.repeat(40), after: '4'.repeat(40),
      installation: {id: Number(installationId)}, repository: {id: Number(repositoryId), private: true, full_name: fullName},
      commits: [{added: ['Cargo.toml'], modified: [], removed: []}],
    }, rustDeliveryId)).statusCode, 202);
    assert.equal((await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: '4'.repeat(40), after: '5'.repeat(40),
      installation: {id: Number(installationId)}, repository: {id: Number(repositoryId), private: true, full_name: fullName},
      commits: [{added: ['go.mod'], modified: [], removed: []}],
    }, goDeliveryId)).statusCode, 202);

    const blockerDb = createDatabase(databaseUrl);
    let releaseProjectLock;
    let projectLockReady;
    const projectLockReadyPromise = new Promise((resolve) => { projectLockReady = resolve; });
    const releaseProjectLockPromise = new Promise((resolve) => { releaseProjectLock = resolve; });
    const heldProjectLock = blockerDb.transaction().execute(async (transaction) => {
      await transaction.selectFrom('projects').select('project_id').where('project_id', '=', projectId).forUpdate().executeTakeFirstOrThrow();
      projectLockReady();
      await releaseProjectLockPromise;
    });
    await projectLockReadyPromise;
    const concurrentWorkers = [runOneJob(db, {leaseMs: 1000, retryBaseMs: 1}), runOneJob(db, {leaseMs: 1000, retryBaseMs: 1})];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const running = await db.selectFrom('outbox_jobs').select('job_id')
        .where('idempotency_key', 'in', [`project.github_observation:${projectId}:${rustDeliveryId}`, `project.github_observation:${projectId}:${goDeliveryId}`])
        .where('state', '=', 'running').execute();
      if (running.length === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (attempt === 99) throw new Error('phase4_concurrent_project_jobs_not_claimed');
    }
    releaseProjectLock();
    await heldProjectLock;
    const concurrentResults = await Promise.all(concurrentWorkers);
    assert.equal(concurrentResults.every((result) => result.status === 'succeeded'), true);
    await blockerDb.destroy();

    const concurrentCommand = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.deepEqual(concurrentCommand.json().github_evidence.observed_stacks, ['GO', 'JAVASCRIPT_TYPESCRIPT', 'PYTHON', 'RUST']);
    const projectedStacks = await db.selectFrom('projects').select('observed_stack_labels').where('project_id', '=', projectId).executeTakeFirstOrThrow();
    assert.deepEqual(projectedStacks.observed_stack_labels, ['GO', 'JAVASCRIPT_TYPESCRIPT', 'PYTHON', 'RUST']);
    const concurrentStackEvents = await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.github_repository_stack.observed').where('subject_id', '=', projectId).execute();
    assert.equal(concurrentStackEvents.length, 4);

    await db.updateTable('outbox_jobs').set({state: 'running', attempts: Math.max(1, firstObservationJob.attempts), locked_at: new Date(0), lock_token: randomUUID(), completed_at: null})
      .where('job_id', '=', firstObservationJob.job_id).execute();
    const oldRetryAfterNewerEvidence = await runOneJob(db, {leaseMs: 1, retryBaseMs: 1});
    assert.equal(oldRetryAfterNewerEvidence.status, 'succeeded');
    const stackEventsAfterLateRetry = await db.selectFrom('history_events').selectAll()
      .where('event_type', '=', 'project.github_repository_stack.observed').where('subject_id', '=', projectId).execute();
    assert.equal(stackEventsAfterLateRetry.length, 4);
    const projectionAfterLateRetry = await db.selectFrom('projects').select('observed_stack_labels').where('project_id', '=', projectId).executeTakeFirstOrThrow();
    assert.deepEqual(projectionAfterLateRetry.observed_stack_labels, ['GO', 'JAVASCRIPT_TYPESCRIPT', 'PYTHON', 'RUST']);

    const suspend = await sendWebhook(app, 'installation', {action: 'suspend', installation: {id: Number(installationId)}});
"""
if expanded_anchor not in text:
    raise SystemExit('concurrency test anchor drifted')
text = text.replace(expanded_anchor, concurrency_block, 1)
test.write_text(text)
