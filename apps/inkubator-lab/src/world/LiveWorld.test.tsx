import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {InkubatorApiError, type InkubatorApiClient, type ProjectDiscoveryList, type WorldSignalList} from '../generated/inkubator-api-client';
import LiveWorld from './LiveWorld';

afterEach(cleanup);

type WorldClient = Pick<InkubatorApiClient, 'discoverProjects' | 'listWorldSignals' | 'getMe' | 'offerAssist' | 'getProjectExternalTests' | 'recordExternalTestResult'>;

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

const initialSignals: WorldSignalList = [
  {schema_version: 'world.signal.public.v1', signal_id: 'SIG-1', kind: 'HELP_BEACON_OPENED', project_id: 'P-1', project_name: 'WEIRD LITTLE THING', truth_state: 'CLAIMED', occurred_at: '2026-09-08T13:00:00Z'},
  {schema_version: 'world.signal.public.v1', signal_id: 'SIG-2', kind: 'EXTERNAL_TEST_RECORDED', project_id: 'P-2', project_name: 'TINY RELAY', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:10:00Z'},
];

function client(overrides: Partial<WorldClient> = {}): WorldClient {
  return {
    discoverProjects: vi.fn().mockResolvedValue(projects),
    listWorldSignals: vi.fn().mockResolvedValue(initialSignals),
    getMe: vi.fn().mockRejectedValue(new InkubatorApiError(401, 'authentication_required')),
    offerAssist: vi.fn().mockResolvedValue({schema_version: 'assist.private.v1', assist_id: 'A-1', beacon_id: 'B-1', project_id: 'P-1', offered_by_player_id: 'PLAYER-3', message: 'I can test this.', state: 'OFFERED'}),
    getProjectExternalTests: vi.fn().mockResolvedValue({schema_version: 'project.external_tests.public.v1', project_id: 'P-2', requests: [], results: []}),
    recordExternalTestResult: vi.fn().mockResolvedValue({schema_version: 'external_test.result.public.v1', test_result_id: 'TR-1', test_request_id: 'T-1', project_id: 'P-2', tester: {player_id: 'PLAYER-3', display_name: 'Helper'}, outcome: 'PASS', summary: 'Works on mobile.', observed_at: '2026-09-11T19:20:00Z'}),
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

  it('offers a clear sign-in follow-up when a public visitor wants to participate', async () => {
    renderWorld();
    expect(await screen.findByRole('link', {name: 'ENTER WITH GITHUB →'})).toBeTruthy();
    expect(screen.getByText(/WORLD is public/)).toBeTruthy();
  });

  it('lets an authenticated non-owner offer an Assist and shows the claimed follow-up', async () => {
    const offerAssist = vi.fn().mockResolvedValue({schema_version: 'assist.private.v1', assist_id: 'A-1', beacon_id: 'B-1', project_id: 'P-1', offered_by_player_id: 'PLAYER-3', message: 'I can test this.', state: 'OFFERED'});
    renderWorld(client({
      getMe: vi.fn().mockResolvedValue({schema_version: 'player.private.v1', player_id: 'PLAYER-3', display_name: 'Helper', created_at: '2026-09-11T18:00:00Z', updated_at: '2026-09-11T18:00:00Z'}),
      offerAssist,
    }));
    const newest = await screen.findByRole('button', {name: /EXTERNAL TEST RECORDED/});
    fireEvent.keyDown(newest, {key: 'ArrowDown'});
    const message = await screen.findByLabelText('Assist message');
    fireEvent.change(message, {target: {value: 'I can test this.'}});
    fireEvent.click(screen.getByRole('button', {name: 'OFFER ASSIST →'}));
    await waitFor(() => expect(offerAssist).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('status')).textContent).toContain('ASSIST OFFER SENT');
    expect(screen.getByText(/waiting for the project owner to accept/i)).toBeTruthy();
  });

  it('lets an authenticated non-owner record an open external test result and shows OBSERVED follow-up', async () => {
    const recordExternalTestResult = vi.fn().mockResolvedValue({schema_version: 'external_test.result.public.v1', test_result_id: 'TR-1', test_request_id: 'T-1', project_id: 'P-2', tester: {player_id: 'PLAYER-3', display_name: 'Helper'}, outcome: 'PASS', summary: 'Works on mobile.', observed_at: '2026-09-11T19:20:00Z'});
    renderWorld(client({
      getMe: vi.fn().mockResolvedValue({schema_version: 'player.private.v1', player_id: 'PLAYER-3', display_name: 'Helper', created_at: '2026-09-11T18:00:00Z', updated_at: '2026-09-11T18:00:00Z'}),
      getProjectExternalTests: vi.fn().mockResolvedValue({schema_version: 'project.external_tests.public.v1', project_id: 'P-2', requests: [{schema_version: 'external_test.request.public.v1', test_request_id: 'T-1', project_id: 'P-2', prompt: 'Check mobile navigation.', state: 'OPEN'}], results: []}),
      recordExternalTestResult,
    }));
    expect(await screen.findByText('Check mobile navigation.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('External test summary'), {target: {value: 'Works on mobile.'}});
    fireEvent.click(screen.getByRole('button', {name: 'RECORD TEST RESULT →'}));
    await waitFor(() => expect(recordExternalTestResult).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('status')).textContent).toContain('TEST RESULT RECORDED / OBSERVED');
  });

  it('does not offer helper/tester mutations on the selected builder own project', async () => {
    renderWorld(client({getMe: vi.fn().mockResolvedValue({schema_version: 'player.private.v1', player_id: 'PLAYER-2', display_name: 'Relay Kid', created_at: '2026-09-11T18:00:00Z', updated_at: '2026-09-11T18:00:00Z'})}));
    expect(await screen.findByText('YOUR PROJECT')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'OPEN COMMAND →'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'RECORD TEST RESULT →'})).toBeNull();
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
