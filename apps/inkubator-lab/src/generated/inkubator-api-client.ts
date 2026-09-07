/* GENERATED FROM apps/inkubator-api/src/contract.ts. DO NOT EDIT. */
export interface Error {
  error: string;
}

export interface DevSessionRequest {
  display_name: string;
}

export type PlayerId = string;

export type ProjectId = string;

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
  schema_version: "project.public.v1";
  project_id: ProjectId;
  name: string;
  mission_id: string;
  mission_state: "DECLARED";
  source_connected: boolean;
  source_visibility: string;
  observation_state: string;
}

export interface PrivateProject {
  schema_version: "project.private.v1";
  project_id: ProjectId;
  owner_player_id: PlayerId;
  name: string;
  mission_id: string;
  mission_state: "DECLARED";
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  source_connected: boolean;
  source_visibility: string;
  observation_state: string;
  repository_id?: string;
  repository_full_name?: string;
  repository_private?: boolean;
  repository_active?: boolean;
  last_delivery_id?: string;
  last_ref?: string;
  last_before?: string;
  last_after?: string;
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

  getPublicPlayer(playerId: PlayerId): Promise<PublicPlayer> {
    return this.request<PublicPlayer>(`/v1/players/${encodeURIComponent(playerId)}`, {method: 'GET'});
  }

  getPrivatePlayer(playerId: PlayerId): Promise<PrivatePlayer> {
    return this.request<PrivatePlayer>(`/v1/players/${encodeURIComponent(playerId)}/private`, {method: 'GET'});
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
