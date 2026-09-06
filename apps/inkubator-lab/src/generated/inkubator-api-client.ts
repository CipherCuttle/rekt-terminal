/* GENERATED FROM apps/inkubator-api/src/contract.ts. DO NOT EDIT. */
export interface Error {
  error: string;
}

export interface DevSessionRequest {
  display_name: string;
}

export type PlayerId = string;

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

  createGitHubInstall(): Promise<GitHubInstallView> {
    return this.request<GitHubInstallView>("/v1/github/install", {method: 'POST'});
  }
}
