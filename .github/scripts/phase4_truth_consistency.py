from pathlib import Path

# Centralize the trusted push -> freshness classifier so Command and Project cannot drift.
evidence = Path('apps/inkubator-api/src/evidence.ts')
text = evidence.read_text()
anchor = "export const DAEMON_ADVISORY_RULE_VERSION = 'daemon-advisory.v1' as const;\n"
insert = anchor + "export const GITHUB_PUSH_EVIDENCE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;\n"
if anchor not in text:
    raise SystemExit('evidence rule anchor drifted')
text = text.replace(anchor, insert, 1)
classify_anchor = "export type DetectedStack =\n"
helper = """export function classifyGitHubPushEvidence(input: {
  observationId?: string;
  observedAt?: string | Date;
  sourceAvailable: boolean;
  now: string | number | Date;
}): GitHubEvidenceSnapshot {
  if ((input.observationId === undefined) !== (input.observedAt === undefined)) {
    throw new Error('github_push_evidence_observation_incomplete');
  }
  return classifyGitHubEvidence({
    observations: input.observationId && input.observedAt ? [{
      observationId: input.observationId,
      kind: 'PUSH',
      outcome: 'OBSERVED',
      observedAt: input.observedAt instanceof Date ? input.observedAt.toISOString() : input.observedAt,
    }] : [],
    sourceAvailable: input.sourceAvailable,
    now: input.now,
    staleAfterMs: GITHUB_PUSH_EVIDENCE_STALE_AFTER_MS,
  });
}

"""
if classify_anchor not in text:
    raise SystemExit('evidence stack anchor drifted')
text = text.replace(classify_anchor, helper + classify_anchor, 1)
evidence.write_text(text)

# Reuse the classifier in Command.
mission = Path('apps/inkubator-api/src/mission-command.ts')
text = mission.read_text()
text = text.replace(
    "import {classifyGitHubEvidence, deriveDaemonAdvisory, type DaemonAdvisory, type GitHubEvidenceSnapshot} from './evidence.js';",
    "import {classifyGitHubPushEvidence, deriveDaemonAdvisory, type DaemonAdvisory, type GitHubEvidenceSnapshot} from './evidence.js';",
    1,
)
text = text.replace("const COMMAND_GITHUB_EVIDENCE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;\n", "", 1)
old = """  const githubEvidence = classifyGitHubEvidence({
    observations: observation ? [{
      observationId: observation.history_event_id,
      kind: 'PUSH',
      outcome: 'OBSERVED',
      observedAt: observation.occurred_at.toISOString(),
    }] : [],
    sourceAvailable: Boolean(repository?.active),
    now: await readDatabaseNow(db),
    staleAfterMs: COMMAND_GITHUB_EVIDENCE_STALE_AFTER_MS,
  });
"""
new = """  const githubEvidence = classifyGitHubPushEvidence({
    ...(observation ? {observationId: observation.history_event_id, observedAt: observation.occurred_at} : {}),
    sourceAvailable: Boolean(repository?.active),
    now: await readDatabaseNow(db),
  });
"""
if old not in text:
    raise SystemExit('command evidence classifier anchor drifted')
text = text.replace(old, new, 1)
mission.write_text(text)

# Make Project projections use the same freshness truth.
projects = Path('apps/inkubator-api/src/projects.ts')
text = projects.read_text()
text = text.replace(
    "import type {DatabaseSchema, GitHubRepositoryRow, MissionState} from './database.js';",
    "import {readDatabaseNow, type DatabaseSchema, type GitHubRepositoryRow, type MissionState} from './database.js';",
    1,
)
text = text.replace(
    "import {appendHistoryEvent} from './events.js';\n",
    "import {appendHistoryEvent} from './events.js';\nimport {classifyGitHubPushEvidence, type GitHubEvidenceSnapshot} from './evidence.js';\n",
    1,
)
text = text.replace(
    "  observation: {\n    deliveryId: string;",
    "  githubEvidence: GitHubEvidenceSnapshot;\n  observation: {\n    deliveryId: string;",
    1,
)
return_anchor = """  return {
    projectId: project.project_id,
    ownerPlayerId: project.owner_player_id,
"""
calc = """  const githubEvidence = classifyGitHubPushEvidence({
    ...(observationEvent ? {observationId: observationEvent.history_event_id, observedAt: observationEvent.occurred_at} : {}),
    sourceAvailable: Boolean(repository?.active),
    now: await readDatabaseNow(db),
  });

"""
if return_anchor not in text:
    raise SystemExit('project snapshot return anchor drifted')
text = text.replace(return_anchor, calc + return_anchor, 1)
text = text.replace("    repository,\n    observation,\n", "    repository,\n    githubEvidence,\n    observation,\n", 1)
text = text.replace("schema_version: 'project.public.v1' as const,", "schema_version: 'project.public.v2' as const,", 1)
text = text.replace("observation_state: project.observation ? 'OBSERVED' : 'UNKNOWN',", "observation_state: project.githubEvidence.signalState,", 1)
text = text.replace("schema_version: 'project.private.v1' as const,", "schema_version: 'project.private.v2' as const,", 1)
text = text.replace("observation_state: project.observation ? 'OBSERVED' : 'UNKNOWN',", "observation_state: project.githubEvidence.signalState,", 1)
projects.write_text(text)

# Align executable HTTP contract with the changed semantics.
contract = Path('apps/inkubator-api/src/contract.ts')
text = contract.read_text()
text = text.replace("schema_version: {type: 'string', const: 'project.public.v1'},", "schema_version: {type: 'string', const: 'project.public.v2'},", 1)
text = text.replace("schema_version: {type: 'string', const: 'project.private.v1'},", "schema_version: {type: 'string', const: 'project.private.v2'},", 1)
private_anchor = """  PrivateProject: {
"""
private_start = text.index(private_anchor)
private_end = text.index("  MissionCreateRequest: {", private_start)
private_block = text[private_start:private_end]
private_block = private_block.replace(
    "observation_state: {type: 'string', enum: ['UNKNOWN', 'OBSERVED']},",
    "observation_state: {type: 'string', enum: ['UNKNOWN', 'ACTIVE', 'OBSERVED', 'STALE', 'FAILED']},",
    1,
)
text = text[:private_start] + private_block + text[private_end:]
command_start = text.index("  CommandProject: {")
command_end = text.index("  CommandMission: {", command_start)
command_block = text[command_start:command_end]
command_block = command_block.replace(
    "observation_state: {type: 'string', enum: ['UNKNOWN', 'OBSERVED']},",
    "observation_state: {type: 'string', enum: ['UNKNOWN', 'ACTIVE', 'OBSERVED', 'STALE', 'FAILED']},",
    1,
)
text = text[:command_start] + command_block + text[command_end:]
contract.write_text(text)

# Extend the Phase-4 regression across all projections.
test = Path('apps/inkubator-api/test/integration/phase4-github-evidence-daemon.test.mjs')
text = test.read_text()
old = """    assert.match(stale.json().daemon.likely_blocker, /stale/i);
    assert.equal(stale.json().gates.every((gate) => gate.state === 'UNKNOWN'), true);

    const freshPush = await sendWebhook(app, 'push', {
"""
new = """    assert.match(stale.json().daemon.likely_blocker, /stale/i);
    assert.equal(stale.json().gates.every((gate) => gate.state === 'UNKNOWN'), true);
    const publicStale = await app.inject({method: 'GET', url: `/v1/projects/${projectId}`});
    assert.equal(publicStale.statusCode, 200);
    assert.equal(publicStale.json().schema_version, 'project.public.v2');
    assert.equal(publicStale.json().observation_state, 'STALE');
    assert.equal(JSON.stringify(publicStale.json()).includes(repositoryId), false);
    assert.equal(JSON.stringify(publicStale.json()).includes(fullName), false);
    const privateStale = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/private`, headers: {cookie}});
    assert.equal(privateStale.statusCode, 200);
    assert.equal(privateStale.json().schema_version, 'project.private.v2');
    assert.equal(privateStale.json().observation_state, 'STALE');

    const freshPush = await sendWebhook(app, 'push', {
"""
if old not in text:
    raise SystemExit('phase4 stale assertion anchor drifted')
text = text.replace(old, new, 1)
old = """    assert.equal(unavailable.json().daemon.authority, 'ADVISORY_ONLY');
    assert.equal(unavailable.json().gates.every((gate) => gate.state === 'UNKNOWN'), true);

    const proofEvents = await db.selectFrom('history_events')
"""
new = """    assert.equal(unavailable.json().daemon.authority, 'ADVISORY_ONLY');
    assert.equal(unavailable.json().gates.every((gate) => gate.state === 'UNKNOWN'), true);
    const publicUnavailable = await app.inject({method: 'GET', url: `/v1/projects/${projectId}`});
    assert.equal(publicUnavailable.statusCode, 200);
    assert.equal(publicUnavailable.json().source_connected, false);
    assert.equal(publicUnavailable.json().observation_state, 'STALE');
    const privateUnavailable = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/private`, headers: {cookie}});
    assert.equal(privateUnavailable.statusCode, 200);
    assert.equal(privateUnavailable.json().source_connected, false);
    assert.equal(privateUnavailable.json().observation_state, 'STALE');

    const proofEvents = await db.selectFrom('history_events')
"""
if old not in text:
    raise SystemExit('phase4 unavailable assertion anchor drifted')
text = text.replace(old, new, 1)
test.write_text(text)
