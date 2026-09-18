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

  it('guides a builder from reading an open Challenge into joined state', async () => {
    const challengeId = '123e4567-e89b-42d3-a456-426614174000';
    window.history.replaceState({}, '', `/?surface=challenge&challenge=${challengeId}`);
    const getChallenge = vi.fn(async () => ({
      schema_version: 'challenge.public.v1',
      challenge_id: challengeId,
      status: 'ENTRY_OPEN',
      mechanism_version: 'test',
      settlement_policy_version: 'test',
      ip_terms_version: 'test',
      current_contract_version: '1.0.0',
      current_terms_digest: 'terms-digest',
      has_frozen_contract: true,
      slot_limit: 3,
      activation_minimum: 1,
      entry_deadline: '2026-09-18T12:00:00.000Z',
      build_start: '2026-09-18T12:30:00.000Z',
      submission_deadline: '2026-09-19T12:00:00.000Z',
      appeal_window_ms: 3600000,
      review_deadline: '2026-09-19T14:00:00.000Z',
      entry_count: 0,
      submission_count: 0,
      qualification_count: 0,
      receipt_count: 0,
      created_at: '2026-09-18T00:00:00.000Z',
      updated_at: '2026-09-18T00:00:00.000Z',
    } as never));
    const joinChallenge = vi.fn(async () => ({
      schema_version: 'challenge.entry.joined.v1',
      challenge_id: challengeId,
      entry_id: 'entry-1',
      state: 'JOINED',
      terms_digest: 'terms-digest',
    } as never));

    renderJourney(client({getChallenge, joinChallenge}));

    const guide = await screen.findByRole('complementary', {name: /BUILDER journey guidance/i});
    expect(guide.getAttribute('data-journey-step')).toBe('1');
    expect(screen.getByText('READ IT, THEN JOIN')).toBeTruthy();

    const join = await screen.findByRole('button', {name: 'JOIN THIS CHALLENGE'});
    join.click();

    expect(await screen.findByText("YOU'RE IN")).toBeTruthy();
    expect(guide.getAttribute('data-journey-step')).toBe('2');
    expect(await screen.findByRole('link', {name: /CONTINUE TO MY BUILD/i})).toBeTruthy();
    expect(joinChallenge).toHaveBeenCalledTimes(1);
  });
});
