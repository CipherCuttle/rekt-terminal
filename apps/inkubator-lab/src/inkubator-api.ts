import {InkubatorApiClient, InkubatorApiError, type FetchLike} from './generated/inkubator-api-client';

const platformFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export interface ProjectPendingAssistView {
  assist_id: string;
  beacon_id: string;
  project_id: string;
  offered_by_player_id: string;
  offered_by_display_name: string;
  message: string;
  state: 'OFFERED';
  offered_at: string;
}

export interface ProjectPendingAssistsView {
  schema_version: 'project.pending_assists.private.v1';
  project_id: string;
  assists: ProjectPendingAssistView[];
}

export class InkubatorProductApiClient extends InkubatorApiClient {
  constructor(
    private readonly productBaseUrl = '',
    private readonly productFetch: FetchLike = platformFetch,
  ) {
    super(productBaseUrl, productFetch);
  }

  async getProjectPendingAssists(projectId: string): Promise<ProjectPendingAssistsView> {
    const response = await this.productFetch(
      `${this.productBaseUrl.replace(/\/$/, '')}/v1/projects/${encodeURIComponent(projectId)}/pending-assists`,
      {method: 'GET', credentials: 'include'},
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {error?: unknown} | null;
      const message = typeof body?.error === 'string' ? body.error : `request_failed_${response.status}`;
      throw new InkubatorApiError(response.status, message);
    }
    return await response.json() as ProjectPendingAssistsView;
  }
}

export function createInkubatorApiClient(baseUrl = '', fetchImpl?: FetchLike): InkubatorProductApiClient {
  return new InkubatorProductApiClient(baseUrl, fetchImpl ?? platformFetch);
}
