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

  it('exposes Stage I session projections while keeping immutable submission out of the browser client', async () => {
    const calls: Array<{url: string; method?: string; body?: string}> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      calls.push({url, method: init?.method, body: typeof init?.body === 'string' ? init.body : undefined});
      let body: unknown = {};
      if (url.endsWith('/v1/challenges')) body = {schema_version: 'challenge.public.v1', challenge_id: 'challenge-id', status: 'DRAFT'};
      else if (url.endsWith('/entries')) body = {schema_version: 'challenge.entry.joined.v1', challenge_id: 'challenge-id', entry_id: 'entry-id', state: 'RESERVED', terms_digest: 'terms'};
      else if (url.endsWith('/submit-credential')) body = {schema_version: 'devkit.token.issued.v1', token: 'rekt_dk_test', scopes: ['challenge:submit']};
      else if (url.endsWith('/reveal-arena')) body = {schema_version: 'challenge.reveal-arena/1.0', challenge_id: 'challenge-id', criteria: [], submissions: []};
      else if (url.endsWith('/receipts')) body = {schema_version: 'challenge.receipt-transport/1.0', challenge_id: 'challenge-id', receipts: []};
      return {ok: true, status: 200, json: async () => body} as Response;
    };
    const client = createInkubatorApiClient('https://api.example/', fetchImpl);

    await client.createChallenge({
      request_id: '11111111-1111-4111-8111-111111111111',
      challenge_id: '22222222-2222-4222-8222-222222222222',
      slot_limit: 3,
      activation_minimum: 1,
      entry_deadline_ms: 1,
      submission_deadline_ms: 2,
      appeal_window_ms: 1,
      review_deadline_ms: 3,
    });
    await client.joinChallenge('a/b', 'request-id', 'entry-id', 'terms');
    await client.mintSubmitCredential('a/b', 'request-id', 3600);
    await client.getRevealArena('a/b');
    await client.getReceipts('a/b');

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example/v1/challenges',
      'https://api.example/v1/challenges/a%2Fb/entries',
      'https://api.example/v1/challenges/a%2Fb/submit-credential',
      'https://api.example/v1/challenges/a%2Fb/reveal-arena',
      'https://api.example/v1/challenges/a%2Fb/receipts',
    ]);
    expect(calls[0]!.body).not.toContain('settlement_asset');
    expect(calls[0]!.body).not.toContain('funding');
    expect(calls[2]!.body).toContain('"expires_in_seconds":3600');
    expect('submitChallenge' in client).toBe(false);
    expect('submitChallengeSubmission' in client).toBe(false);
  });
});