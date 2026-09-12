import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CommandView} from '../generated/inkubator-api-client';
import {CommandActions} from './CommandActions';

afterEach(cleanup);

const command: CommandView = {
  schema_version: 'command.private.v2',
  project: {project_id: 'P-SYNC', name: 'SYNC TEST', source_connected: false, source_visibility: 'NONE', observation_state: 'UNKNOWN'},
  mission: {
    mission_id: 'M-SYNC', state: 'BUILDING', goal: 'Verify sync routing.', ship_condition: 'Sync stays in REKT.',
    current_focus: 'Test server-side reconciliation.', next_move: 'SYNC GITHUB ACCESS',
    progress_model_version: 'mission.progress.v1', stack_labels: ['TYPESCRIPT'], stack_source: 'PLAYER_CONFIRMED',
  },
  round: {round_id: 'R-SYNC', code: 'R1', title: 'FOUNDING', constraint: 'Ship one working thing.', state: 'OPEN'},
  gates: [{key: 'FOUNDATION', label: 'FOUNDATION', state: 'ACTIVE', position: 1}],
  github_evidence: {
    rule_version: 'github-evidence.v1', source_state: 'UNAVAILABLE', signal_state: 'UNKNOWN', stale_after_ms: 300000,
    invalid_observation_count: 0, reason_code: 'source_unavailable_no_evidence', observed_stacks: [],
  },
  daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'No evidence yet.', proposed_next_move: 'Sync GitHub access.'},
};

function client(syncGitHubAccess: ReturnType<typeof vi.fn>) {
  return {
    updateMission: vi.fn().mockResolvedValue(command),
    listGitHubRepositories: vi.fn().mockResolvedValue([{repository_id: '11001', full_name: 'CipherCuttle/rekt-terminal', private: false}]),
    linkProjectGitHubRepository: vi.fn().mockResolvedValue({}),
    createHelpBeacon: vi.fn().mockResolvedValue({}),
    closeHelpBeacon: vi.fn().mockResolvedValue({}),
    getProjectHelpLoop: vi.fn().mockResolvedValue({
      schema_version: 'project.help_loop.public.v1', project_id: 'P-SYNC',
      owner: {schema_version: 'player.public.v2', player_id: 'OWNER', display_name: 'Owner', skills_needed: [], can_help_with: []},
      party_members: [],
    }),
    getProjectPendingAssists: vi.fn().mockResolvedValue({schema_version: 'project.pending_assists.private.v1', project_id: 'P-SYNC', assists: []}),
    acceptAssist: vi.fn().mockResolvedValue({}),
    createExternalTestRequest: vi.fn().mockResolvedValue({}),
    getProjectExternalTests: vi.fn().mockResolvedValue({schema_version: 'project.external_tests.public.v1', project_id: 'P-SYNC', requests: [], results: []}),
    syncGitHubAccess,
  } as any;
}

describe('GitHub repository sync routing', () => {
  it('reconciles through the same-origin API instead of opening another OAuth journey', async () => {
    const syncGitHubAccess = vi.fn().mockResolvedValue({
      schema_version: 'github.reconcile.private.v1', installation_count: 1, repositories_connected: 1, warnings: [],
    });
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <CommandActions command={command} client={client(syncGitHubAccess)} />
      </QueryClientProvider>,
    );

    await screen.findByText('REPOSITORY ACCESS READY / 1 AVAILABLE');
    fireEvent.click(screen.getByRole('button', {name: 'SYNC GITHUB ACCESS'}));
    await waitFor(() => expect(syncGitHubAccess).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('REPOSITORY ACCESS SYNCED / 1 AVAILABLE')).toBeTruthy();
  });

  it('keeps repository authority while surfacing degraded Push observation health', async () => {
    const syncGitHubAccess = vi.fn().mockResolvedValue({
      schema_version: 'github.reconcile.private.v1', installation_count: 1, repositories_connected: 1,
      warnings: ['github_push_event_required'],
    });
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <CommandActions command={command} client={client(syncGitHubAccess)} />
      </QueryClientProvider>,
    );

    await screen.findByText('REPOSITORY ACCESS READY / 1 AVAILABLE');
    fireEvent.click(screen.getByRole('button', {name: 'SYNC GITHUB ACCESS'}));
    expect(await screen.findByText('REPOSITORY ACCESS SYNCED / PUSH OBSERVATION DEGRADED / github_push_event_required')).toBeTruthy();
  });
});
