import {cleanup, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {
  CommandView,
  InkubatorApiClient,
  PrivateProject,
  ProjectExternalTestsView,
  ProjectHelpLoopView,
  ProjectShipStateView,
} from '../generated/inkubator-api-client';
import LiveProject from './LiveProject';

afterEach(cleanup);

type ProjectClient = Pick<InkubatorApiClient, 'getMyCommand' | 'getPrivateProject' | 'getProjectHelpLoop' | 'getProjectExternalTests' | 'getProjectShipState'>;

const command: CommandView = {
  schema_version: 'command.private.v2',
  project: {project_id: 'P-001', name: 'WEIRD LITTLE THING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'},
  mission: {
    mission_id: 'M-001', state: 'BUILDING', goal: 'Make the thing real.', ship_condition: 'A working link exists.',
    current_focus: 'Wire the project workstation.', next_move: 'PROVE THE PROJECT SURFACE', blocker: undefined,
    progress_model_version: 'mission.progress.v1', stack_labels: ['TYPESCRIPT'], stack_source: 'PLAYER_CONFIRMED',
  },
  round: {round_id: 'R-001', code: 'R1', title: 'FOUNDING', constraint: 'Ship one working thing.', state: 'OPEN'},
  gates: [
    {key: 'FOUNDATION', label: 'FOUNDATION', state: 'PROVEN', position: 1},
    {key: 'CORE_EXPERIENCE', label: 'CORE EXPERIENCE', state: 'OBSERVED', position: 2},
    {key: 'QUALITY_TESTING', label: 'QUALITY TESTING', state: 'ACTIVE', position: 3},
    {key: 'SHIPABILITY', label: 'SHIPABILITY', state: 'UNKNOWN', position: 4},
  ],
  github_evidence: {
    rule_version: 'github-evidence.v1', source_state: 'AVAILABLE', signal_state: 'OBSERVED', stale_after_ms: 300000,
    invalid_observation_count: 0, reason_code: 'latest_observation_current', observed_stacks: ['JAVASCRIPT_TYPESCRIPT'],
    latest_observation: {observation_id: 'OBS-1', kind: 'WORKFLOW', outcome: 'SUCCEEDED', observed_at: '2026-09-08T13:00:00Z'},
  },
  daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'Project changed.', proposed_next_move: 'Keep scope bounded.'},
};

const project: PrivateProject = {
  schema_version: 'project.private.v2', project_id: 'P-001', owner_player_id: 'PLAYER-1', name: 'WEIRD LITTLE THING', mission_id: 'M-001',
  mission_state: 'BUILDING', goal: 'Make the thing real.', ship_condition: 'A working link exists.', current_focus: 'Wire the project workstation.',
  next_move: 'PROVE THE PROJECT SURFACE', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED',
  repository_id: '123', repository_full_name: 'CipherCuttle/weird-little-thing', repository_private: true, repository_active: true,
  last_delivery_id: 'delivery-1', last_ref: 'refs/heads/main', last_before: 'aaa', last_after: 'bbb',
};

const help: ProjectHelpLoopView = {
  schema_version: 'project.help_loop.public.v1', project_id: 'P-001',
  owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-1', display_name: 'Builder', skills_needed: [], can_help_with: ['UI']},
  open_help_beacon: {schema_version: 'help_beacon.public.v1', beacon_id: 'B-1', project_id: 'P-001', summary: 'Need one external tester.', skills_needed: ['QA'], state: 'OPEN'},
  party_members: [{player_id: 'PLAYER-2', display_name: 'Helper', role: 'ASSIST'}],
};

const tests: ProjectExternalTestsView = {
  schema_version: 'project.external_tests.public.v1', project_id: 'P-001',
  requests: [{schema_version: 'external_test.request.public.v1', test_request_id: 'T-1', project_id: 'P-001', prompt: 'Try the main flow.', state: 'COMPLETED'}],
  results: [{schema_version: 'external_test.result.public.v1', test_result_id: 'TR-1', test_request_id: 'T-1', project_id: 'P-001', tester: {player_id: 'PLAYER-3', display_name: 'Tester'}, outcome: 'PASS', summary: 'Core flow works.', observed_at: '2026-09-08T13:30:00Z'}],
};

const ship: ProjectShipStateView = {
  schema_version: 'project.ship.public.v2', project_id: 'P-001',
  latest_submission: {
    schema_version: 'ship.submission.public.v2', submission_id: 'S-1', mission_id: 'M-001', project_id: 'P-001',
    artifact: {title: 'Weird Little Thing v1', url: 'https://artifact.example/app', demo_url: 'https://artifact.example/demo'},
    state: 'OBSERVED', submitted_at: '2026-09-08T13:35:00Z',
    verifier_observation: {schema_version: 'ship.verifier_observation.public.v1', outcome: 'PASS', reason_code: 'reachable', duration_ms: 120, redirects: 0, observed_at: '2026-09-08T13:36:00Z'},
  },
};

function client(overrides: Partial<ProjectClient> = {}): ProjectClient {
  return {
    getMyCommand: vi.fn().mockResolvedValue(command),
    getPrivateProject: vi.fn().mockResolvedValue(project),
    getProjectHelpLoop: vi.fn().mockResolvedValue(help),
    getProjectExternalTests: vi.fn().mockResolvedValue(tests),
    getProjectShipState: vi.fn().mockResolvedValue(ship),
    ...overrides,
  };
}

function renderProject(projectClient = client()) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <LiveProject client={projectClient} refetchIntervalMs={false} />
    </QueryClientProvider>,
  );
}

describe('Live Project', () => {
  it('renders canonical project, source, help, test and ship projections in the v2 shell without fixture fallback', async () => {
    const {container} = renderProject();

    expect(await screen.findByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeTruthy();
    expect(container.querySelector('[data-shell-variant="v2"]')).toBeTruthy();
    expect(screen.getByText('Wire the project workstation.')).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'PROVE THE PROJECT SURFACE'})).toBeTruthy();
    expect(await screen.findByText('CipherCuttle/weird-little-thing')).toBeTruthy();
    expect(screen.getByText('Need one external tester.')).toBeTruthy();
    expect(screen.getByText('Helper')).toBeTruthy();
    expect(screen.getByText('Core flow works.')).toBeTruthy();
    expect(screen.getAllByText('OBSERVED').length).toBeGreaterThan(0);
    expect(screen.getByTitle('Weird Little Thing v1 artifact preview')).toBeTruthy();
    expect(container.querySelector('.project-artifact')?.getAttribute('data-truth')).toBe('unproven');
    expect(screen.queryByText(/development fixture/i)).toBeNull();
  });

  it('keeps optional help/test/ship projections visibly fail-closed without collapsing project core', async () => {
    renderProject(client({
      getProjectHelpLoop: vi.fn().mockRejectedValue(new Error('help_unavailable')),
      getProjectExternalTests: vi.fn().mockRejectedValue(new Error('tests_unavailable')),
      getProjectShipState: vi.fn().mockRejectedValue(new Error('ship_unavailable')),
    }));

    expect(await screen.findByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeTruthy();
    expect(await screen.findByText('HELP LINK UNAVAILABLE', {}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('TEST LINK UNAVAILABLE')).toBeTruthy();
    expect(screen.getAllByText('SHIP LINK UNAVAILABLE').length).toBeGreaterThan(0);
    expect(screen.getByText('CipherCuttle/weird-little-thing')).toBeTruthy();
  });

  it('fails closed when the current/private project projection is unavailable', async () => {
    renderProject(client({getMyCommand: vi.fn().mockRejectedValue(new Error('session_required'))}));

    expect(await screen.findByRole('heading', {name: 'PROJECT LINK UNAVAILABLE'}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('session_required')).toBeTruthy();
    expect(screen.getByText(/No development fixture fallback is permitted/i)).toBeTruthy();
  });
});
