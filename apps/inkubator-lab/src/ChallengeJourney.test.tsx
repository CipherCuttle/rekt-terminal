import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import ChallengeJourney, {type ChallengeJourneyClient} from './ChallengeJourney';

function client(overrides: Partial<ChallengeJourneyClient> = {}): ChallengeJourneyClient {
  return {
    getMe: vi.fn(async () => ({schema_version: 'player.me.v1'} as never)),
    getMyConnectionContext: vi.fn(async () => ({
      schema_version: 'player.connection_context.private.v1',
      player: {player_id: 'player-1', display_name: 'Connected Builder'},
      github: {user_id: '123', login: 'connected-builder'},
      states: {signed_in: 'SIGNED_IN', app_access: 'GRANTED', repository_authorized: 'AUTHORIZED', project_linked: 'NOT_LINKED', observing: 'NOT_OBSERVING'},
      source: {repository_id: null, repository_full_name: null, visibility: 'NONE', availability: 'NONE', last_observed_at: null},
    } as never)),
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

    expect(await screen.findByRole('heading', {name: /LAUNCH A CHALLENGE.*PROVE WHAT GETS BUILT/i})).toBeTruthy();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('surface')).toBe('discover'));
    expect(new URLSearchParams(window.location.search).get('mode')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('auth')).toBe('github');
    expect(screen.getByText(/GITHUB OBSERVATION DEGRADED/i)).toBeTruthy();
    expect(screen.queryByText('WORLD')).toBeNull();
    expect(screen.queryByText('PROJECT')).toBeNull();
    expect(screen.queryByText('PLAYER')).toBeNull();
    expect(screen.queryByText('SHIP')).toBeNull();
  });

  it('keeps connected GitHub identity visible across the journey shell', async () => {
    renderJourney(client());
    const dock = await screen.findByRole('link', {name: 'GitHub connected as connected-builder'});
    expect(dock.getAttribute('href')).toBe('https://github.com/connected-builder');
    const avatar = dock.querySelector('img');
    expect(avatar?.getAttribute('src')).toContain('github.com/connected-builder.png?size=96');
  });

  it('gives organizer and builder explicit first actions without hidden surface knowledge', async () => {
    renderJourney(client());

    const create = await screen.findByRole('link', {name: /CREATE A CHALLENGE/i});
    expect(create.getAttribute('href')).toBe('/?surface=compiler');
    expect(screen.getByText(/I HAVE A CHALLENGE TO BUILD/i)).toBeTruthy();
    expect(screen.getByLabelText(/CHALLENGE LINK OR ID/i)).toBeTruthy();
    expect(screen.getByText(/ENTER A VALID CHALLENGE ID/i)).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'WHAT\'S BUILDING?'})).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'Realtime Launch Radar'})).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'Wallet Safety Check'})).toBeTruthy();
    expect(screen.getAllByText(/EXAMPLE ONLY · NOT A LIVE CHALLENGE/i)).toHaveLength(3);
    const demoLinks = screen.getAllByRole('link', {name: 'START FROM THIS IDEA →'});
    expect(demoLinks).toHaveLength(3);
    expect(demoLinks[0]!.getAttribute('href')).toContain('surface=compiler');
    expect(demoLinks[0]!.getAttribute('href')).toContain('idea=');
    expect(screen.getByText('POST')).toBeTruthy();
    expect(screen.getByText('RECEIPT')).toBeTruthy();
  });

  it('shows the selected canonical Challenge on Discover after creation/opening', async () => {
    const challengeId = '123e4567-e89b-42d3-a456-426614174000';
    window.history.replaceState({}, '', `/?surface=discover&challenge=${challengeId}`);
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
      organizer: {display_name: 'Creator Person', github_login: 'creator-gh'},
      contract_summary: {
        contract_version: '1.0.0',
        terms_digest: 'terms-digest',
        title: 'My Launch Tracker',
        brief: 'Track the launch publicly with clear state.',
        outcome_criteria: [],
        production_criteria: [],
        delivery_criteria: [],
        normative_constraints: [],
        normative_references: [],
        informational_references: [{id: 'creator-x-profile', url: 'https://x.com/creator_handle'}],
        prize_minor_units: 100,
        settlement_asset: 'TEST',
      },
      slot_limit: 3,
      activation_minimum: 1,
      entry_deadline: '2026-09-18T12:00:00.000Z',
      build_start: '2026-09-18T12:30:00.000Z',
      submission_deadline: '2026-09-19T12:00:00.000Z',
      appeal_window_ms: 3600000,
      review_deadline: '2026-09-19T14:00:00.000Z',
      entry_count: 1,
      submission_count: 0,
      qualification_count: 0,
      receipt_count: 0,
      created_at: '2026-09-18T00:00:00.000Z',
      updated_at: '2026-09-18T00:00:00.000Z',
    } as never));

    renderJourney(client({getChallenge}));

    expect(await screen.findByText('YOUR CURRENT CHALLENGE')).toBeTruthy();
    expect(await screen.findByRole('heading', {name: 'My Launch Tracker'})).toBeTruthy();
    expect(await screen.findByText('Track the launch publicly with clear state.')).toBeTruthy();
    expect(screen.getByText(/Creator Person/i)).toBeTruthy();
    expect(screen.getByRole('link', {name: /GITHUB \/ @creator-gh/i}).getAttribute('href')).toBe('https://github.com/creator-gh');
    expect(screen.getByRole('link', {name: /X PROFILE/i}).getAttribute('href')).toBe('https://x.com/creator_handle');
    expect(screen.getByRole('link', {name: 'OPEN YOUR CHALLENGE →'}).getAttribute('href')).toContain(challengeId);
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
      contract_summary: {
        contract_version: '1.0.0',
        terms_digest: 'terms-digest',
        title: 'Build a public launch dashboard',
        brief: 'Ship a realtime dashboard that makes the launch state obvious.',
        outcome_criteria: [{id: 'outcome-1', description: 'The dashboard shows the current launch state.', mandatory: true}],
        production_criteria: [{id: 'production-1', description: 'The public view recovers after reload.', mandatory: true}],
        delivery_criteria: [{id: 'delivery-1', description: 'Provide an immutable source reference.', mandatory: true}],
        normative_constraints: [],
        normative_references: [],
        informational_references: [],
        prize_minor_units: 100,
        settlement_asset: 'TEST',
      },
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
    expect(screen.getByRole('heading', {name: 'Build a public launch dashboard'})).toBeTruthy();
    expect(screen.getByText('Ship a realtime dashboard that makes the launch state obvious.')).toBeTruthy();
    expect(screen.getByText('The dashboard shows the current launch state.')).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'WHAT COUNTS AS DONE?'})).toBeTruthy();
    expect(screen.getAllByText('MUST PASS').length).toBeGreaterThan(0);

    const join = await screen.findByRole('button', {name: 'JOIN THIS CHALLENGE'});
    await waitFor(() => expect((join as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(join);

    expect(await screen.findByText("YOU'RE IN")).toBeTruthy();
    expect(guide.getAttribute('data-journey-step')).toBe('2');
    expect(await screen.findByRole('link', {name: /CONTINUE TO MY BUILD/i})).toBeTruthy();
    expect(joinChallenge).toHaveBeenCalledTimes(1);
  });

  it('fails builder entry closed when the locked rule projection is unavailable', async () => {
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
      contract_summary: null,
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

    renderJourney(client({getChallenge, joinChallenge: vi.fn()}));

    expect(await screen.findByText('RULES NOT AVAILABLE YET')).toBeTruthy();
    expect(screen.getByText(/will not offer a Join action/i)).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'JOIN THIS CHALLENGE'})).toBeNull();
  });
});
