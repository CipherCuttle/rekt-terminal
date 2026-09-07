from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'anchor drifted: {path}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))

# P2: canonical Mission gate key.
replace_once(
    'apps/inkubator-api/src/evidence.ts',
    "export type ProgressGateKey = 'FOUNDATION' | 'CORE_EXPERIENCE' | 'QUALITY' | 'SHIPABILITY';",
    "export type ProgressGateKey = 'FOUNDATION' | 'CORE_EXPERIENCE' | 'QUALITY_TESTING' | 'SHIPABILITY';",
)
replace_once(
    'apps/inkubator-api/src/evidence.ts',
    "      gateKey: 'QUALITY',",
    "      gateKey: 'QUALITY_TESTING',",
)
replace_once(
    'apps/inkubator-api/test/unit/evidence.test.mjs',
    "    gateKey: 'QUALITY',",
    "    gateKey: 'QUALITY_TESTING',",
)

# P2: generated array item unions must be parenthesized.
replace_once(
    'apps/inkubator-api/src/generate-client.ts',
    "  if (schema.type === 'array') return `${schema.items ? schemaType(schema.items) : 'unknown'}[]`;",
    """  if (schema.type === 'array') {
    const itemType = schema.items ? schemaType(schema.items) : 'unknown';
    return `${itemType.includes(' | ') ? `(${itemType})` : itemType}[]`;
  }""",
)
Path('apps/inkubator-api/test/unit/generated-client-contract.test.mjs').write_text("""import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('generated enum-array unions are parenthesized before []', () => {
  const target = new URL('../../../inkubator-lab/src/generated/inkubator-api-client.ts', import.meta.url);
  const source = fs.readFileSync(target, 'utf8');
  const stackLines = source.split('\\n').filter((line) => line.includes('observed_stacks:'));
  assert.ok(stackLines.length > 0);
  for (const line of stackLines) assert.match(line, /observed_stacks: \\(.+\\)\\[\\];/);
});
""")

# P1/P2: retain only privacy-preserving manifest fingerprints in current Project state.
replace_once(
    'apps/inkubator-api/src/database.ts',
    "  observed_stack_labels: Generated<unknown>;\n  created_at: Generated<Date>;",
    "  observed_stack_labels: Generated<unknown>;\n  observed_manifest_fingerprints: Generated<unknown>;\n  created_at: Generated<Date>;",
)

migration = Path('apps/inkubator-api/src/migrations/008-phase4-manifest-truth.ts')
if migration.exists():
    raise SystemExit('008 migration already exists')
migration.write_text("""import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase4ManifestTruthMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('projects')
      .addColumn('observed_manifest_fingerprints', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .execute();
    await sql`
      alter table projects
      add constraint projects_observed_manifest_fingerprints_object
      check (jsonb_typeof(observed_manifest_fingerprints) = 'object')
    `.execute(db);

    // Legacy Phase-4 stack labels have no path identity, so they cannot be safely retracted.
    // Fail closed rather than preserving an unremovable positive stack claim.
    await sql`update projects set observed_stack_labels = '[]'::jsonb`.execute(db);
  },
  async down(db) {
    await db.schema.alterTable('projects').dropColumn('observed_manifest_fingerprints').execute();
  },
};
""")
replace_once(
    'apps/inkubator-api/src/migrations.ts',
    "import {phase4ProjectEvidenceProjectionMigration} from './migrations/007-phase4-project-evidence-projection.js';",
    "import {phase4ProjectEvidenceProjectionMigration} from './migrations/007-phase4-project-evidence-projection.js';\nimport {phase4ManifestTruthMigration} from './migrations/008-phase4-manifest-truth.js';",
)
replace_once(
    'apps/inkubator-api/src/migrations.ts',
    "      '007_phase4_project_evidence_projection': phase4ProjectEvidenceProjectionMigration,",
    "      '007_phase4_project_evidence_projection': phase4ProjectEvidenceProjectionMigration,\n      '008_phase4_manifest_truth': phase4ManifestTruthMigration,",
)

# P1: inspect added/modified/removed manifest paths, persist only hashes + allowlisted stack enums.
replace_once(
    'apps/inkubator-api/src/github.ts',
    "import {detectStackFromManifestPaths} from './evidence.js';",
    "import {detectStackFromManifestPaths, type DetectedStack} from './evidence.js';",
)
old_helper = """function boundedChangedManifestCandidatePaths(payload: Record<string, unknown>): string[] {
  const commits = Array.isArray(payload.commits) ? payload.commits.slice(0, 64) : [];
  const paths = new Set<string>();
  for (const candidate of commits) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const commit = candidate as Record<string, unknown>;
    for (const key of ['added', 'modified'] as const) {
      const values = Array.isArray(commit[key]) ? commit[key].slice(0, 128) : [];
      for (const value of values) {
        if (typeof value !== 'string' || value.length < 1 || value.length > 300) continue;
        paths.add(value);
        if (paths.size >= 128) return [...paths];
      }
    }
  }
  return [...paths];
}
"""
new_helper = """type ManifestChange = {
  path_hash: string;
  stack: DetectedStack;
  state: 'PRESENT' | 'REMOVED';
};

function boundedManifestChanges(payload: Record<string, unknown>): {changes: ManifestChange[]; complete: boolean} {
  const commits = Array.isArray(payload.commits) ? payload.commits.slice(0, 64) : [];
  const changes = new Map<string, ManifestChange>();
  let complete = true;
  for (const candidate of commits) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const commit = candidate as Record<string, unknown>;
    for (const key of ['added', 'modified', 'removed'] as const) {
      const values = Array.isArray(commit[key]) ? commit[key].slice(0, 128) : [];
      for (const value of values) {
        if (typeof value !== 'string' || value.length < 1 || value.length > 300) continue;
        const detection = detectStackFromManifestPaths([value]);
        for (const detected of detection.detections) {
          for (const evidencePath of detected.evidencePaths) {
            const pathHash = createHash('sha256').update(evidencePath, 'utf8').digest('hex');
            if (!changes.has(pathHash) && changes.size >= 128) {
              complete = false;
              continue;
            }
            changes.set(pathHash, {
              path_hash: pathHash,
              stack: detected.stack,
              state: key === 'removed' ? 'REMOVED' : 'PRESENT',
            });
          }
        }
      }
    }
  }
  return {
    changes: [...changes.values()].sort((left, right) => left.path_hash.localeCompare(right.path_hash)),
    complete,
  };
}
"""
replace_once('apps/inkubator-api/src/github.ts', old_helper, new_helper)
replace_once(
    'apps/inkubator-api/src/github.ts',
    """    const stackDetection = detectStackFromManifestPaths(boundedChangedManifestCandidatePaths(payload));
    const observedStacks = stackDetection.detections.map((detection) => detection.stack);
    const projectId = await findLinkedProjectIdForRepository(transaction, repositoryId);""",
    """    const manifestChanges = boundedManifestChanges(payload);
    const projectId = await findLinkedProjectIdForRepository(transaction, repositoryId);""",
)
replace_once(
    'apps/inkubator-api/src/github.ts',
    """          schema_version: 'project.github_observation.job.v1',
          project_id: projectId,
          delivery_id: deliveryId,
          repository_id: repositoryId,
          ref,
          before,
          after,
          repository_private: repository.private,
          observed_stacks: observedStacks,""",
    """          schema_version: 'project.github_observation.job.v2',
          project_id: projectId,
          delivery_id: deliveryId,
          repository_id: repositoryId,
          ref,
          before,
          after,
          repository_private: repository.private,
          manifest_changes: manifestChanges.changes,
          manifest_changes_complete: manifestChanges.complete,""",
)

# P1/P2 worker repair: delivery-order serialization + retractable fingerprint map.
jobs = Path('apps/inkubator-api/src/jobs.ts')
text = jobs.read_text()
start = text.index('function projectObservationPayload(payload: unknown) {')
end = text.index('\nasync function handleSessionExpiry', start)
helpers = r'''type ProjectManifestChange = {
  pathHash: string;
  stack: DetectedStack;
  state: 'PRESENT' | 'REMOVED';
};

type ProjectObservationPayload = {
  schemaVersion: 'project.github_observation.job.v1' | 'project.github_observation.job.v2';
  projectId: string;
  deliveryId: string;
  repositoryId: string;
  ref: string;
  before: string;
  after: string;
  repositoryPrivate: boolean;
  manifestChanges: ProjectManifestChange[];
  manifestChangesComplete: boolean;
  legacyObservedStacks: DetectedStack[];
};

function projectObservationPayload(payload: unknown): ProjectObservationPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('project_github_observation_payload_invalid');
  const value = payload as Record<string, unknown>;
  const schemaVersion = value.schema_version;
  const projectId = value.project_id;
  const deliveryId = value.delivery_id;
  const repositoryId = value.repository_id;
  const ref = value.ref;
  const before = value.before;
  const after = value.after;
  const repositoryPrivate = value.repository_private;
  if (schemaVersion !== 'project.github_observation.job.v1' && schemaVersion !== 'project.github_observation.job.v2') {
    throw new Error('project_github_observation_payload_invalid');
  }
  if (typeof projectId !== 'string' || !UUID_PATTERN.test(projectId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof deliveryId !== 'string' || !DELIVERY_PATTERN.test(deliveryId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof repositoryId !== 'string' || !/^[1-9]\d*$/.test(repositoryId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof ref !== 'string' || !REF_PATTERN.test(ref)) throw new Error('project_github_observation_payload_invalid');
  if (typeof before !== 'string' || !GIT_SHA_PATTERN.test(before)) throw new Error('project_github_observation_payload_invalid');
  if (typeof after !== 'string' || !GIT_SHA_PATTERN.test(after)) throw new Error('project_github_observation_payload_invalid');
  if (typeof repositoryPrivate !== 'boolean') throw new Error('project_github_observation_payload_invalid');

  if (schemaVersion === 'project.github_observation.job.v1') {
    const observedStacksRaw = value.observed_stacks ?? [];
    if (!Array.isArray(observedStacksRaw) || observedStacksRaw.length > 9 || observedStacksRaw.some((stack) => !isDetectedStack(stack))) {
      throw new Error('project_github_observation_payload_invalid');
    }
    return {
      schemaVersion,
      projectId,
      deliveryId,
      repositoryId,
      ref,
      before,
      after,
      repositoryPrivate,
      manifestChanges: [],
      manifestChangesComplete: false,
      legacyObservedStacks: [...new Set(observedStacksRaw as DetectedStack[])].sort(),
    };
  }

  const changesRaw = value.manifest_changes ?? [];
  const complete = value.manifest_changes_complete;
  if (!Array.isArray(changesRaw) || changesRaw.length > 128 || typeof complete !== 'boolean') {
    throw new Error('project_github_observation_payload_invalid');
  }
  const seen = new Set<string>();
  const manifestChanges: ProjectManifestChange[] = [];
  for (const raw of changesRaw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('project_github_observation_payload_invalid');
    const change = raw as Record<string, unknown>;
    if (typeof change.path_hash !== 'string' || !/^[0-9a-f]{64}$/.test(change.path_hash)) throw new Error('project_github_observation_payload_invalid');
    if (!isDetectedStack(change.stack)) throw new Error('project_github_observation_payload_invalid');
    if (change.state !== 'PRESENT' && change.state !== 'REMOVED') throw new Error('project_github_observation_payload_invalid');
    if (seen.has(change.path_hash)) throw new Error('project_github_observation_payload_invalid');
    seen.add(change.path_hash);
    manifestChanges.push({pathHash: change.path_hash, stack: change.stack, state: change.state});
  }
  manifestChanges.sort((left, right) => left.pathHash.localeCompare(right.pathHash));
  return {
    schemaVersion,
    projectId,
    deliveryId,
    repositoryId,
    ref,
    before,
    after,
    repositoryPrivate,
    manifestChanges,
    manifestChangesComplete: complete,
    legacyObservedStacks: [],
  };
}

function stackListFromProjection(value: unknown): DetectedStack[] {
  if (!Array.isArray(value) || value.length > 9 || value.some((stack) => !isDetectedStack(stack))) {
    throw new Error('project_github_stack_projection_invalid');
  }
  return [...new Set(value as DetectedStack[])].sort();
}

function manifestMapFromProjection(value: unknown): Record<string, DetectedStack> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('project_github_manifest_projection_invalid');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 4096) throw new Error('project_github_manifest_projection_invalid');
  const result: Record<string, DetectedStack> = {};
  for (const [pathHash, stack] of entries) {
    if (!/^[0-9a-f]{64}$/.test(pathHash) || !isDetectedStack(stack)) throw new Error('project_github_manifest_projection_invalid');
    result[pathHash] = stack;
  }
  return result;
}

function receiptMatches(payload: unknown, input: ProjectObservationPayload): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const value = payload as Record<string, unknown>;
  if (value.delivery_id !== input.deliveryId) return false;
  if (input.schemaVersion === 'project.github_observation.job.v1') {
    if (value.schema_version !== 'project.github_repository_stack.observed.v1') return false;
    const stacks = value.observed_stacks;
    if (!Array.isArray(stacks) || stacks.some((stack) => !isDetectedStack(stack))) return false;
    const normalized = [...new Set(stacks as DetectedStack[])].sort();
    return canonicalizeJson(normalized).sha256 === canonicalizeJson(input.legacyObservedStacks).sha256;
  }
  if (value.schema_version !== 'project.github_repository_stack.observed.v2') return false;
  if (value.projection_complete !== input.manifestChangesComplete) return false;
  const rawChanges = value.manifest_changes;
  if (!Array.isArray(rawChanges)) return false;
  const expected = input.manifestChanges.map((change) => ({path_hash: change.pathHash, stack: change.stack, state: change.state}));
  return canonicalizeJson(rawChanges).sha256 === canonicalizeJson(expected).sha256;
}

async function requireDeliveryOrder(
  db: Kysely<DatabaseSchema>,
  job: OutboxJobRow,
  input: ProjectObservationPayload,
  receivedAt: Date,
): Promise<void> {
  const earlier = await sql<{state: OutboxJobState}>`
    select pending.state
    from outbox_jobs pending
    join github_deliveries delivery on delivery.delivery_id = pending.payload ->> 'delivery_id'
    where pending.job_type = ${PROJECT_GITHUB_OBSERVATION_JOB_TYPE}
      and pending.job_id <> ${job.job_id}
      and pending.payload ->> 'project_id' = ${input.projectId}
      and pending.state <> 'succeeded'
      and (
        delivery.received_at < ${receivedAt}
        or (delivery.received_at = ${receivedAt} and delivery.delivery_id < ${input.deliveryId})
      )
    order by delivery.received_at asc, delivery.delivery_id asc
    limit 1
  `.execute(db);
  const state = earlier.rows[0]?.state;
  if (!state) return;
  if (state === 'failed') throw new Error('project_github_observation_earlier_delivery_failed');
  throw new Error('project_github_observation_waiting_for_earlier_delivery');
}
'''
text = text[:start] + helpers + text[end:]
jobs.write_text(text)

# Replace worker handler wholesale.
text = jobs.read_text()
start = text.index('async function handleProjectGitHubObservation(db: Kysely<DatabaseSchema>, job: OutboxJobRow): Promise<void> {')
end = text.index('\nasync function handleJob', start)
handler = r'''async function handleProjectGitHubObservation(db: Kysely<DatabaseSchema>, job: OutboxJobRow): Promise<void> {
  const payload = projectObservationPayload(job.payload);
  await db.transaction().execute(async (transaction) => {
    const project = await transaction
      .selectFrom('projects')
      .select(['project_id', 'repository_id', 'observed_stack_labels', 'observed_manifest_fingerprints'])
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

    await requireDeliveryOrder(transaction, job, payload, delivery.received_at);

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

    const stackDedupeKey = `evidence:project.github_repository_stack.observed:${payload.projectId}:${payload.deliveryId}`;
    const existingStackReceipt = await transaction
      .selectFrom('history_events')
      .select('payload')
      .where('dedupe_key', '=', stackDedupeKey)
      .executeTakeFirst();
    if (existingStackReceipt) {
      if (!receiptMatches(existingStackReceipt.payload, payload)) throw new Error('project_github_stack_history_invalid');
      return;
    }

    if (payload.schemaVersion === 'project.github_observation.job.v2' && payload.manifestChanges.length === 0 && payload.manifestChangesComplete) return;

    const previousObservedStacks = stackListFromProjection(project.observed_stack_labels);
    let manifestMap = manifestMapFromProjection(project.observed_manifest_fingerprints);
    if (payload.schemaVersion === 'project.github_observation.job.v1' || !payload.manifestChangesComplete) {
      manifestMap = {};
    } else {
      manifestMap = {...manifestMap};
      for (const change of payload.manifestChanges) {
        if (change.state === 'REMOVED') delete manifestMap[change.pathHash];
        else manifestMap[change.pathHash] = change.stack;
      }
    }
    const currentObservedStacks = [...new Set(Object.values(manifestMap))].sort();
    const manifestChanges = payload.manifestChanges.map((change) => ({path_hash: change.pathHash, stack: change.stack, state: change.state}));

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'project.github_repository_stack.observed',
      dedupeKey: stackDedupeKey,
      actorPlayerId: null,
      subjectType: 'project',
      subjectId: payload.projectId,
      occurredAt: delivery.received_at,
      payload: payload.schemaVersion === 'project.github_observation.job.v1'
        ? {
            schema_version: 'project.github_repository_stack.observed.v2',
            provider: 'github',
            delivery_id: payload.deliveryId,
            manifest_changes: [],
            projection_complete: false,
            previous_observed_stacks: previousObservedStacks,
            current_observed_stacks: currentObservedStacks,
            legacy_observed_stacks: payload.legacyObservedStacks,
            truth_state: 'OBSERVED',
          }
        : {
            schema_version: 'project.github_repository_stack.observed.v2',
            provider: 'github',
            delivery_id: payload.deliveryId,
            manifest_changes: manifestChanges,
            projection_complete: payload.manifestChangesComplete,
            previous_observed_stacks: previousObservedStacks,
            current_observed_stacks: currentObservedStacks,
            truth_state: 'OBSERVED',
          },
    });
    await transaction.updateTable('projects').set({
      observed_manifest_fingerprints: manifestMap,
      observed_stack_labels: currentObservedStacks,
    }).where('project_id', '=', payload.projectId).execute();
  });
}
'''
text = text[:start] + handler + text[end:]
jobs.write_text(text)

# Fix retry compatibility: v1 historical receipts are matched before any current projection mutation.
# Also make latest stack event tie-breaking use trusted delivery id, not random history UUID.
replace_once(
    'apps/inkubator-api/src/mission-command.ts',
    """    .orderBy('occurred_at', 'desc')
    .orderBy('history_event_id', 'desc')
    .executeTakeFirst();
  const observedStacks = stacksFromProjectProjection(project.observed_stack_labels);""",
    """    .orderBy('occurred_at', 'desc')
    .orderBy(sql<string>`payload ->> 'delivery_id'`, 'desc')
    .executeTakeFirst();
  const observedStacks = stacksFromProjectProjection(project.observed_stack_labels);""",
)

# Focused integration: force later GO job to claim first, verify it defers to earlier RUST,
# then verify manifest deletion retracts stack only after the last tracked manifest disappears.
test_path = Path('apps/inkubator-api/test/integration/phase4-github-evidence-daemon.test.mjs')
test = test_path.read_text()
old_concurrency = """    const blockerDb = createDatabase(databaseUrl);
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
"""
new_concurrency = """    const rustJobKey = `project.github_observation:${projectId}:${rustDeliveryId}`;
    const goJobKey = `project.github_observation:${projectId}:${goDeliveryId}`;
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(Date.now() - 2000)}).where('idempotency_key', '=', goJobKey).execute();
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(Date.now() - 1000)}).where('idempotency_key', '=', rustJobKey).execute();

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

    const laterGoWorker = runOneJob(db, {leaseMs: 1000, retryBaseMs: 1});
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const go = await db.selectFrom('outbox_jobs').select('state').where('idempotency_key', '=', goJobKey).executeTakeFirstOrThrow();
      if (go.state === 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (attempt === 99) throw new Error('phase4_later_job_not_claimed_first');
    }
    const earlierRustWorker = runOneJob(db, {leaseMs: 1000, retryBaseMs: 1});
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rust = await db.selectFrom('outbox_jobs').select('state').where('idempotency_key', '=', rustJobKey).executeTakeFirstOrThrow();
      if (rust.state === 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (attempt === 99) throw new Error('phase4_earlier_job_not_claimed');
    }
    releaseProjectLock();
    await heldProjectLock;
    const [laterResult, earlierResult] = await Promise.all([laterGoWorker, earlierRustWorker]);
    assert.equal(laterResult.status, 'retry');
    assert.equal(earlierResult.status, 'succeeded');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const goRetry = await runOneJob(db, {leaseMs: 1000, retryBaseMs: 1});
    assert.equal(goRetry.status, 'succeeded');
    await blockerDb.destroy();

    const goStackEvent = await db.selectFrom('history_events').select('payload')
      .where('dedupe_key', '=', `evidence:project.github_repository_stack.observed:${projectId}:${goDeliveryId}`).executeTakeFirstOrThrow();
    assert.deepEqual(goStackEvent.payload.previous_observed_stacks, ['JAVASCRIPT_TYPESCRIPT', 'PYTHON', 'RUST']);

    const concurrentCommand = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
"""
if old_concurrency not in test:
    raise SystemExit('concurrency test anchor drifted')
test = test.replace(old_concurrency, new_concurrency, 1)

insert_anchor = """    const projectionAfterLateRetry = await db.selectFrom('projects').select('observed_stack_labels').where('project_id', '=', projectId).executeTakeFirstOrThrow();
    assert.deepEqual(projectionAfterLateRetry.observed_stack_labels, ['GO', 'JAVASCRIPT_TYPESCRIPT', 'PYTHON', 'RUST']);

    const suspend = await sendWebhook(app, 'installation', {action: 'suspend', installation: {id: Number(installationId)}});
"""
delete_regression = """    const projectionAfterLateRetry = await db.selectFrom('projects').select('observed_stack_labels').where('project_id', '=', projectId).executeTakeFirstOrThrow();
    assert.deepEqual(projectionAfterLateRetry.observed_stack_labels, ['GO', 'JAVASCRIPT_TYPESCRIPT', 'PYTHON', 'RUST']);

    const secondJsManifest = await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: '5'.repeat(40), after: '6'.repeat(40),
      installation: {id: Number(installationId)}, repository: {id: Number(repositoryId), private: true, full_name: fullName},
      commits: [{added: ['apps/web/package.json'], modified: [], removed: []}],
    });
    assert.equal(secondJsManifest.statusCode, 202);
    await drainOneProjectJob(db, projectId, 5);

    const removeOneJsManifest = await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: '6'.repeat(40), after: '7'.repeat(40),
      installation: {id: Number(installationId)}, repository: {id: Number(repositoryId), private: true, full_name: fullName},
      commits: [{added: [], modified: [], removed: ['package.json']}],
    });
    assert.equal(removeOneJsManifest.statusCode, 202);
    await drainOneProjectJob(db, projectId, 6);
    const afterOneRemoval = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.equal(afterOneRemoval.json().github_evidence.observed_stacks.includes('JAVASCRIPT_TYPESCRIPT'), true);

    const removeLastJsManifest = await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: '7'.repeat(40), after: '8'.repeat(40),
      installation: {id: Number(installationId)}, repository: {id: Number(repositoryId), private: true, full_name: fullName},
      commits: [{added: [], modified: [], removed: ['apps/web/package.json']}],
    });
    assert.equal(removeLastJsManifest.statusCode, 202);
    await drainOneProjectJob(db, projectId, 7);
    const afterLastRemoval = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.deepEqual(afterLastRemoval.json().github_evidence.observed_stacks, ['GO', 'PYTHON', 'RUST']);
    assert.equal(JSON.stringify(afterLastRemoval.json()).includes('package.json'), false);
    const manifestProjection = await db.selectFrom('projects').select('observed_manifest_fingerprints').where('project_id', '=', projectId).executeTakeFirstOrThrow();
    assert.equal(JSON.stringify(manifestProjection).includes('package.json'), false);

    const suspend = await sendWebhook(app, 'installation', {action: 'suspend', installation: {id: Number(installationId)}});
"""
if insert_anchor not in test:
    raise SystemExit('deletion regression anchor drifted')
test = test.replace(insert_anchor, delete_regression, 1)
test_path.write_text(test)
