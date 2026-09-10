import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {InkubatorApiClient, ProjectDiscoveryList, PublicPlayerList, WorldSignalList} from '../generated/inkubator-api-client';
import LiveWorld from './LiveWorld';

afterEach(cleanup);

type WorldClient = Pick<InkubatorApiClient, 'discoverProjects' | 'discoverPlayers' | 'listWorldSignals'>;

const projects: ProjectDiscoveryList = [
  {
    schema_version: 'project.discovery.v1',
    project: {schema_version: 'project.public.v2', project_id: 'P-1', name: 'WEIRD LITTLE THING', mission_id: 'M-1', mission_state: 'BUILDING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'},
    owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-1', display_name: 'Builder', skills_needed: ['QA'], can_help_with: ['UI']},
    open_help_beacon: {schema_version: 'help_beacon.public.v1', beacon_id: 'B-1', project_id: 'P-1', summary: 'Need an external tester.', skills_needed: ['QA'], state: 'OPEN'},
  },
  {
    schema_version: 'project.discovery.v1',
    project: {schema_version: 'project.public.v2', project_id: 'P-2', name: 'TINY RELAY', mission_id: 'M-2', mission_state: 'BLOCKED', source_connected: true, source_visibility: 'PUBLIC', observation_state: 'STALE'},
    owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-2', display_name: 'Relay Kid', skills_needed: [], can_help_with: ['RUST']},
  },
];

const players: PublicPlayerList = [
  {schema_version: 'player.public.v2', player_id: 'PLAYER-1', display_name: 'Builder', skills_needed: ['QA'], can_help_with: ['UI']},
  {schema_version: 'player.public.v2', player_id: 'PLAYER-2', display_name: 'Relay Kid', skills_needed: [], can_help_with: ['RUST']},
];

const initialSignals: WorldSignalList = [
  {schema_version: 'world.signal.public.v1', signal_id: 'SIG-1', kind: 'HELP_BEACON_OPENED', project_id: 'P-1', project_name: 'WEIRD LITTLE THING', truth_state: 'CLAIMED', occurred_at: '2026-09-08T13:00:00Z'},
  {schema_version: 'world.signal.public.v1', signal_id: 'SIG-2', kind: 'EXTERNAL_TEST_RECORDED', project_id: 'P-2', project_name: 'TINY RELAY', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:10:00Z'},
];

function client(overrides: Partial<WorldClient> = {}): WorldClient {
  return {
    discoverProjects: vi.fn().mockResolvedValue(projects),
    discoverPlayers: vi.fn().mockResolvedValue(players),
    listWorldSignals: vi.fn().mockResolvedValue(initialSignals),
    ...overrides,
  };
}

function renderWorld(worldClient = client()) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const result = render(
    <QueryClientProvider client={queryClient}>
      <LiveWorld client={worldClient} refetchIntervalMs={false} />
    </QueryClientProvider>,
  );
  return {...result, queryClient};
}

describe('Live World', () => {
  it('renders only canonical public projections in the v2 pulse and network instruments', async () => {
    const {container} = renderWorld();

    expect(await screen.findByRole('heading', {name: 'UNDERGROUND BUILD NETWORK'})).toBeTruthy();
    expect(await screen.findByText('1 OPEN HELP BEACON')).toBeTruthy();
    expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-shell-variant')).toBe('v2');
    expect((await screen.findAllByText('Need an external tester.')).length).toBe(2);
    expect(screen.getAllByText('WEIRD LITTLE THING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Relay Kid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('EXTERNAL TEST RECORDED').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('img', {name: 'Public Inkubator project and signal radar'})).toBeTruthy();
    expect(container.querySelectorAll('[data-truth="proven"]')).toHaveLength(0);
    expect(screen.queryByText(/repository_full_name|refs\/heads/i)).toBeNull();
    expect(screen.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeTruthy();
  });

  it('keeps partial public feed failures visible without collapsing available world context', async () => {
    renderWorld(client({
      discoverPlayers: vi.fn().mockRejectedValue(new Error('players_unavailable')),
      listWorldSignals: vi.fn().mockRejectedValue(new Error('signals_unavailable')),
    }));

    expect((await screen.findAllByText('Need an external tester.')).length).toBe(2);
    expect(await screen.findByText('PLAYER FEED UNAVAILABLE', {}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('SIGNAL FEED UNAVAILABLE')).toBeTruthy();
  });

  it('increments world event sequence only when a newly returned canonical signal appears', async () => {
    const nextSignals: WorldSignalList = [
      {schema_version: 'world.signal.public.v1', signal_id: 'SIG-3', kind: 'ASSIST_ACCEPTED', project_id: 'P-1', project_name: 'WEIRD LITTLE THING', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:20:00Z'},
      ...initialSignals,
    ];
    const worldClient = client({listWorldSignals: vi.fn().mockResolvedValueOnce(initialSignals).mockResolvedValue(nextSignals)});
    const {container, queryClient} = renderWorld(worldClient);

    await screen.findAllByText('EXTERNAL TEST RECORDED');
    expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-event-sequence')).toBe('0');
    await queryClient.refetchQueries({queryKey: ['inkubator', 'world', 'signals']});

    await waitFor(() => {
      expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-event-sequence')).toBe('1');
      expect(screen.getAllByText('ASSIST ACCEPTED').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('fails closed when every canonical public feed is unavailable', async () => {
    renderWorld(client({
      discoverProjects: vi.fn().mockRejectedValue(new Error('world_offline')),
      discoverPlayers: vi.fn().mockRejectedValue(new Error('world_offline')),
      listWorldSignals: vi.fn().mockRejectedValue(new Error('world_offline')),
    }));

    expect(await screen.findByRole('heading', {name: 'WORLD LINK UNAVAILABLE'}, {timeout: 3000})).toBeTruthy();
    expect(screen.getAllByText('world_offline').length).toBeGreaterThan(0);
    expect(screen.getByText(/No development fixture fallback is permitted/i)).toBeTruthy();
  });
});
