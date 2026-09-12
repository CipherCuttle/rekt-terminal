import {describe, expect, it} from 'vitest';
import {createInkubatorApiClient} from './inkubator-api';
import type {FetchLike} from './generated/inkubator-api-client';

describe('generated Inkubator API client', () => {
  it('consumes the typed public-player operation without redefining the route', async () => {
    const calls: Array<{url: string; credentials?: RequestCredentials}> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({url: String(input), credentials: init?.credentials});
      return {
        ok: true,
        status: 200,
        json: async () => ({schema_version: 'player.public.v1', player_id: 'abc', display_name: 'Builder'}),
      } as Response;
    };
    const client = createInkubatorApiClient('https://api.example/', fetchImpl);
    const player = await client.getPublicPlayer('a/b');
    expect(player.display_name).toBe('Builder');
    expect(calls).toEqual([{url: 'https://api.example/v1/players/a%2Fb', credentials: 'include'}]);
  });
});
