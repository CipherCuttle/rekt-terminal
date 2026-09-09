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
  it('emphasizes the latest supported signal once and keeps the tape chronological', async () => {
    const {container} = renderWorld();

    expect(await screen.findByRole('heading', {name: 'PUBLIC SIGNALS'})).toBeTruthy();
    expect(await screen.findByText('Need an external tester.')).toBeTruthy();
    expect(screen.getAllByText('WEIRD LITTLE THING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Relay Kid').length).toBeGreaterThan(0);
    expect(screen.getByText('EXTERNAL TEST RECORDED')).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'LATEST SUPPORTED SIGNAL'})).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'SIGNAL TAPE'})).toBeTruthy();
    expect(container.querySelector('[data-now="true"]')?.getAttribute('data-signal-id')).toBe('SIG-2');
    expect(container.querySelectorAll('[data-signal-id="SIG-2"]')).toHaveLength(1);
    expect(container.querySelector('[data-signal-id="SIG-1"]')?.closest('li')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Open project context for TINY RELAY'})).toBeTruthy();
    expect(container.querySelector('.world-network-field')).toBeNull();
    expect(container.querySelector('.world-radar')).toBeNull();
    expect(container.querySelector('.world-field-route')).toBeNull();
    expect(container.querySelector('.world-radar-sweep')).toBeNull();
    expect(screen.getByText('SELF-DESCRIPTION // NOT MATCHING')).toBeTruthy();
    expect(screen.queryByText(/BUILDING|BLOCKED/)).toBeNull();
    expect(screen.queryByText(/BEST MATCH|RECOMMENDATION|COMPATIBILITY/i)).toBeNull();
    expect(container.querySelectorAll('[data-truth="proven"]')).toHaveLength(0);
    expect(screen.queryByText(/repository_full_name|refs\/heads/i)).toBeNull();
    expect(screen.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeTruthy();
  });

  it('preserves the runtime truth mapping for every supported World event kind', async () => {
    const signals: WorldSignalList = [
      {...initialSignals[0], kind: 'HELP_BEACON_OPENED', truth_state: 'CLAIMED'},
      {...initialSignals[0], signal_id: 'SIG-3', kind: 'ASSIST_ACCEPTED', truth_state: 'OBSERVED', occurred_at: '2026-09-08T12:00:00Z'},
      {...initialSignals[0], signal_id: 'SIG-4', kind: 'EXTERNAL_TEST_RECORDED', truth_state: 'OBSERVED', occurred_at: '2026-09-08T11:00:00Z'},
    ];
    const {container} = renderWorld(client({listWorldSignals: vi.fn().mockResolvedValue(signals)}));

    expect(await screen.findByText('EXTERNAL TEST RECORDED')).toBeTruthy();
    expect(container.querySelector('[data-signal-id="SIG-1"]')?.getAttribute('data-truth')).toBe('claimed');
    expect(container.querySelector('[data-signal-id="SIG-3"]')?.getAttribute('data-truth')).toBe('observed');
    expect(container.querySelector('[data-signal-id="SIG-4"]')?.getAttribute('data-truth')).toBe('observed');
    expect(screen.queryByText('PROVEN')).toBeNull();
  });

  it('fails visibly closed for unknown, malformed and contradictory signal rows', async () => {
    const unsupported = [
      {...initialSignals[0], kind: 'GITHUB_PUSH', truth_state: 'OBSERVED'},
      {...initialSignals[0], signal_id: 'SIG-BAD', kind: 'ASSIST_ACCEPTED', truth_state: 'CLAIMED'},
      {signal_id: 'SIG-MALFORMED', project_name: 'HIDDEN DETAIL'},
    ] as unknown as WorldSignalList;
    renderWorld(client({listWorldSignals: vi.fn().mockResolvedValue(unsupported)}));

    expect(await screen.findByText('NO SUPPORTED PUBLIC SIGNALS')).toBeTruthy();
    expect(screen.getAllByText('WORLD SIGNAL NOT RENDERED')).toHaveLength(3);
    expect(screen.getByText('UNKNOWN WORLD EVENT KIND')).toBeTruthy();
    expect(screen.getByText('WORLD EVENT / TRUTH MISMATCH')).toBeTruthy();
    expect(screen.queryByText('PROVEN')).toBeNull();
    expect(screen.queryByText('GITHUB PUSH')).toBeNull();
  });

  it('keeps partial public feed failures visible without collapsing available world context', async () => {
    renderWorld(client({
      discoverPlayers: vi.fn().mockRejectedValue(new Error('players_unavailable')),
      listWorldSignals: vi.fn().mockRejectedValue(new Error('signals_unavailable')),
    }));

    expect(await screen.findByText('Need an external tester.')).toBeTruthy();
    expect(await screen.findByText('PLAYER FEED UNAVAILABLE', {}, {timeout: 3000})).toBeTruthy();
    expect(screen.getAllByText('SIGNAL FEED UNAVAILABLE')).toHaveLength(2);
  });

  it('increments world event sequence only when a newly returned canonical signal appears', async () => {
    const nextSignals: WorldSignalList = [
      {schema_version: 'world.signal.public.v1', signal_id: 'SIG-3', kind: 'ASSIST_ACCEPTED', project_id: 'P-1', project_name: 'WEIRD LITTLE THING', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:20:00Z'},
      ...initialSignals,
    ];
    const worldClient = client({listWorldSignals: vi.fn().mockResolvedValueOnce(initialSignals).mockResolvedValue(nextSignals)});
    const {container, queryClient} = renderWorld(worldClient);

    await screen.findByText('EXTERNAL TEST RECORDED');
    expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-event-sequence')).toBe('0');
    await queryClient.refetchQueries({queryKey: ['inkubator', 'world', 'signals']});

    await waitFor(() => expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-event-sequence')).toBe('1'));
    expect(screen.getAllByText('ASSIST ACCEPTED').length).toBeGreaterThan(0);
  });

  it('fails closed when every canonical public feed is unavailable', async () => {
    renderWorld(client({
      discoverProjects: vi.fn().mockRejectedValue(new Error('world_offline')),
      discoverPlayers: vi.fn().mockRejectedValue(new Error('world_offline')),
      listWorldSignals: vi.fn().mockRejectedValue(new Error('world_offline')),
    }));

    expect(await screen.findByRole('heading', {name: 'WORLD LINK UNAVAILABLE'}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('world_offline')).toBeTruthy();
    expect(screen.getByText(/No development fixture fallback is permitted/i)).toBeTruthy();
  });
});
