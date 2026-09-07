export const GITHUB_EVIDENCE_RULE_VERSION = 'github-evidence.v1' as const;
export const PROGRESS_EVIDENCE_RULE_VERSION = 'progress-evidence.v1' as const;
export const DAEMON_ADVISORY_RULE_VERSION = 'daemon-advisory.v1' as const;

export type GitHubObservationKind = 'PUSH' | 'PULL_REQUEST' | 'WORKFLOW' | 'DEPLOYMENT' | 'MANIFEST';
export type ObservationOutcome = 'OBSERVED' | 'SUCCEEDED' | 'FAILED' | 'IN_PROGRESS' | 'UNKNOWN';
export type EvidenceSignalState = 'UNKNOWN' | 'ACTIVE' | 'OBSERVED' | 'STALE' | 'FAILED';
export type EvidenceSourceState = 'AVAILABLE' | 'UNAVAILABLE';

export interface StructuredGitHubObservation {
  observationId: string;
  kind: GitHubObservationKind;
  outcome: ObservationOutcome;
  observedAt: string;
}

export interface GitHubEvidenceSnapshot {
  ruleVersion: typeof GITHUB_EVIDENCE_RULE_VERSION;
  sourceState: EvidenceSourceState;
  signalState: EvidenceSignalState;
  staleAfterMs: number;
  invalidObservationCount: number;
  reasonCode:
    | 'source_unavailable_no_evidence'
    | 'source_unavailable_cached_evidence_not_current'
    | 'no_valid_observation'
    | 'latest_observation_stale'
    | 'latest_observation_current';
  latestObservation?: StructuredGitHubObservation;
}

const OBSERVATION_KINDS = new Set<GitHubObservationKind>(['PUSH', 'PULL_REQUEST', 'WORKFLOW', 'DEPLOYMENT', 'MANIFEST']);
const OBSERVATION_OUTCOMES = new Set<ObservationOutcome>(['OBSERVED', 'SUCCEEDED', 'FAILED', 'IN_PROGRESS', 'UNKNOWN']);
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

function sanitizeObservation(observation: StructuredGitHubObservation): {observation: StructuredGitHubObservation; timestamp: number} | null {
  if (!observation || typeof observation !== 'object') return null;
  const candidate = observation as Partial<StructuredGitHubObservation>;
  if (typeof candidate.observationId !== 'string' || candidate.observationId.length === 0 || candidate.observationId.length > 256) return null;
  if (typeof candidate.kind !== 'string' || !OBSERVATION_KINDS.has(candidate.kind as GitHubObservationKind)) return null;
  if (typeof candidate.outcome !== 'string' || !OBSERVATION_OUTCOMES.has(candidate.outcome as ObservationOutcome)) return null;
  if (typeof candidate.observedAt !== 'string' || candidate.observedAt.length === 0 || candidate.observedAt.length > 64) return null;

  const timestamp = Date.parse(candidate.observedAt);
  if (!Number.isFinite(timestamp)) return null;

  return {
    timestamp,
    observation: {
      observationId: candidate.observationId,
      kind: candidate.kind as GitHubObservationKind,
      outcome: candidate.outcome as ObservationOutcome,
      observedAt: candidate.observedAt,
    },
  };
}

function signalStateForOutcome(outcome: ObservationOutcome): EvidenceSignalState {
  if (outcome === 'FAILED') return 'FAILED';
  if (outcome === 'IN_PROGRESS') return 'ACTIVE';
  if (outcome === 'UNKNOWN') return 'UNKNOWN';
  return 'OBSERVED';
}

export function classifyGitHubEvidence(input: {
  observations: readonly StructuredGitHubObservation[];
  sourceAvailable: boolean;
  now: string | number | Date;
  staleAfterMs: number;
}): GitHubEvidenceSnapshot {
  if (!Number.isFinite(input.staleAfterMs) || input.staleAfterMs <= 0) {
    throw new Error('evidence_stale_after_invalid');
  }

  const nowMs = input.now instanceof Date ? input.now.getTime() : typeof input.now === 'number' ? input.now : Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('evidence_now_invalid');

  const valid = input.observations
    .map(sanitizeObservation)
    .filter((entry): entry is {observation: StructuredGitHubObservation; timestamp: number} => entry !== null && entry.timestamp <= nowMs + MAX_FUTURE_CLOCK_SKEW_MS)
    .sort((left, right) => right.timestamp - left.timestamp);

  const latest = valid[0];
  const invalidObservationCount = input.observations.length - valid.length;

  if (!input.sourceAvailable) {
    if (!latest) {
      return {
        ruleVersion: GITHUB_EVIDENCE_RULE_VERSION,
        sourceState: 'UNAVAILABLE',
        signalState: 'UNKNOWN',
        staleAfterMs: input.staleAfterMs,
        invalidObservationCount,
        reasonCode: 'source_unavailable_no_evidence',
      };
    }

    return {
      ruleVersion: GITHUB_EVIDENCE_RULE_VERSION,
      sourceState: 'UNAVAILABLE',
      signalState: 'STALE',
      staleAfterMs: input.staleAfterMs,
      invalidObservationCount,
      reasonCode: 'source_unavailable_cached_evidence_not_current',
      latestObservation: latest.observation,
    };
  }

  if (!latest) {
    return {
      ruleVersion: GITHUB_EVIDENCE_RULE_VERSION,
      sourceState: 'AVAILABLE',
      signalState: 'UNKNOWN',
      staleAfterMs: input.staleAfterMs,
      invalidObservationCount,
      reasonCode: 'no_valid_observation',
    };
  }

  const ageMs = Math.max(0, nowMs - latest.timestamp);
  if (ageMs > input.staleAfterMs) {
    return {
      ruleVersion: GITHUB_EVIDENCE_RULE_VERSION,
      sourceState: 'AVAILABLE',
      signalState: 'STALE',
      staleAfterMs: input.staleAfterMs,
      invalidObservationCount,
      reasonCode: 'latest_observation_stale',
      latestObservation: latest.observation,
    };
  }

  return {
    ruleVersion: GITHUB_EVIDENCE_RULE_VERSION,
    sourceState: 'AVAILABLE',
    signalState: signalStateForOutcome(latest.observation.outcome),
    staleAfterMs: input.staleAfterMs,
    invalidObservationCount,
    reasonCode: 'latest_observation_current',
    latestObservation: latest.observation,
  };
}

export type DetectedStack =
  | 'JAVASCRIPT_TYPESCRIPT'
  | 'PYTHON'
  | 'RUST'
  | 'GO'
  | 'JVM'
  | 'RUBY'
  | 'PHP'
  | 'DOTNET'
  | 'CONTAINER';

export interface StackDetection {
  stack: DetectedStack;
  evidencePaths: string[];
}

const DETECTED_STACKS = new Set<DetectedStack>([
  'JAVASCRIPT_TYPESCRIPT',
  'PYTHON',
  'RUST',
  'GO',
  'JVM',
  'RUBY',
  'PHP',
  'DOTNET',
  'CONTAINER',
]);

const MANIFEST_STACK: Readonly<Record<string, DetectedStack>> = {
  'package.json': 'JAVASCRIPT_TYPESCRIPT',
  'pnpm-workspace.yaml': 'JAVASCRIPT_TYPESCRIPT',
  'pyproject.toml': 'PYTHON',
  'requirements.txt': 'PYTHON',
  'cargo.toml': 'RUST',
  'go.mod': 'GO',
  'pom.xml': 'JVM',
  'build.gradle': 'JVM',
  'build.gradle.kts': 'JVM',
  'gemfile': 'RUBY',
  'composer.json': 'PHP',
  'global.json': 'DOTNET',
  'dockerfile': 'CONTAINER',
  'compose.yaml': 'CONTAINER',
  'docker-compose.yml': 'CONTAINER',
};

export function detectStackFromManifestPaths(paths: readonly string[]): {
  ruleVersion: 'stack-detection.v1';
  inspectedPathCount: number;
  detections: StackDetection[];
} {
  const boundedPaths = paths.slice(0, 128);
  const detections = new Map<DetectedStack, Set<string>>();

  for (const rawPath of boundedPaths) {
    if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.length > 240 || /[\u0000-\u001f\u007f]/.test(rawPath)) continue;
    const normalized = rawPath.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0 || segments.length > 3) continue;

    const basename = segments.at(-1)?.toLowerCase();
    if (!basename) continue;
    const stack = MANIFEST_STACK[basename];
    if (!stack) continue;

    const evidencePaths = detections.get(stack) ?? new Set<string>();
    evidencePaths.add(normalized);
    detections.set(stack, evidencePaths);
  }

  return {
    ruleVersion: 'stack-detection.v1',
    inspectedPathCount: boundedPaths.length,
    detections: [...detections.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([stack, evidencePaths]) => ({stack, evidencePaths: [...evidencePaths].sort()})),
  };
}

export type ProgressGateKey = 'FOUNDATION' | 'CORE_EXPERIENCE' | 'QUALITY' | 'SHIPABILITY';

export interface ProgressObservationSuggestion {
  ruleVersion: typeof PROGRESS_EVIDENCE_RULE_VERSION;
  gateKey: ProgressGateKey;
  suggestedSignalState: 'OBSERVED';
  observationId: string;
  reasonCode: 'manifest_observed' | 'workflow_succeeded' | 'deployment_succeeded';
}

export function deriveProgressObservationSuggestion(snapshot: GitHubEvidenceSnapshot): ProgressObservationSuggestion | null {
  if (snapshot.sourceState !== 'AVAILABLE' || snapshot.signalState !== 'OBSERVED' || !snapshot.latestObservation) return null;

  const latest = snapshot.latestObservation;
  if (latest.kind === 'MANIFEST') {
    return {
      ruleVersion: PROGRESS_EVIDENCE_RULE_VERSION,
      gateKey: 'FOUNDATION',
      suggestedSignalState: 'OBSERVED',
      observationId: latest.observationId,
      reasonCode: 'manifest_observed',
    };
  }
  if (latest.kind === 'WORKFLOW' && latest.outcome === 'SUCCEEDED') {
    return {
      ruleVersion: PROGRESS_EVIDENCE_RULE_VERSION,
      gateKey: 'QUALITY',
      suggestedSignalState: 'OBSERVED',
      observationId: latest.observationId,
      reasonCode: 'workflow_succeeded',
    };
  }
  if (latest.kind === 'DEPLOYMENT' && latest.outcome === 'SUCCEEDED') {
    return {
      ruleVersion: PROGRESS_EVIDENCE_RULE_VERSION,
      gateKey: 'SHIPABILITY',
      suggestedSignalState: 'OBSERVED',
      observationId: latest.observationId,
      reasonCode: 'deployment_succeeded',
    };
  }
  return null;
}

export interface DaemonAdvisory {
  ruleVersion: typeof DAEMON_ADVISORY_RULE_VERSION;
  authority: 'ADVISORY_ONLY';
  whatChanged: string;
  likelyBlocker?: string;
  scopeDamageWarning?: string;
  proposedNextMove: string;
}

const OBSERVATION_LABEL: Readonly<Record<GitHubObservationKind, string>> = {
  PUSH: 'A GitHub push was observed.',
  PULL_REQUEST: 'A GitHub pull-request state change was observed.',
  WORKFLOW: 'A GitHub workflow state change was observed.',
  DEPLOYMENT: 'A GitHub deployment state change was observed.',
  MANIFEST: 'A repository manifest was observed.',
};

function safeStacks(stacks: readonly DetectedStack[]): DetectedStack[] {
  return [...new Set(stacks.filter((stack) => DETECTED_STACKS.has(stack)))].sort();
}

export function deriveDaemonAdvisory(input: {
  snapshot: GitHubEvidenceSnapshot;
  detectedStacks: readonly DetectedStack[];
  previousDetectedStacks?: readonly DetectedStack[];
}): DaemonAdvisory {
  const currentStacks = safeStacks(input.detectedStacks);
  const previous = new Set(safeStacks(input.previousDetectedStacks ?? []));
  const newStacks = currentStacks.filter((stack) => !previous.has(stack));
  const latest = input.snapshot.latestObservation;

  let likelyBlocker: string | undefined;
  let proposedNextMove = 'Connect or refresh GitHub evidence for this Project.';

  if (input.snapshot.sourceState === 'UNAVAILABLE') {
    likelyBlocker = 'GitHub source is unavailable; cached evidence is not current authority.';
    proposedNextMove = 'Restore GitHub source access before relying on repository evidence.';
  } else if (input.snapshot.signalState === 'STALE') {
    likelyBlocker = 'GitHub evidence is stale.';
    proposedNextMove = 'Refresh repository evidence before changing progress assumptions.';
  } else if (latest?.kind === 'WORKFLOW' && latest.outcome === 'FAILED') {
    likelyBlocker = 'The latest observed GitHub workflow failed.';
    proposedNextMove = 'Inspect the failed workflow in GitHub and resolve the bounded failure.';
  } else if (latest?.kind === 'DEPLOYMENT' && latest.outcome === 'SUCCEEDED') {
    proposedNextMove = 'Compare the observed deployment with the Mission ship condition.';
  } else if (latest?.kind === 'WORKFLOW' && latest.outcome === 'SUCCEEDED') {
    proposedNextMove = 'Re-evaluate the QUALITY gate and continue toward the Mission ship condition.';
  } else if (latest) {
    proposedNextMove = 'Compare the latest observed change with the Mission current focus and ship condition.';
  }

  const whatChanged = latest && OBSERVATION_KINDS.has(latest.kind)
    ? OBSERVATION_LABEL[latest.kind]
    : 'No current GitHub observation is available.';

  return {
    ruleVersion: DAEMON_ADVISORY_RULE_VERSION,
    authority: 'ADVISORY_ONLY',
    whatChanged,
    ...(likelyBlocker ? {likelyBlocker} : {}),
    ...(newStacks.length > 0 && previous.size > 0 ? {scopeDamageWarning: `New detected runtime stack: ${newStacks.join(', ')}. Confirm that scope expansion is intentional.`} : {}),
    proposedNextMove,
  };
}
