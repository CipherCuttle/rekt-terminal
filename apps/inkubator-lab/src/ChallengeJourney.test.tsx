import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import ChallengeJourney, {type ChallengeJourneyClient} from './ChallengeJourney';

function client(overrides: Partial<ChallengeJourneyClient> = {}): ChallengeJourneyClient {
  return {
    getMe: vi.fn(async () => ({schema_version: 'player.me.v1'} as never)),
    compileChallenge: vi.fn(async () => { throw new Error('not_used'); }),
    getChallenge: vi.fn(async () => { throw new Error('challenge_not_found'); }),
    previewBuildContract: vi.fn(async () => { throw new Error('not_used'); }),
    persistBuildContract: vi.fn(async () => { throw new Error('not_used'); }),
    ...overrides,
  } as ChallengeJourneyClient;
}

function renderJourney(value: ChallengeJourneyClient) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(<QueryClientProvider client={queryClient}><ChallengeJourney client={value} /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Stage I owner journey composition', () => {
  it('turns the historical command URL into the canonical Challenge front door', async () => {
    window.history.replaceState({}, '', '/?mode=command&auth=github&github_observation=degraded&github_observation_reason=github_push_event_required');
    renderJourney(client());

    expect(await screen.findByText('ONE FRONT DOOR.')).toBeTruthy();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('surface')).toBe('discover'));
    expect(new URLSearchParams(window.location.search).get('mode')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('auth')).toBe('github');
    expect(screen.getByText(/GITHUB OBSERVATION DEGRADED/i)).toBeTruthy();
    expect(screen.queryByText('WORLD')).toBeNull();
    expect(screen.queryByText('PROJECT')).toBeNull();
    expect(screen.queryByText('PLAYER')).toBeNull();
    expect(screen.queryByText('SHIP')).toBeNull();
  });

  it('gives organizer and builder explicit first actions without hidden surface knowledge', async () => {
    renderJourney(client());

    const create = await screen.findByRole('link', {name: /CREATE A CHALLENGE/i});
    expect(create.getAttribute('href')).toBe('/?surface=compiler');
    expect(screen.getByText(/I HAVE A CHALLENGE TO BUILD/i)).toBeTruthy();
    expect(screen.getByLabelText(/CHALLENGE LINK OR ID/i)).toBeTruthy();
    expect(screen.getByText(/ENTER A VALID CHALLENGE ID/i)).toBeTruthy();
    expect(screen.getByText('POST')).toBeTruthy();
    expect(screen.getByText('RECEIPT')).toBeTruthy();
  });

  it('keeps Challenge surfaces inside the same white journey shell', async () => {
    window.history.replaceState({}, '', '/?surface=compiler');
    renderJourney(client());

    expect(await screen.findByRole('navigation', {name: 'Inkubator journey'})).toBeTruthy();
    expect(document.querySelector('.challenge-journey-header h1')?.textContent).toBe('COMPILER / CREATE');
    expect(document.querySelector('.challenge-journey-runtime .challenge-product')).toBeTruthy();
    expect(screen.queryByText('WORLD')).toBeNull();
  });
});
