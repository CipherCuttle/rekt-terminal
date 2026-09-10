import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {InkubatorApiError, type CommandView, type GitHubRepositoryChoices} from '../generated/inkubator-api-client';
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

function renderActions(command: CommandView, client: Record<string, unknown>) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandActions command={command} client={client as never} />
    </QueryClientProvider>,
  );
}

function openSection(summary: string) {
  fireEvent.click(screen.getByText(summary, {exact: true}));
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
    await screen.findByRole('status');
    expect(screen.getByRole('status').textContent).toBe('Recorded by Inkubator.');
  });

  it('fails closed with an UNAUTHORIZED alert when the server rejects the work update', async () => {
    const updateMission = vi.fn().mockRejectedValue(new InkubatorApiError(403, 'authorization_denied'));
    renderActions(commandView(), {updateMission});
    openSection('EDIT WORK / DECLARED STATE');
    fireEvent.click(screen.getByRole('button', {name: 'SAVE WORK STATE'}));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('UNAUTHORIZED');
    expect(alert.textContent).toContain('authorization_denied');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('distinguishes GitHub sign-in from repository authorization and links an authorized repository', async () => {
    const linkProjectGitHubRepository = vi.fn().mockResolvedValue(commandView({project: {project_id: 'P-001', name: 'WEIRD LITTLE THING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'ACTIVE'}}));
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockResolvedValue(repositories), linkProjectGitHubRepository});
    openSection('SOURCE / REPOSITORY ACCESS');
    expect(screen.getByText('GitHub sign-in identifies you. Installing the read-only GitHub App separately authorizes selected repositories.')).toBeTruthy();
    expect(screen.getByText('NO REPOSITORY CONNECTED')).toBeTruthy();
    expect(await screen.findByRole('option', {name: 'coherence/private-source / PRIVATE'})).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Authorized repository', {exact: true}), {target: {value: '11001'}});
    fireEvent.click(screen.getByRole('button', {name: 'LINK AUTHORIZED REPOSITORY'}));
    await waitFor(() => expect(linkProjectGitHubRepository).toHaveBeenCalledTimes(1));
    expect(linkProjectGitHubRepository.mock.calls[0]).toEqual(['P-001', {repository_id: '11001'}]);
    await screen.findByRole('status');
  });

  it('renders the empty repository state fail-closed and never fakes a source link', async () => {
    const linkProjectGitHubRepository = vi.fn();
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockResolvedValue([]), linkProjectGitHubRepository});
    openSection('SOURCE / REPOSITORY ACCESS');
    expect(await screen.findByText('No repositories authorized yet. Authorize repositories above, then return here.')).toBeTruthy();
    const submit = screen.getByRole('button', {name: 'LINK AUTHORIZED REPOSITORY'}) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const select = screen.getByLabelText('Authorized repository', {exact: true}) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    fireEvent.click(submit);
    expect(linkProjectGitHubRepository).not.toHaveBeenCalled();
  });

  it('surfaces repository list UNAUTHORIZED without pretending repositories exist', async () => {
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockRejectedValue(new InkubatorApiError(401, 'authentication_required')), linkProjectGitHubRepository: vi.fn()});
    openSection('SOURCE / REPOSITORY ACCESS');
    expect(await screen.findByText('Authorized repositories unavailable.')).toBeTruthy();
    expect((screen.getByLabelText('Authorized repository', {exact: true}) as HTMLSelectElement).disabled).toBe(true);
  });

  it('opens a help beacon through POST /v1/projects/:id/help-beacons', async () => {
    const createHelpBeacon = vi.fn().mockResolvedValue({schema_version: 'help_beacon.public.v1', beacon_id: 'B-1', project_id: 'P-001', summary: 'Review the mobile journey.', skills_needed: [], state: 'OPEN'});
    renderActions(commandView(), {createHelpBeacon});
    openSection('HELP / ASK FOR A CONTRIBUTION');
    fireEvent.change(screen.getByLabelText('What help would move this build forward?'), {target: {value: 'Review the mobile journey.'}});
    fireEvent.click(screen.getByRole('button', {name: 'OPEN HELP BEACON'}));
    await waitFor(() => expect(createHelpBeacon).toHaveBeenCalledTimes(1));
    const [projectId, body] = createHelpBeacon.mock.calls[0] as [string, {request_id: string; summary: string}];
    expect(projectId).toBe('P-001');
    expect(body.summary).toBe('Review the mobile journey.');
    expect(body.request_id).toBeTruthy();
    await screen.findByRole('status');
  });

  it('shows a generic fail-closed alert when the help beacon mutation fails without a typed error', async () => {
    const createHelpBeacon = vi.fn().mockRejectedValue(new Error('help_beacon_not_open'));
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockResolvedValue([]), createHelpBeacon});
    openSection('HELP / ASK FOR A CONTRIBUTION');
    fireEvent.change(screen.getByLabelText('What help would move this build forward?'), {target: {value: 'Review the mobile journey.'}});
    fireEvent.click(screen.getByRole('button', {name: 'OPEN HELP BEACON'}));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('help_beacon_not_open');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('requests an external test through POST /v1/projects/:id/tester-requests', async () => {
    const createExternalTestRequest = vi.fn().mockResolvedValue({schema_version: 'external_test.request.public.v1', test_request_id: 'T-1', project_id: 'P-001', prompt: 'Check the public artifact navigation.', state: 'OPEN'});
    renderActions(commandView(), {createExternalTestRequest});
    openSection('EXTERNAL TEST / ASK FOR EVIDENCE');
    fireEvent.change(screen.getByLabelText('What should another builder test?'), {target: {value: 'Check the public artifact navigation.'}});
    fireEvent.click(screen.getByRole('button', {name: 'REQUEST EXTERNAL TEST'}));
    await waitFor(() => expect(createExternalTestRequest).toHaveBeenCalledTimes(1));
    const [projectId, body] = createExternalTestRequest.mock.calls[0] as [string, {request_id: string; prompt: string}];
    expect(projectId).toBe('P-001');
    expect(body.prompt).toBe('Check the public artifact navigation.');
    await screen.findByRole('status');
  });

  it('renders UNAUTHORIZED instead of success when an external test request is denied', async () => {
    const createExternalTestRequest = vi.fn().mockRejectedValue(new InkubatorApiError(401, 'authentication_required'));
    renderActions(commandView(), {listGitHubRepositories: vi.fn().mockResolvedValue([]), createExternalTestRequest});
    openSection('EXTERNAL TEST / ASK FOR EVIDENCE');
    fireEvent.change(screen.getByLabelText('What should another builder test?'), {target: {value: 'Check the public artifact navigation.'}});
    fireEvent.click(screen.getByRole('button', {name: 'REQUEST EXTERNAL TEST'}));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('UNAUTHORIZED');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides mutation controls when the mission is terminal (fail-closed, no fake edit)', () => {
    renderActions(commandView({mission: {...commandView().mission, state: 'CLOSED_NOT_SHIPPED'}}), {updateMission: vi.fn()});
    expect(screen.queryByText('EDIT WORK / DECLARED STATE')).toBeNull();
    expect(screen.queryByText('HELP / ASK FOR A CONTRIBUTION')).toBeNull();
    expect(screen.queryByText('EXTERNAL TEST / ASK FOR EVIDENCE')).toBeNull();
  });

  it('keeps repository authorization outside the mission edit boundary when the source is already connected', () => {
    renderActions(commandView({project: {project_id: 'P-001', name: 'WEIRD LITTLE THING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'}}), {listGitHubRepositories: vi.fn(), linkProjectGitHubRepository: vi.fn()});
    openSection('SOURCE / REPOSITORY ACCESS');
    expect(screen.getByText(/SOURCE CONNECTED \/ PRIVATE/)).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'AUTHORIZE REPOSITORIES'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'LINK AUTHORIZED REPOSITORY'})).toBeNull();
    expect(screen.getByText('Source arrival is observed server-side. A connection alone is not evidence of completed work.')).toBeTruthy();
  });
});
