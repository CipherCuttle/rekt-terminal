import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CommandView, PrivateProject} from '../generated/inkubator-api-client';
import {CommandActions} from './CommandActions';

afterEach(cleanup);

const command: CommandView = {
  schema_version: 'command.private.v2',
  project: {project_id: 'P-SOURCE', name: 'SOURCE TEST', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'},
  mission: {
    mission_id: 'M-SOURCE', state: 'BUILDING', goal: 'Recover from a wrong repository.', ship_condition: 'Correct source is observed.',
    current_focus: 'Inspect current source.', next_move: 'CHANGE SOURCE',
    progress_model_version: 'mission.progress.v1', stack_labels: ['TYPESCRIPT'], stack_source: 'PLAYER_CONFIRMED',
  },
  round: {round_id: 'R-SOURCE', code: 'R1', title: 'FOUNDING', constraint: 'Ship one working thing.', state: 'OPEN'},
  gates: [{key: 'FOUNDATION', label: 'FOUNDATION', state: 'OBSERVED', position: 1}],
  github_evidence: {
    rule_version: 'github-evidence.v1', source_state: 'AVAILABLE', signal_state: 'OBSERVED', stale_after_ms: 300000,
    invalid_observation_count: 0, reason_code: 'latest_observation_current', observed_stacks: ['JAVASCRIPT_TYPESCRIPT'],
  },
  daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'Source observed.', proposed_next_move: 'Change source.'},
};

const projectA: PrivateProject = {
  schema_version: 'project.private.v2', project_id: 'P-SOURCE', owner_player_id: 'OWNER', name: 'SOURCE TEST', mission_id: 'M-SOURCE', mission_state: 'BUILDING',
  goal: 'Recover from a wrong repository.', ship_condition: 'Correct source is observed.', current_focus: 'Inspect current source.', next_move: 'CHANGE SOURCE',
  source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED', repository_id: '22001', repository_full_name: 'CipherCuttle/frontier', repository_private: true, repository_active: true,
};

const projectB: PrivateProject = {
  ...projectA,
  observation_state: 'UNKNOWN', repository_id: '22002', repository_full_name: 'CipherCuttle/rekt-terminal',
};

function buildClient() {
  const getPrivateProject = vi.fn().mockResolvedValueOnce(projectA).mockResolvedValue(projectB);
  const linkProjectGitHubRepository = vi.fn().mockResolvedValue(projectB);
  return {
    updateMission: vi.fn().mockResolvedValue(command),
    getPrivateProject,
    listGitHubRepositories: vi.fn().mockResolvedValue([
      {repository_id: '22001', full_name: 'CipherCuttle/frontier', private: true},
      {repository_id: '22002', full_name: 'CipherCuttle/rekt-terminal', private: true},
    ]),
    linkProjectGitHubRepository,
    createHelpBeacon: vi.fn().mockResolvedValue({}),
    closeHelpBeacon: vi.fn().mockResolvedValue({}),
    getProjectHelpLoop: vi.fn().mockResolvedValue({
      schema_version: 'project.help_loop.public.v1', project_id: 'P-SOURCE',
      owner: {schema_version: 'player.public.v2', player_id: 'OWNER', display_name: 'Owner', skills_needed: [], can_help_with: []},
      party_members: [],
    }),
    getProjectPendingAssists: vi.fn().mockResolvedValue({schema_version: 'project.pending_assists.private.v1', project_id: 'P-SOURCE', assists: []}),
    acceptAssist: vi.fn().mockResolvedValue({}),
    createExternalTestRequest: vi.fn().mockResolvedValue({}),
    getProjectExternalTests: vi.fn().mockResolvedValue({schema_version: 'project.external_tests.public.v1', project_id: 'P-SOURCE', requests: [], results: []}),
    syncGitHubAccess: vi.fn().mockResolvedValue({schema_version: 'github.reconcile.private.v1', installation_count: 1, repositories_connected: 2, warnings: []}),
  } as any;
}

describe('Mission source recovery', () => {
  it('keeps the current repository visible and requires explicit review before replacement', async () => {
    const client = buildClient();
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <CommandActions command={command} client={client} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('CipherCuttle/frontier')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'CHANGE SOURCE'}));

    const selector = await screen.findByRole('combobox', {name: 'New Mission source'});
    fireEvent.change(selector, {target: {value: '22002'}});
    fireEvent.click(screen.getByRole('button', {name: 'REVIEW SOURCE CHANGE'}));

    expect(screen.getByText(/Previous observations stay in history/i)).toBeTruthy();
    expect(screen.getByText(/Current source-derived evidence resets/i)).toBeTruthy();
    expect(client.linkProjectGitHubRepository).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'CONFIRM SOURCE CHANGE'}));
    await waitFor(() => expect(client.linkProjectGitHubRepository).toHaveBeenCalledWith('P-SOURCE', {repository_id: '22002'}));
    await waitFor(() => expect(client.getPrivateProject).toHaveBeenCalledTimes(2));
  });
});
