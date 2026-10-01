import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {GitHubSessionWidget, type GitHubSessionWidgetApi} from './GitHubSessionWidget';
import {InkubatorApiError} from '../inkubator-api';

afterEach(() => cleanup());

function readyApi(overrides: Partial<GitHubSessionWidgetApi> = {}): GitHubSessionWidgetApi {
  return {
    getSession: vi.fn<GitHubSessionWidgetApi['getSession']>(async () => ({
      schema_version: 'session.private.v1',
      player: {
        schema_version: 'player.private.v1',
        player_id: '22222222-2222-4222-8222-222222222222',
        display_name: 'Builder',
        created_at: '2026-09-14T00:00:00.000Z',
        updated_at: '2026-09-14T00:00:00.000Z',
      },
      expires_at: '2099-09-14T08:00:00.000Z',
    })),
    getConnectionContext: vi.fn<GitHubSessionWidgetApi['getConnectionContext']>(async () => ({
      schema_version: 'player.connection_context.private.v1',
      player: {player_id: '22222222-2222-4222-8222-222222222222', display_name: 'Builder'},
      github: {user_id: '12345', login: 'builder'},
      states: {
        signed_in: 'SIGNED_IN',
        app_access: 'GRANTED',
        repository_authorized: 'AUTHORIZED',
        project_linked: 'NOT_LINKED',
        observing: 'NOT_OBSERVING',
      },
      source: {
        repository_id: null,
        repository_full_name: null,
        visibility: 'NONE',
        availability: 'NONE',
        last_observed_at: null,
      },
    })),
    getGitHubRepositories: vi.fn<GitHubSessionWidgetApi['getGitHubRepositories']>(async () => [
      {repository_id: '1', full_name: 'owner/one', private: false},
      {repository_id: '2', full_name: 'owner/two', private: true},
    ]),
    signOut: vi.fn<GitHubSessionWidgetApi['signOut']>(async () => undefined),
    ...overrides,
  };
}

describe('GitHub session widget', () => {
  it('shows verified GitHub identity, authorized repository count and bounded REKT session', async () => {
    render(<GitHubSessionWidget api={readyApi()} />);
    await waitFor(() => expect(screen.getByText('@builder')).toBeTruthy());
    expect(screen.getByText('GITHUB APP')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('10 MIN FOR SENSITIVE GITHUB CHANGES')).toBeTruthy();
    expect(screen.getByText(/REKT session ·/i)).toBeTruthy();
  });

  it('turns an expired or missing server session into an explicit reconnect action', async () => {
    const api = readyApi({
      getSession: vi.fn(async () => {
        throw new InkubatorApiError(401, 'authentication_required');
      }),
    });
    render(<GitHubSessionWidget api={api} />);
    await waitFor(() => expect(screen.getByText('CONNECT GITHUB')).toBeTruthy());
    expect(screen.getByText(/8-hour REKT session/i)).toBeTruthy();
  });
});
