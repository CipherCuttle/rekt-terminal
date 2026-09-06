import {InkubatorApiClient, type FetchLike} from './generated/inkubator-api-client';

export function createInkubatorApiClient(baseUrl = '', fetchImpl?: FetchLike): InkubatorApiClient {
  return new InkubatorApiClient(baseUrl, fetchImpl ?? fetch);
}
