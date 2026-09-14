import {InkubatorApiClient, InkubatorApiError, type FetchLike} from './generated/inkubator-api-client.js';

export {InkubatorApiError};
export interface InkubatorServerClientOptions { baseUrl: string; accessToken: string; fetchImpl?: FetchLike; }
export interface MutationOptions { idempotencyKey?: string; }
export interface BuilderCapsuleFile {
  path: string;
  media_type: 'text/markdown' | 'application/json';
  sha256: string;
  content: string;
}
export interface BuilderCapsuleView {
  schema_version: 'builder-capsule.v1';
  challenge_id: string;
  entry_id: string;
  entry_state: string;
  contract_version: string;
  terms_digest: string;
  submission_deadline: string;
  files: BuilderCapsuleFile[];
}
export interface ChallengeSubmissionAcceptedView {
  schema_version: 'challenge.submission.accepted.v1';
  submission_id: string;
  challenge_id: string;
  entry_id: string;
  submission_version: string;
  terms_digest: string;
  manifest_digest: string;
  accepted_at: string;
  ship_submission_id: string | null;
}
export interface ChallengeSubmitInput extends MutationOptions {
  entryId: string;
  expectedTermsDigest: string;
  submissionVersion: number;
  immutableSourceReference: {kind: 'GIT_COMMIT'|'CONTENT_ADDRESS'|'ARCHIVE_DIGEST'; value: string};
  artifactDigest: string;
  evidenceReferences?: string[];
  optionalLiveUrl?: string;
  shipSubmissionId?: string;
  submissionId?: string;
}
const requestId = (value?: string) => value ?? crypto.randomUUID();

export function createInkubatorServerClient(options: InkubatorServerClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const transport = new InkubatorApiClient(options.baseUrl, fetchImpl, options.accessToken);
  const requestJson = async <T>(route: string, init: RequestInit = {method: 'GET'}): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${options.accessToken}`);
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, '')}${route}`, {...init, headers});
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {error?: unknown} | null;
      const message = typeof body?.error === 'string' ? body.error : `request_failed_${response.status}`;
      throw new InkubatorApiError(response.status, message);
    }
    return await response.json() as T;
  };

  return {
    player: {
      me: () => transport.getDevkitMe(),
      profile: () => transport.getDevkitPlayerProfile(),
    },
    challenge: {
      capsule: (challengeId: string) => requestJson<BuilderCapsuleView>(`/v1/devkit/challenges/${encodeURIComponent(challengeId)}/capsule`),
      submit: (challengeId: string, input: ChallengeSubmitInput) => requestJson<ChallengeSubmissionAcceptedView>(
        `/v1/devkit/challenges/${encodeURIComponent(challengeId)}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
            request_id: requestId(input.idempotencyKey),
            submission_id: input.submissionId ?? crypto.randomUUID(),
            entry_id: input.entryId,
            expected_terms_digest: input.expectedTermsDigest,
            submission_version: input.submissionVersion,
            immutable_source_reference: input.immutableSourceReference,
            artifact_digest: input.artifactDigest,
            evidence_references: input.evidenceReferences ?? [],
            ...(input.optionalLiveUrl ? {optional_live_url: input.optionalLiveUrl} : {}),
            ...(input.shipSubmissionId ? {ship_submission_id: input.shipSubmissionId} : {}),
          }),
        },
      ),
    },
    mission: {
      current: () => transport.getDevkitCurrentMission(),
      status: () => transport.getDevkitCurrentMission(),
      update: (input: {currentFocus?: string; nextMove?: string; blocker?: string | null; stackLabels?: string[]} & MutationOptions) => transport.updateDevkitCurrentMission({
        request_id: requestId(input.idempotencyKey),
        ...(input.currentFocus !== undefined ? {current_focus: input.currentFocus} : {}),
        ...(input.nextMove !== undefined ? {next_move: input.nextMove} : {}),
        ...(input.blocker !== undefined ? {blocker: input.blocker} : {}),
        ...(input.stackLabels !== undefined ? {stack_labels: input.stackLabels} : {}),
      }),
      claim: (input: {gateKey: 'FOUNDATION'|'CORE_EXPERIENCE'|'QUALITY_TESTING'|'SHIPABILITY'; state?: 'UNKNOWN'|'CLAIMED'|'ACTIVE'|'ATTENTION'|'BLOCKED'|'STALE'|'FAILED'} & MutationOptions) => transport.claimDevkitMilestone(input.gateKey, {request_id: requestId(input.idempotencyKey), state: input.state ?? 'CLAIMED'}),
    },
    project: {
      current: () => transport.getDevkitCurrentProject(),
      activity: () => transport.getDevkitActivity(),
    },
    beacon: {
      list: () => transport.listDevkitHelpBeacons(),
      create: (input: {summary: string; skillsNeeded?: string[]} & MutationOptions) => transport.createDevkitHelpBeacon({request_id: requestId(input.idempotencyKey), summary: input.summary, ...(input.skillsNeeded ? {skills_needed: input.skillsNeeded} : {})}),
    },
    assist: {
      offer: (input: {beaconId: string; message: string} & MutationOptions) => transport.offerDevkitAssist(input.beaconId, {request_id: requestId(input.idempotencyKey), message: input.message}),
    },
    ship: {
      prepare: (input: {title: string; url: string; demoUrl?: string; sourceUrl?: string} & MutationOptions) => transport.prepareDevkitShip({request_id: requestId(input.idempotencyKey), title: input.title, url: input.url, ...(input.demoUrl ? {demo_url: input.demoUrl} : {}), ...(input.sourceUrl ? {source_url: input.sourceUrl} : {})}),
    },
  };
}

export function createInkubatorServerClientFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const accessToken = env.REKT_DEVKIT_TOKEN;
  if (!accessToken) throw new Error('REKT_DEVKIT_TOKEN is required');
  const baseUrl = env.REKT_API_URL ?? 'http://127.0.0.1:8787';
  return createInkubatorServerClient({baseUrl, accessToken});
}
