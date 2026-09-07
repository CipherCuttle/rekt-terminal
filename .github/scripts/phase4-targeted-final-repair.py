from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_all_checked(path: str, old: str, new: str, minimum: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"expected at least {minimum} anchors in {path}, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new))


# --- github.ts: fail closed on bounded truncation and scope manifest projection to the canonical branch.
github = "apps/inkubator-api/src/github.ts"
old_manifest = '''function boundedManifestChanges(payload: Record<string, unknown>): {changes: ManifestChange[]; complete: boolean} {
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
'''
new_manifest = '''function canonicalManifestProjectionRef(repository: Record<string, unknown>, pushRef: string): string | null {
  const defaultBranch = repository.default_branch;
  if (typeof defaultBranch !== 'string' || defaultBranch.length < 1 || defaultBranch.length > 200) return null;
  const canonicalRef = `refs/heads/${defaultBranch}`;
  if (!REF_PATTERN.test(canonicalRef)) return null;
  return canonicalRef === pushRef ? canonicalRef : null;
}

function boundedManifestChanges(payload: Record<string, unknown>): {changes: ManifestChange[]; complete: boolean} {
  const commitsRaw = Array.isArray(payload.commits) ? payload.commits : [];
  const commits = commitsRaw.slice(0, 64);
  const changes = new Map<string, ManifestChange>();
  let complete = Array.isArray(payload.commits) && commitsRaw.length <= 64;
  if (
    typeof payload.size === 'number' && Number.isInteger(payload.size) && payload.size >= 0 &&
    payload.size > commitsRaw.length
  ) complete = false;
  for (const candidate of commits) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      complete = false;
      continue;
    }
    const commit = candidate as Record<string, unknown>;
    for (const key of ['added', 'modified', 'removed'] as const) {
      const rawValues = commit[key];
      if (!Array.isArray(rawValues)) {
        complete = false;
        continue;
      }
      if (rawValues.length > 128) complete = false;
      const values = rawValues.slice(0, 128);
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
'''
replace_once(github, old_manifest, new_manifest)
replace_once(
    github,
    "    const manifestChanges = boundedManifestChanges(payload);\n    const projectId = await findLinkedProjectIdForRepository(transaction, repositoryId);",
    "    const manifestProjectionRef = canonicalManifestProjectionRef(repository, ref);\n    const manifestChanges = manifestProjectionRef ? boundedManifestChanges(payload) : {changes: [], complete: true};\n    const projectId = await findLinkedProjectIdForRepository(transaction, repositoryId);",
)
replace_once(
    github,
    "          repository_private: repository.private,\n          manifest_changes: manifestChanges.changes,",
    "          repository_private: repository.private,\n          manifest_projection_ref: manifestProjectionRef,\n          manifest_changes: manifestChanges.changes,",
)

# --- database + migration: record which canonical ref the manifest projection belongs to.
database = "apps/inkubator-api/src/database.ts"
replace_once(
    database,
    "  observed_manifest_fingerprints: Generated<unknown>;\n  created_at: Generated<Date>;",
    "  observed_manifest_fingerprints: Generated<unknown>;\n  observed_manifest_ref: Generated<string | null>;\n  created_at: Generated<Date>;",
)

migration_path = Path("apps/inkubator-api/src/migrations/009-phase4-manifest-ref-scope.ts")
migration_path.write_text("""import type {Migration} from 'kysely/migration';

export const phase4ManifestRefScopeMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('projects')
      .addColumn('observed_manifest_ref', 'text')
      .execute();

    // Pre-repair manifest state may have mixed multiple branch refs. Fail closed once,
    // then rebuild only from future canonical/default-branch observations.
    await db
      .updateTable('projects')
      .set({observed_manifest_ref: null, observed_manifest_fingerprints: {}, observed_stack_labels: []})
      .execute();
  },
  async down(db) {
    await db.schema.alterTable('projects').dropColumn('observed_manifest_ref').execute();
  },
};
""")

migrations = "apps/inkubator-api/src/migrations.ts"
replace_once(
    migrations,
    "import {phase4ManifestTruthMigration} from './migrations/008-phase4-manifest-truth.js';",
    "import {phase4ManifestTruthMigration} from './migrations/008-phase4-manifest-truth.js';\nimport {phase4ManifestRefScopeMigration} from './migrations/009-phase4-manifest-ref-scope.js';",
)
replace_once(
    migrations,
    "      '008_phase4_manifest_truth': phase4ManifestTruthMigration,",
    "      '008_phase4_manifest_truth': phase4ManifestTruthMigration,\n      '009_phase4_manifest_ref_scope': phase4ManifestRefScopeMigration,",
)

# --- jobs.ts: carry canonical projection scope, reset on scope change, and match legacy v1 retries to v2 receipts.
jobs = "apps/inkubator-api/src/jobs.ts"
replace_once(
    jobs,
    "  repositoryPrivate: boolean;\n  manifestChanges: ProjectManifestChange[];",
    "  repositoryPrivate: boolean;\n  manifestProjectionRef: string | null;\n  manifestChanges: ProjectManifestChange[];",
)
replace_once(
    jobs,
    "      repositoryPrivate,\n      manifestChanges: [],",
    "      repositoryPrivate,\n      manifestProjectionRef: null,\n      manifestChanges: [],",
)
replace_once(
    jobs,
    "  const changesRaw = value.manifest_changes ?? [];\n  const complete = value.manifest_changes_complete;",
    "  const manifestProjectionRefRaw = value.manifest_projection_ref;\n  if (\n    manifestProjectionRefRaw !== undefined && manifestProjectionRefRaw !== null &&\n    (typeof manifestProjectionRefRaw !== 'string' || !REF_PATTERN.test(manifestProjectionRefRaw) || manifestProjectionRefRaw !== ref)\n  ) throw new Error('project_github_observation_payload_invalid');\n  const manifestProjectionRef = typeof manifestProjectionRefRaw === 'string' ? manifestProjectionRefRaw : null;\n  const changesRaw = value.manifest_changes ?? [];\n  const complete = value.manifest_changes_complete;",
)
replace_once(
    jobs,
    "    repositoryPrivate,\n    manifestChanges,\n    manifestChangesComplete: complete,",
    "    repositoryPrivate,\n    manifestProjectionRef,\n    manifestChanges,\n    manifestChangesComplete: complete,",
)
old_receipt = '''  if (input.schemaVersion === 'project.github_observation.job.v1') {
    if (value.schema_version !== 'project.github_repository_stack.observed.v1') return false;
    const stacks = value.observed_stacks;
    if (!Array.isArray(stacks) || stacks.some((stack) => !isDetectedStack(stack))) return false;
    const normalized = [...new Set(stacks as DetectedStack[])].sort();
    return canonicalizeJson(normalized).sha256 === canonicalizeJson(input.legacyObservedStacks).sha256;
  }
  if (value.schema_version !== 'project.github_repository_stack.observed.v2') return false;
  if (value.projection_complete !== input.manifestChangesComplete) return false;
'''
new_receipt = '''  if (input.schemaVersion === 'project.github_observation.job.v1') {
    if (value.schema_version !== 'project.github_repository_stack.observed.v2') return false;
    if (value.projection_complete !== false || (value.projection_ref ?? null) !== null) return false;
    if (!Array.isArray(value.manifest_changes) || value.manifest_changes.length !== 0) return false;
    const stacks = value.legacy_observed_stacks;
    if (!Array.isArray(stacks) || stacks.some((stack) => !isDetectedStack(stack))) return false;
    const normalized = [...new Set(stacks as DetectedStack[])].sort();
    return canonicalizeJson(normalized).sha256 === canonicalizeJson(input.legacyObservedStacks).sha256;
  }
  if (value.schema_version !== 'project.github_repository_stack.observed.v2') return false;
  if (value.projection_complete !== input.manifestChangesComplete) return false;
  if ((value.projection_ref ?? null) !== input.manifestProjectionRef) return false;
'''
replace_once(jobs, old_receipt, new_receipt)
replace_once(
    jobs,
    "      .select(['project_id', 'repository_id', 'observed_stack_labels', 'observed_manifest_fingerprints'])",
    "      .select(['project_id', 'repository_id', 'observed_stack_labels', 'observed_manifest_fingerprints', 'observed_manifest_ref'])",
)
old_projection = '''    if (payload.schemaVersion === 'project.github_observation.job.v2' && payload.manifestChanges.length === 0 && payload.manifestChangesComplete) return;

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
'''
new_projection = '''    if (payload.schemaVersion === 'project.github_observation.job.v2' && payload.manifestProjectionRef === null) return;
    const projectionRefChanged = payload.schemaVersion === 'project.github_observation.job.v2' && project.observed_manifest_ref !== payload.manifestProjectionRef;
    if (
      payload.schemaVersion === 'project.github_observation.job.v2' &&
      payload.manifestChanges.length === 0 && payload.manifestChangesComplete && !projectionRefChanged
    ) return;

    const previousObservedStacks = stackListFromProjection(project.observed_stack_labels);
    let manifestMap = manifestMapFromProjection(project.observed_manifest_fingerprints);
    let nextManifestRef: string | null = project.observed_manifest_ref;
    if (payload.schemaVersion === 'project.github_observation.job.v1') {
      manifestMap = {};
      nextManifestRef = null;
    } else if (!payload.manifestChangesComplete) {
      manifestMap = {};
      nextManifestRef = payload.manifestProjectionRef;
    } else {
      manifestMap = projectionRefChanged ? {} : {...manifestMap};
      nextManifestRef = payload.manifestProjectionRef;
      for (const change of payload.manifestChanges) {
        if (change.state === 'REMOVED') delete manifestMap[change.pathHash];
        else manifestMap[change.pathHash] = change.stack;
      }
    }
    const currentObservedStacks = [...new Set(Object.values(manifestMap))].sort();
'''
replace_once(jobs, old_projection, new_projection)
replace_once(
    jobs,
    "            manifest_changes: [],\n            projection_complete: false,",
    "            manifest_changes: [],\n            projection_complete: false,\n            projection_ref: null,",
)
replace_once(
    jobs,
    "            manifest_changes: manifestChanges,\n            projection_complete: payload.manifestChangesComplete,",
    "            manifest_changes: manifestChanges,\n            projection_complete: payload.manifestChangesComplete,\n            projection_ref: payload.manifestProjectionRef,",
)
replace_once(
    jobs,
    "      observed_manifest_fingerprints: manifestMap,\n      observed_stack_labels: currentObservedStacks,",
    "      observed_manifest_fingerprints: manifestMap,\n      observed_manifest_ref: nextManifestRef,\n      observed_stack_labels: currentObservedStacks,",
)

# --- integration regression coverage.
test_path = "apps/inkubator-api/test/integration/phase4-github-evidence-daemon.test.mjs"
replace_once(
    test_path,
    "import {runOneJob} from '../../dist/jobs.js';",
    "import {enqueueOutboxJob, PROJECT_GITHUB_OBSERVATION_JOB_TYPE, runOneJob} from '../../dist/jobs.js';",
)
replace_all_checked(
    test_path,
    "repository: {id: Number(repositoryId), private: true, full_name: fullName}",
    "repository: {id: Number(repositoryId), private: true, full_name: fullName, default_branch: 'main'}",
    minimum=6,
)

insert_anchor = """    const suspend = await sendWebhook(app, 'installation', {action: 'suspend', installation: {id: Number(installationId)}});
"""
insert_block = """    let targetedObservationCount = (await db.selectFrom('history_events').select('history_event_id')
      .where('event_type', '=', 'project.github_repository_push.observed')
      .where('subject_type', '=', 'project').where('subject_id', '=', projectId).execute()).length;

    const featureBranch = await sendWebhook(app, 'push', {
      ref: 'refs/heads/feature/ref-scope', before: '8'.repeat(40), after: '9'.repeat(40),
      installation: {id: Number(installationId)},
      repository: {id: Number(repositoryId), private: true, full_name: fullName, default_branch: 'main'},
      commits: [{added: ['composer.json'], modified: [], removed: ['go.mod']}],
    });
    assert.equal(featureBranch.statusCode, 202);
    targetedObservationCount = await drainOneProjectJob(db, projectId, targetedObservationCount);
    const afterFeatureBranch = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.deepEqual(afterFeatureBranch.json().github_evidence.observed_stacks, ['GO', 'PYTHON', 'RUST']);
    const scopedProjection = await db.selectFrom('projects').select(['observed_manifest_ref', 'observed_stack_labels'])
      .where('project_id', '=', projectId).executeTakeFirstOrThrow();
    assert.equal(scopedProjection.observed_manifest_ref, 'refs/heads/main');
    assert.deepEqual(scopedProjection.observed_stack_labels, ['GO', 'PYTHON', 'RUST']);

    const oversizedCommits = Array.from({length: 65}, (_, index) => ({
      added: [], modified: [], removed: index === 64 ? ['go.mod'] : [],
    }));
    const truncatedCommitPush = await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: '9'.repeat(40), after: 'a'.repeat(40), size: 65,
      installation: {id: Number(installationId)},
      repository: {id: Number(repositoryId), private: true, full_name: fullName, default_branch: 'main'},
      commits: oversizedCommits,
    });
    assert.equal(truncatedCommitPush.statusCode, 202);
    targetedObservationCount = await drainOneProjectJob(db, projectId, targetedObservationCount);
    const afterCommitTruncation = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.deepEqual(afterCommitTruncation.json().github_evidence.observed_stacks, []);

    const reseedMainManifest = await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: 'a'.repeat(40), after: 'b'.repeat(40), size: 1,
      installation: {id: Number(installationId)},
      repository: {id: Number(repositoryId), private: true, full_name: fullName, default_branch: 'main'},
      commits: [{added: ['package.json'], modified: [], removed: []}],
    });
    assert.equal(reseedMainManifest.statusCode, 202);
    targetedObservationCount = await drainOneProjectJob(db, projectId, targetedObservationCount);
    const afterReseed = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.deepEqual(afterReseed.json().github_evidence.observed_stacks, ['JAVASCRIPT_TYPESCRIPT']);

    const oversizedRemoved = Array.from({length: 128}, (_, index) => `docs/removed-${index}.txt`);
    oversizedRemoved.push('package.json');
    const truncatedFilesPush = await sendWebhook(app, 'push', {
      ref: 'refs/heads/main', before: 'b'.repeat(40), after: 'c'.repeat(40), size: 1,
      installation: {id: Number(installationId)},
      repository: {id: Number(repositoryId), private: true, full_name: fullName, default_branch: 'main'},
      commits: [{added: [], modified: [], removed: oversizedRemoved}],
    });
    assert.equal(truncatedFilesPush.statusCode, 202);
    targetedObservationCount = await drainOneProjectJob(db, projectId, targetedObservationCount);
    const afterFileTruncation = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.deepEqual(afterFileTruncation.json().github_evidence.observed_stacks, []);

    const legacyDeliveryId = randomUUID();
    await db.insertInto('github_deliveries').values({
      delivery_id: legacyDeliveryId,
      event_name: 'push',
      payload_hash: 'f'.repeat(64),
      installation_id: installationId,
      repository_id: repositoryId,
      received_at: new Date(Date.now() + 1000),
    }).execute();
    const legacyJob = await enqueueOutboxJob(db, {
      jobType: PROJECT_GITHUB_OBSERVATION_JOB_TYPE,
      idempotencyKey: `project.github_observation:${projectId}:${legacyDeliveryId}`,
      nextAttemptAt: new Date(0),
      payload: {
        schema_version: 'project.github_observation.job.v1',
        project_id: projectId,
        delivery_id: legacyDeliveryId,
        repository_id: repositoryId,
        ref: 'refs/heads/main',
        before: 'c'.repeat(40),
        after: 'd'.repeat(40),
        repository_private: true,
        observed_stacks: ['PYTHON'],
      },
    });
    const legacyFirst = await runOneJob(db, {leaseMs: 10, retryBaseMs: 1});
    assert.equal(legacyFirst.status, 'succeeded');
    const legacyStackDedupe = `evidence:project.github_repository_stack.observed:${projectId}:${legacyDeliveryId}`;
    const legacyReceipt = await db.selectFrom('history_events').select('payload').where('dedupe_key', '=', legacyStackDedupe).executeTakeFirstOrThrow();
    assert.equal(legacyReceipt.payload.schema_version, 'project.github_repository_stack.observed.v2');
    assert.deepEqual(legacyReceipt.payload.legacy_observed_stacks, ['PYTHON']);
    await db.updateTable('outbox_jobs').set({
      state: 'running', attempts: Math.max(1, legacyJob.attempts), locked_at: new Date(0), lock_token: randomUUID(), completed_at: null,
    }).where('job_id', '=', legacyJob.job_id).execute();
    const legacyRetry = await runOneJob(db, {leaseMs: 1, retryBaseMs: 1});
    assert.equal(legacyRetry.status, 'succeeded');
    const legacyReceiptsAfterRetry = await db.selectFrom('history_events').select('history_event_id').where('dedupe_key', '=', legacyStackDedupe).execute();
    assert.equal(legacyReceiptsAfterRetry.length, 1);

"""
replace_once(test_path, insert_anchor, insert_block + insert_anchor)

print('Phase 4 targeted final repair applied')
