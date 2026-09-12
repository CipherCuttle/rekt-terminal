import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {InkubatorApiError, type CommandView, type GitHubRepositoryChoices, type InkubatorApiClient} from '../generated/inkubator-api-client';
import type {InkubatorProductApiClient} from '../inkubator-api';
import {CommandActions} from './CommandActions';

afterEach(cleanup);

function commandView(overrides: Partial<CommandView> = {}): CommandView {
  return {
    schema_version: 'command.private.v2',
    project: {project_id: 'P-001', name: 'WEIRD LITTLE THING', source_connected: false, source_visibility: 'NONE', observation_state: 'UNKNOWN'},
    mission: {
      mission_id: 'M-001', state: 'BUILDING', goal: 'Make the thing real.', ship_condition: 'A working link exists.',
      current_focus: 'Wire the canonical command projection.', next_move: 'CONNECT THE REPOSITORY',
      progress_model_version: 'mission.progress.v1', stack_labels: ['TYPESCRIPT'], stack_source: 'PLAYER_CONFIRMED',
    },
    round: {round_id: 'R-001', code: 'R1', title: 'FOUNDING', constraint: 'Ship one working thing.', state: 'OPEN'},
    gates: [{key: 'FOUNDATION', label: 'FOUNDATION', state: 'ACTIVE', position: 1}],
    github_evidence: {
      rule_version: 'github-evidence.v1', source_state: 'UNAVAILABLE', signal_state: 'UNKNOWN', stale_after_ms: 300000,
      invalid_observation_count: 0, reason_code: 'source_unavailable_no_evidence', observed_stacks: [],
    },
    daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'No evidence yet.', proposed_next_move: 'Connect the repository.'},
    ...overrides,
  };
}

const repositories: GitHubRepositoryChoices = [
  {repository_id: '11001', full_name: 'coherence/private-source', private: true},
];

type ActionClient = Pick<InkubatorApiClient, 'updateMission' | 'listGitHubRepositories' | 'createGitHubInstall' | 'linkProjectGitHubRepository' | 'createHelpBeacon' | 'closeHelpBeacon' | 'getProjectHelpLoop' | 'acceptAssist' | 'createExternalTestRequest' | 'getProjectExternalTests'> & Pick<InkubatorProductApiClient, 'getProjectPendingAssists'>;

function client(overrides: Partial<ActionClient> = {}): ActionClient {
  return {
    updateMission: vi.fn().mockResolvedValue(commandView()),
    listGitHubRepositories: vi.fn().mockResolvedValue([]),
    createGitHubInstall: vi.fn().mockResolvedValue({schema_version: 'github.install.v1', install_url: 'https://github.test/install', expires_at: '2026-09-11T19:00:00Z'}),
    linkProjectGitHubRepository: vi.fn().mockResolvedValue({}),
    createHelpBeacon: vi.fn().mockResolvedValue({}),
    closeHelpBeacon: vi.fn().mockResolvedValue({}),
    getProjectHelpLoop: vi.fn().mockResolvedValue({schema_version: 'project.help_loop.public.v1', project_id: 'P-001', owner: {schema_version: 'player.public.v2', player_id: 'OWNER-1', display_name: 'Owner', skills_needed: [], can_help_with: []}, party_members: []}),
    getProjectPendingAssists: vi.fn().mockResolvedValue({schema_version: 'project.pending_assists.private.v1', project_id: 'P-001', assists: []}),
    acceptAssist: vi.fn().mockResolvedValue({}),
    createExternalTestRequest: vi.fn().mockResolvedValue({}),
    getProjectExternalTests: vi.fn().mockResolvedValue({schema_version: 'project.external_tests.public.v1', project_id: 'P-001', requests: [], results: []}),
    ...overrides,
  };
}

function renderActions(command: CommandView, overrides: Partial<ActionClient> = {}) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const actionClient = client(overrides);
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <CommandActions command={command} client={actionClient} />
      </QueryClientProvider>,
    ),
    queryClient,
    client: actionClient,
  };
}

function openSection(summary: string) {
  const element = screen.getByText(summary, {exact: true});
  if (!(element.closest('details') as HTMLDetailsElement | null)?.open) fireEvent.click(element);
}

describe('CommandActions journey mutations', () => {
  it('saves work state through PATCH /v1/missions/:id and invalidates the command query on success', async () => {
    const updateMission = vi.fn().mockResolvedValue(commandView());
    renderActions(commandView(), {updateMission});
    openSection('EDIT WORK / DECLARED STATE');
    fireEvent.change(screen.getByLabelText('Next move'), {target: {value: 'Test the artifact.'}});
    fireEvent.change(screen.getByLabelText('Current focus'), {target: {value: 'Wiring the journey.'}});
    fireEvent.click(screen.getByRole('button', {name: 'SAVE WORK STATE'}));
    await waitFor(() => expect(updateMission).toHaveBeenCalledTimes(1));
    const [missionId, body] = updateMission.mock.calls[0] as [string, {request_id: string; state: string; current_focus: string; next_move: string; blocker: string | null}];
    expect(missionId).toBe('M-001');
    expect(body.request_id).toBeTruthy();
    expect(body.state).toBe('BUILDING');
    expect(body.next_move).toBe('Test the artifact.');
    expect(body.blocker).toBeNull();
    expect((await screen.findByRole('status')).textContent).toContain('Work state updated');
  });

  it('fails closed with an UNAUTHORIZED alert when the server rejects the work update', async () => {
    const updateMission = vi.fn().mockRejectedValue(new InkubatorApiError(403, 'authorization_denied'));
    renderActions(commandView(), {updateMission});
    openSection('EDIT WORK / DECLARED STATE');
    fireEvent.click(screen.getByRole('button', {name: 'SAVE WORK STATE'}));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('UNAUTHORIZED');
    expect(alert.textContent).toContain('authorization_denied');
  });

  it('distinguishes GitHub sign-in from repository authorization and links an authorized repository', async () => {
    const linkProjectGitHubRepository = vi.fn().mockResolvedValue({});
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockResolvedValue(repositories), linkProjectGitHubRepository});
    expect(screen.getByText(/GitHub sign-in identifies you\. GitHub App access controls which repositories REKT may read\./)).toBeTruthy();
    expect(await screen.findByText('REPOSITORY ACCESS READY / 1 AVAILABLE')).toBeTruthy();
    expect(await screen.findByRole('option', {name: 'coherence/private-source / PRIVATE'})).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Authorized repository', {exact: true}), {target: {value: '11001'}});
    fireEvent.click(screen.getByRole('button', {name: 'LINK AUTHORIZED REPOSITORY'}));
    await waitFor(() => expect(linkProjectGitHubRepository).toHaveBeenCalledTimes(1));
    expect(linkProjectGitHubRepository.mock.calls[0]).toEqual(['P-001', {repository_id: '11001'}]);
    expect(await screen.findByText(/Repository linked\. COMMAND will now watch the canonical source projection\./)).toBeTruthy();
  });

  it('renders the empty repository state fail-closed and keeps an explicit GitHub sync path', async () => {
    const linkProjectGitHubRepository = vi.fn();
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockResolvedValue([]), linkProjectGitHubRepository});
    expect(await screen.findByText(/No repositories are known to Inkubator yet/)).toBeTruthy();
    const submit = screen.getByRole('button', {name: 'LINK AUTHORIZED REPOSITORY'}) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const sync = screen.getByRole('button', {name: 'SYNC GITHUB ACCESS'}) as HTMLButtonElement;
    expect(sync.disabled).toBe(false);
    fireEvent.click(submit);
    expect(linkProjectGitHubRepository).not.toHaveBeenCalled();
  });

  it('surfaces repository list UNAUTHORIZED without pretending repositories exist', async () => {
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockRejectedValue(new InkubatorApiError(401, 'authentication_required'))});
    expect(await screen.findByText(/Authorized repositories unavailable/)).toBeTruthy();
    expect((screen.getByLabelText('Authorized repository', {exact: true}) as HTMLSelectElement).disabled).toBe(true);
  });

  it('opens a help beacon and then renders the canonical open follow-up instead of another create form', async () => {
    const beacon = {schema_version: 'help_beacon.public.v1' as const, beacon_id: 'B-1', project_id: 'P-001', summary: 'Review the mobile journey.', skills_needed: [], state: 'OPEN' as const};
    const createHelpBeacon = vi.fn().mockResolvedValue(beacon);
    const getProjectHelpLoop = vi.fn()
      .mockResolvedValueOnce({schema_version: 'project.help_loop.public.v1', project_id: 'P-001', owner: {schema_version: 'player.public.v2', player_id: 'OWNER-1', display_name: 'Owner', skills_needed: [], can_help_with: []}, party_members: []})
      .mockResolvedValue({schema_version: 'project.help_loop.public.v1', project_id: 'P-001', owner: {schema_version: 'player.public.v2', player_id: 'OWNER-1', display_name: 'Owner', skills_needed: [], can_help_with: []}, open_help_beacon: beacon, party_members: []});
    const {queryClient} = renderActions(commandView(), {createHelpBeacon, getProjectHelpLoop});
    openSection('HELP / ASK FOR A CONTRIBUTION');
    await screen.findByLabelText('What help would move this build forward?');
    fireEvent.change(screen.getByLabelText('What help would move this build forward?'), {target: {value: 'Review the mobile journey.'}});
    fireEvent.click(screen.getByRole('button', {name: 'OPEN HELP BEACON'}));
    await waitFor(() => expect(createHelpBeacon).toHaveBeenCalledTimes(1));
    await queryClient.refetchQueries({queryKey: ['inkubator', 'project', 'P-001', 'help']});
    expect(await screen.findByText('HELP BEACON / OPEN')).toBeTruthy();
    expect(screen.getByText('Review the mobile journey.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'OPEN HELP BEACON'})).toBeNull();
    expect(screen.getByRole('button', {name: 'CLOSE HELP BEACON'})).toBeTruthy();
  });

  it('surfaces an owner-private pending Assist and reconciles after acceptance', async () => {
    const beacon = {schema_version: 'help_beacon.public.v1' as const, beacon_id: 'B-1', project_id: 'P-001', summary: 'Need QA.', skills_needed: [], state: 'OPEN' as const};
    const offer = {assist_id: 'A-1', beacon_id: 'B-1', project_id: 'P-001', offered_by_player_id: 'HELPER-1', offered_by_display_name: 'Helpful Goblin', message: 'I can reproduce the mobile bug.', state: 'OFFERED' as const, offered_at: '2026-09-11T19:00:00Z'};
    const getProjectPendingAssists = vi.fn()
      .mockResolvedValueOnce({schema_version: 'project.pending_assists.private.v1' as const, project_id: 'P-001', assists: [offer]})
      .mockResolvedValue({schema_version: 'project.pending_assists.private.v1' as const, project_id: 'P-001', assists: []});
    const acceptAssist = vi.fn().mockResolvedValue({schema_version: 'assist.private.v1', assist_id: 'A-1', state: 'ACCEPTED'});
    renderActions(commandView(), {
      getProjectHelpLoop: vi.fn().mockResolvedValue({schema_version: 'project.help_loop.public.v1', project_id: 'P-001', owner: {schema_version: 'player.public.v2', player_id: 'OWNER-1', display_name: 'Owner', skills_needed: [], can_help_with: []}, open_help_beacon: beacon, party_members: []}),
      getProjectPendingAssists,
      acceptAssist,
    });
    expect(await screen.findByText('ASSIST OFFERS / 1 PENDING')).toBeTruthy();
    expect(screen.getByText('Helpful Goblin')).toBeTruthy();
    expect(screen.getByText('I can reproduce the mobile bug.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'ACCEPT ASSIST'}));
    await waitFor(() => expect(acceptAssist).toHaveBeenCalledTimes(1));
    const [assistId, body] = acceptAssist.mock.calls[0] as [string, {request_id:string}];
    expect(assistId).toBe('A-1');
    expect(body.request_id).toBeTruthy();
    expect(await screen.findByText('Assist accepted. Party state will reconcile automatically.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('I can reproduce the mobile bug.')).toBeNull());
  });

  it('fails closed if pending Assist authority is lost', async () => {
    const beacon = {schema_version: 'help_beacon.public.v1' as const, beacon_id: 'B-1', project_id: 'P-001', summary: 'Need QA.', skills_needed: [], state: 'OPEN' as const};
    renderActions(commandView(), {
      getProjectHelpLoop: vi.fn().mockResolvedValue({schema_version: 'project.help_loop.public.v1', project_id: 'P-001', owner: {schema_version: 'player.public.v2', player_id: 'OWNER-1', display_name: 'Owner', skills_needed: [], can_help_with: []}, open_help_beacon: beacon, party_members: []}),
      getProjectPendingAssists: vi.fn().mockRejectedValue(new InkubatorApiError(403, 'authorization_denied')),
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('PENDING ASSISTS UNAVAILABLE');
    expect(alert.textContent).toContain('UNAUTHORIZED');
  });

  it('closes the live Help Beacon and invalidates the journey projections', async () => {
    const beacon = {schema_version: 'help_beacon.public.v1' as const, beacon_id: 'B-1', project_id: 'P-001', summary: 'Need QA.', skills_needed: [], state: 'OPEN' as const};
    const closeHelpBeacon = vi.fn().mockResolvedValue({...beacon, state: 'CLOSED'});
    renderActions(commandView(), {getProjectHelpLoop: vi.fn().mockResolvedValue({schema_version: 'project.help_loop.public.v1', project_id: 'P-001', owner: {schema_version: 'player.public.v2', player_id: 'OWNER-1', display_name: 'Owner', skills_needed: [], can_help_with: []}, open_help_beacon: beacon, party_members: []}), closeHelpBeacon});
    openSection('HELP / ASK FOR A CONTRIBUTION');
    fireEvent.click(await screen.findByRole('button', {name: 'CLOSE HELP BEACON'}));
    await waitFor(() => expect(closeHelpBeacon).toHaveBeenCalledTimes(1));
    expect(closeHelpBeacon.mock.calls[0][0]).toBe('B-1');
  });

  it('shows a generic fail-closed alert when the help beacon mutation fails without a typed error', async () => {
    const createHelpBeacon = vi.fn().mockRejectedValue(new Error('help_beacon_not_open'));
    renderActions(commandView(), {createHelpBeacon});
    openSection('HELP / ASK FOR A CONTRIBUTION');
    await screen.findByLabelText('What help would move this build forward?');
    fireEvent.change(screen.getByLabelText('What help would move this build forward?'), {target: {value: 'Review the mobile journey.'}});
    fireEvent.click(screen.getByRole('button', {name: 'OPEN HELP BEACON'}));
    expect((await screen.findByRole('alert')).textContent).toBe('help_beacon_not_open');
  });

  it('requests an external test and replaces the create form with the canonical open request after refresh', async () => {
    const request = {schema_version: 'external_test.request.public.v1' as const, test_request_id: 'T-1', project_id: 'P-001', prompt: 'Check the public artifact navigation.', state: 'OPEN' as const};
    const createExternalTestRequest = vi.fn().mockResolvedValue(request);
    const getProjectExternalTests = vi.fn()
      .mockResolvedValueOnce({schema_version: 'project.external_tests.public.v1', project_id: 'P-001', requests: [], results: []})
      .mockResolvedValue({schema_version: 'project.external_tests.public.v1', project_id: 'P-001', requests: [request], results: []});
    const {queryClient} = renderActions(commandView(), {createExternalTestRequest, getProjectExternalTests});
    openSection('EXTERNAL TEST / ASK FOR EVIDENCE');
    await screen.findByLabelText('What should another builder test?');
    fireEvent.change(screen.getByLabelText('What should another builder test?'), {target: {value: 'Check the public artifact navigation.'}});
    fireEvent.click(screen.getByRole('button', {name: 'REQUEST EXTERNAL TEST'}));
    await waitFor(() => expect(createExternalTestRequest).toHaveBeenCalledTimes(1));
    await queryClient.refetchQueries({queryKey: ['inkubator', 'project', 'P-001', 'tests']});
    expect(await screen.findByText('EXTERNAL TEST / OPEN')).toBeTruthy();
    expect(screen.getByText('Check the public artifact navigation.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'REQUEST EXTERNAL TEST'})).toBeNull();
  });

  it('renders UNAUTHORIZED instead of success when an external test request is denied', async () => {
    const createExternalTestRequest = vi.fn().mockRejectedValue(new InkubatorApiError(401, 'authentication_required'));
    renderActions(commandView(), {createExternalTestRequest});
    openSection('EXTERNAL TEST / ASK FOR EVIDENCE');
    await screen.findByLabelText('What should another builder test?');
    fireEvent.change(screen.getByLabelText('What should another builder test?'), {target: {value: 'Check the public artifact navigation.'}});
    fireEvent.click(screen.getByRole('button', {name: 'REQUEST EXTERNAL TEST'}));
    expect((await screen.findByRole('alert')).textContent).toContain('UNAUTHORIZED');
  });

  it('hides mutation controls when the mission is terminal (fail-closed, no fake edit)', () => {
    renderActions(commandView({mission: {...commandView().mission, state: 'CLOSED_NOT_SHIPPED'}}));
    expect(screen.queryByText('EDIT WORK / DECLARED STATE')).toBeNull();
    expect(screen.queryByText('HELP / ASK FOR A CONTRIBUTION')).toBeNull();
    expect(screen.queryByText('EXTERNAL TEST / ASK FOR EVIDENCE')).toBeNull();
  });

  it('keeps repository authorization outside the mission edit boundary when the source is already connected', () => {
    renderActions(commandView({project: {project_id: 'P-001', name: 'WEIRD LITTLE THING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'}}));
    openSection('SOURCE / REPOSITORY ACCESS');
    expect(screen.getByText(/MISSION SOURCE LINKED \/ PRIVATE \/ OBSERVED/)).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'AUTHORIZE REPOSITORIES'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'LINK AUTHORIZED REPOSITORY'})).toBeNull();
    expect(screen.getByRole('button', {name: 'MANAGE GITHUB ACCESS'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'CHANGE MISSION SOURCE'})).toBeTruthy();
    expect(screen.getByText('Source arrival is observed server-side. A connection alone is not evidence of completed work.')).toBeTruthy();
  });
});