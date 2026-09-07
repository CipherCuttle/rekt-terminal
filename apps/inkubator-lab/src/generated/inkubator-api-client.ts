/* GENERATED FROM apps/inkubator-api/src/contract.ts. DO NOT EDIT. */
export interface Error {
  error: string;
}

export interface DevSessionRequest {
  display_name: string;
}

export type PlayerId = string;

export type ProjectId = string;

export type MissionId = string;

export type RoundId = string;

export type RequestId = string;

export type MissionState = "DRAFT" | "DECLARED" | "BUILDING" | "BLOCKED" | "SHIP_READY" | "SUBMITTED" | "SHIPPED" | "CLOSED_NOT_SHIPPED" | "ARCHIVED";

export type MissionGateKey = "FOUNDATION" | "CORE_EXPERIENCE" | "QUALITY_TESTING" | "SHIPABILITY";

export type MissionGateState = "UNKNOWN" | "CLAIMED" | "ACTIVE" | "OBSERVED" | "PROVEN" | "ATTENTION" | "BLOCKED" | "STALE" | "FAILED";

export type ParticipantMissionGateState = "UNKNOWN" | "CLAIMED" | "ACTIVE" | "ATTENTION" | "BLOCKED" | "STALE" | "FAILED";

export interface PublicPlayer {
  schema_version: "player.public.v1";
  player_id: PlayerId;
  display_name: string;
}

export interface PrivatePlayer {
  schema_version: "player.private.v1";
  player_id: PlayerId;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface SessionView {
  schema_version: "session.private.v1";
  player: PrivatePlayer;
  expires_at: string;
}

export interface PlayerProfileView {
  schema_version: "player.profile.v1";
  player_id: PlayerId;
  bio?: string;
  character_name?: string;
  character_archetype?: string;
}

export interface PlayerProfileUpdateRequest {
  request_id: RequestId;
  bio?: string | null;
  character_name?: string | null;
  character_archetype?: string | null;
}

export interface RoundView {
  schema_version: "round.private.v1";
  round_id: RoundId;
  code: string;
  title: string;
  constraint: string;
  state: "OPEN" | "CLOSED" | "ARCHIVED";
  joined: boolean;
}

export type RoundList = RoundView[];

export interface GitHubInstallView {
  schema_version: "github.install.v1";
  install_url: string;
  expires_at: string;
}

export interface DevelopmentProjectRequest {
  name: string;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
}

export interface ProjectGitHubRepositoryLinkRequest {
  repository_id: string;
}

export interface PublicProject {
  schema_version: "project.public.v2";
  project_id: ProjectId;
  name: string;
  mission_id: MissionId;
  mission_state: MissionState;
  source_connected: boolean;
  source_visibility: "NONE" | "PUBLIC" | "PRIVATE";
  observation_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
}

export interface PrivateProject {
  schema_version: "project.private.v2";
  project_id: ProjectId;
  owner_player_id: PlayerId;
  name: string;
  mission_id: MissionId;
  mission_state: MissionState;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  source_connected: boolean;
  source_visibility: "NONE" | "PUBLIC" | "PRIVATE";
  observation_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
  repository_id?: string;
  repository_full_name?: string;
  repository_private?: boolean;
  repository_active?: boolean;
  last_delivery_id?: string;
  last_ref?: string;
  last_before?: string;
  last_after?: string;
}

export interface MissionCreateRequest {
  request_id: RequestId;
  round_id: RoundId;
  project_name: string;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  stack_labels?: string[];
}

export interface MissionUpdateRequest {
  request_id: RequestId;
  state?: "DECLARED" | "BUILDING" | "BLOCKED" | "SHIP_READY" | "CLOSED_NOT_SHIPPED";
  current_focus?: string;
  next_move?: string;
  blocker?: string | null;
  stack_labels?: string[];
}

export interface MissionGateUpdateRequest {
  request_id: RequestId;
  state: ParticipantMissionGateState;
}

export interface CommandProject {
  project_id: ProjectId;
  name: string;
  source_connected: boolean;
  source_visibility: "NONE" | "PUBLIC" | "PRIVATE";
  observation_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
}

export interface CommandMission {
  mission_id: MissionId;
  state: MissionState;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  blocker?: string;
  progress_model_version: "mission.progress.v1";
  stack_labels: string[];
  stack_source: "UNKNOWN" | "PLAYER_CONFIRMED";
}

export interface CommandRound {
  round_id: RoundId;
  code: string;
  title: string;
  constraint: string;
  state: "OPEN" | "CLOSED" | "ARCHIVED";
}

export interface MissionGateView {
  key: MissionGateKey;
  label: string;
  state: MissionGateState;
  position: number;
}

export interface CommandEvidenceObservation {
  observation_id: string;
  kind: "PUSH" | "PULL_REQUEST" | "WORKFLOW" | "DEPLOYMENT" | "MANIFEST";
  outcome: "OBSERVED" | "SUCCEEDED" | "FAILED" | "IN_PROGRESS" | "UNKNOWN";
  observed_at: string;
}

export interface CommandGitHubEvidence {
  rule_version: "github-evidence.v1";
  source_state: "AVAILABLE" | "UNAVAILABLE";
  signal_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
  stale_after_ms: number;
  invalid_observation_count: number;
  reason_code: "source_unavailable_no_evidence" | "source_unavailable_cached_evidence_not_current" | "no_valid_observation" | "latest_observation_stale" | "latest_observation_current";
  latest_observation?: CommandEvidenceObservation;
}

export interface CommandDaemonAdvisory {
  rule_version: "daemon-advisory.v1";
  authority: "ADVISORY_ONLY";
  what_changed: string;
  likely_blocker?: string;
  scope_damage_warning?: string;
  proposed_next_move: string;
}

export interface CommandView {
  schema_version: "command.private.v2";
  project: CommandProject;
  mission: CommandMission;
  round?: CommandRound;
  gates: MissionGateView[];
  github_evidence: CommandGitHubEvidence;
  daemon: CommandDaemonAdvisory;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class InkubatorApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'InkubatorApiError';
  }
}

export class InkubatorApiClient {
  constructor(
    private readonly baseUrl = '',
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {error?: unknown} | null;
      const message = typeof body?.error === 'string' ? body.error : `request_failed_${response.status}`;
      throw new InkubatorApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  createDevSession(body: DevSessionRequest): Promise<SessionView> {
    return this.request<SessionView>("/v1/dev/session", {method: 'POST', body: JSON.stringify(body)});
  }

  deleteSession(): Promise<void> {
    return this.request<void>("/v1/session", {method: 'DELETE'});
  }

  getMe(): Promise<PrivatePlayer> {
    return this.request<PrivatePlayer>("/v1/me", {method: 'GET'});
  }

  getMyProfile(): Promise<PlayerProfileView> {
    return this.request<PlayerProfileView>("/v1/me/profile", {method: 'GET'});
  }

  updateMyProfile(body: PlayerProfileUpdateRequest): Promise<PlayerProfileView> {
    return this.request<PlayerProfileView>("/v1/me/profile", {method: 'PATCH', body: JSON.stringify(body)});
  }

  getMyCommand(): Promise<CommandView> {
    return this.request<CommandView>("/v1/me/command", {method: 'GET'});
  }

  getPublicPlayer(playerId: PlayerId): Promise<PublicPlayer> {
    return this.request<PublicPlayer>(`/v1/players/${encodeURIComponent(playerId)}`, {method: 'GET'});
  }

  getPrivatePlayer(playerId: PlayerId): Promise<PrivatePlayer> {
    return this.request<PrivatePlayer>(`/v1/players/${encodeURIComponent(playerId)}/private`, {method: 'GET'});
  }

  listRounds(): Promise<RoundList> {
    return this.request<RoundList>("/v1/rounds", {method: 'GET'});
  }

  joinRound(roundId: RoundId): Promise<RoundView> {
    return this.request<RoundView>(`/v1/rounds/${encodeURIComponent(roundId)}/join`, {method: 'POST'});
  }

  createMission(body: MissionCreateRequest): Promise<CommandView> {
    return this.request<CommandView>("/v1/missions", {method: 'POST', body: JSON.stringify(body)});
  }

  updateMission(missionId: MissionId, body: MissionUpdateRequest): Promise<CommandView> {
    return this.request<CommandView>(`/v1/missions/${encodeURIComponent(missionId)}`, {method: 'PATCH', body: JSON.stringify(body)});
  }

  updateMissionGate(missionId: MissionId, gateKey: MissionGateKey, body: MissionGateUpdateRequest): Promise<CommandView> {
    return this.request<CommandView>(`/v1/missions/${encodeURIComponent(missionId)}/gates/${encodeURIComponent(gateKey)}`, {method: 'PATCH', body: JSON.stringify(body)});
  }

  createDevelopmentProject(body: DevelopmentProjectRequest): Promise<PrivateProject> {
    return this.request<PrivateProject>("/v1/development/projects", {method: 'POST', body: JSON.stringify(body)});
  }

  getPublicProject(projectId: ProjectId): Promise<PublicProject> {
    return this.request<PublicProject>(`/v1/projects/${encodeURIComponent(projectId)}`, {method: 'GET'});
  }

  getPrivateProject(projectId: ProjectId): Promise<PrivateProject> {
    return this.request<PrivateProject>(`/v1/projects/${encodeURIComponent(projectId)}/private`, {method: 'GET'});
  }

  linkProjectGitHubRepository(projectId: ProjectId, body: ProjectGitHubRepositoryLinkRequest): Promise<PrivateProject> {
    return this.request<PrivateProject>(`/v1/projects/${encodeURIComponent(projectId)}/github-repositories`, {method: 'POST', body: JSON.stringify(body)});
  }

  createGitHubInstall(): Promise<GitHubInstallView> {
    return this.request<GitHubInstallView>("/v1/github/install", {method: 'POST'});
  }
}
