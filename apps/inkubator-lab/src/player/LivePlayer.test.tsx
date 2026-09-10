import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {
  InkubatorApiClient,
  PlayerHistoryView,
  PlayerProfileView,
  PlayerReputationView,
  PrivatePlayer,
} from '../generated/inkubator-api-client';
import LivePlayer from './LivePlayer';

afterEach(cleanup);

type PlayerClient = Pick<InkubatorApiClient, 'getMe' | 'getMyProfile' | 'getMyHistory' | 'getPlayerReputation'>;

const me: PrivatePlayer = {
  schema_version: 'player.private.v1',
  player_id: 'PLAYER-1',
  display_name: 'CipherCuttle',
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-10T08:00:00Z',
};

const profile: PlayerProfileView = {
  schema_version: 'player.profile.v2',
  player_id: 'PLAYER-1',
  bio: 'Builds strange useful things.',
  character_name: 'ink.operator',
  character_archetype: 'BUILDER',
  skills_needed: ['QA'],
  can_help_with: ['UI', 'SYSTEMS'],
};

const history: PlayerHistoryView = {
  schema_version: 'player.history.private.v1',
  player_id: 'PLAYER-1',
  entries: [
    {entry_id: 'H-1', kind: 'MISSION_BLOCKED', truth_state: 'CLAIMED', occurred_at: '2026-09-08T10:00:00Z', project_id: 'P-1', project_name: 'REKT MACHINE', mission_id: 'M-1'},
    {entry_id: 'H-2', kind: 'EXTERNAL_TEST_RECORDED', truth_state: 'OBSERVED', occurred_at: '2026-09-09T10:00:00Z', project_id: 'P-1', project_name: 'REKT MACHINE', test_result_id: 'TEST-1', outcome: 'PASS'},
    {entry_id: 'H-3', kind: 'SHIP_ACCEPTED', truth_state: 'PROVEN', occurred_at: '2026-09-10T10:00:00Z', project_id: 'P-1', project_name: 'REKT MACHINE', mission_id: 'M-1', receipt_id: 'R-1', artifact_title: 'REKT MACHINE', role: 'OWNER'},
  ],
};

const reputation: PlayerReputationView = {
  schema_version: 'player.reputation.public.v1',
  rule_version: 'reputation.rules.v1',
  player: {player_id: 'PLAYER-1', display_name: 'CipherCuttle'},
  metrics: {ships: 1, shipped_assists: 2, shipped_projects_assisted: 1, collaborative_ships: 1, tested_shipped_projects: 3},
  cheevos: [{
    key: 'WORKING_URL_OR_GTFO',
    label: 'Working URL or GTFO',
    description: 'Accepted Ship backed by the versioned rule.',
    rule_version: 'cheevo.rules.v1',
    truth_state: 'PROVEN',
    earned_at: '2026-09-10T10:00:01Z',
    evidence: {source_type: 'RECEIPT', source_id: 'R-1'},
  }],
};

function client(overrides: Partial<PlayerClient> = {}): PlayerClient {
  return {
    getMe: vi.fn().mockResolvedValue(me),
    getMyProfile: vi.fn().mockResolvedValue(profile),
    getMyHistory: vi.fn().mockResolvedValue(history),
    getPlayerReputation: vi.fn().mockResolvedValue(reputation),
    ...overrides,
  };
}

function renderPlayer(playerClient = client()) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(<QueryClientProvider client={queryClient}><LivePlayer client={playerClient} refetchIntervalMs={false} /></QueryClientProvider>);
}

describe('Live PLAYER', () => {
  it('renders canonical identity, chronological history and evidence-derived reputation without XP inference', async () => {
    const {container} = renderPlayer();

    expect(await screen.findByRole('heading', {name: 'Builder history.'})).toBeTruthy();
    await screen.findByRole('heading', {name: 'ink.operator'});
    await screen.findByText('Working URL or GTFO');

    expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-shell-variant')).toBe('v2');
    expect(screen.getByText('Builds strange useful things.')).toBeTruthy();
    expect(screen.getByText('UI / SYSTEMS')).toBeTruthy();
    expect(screen.getByText('QA')).toBeTruthy();
    expect(screen.getAllByText('Ship accepted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROVEN').length).toBeGreaterThan(0);
    expect(screen.getByText('RECEIPT:R-1')).toBeTruthy();
    expect(screen.getByText('SEQUENCE, NOT A PROGRESS SCORE')).toBeTruthy();
    expect(screen.getAllByText(/universal xp/i).length).toBeGreaterThan(0);
    expect(container.querySelector('.player-mascot')).toBeNull();
  });

  it('lets a record selection update the provenance inspector without changing its truth', async () => {
    const {container} = renderPlayer();
    await screen.findByText('Working URL or GTFO');
    const firstHistory = container.querySelector<HTMLButtonElement>('[data-player-history-id="H-1"]')!;
    fireEvent.click(firstHistory);
    await waitFor(() => expect(firstHistory.getAttribute('aria-pressed')).toBe('true'));
    const inspector = screen.getByRole('complementary', {name: 'Selected builder record'});
    expect(inspector.textContent).toContain('Mission blocked');
    expect(inspector.textContent).toContain('CLAIMED');
    expect(inspector.textContent).toContain('M-1');
  });

  it('isolates optional profile/history/reputation failures without inventing replacement state', async () => {
    renderPlayer(client({
      getMyProfile: vi.fn().mockRejectedValue(new Error('profile_offline')),
      getMyHistory: vi.fn().mockRejectedValue(new Error('history_offline')),
      getPlayerReputation: vi.fn().mockRejectedValue(new Error('reputation_offline')),
    }));

    expect(await screen.findByRole('heading', {name: 'CipherCuttle'})).toBeTruthy();
    expect(await screen.findByText('PROFILE LINK UNAVAILABLE')).toBeTruthy();
    expect(await screen.findByText('HISTORY LINK UNAVAILABLE')).toBeTruthy();
    expect(await screen.findByText('REPUTATION LINK UNAVAILABLE')).toBeTruthy();
    expect(screen.queryByText('Working URL or GTFO')).toBeNull();
    expect(screen.queryByText('REKT MACHINE')).toBeNull();
  });

  it('fails closed when canonical private identity is unavailable', async () => {
    renderPlayer(client({getMe: vi.fn().mockRejectedValue(new Error('session_required'))}));
    expect(await screen.findByRole('heading', {name: 'PLAYER LINK UNAVAILABLE'}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('session_required')).toBeTruthy();
    expect(screen.getByText(/No development fixture fallback is permitted/i)).toBeTruthy();
  });

  it('reopens the exact accepted receipt from builder history', async () => {
    const {container} = renderPlayer();
    await screen.findByText('Working URL or GTFO');
    fireEvent.click(container.querySelector('[data-player-history-id="H-3"]')!);
    expect(screen.getByRole('link', {name: 'Open receipt ↗'}).getAttribute('href')).toContain('receipt=');
  });
});
