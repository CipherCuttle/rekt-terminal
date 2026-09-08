import {InkubatorApiClient, type FetchLike} from './generated/inkubator-api-client';

const platformFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export function createInkubatorApiClient(baseUrl = '', fetchImpl?: FetchLike): InkubatorApiClient {
  return new InkubatorApiClient(baseUrl, fetchImpl ?? platformFetch);
}
