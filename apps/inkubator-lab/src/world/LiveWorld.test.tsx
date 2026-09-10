import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
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
  it('indexes public events in time order without invented topology or private routes', async () => {
    const {container} = renderWorld();
    expect(await screen.findByRole('heading', {name: 'Public signal.'})).toBeTruthy();
    const first = await screen.findByRole('button', {name: /EXTERNAL TEST RECORDED/});
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.world-radar')).toBeNull();
    expect(container.querySelectorAll('[data-truth="proven"]')).toHaveLength(0);
    expect(container.querySelector('a[href*="mode=project"]')).toBeNull();
    fireEvent.keyDown(first, {key: 'ArrowDown'});
    expect(screen.getByRole('button', {name: /HELP BEACON OPENED/}).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('complementary').textContent).toContain('Need an external tester.');
    expect(screen.queryByText(/repository_full_name|refs\/heads/i)).toBeNull();
  });

  it('keeps public events useful when project context is unavailable', async () => {
    renderWorld(client({discoverProjects: vi.fn().mockRejectedValue(new Error('projects_unavailable'))}));
    expect(await screen.findByText('PROJECT CONTEXT UNAVAILABLE')).toBeTruthy();
    expect(screen.getByRole('button', {name: /EXTERNAL TEST RECORDED/})).toBeTruthy();
  });

  it('responds once to new backend events and never animates historical hydration', async () => {
    const nextSignals: WorldSignalList = [{schema_version: 'world.signal.public.v1', signal_id: 'SIG-3', kind: 'ASSIST_ACCEPTED', project_id: 'P-1', project_name: 'WEIRD LITTLE THING', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:20:00Z'}, ...initialSignals];
    const worldClient = client({listWorldSignals: vi.fn().mockResolvedValueOnce(initialSignals).mockResolvedValue(nextSignals)});
    const {container, queryClient} = renderWorld(worldClient);
    await screen.findByRole('button', {name: /EXTERNAL TEST RECORDED/});
    expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-event-sequence')).toBe('0');
    expect(container.querySelector('[data-cue="SOURCE_RX"]')?.getAttribute('data-frame')).toBe('4');
    await queryClient.refetchQueries({queryKey: ['inkubator', 'world', 'signals']});
    await waitFor(() => expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-event-sequence')).toBe('1'));
    await queryClient.refetchQueries({queryKey: ['inkubator', 'world', 'signals']});
    expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-event-sequence')).toBe('1');
  });

  it('labels retained history stale and freezes event motion after refresh failure', async () => {
    const worldClient = client({listWorldSignals: vi.fn().mockResolvedValueOnce(initialSignals).mockRejectedValue(new Error('offline'))});
    const {container, queryClient} = renderWorld(worldClient);
    await screen.findByRole('button', {name: /EXTERNAL TEST RECORDED/});
    await queryClient.refetchQueries({queryKey: ['inkubator', 'world', 'signals']});
    expect(await screen.findByText('STALE PUBLIC SNAPSHOT')).toBeTruthy();
    expect(screen.getByRole('button', {name: /EXTERNAL TEST RECORDED/})).toBeTruthy();
    expect(container.querySelector('[data-cue]')).toBeNull();
    expect(screen.getByRole('complementary').textContent).toContain('STALE SNAPSHOT');
  });

  it('shows unavailable rather than an empty or fixture public feed on failure', async () => {
    renderWorld(client({listWorldSignals: vi.fn().mockRejectedValue(new Error('world_offline'))}));
    expect(await screen.findByText('WORLD LINK UNAVAILABLE')).toBeTruthy();
    expect(screen.queryByText('NO PUBLIC SIGNALS')).toBeNull();
    expect(screen.getByRole('button', {name: 'Retry public events'})).toBeTruthy();
  });
});
