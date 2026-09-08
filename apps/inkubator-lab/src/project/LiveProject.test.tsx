import {act, cleanup, render, screen, waitFor, within} from '@testing-library/react';
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
  const view = render(
    <QueryClientProvider client={queryClient}>
      <LiveProject client={projectClient} refetchIntervalMs={false} />
    </QueryClientProvider>,
  );
  return {...view, queryClient};
}

describe('Live Project', () => {
  it('renders canonical project, source, help, test and ship projections without fixture fallback', async () => {
    const {container} = renderProject();

    expect(await screen.findByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeTruthy();
    expect(await screen.findByText('CipherCuttle/weird-little-thing')).toBeTruthy();
    expect(screen.getByText('Need one external tester.')).toBeTruthy();
    expect(screen.getByText('Helper')).toBeTruthy();
    expect(screen.getByText('Core flow works.')).toBeTruthy();
    expect(screen.getAllByText('OBSERVED').length).toBeGreaterThan(0);
    expect(screen.getByTitle('Weird Little Thing v1 artifact preview')).toBeTruthy();
    expect(container.querySelector('.project-artifact')?.getAttribute('data-truth')).toBe('unproven');
    expect(screen.queryByText(/development fixture/i)).toBeNull();
    expect(screen.getAllByRole('main', {name: 'Project instrument'})).toHaveLength(1);
    expect(screen.getAllByRole('region', {name: 'Living Project Thread'})).toHaveLength(1);
    expect(screen.getAllByRole('region', {name: 'Current locus'})).toHaveLength(1);
    expect(screen.getByRole('region', {name: 'Current locus'}).getAttribute('aria-current')).toBe('step');
    expect(screen.getAllByRole('region', {name: 'Next Move'})).toHaveLength(1);
    expect(within(screen.getByRole('region', {name: 'Next Move'})).getByRole('heading', {name: project.next_move})).toBeTruthy();
    expect(screen.getByText('URL SUPPLIED / CLAIMED')).toBeTruthy();
    expect(screen.getByText('Verifier response ≠ accepted Ship.')).toBeTruthy();
    expect(screen.queryByText('ACCEPTED / PROVEN')).toBeNull();
    expect(screen.getByTitle('Weird Little Thing v1 artifact preview').getAttribute('sandbox')).toBe('allow-scripts allow-forms allow-popups');
    expect(screen.getByTitle('Weird Little Thing v1 artifact preview').getAttribute('referrerpolicy')).toBe('no-referrer');
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

  it.each(['getMyCommand', 'getPrivateProject'] as const)('fails closed when %s is unavailable', async (method) => {
    renderProject(client({[method]: vi.fn().mockRejectedValue(new Error('session_required'))}));

    expect(await screen.findByRole('heading', {name: 'PROJECT LINK UNAVAILABLE'}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('session_required')).toBeTruthy();
    expect(screen.getByText(/No development fixture fallback is permitted/i)).toBeTruthy();
    expect(screen.queryByRole('region', {name: 'Living Project Thread'})).toBeNull();
  });

  it('renders the project Next Move without using advisory instructions or inventing an action', async () => {
    renderProject(client({getMyCommand: vi.fn().mockResolvedValue({...command,
      mission: {...command.mission, next_move: 'DIFFERENT COMMAND INSTRUCTION'},
      daemon: {...command.daemon, proposed_next_move: 'MINT PROOF'},
    })}));
    expect(await screen.findByRole('heading', {name: project.next_move})).toBeTruthy();
    expect(screen.queryByText('MINT PROOF')).toBeNull();
    expect(screen.queryByText('DIFFERENT COMMAND INSTRUCTION')).toBeNull();
  });

  it('does not turn an open test request or submitted artifact into a result or acceptance', async () => {
    renderProject(client({
      getProjectExternalTests: vi.fn().mockResolvedValue({...tests, results: [], requests: [{...tests.requests[0], state: 'OPEN'}]}),
      getProjectShipState: vi.fn().mockResolvedValue({...ship, latest_submission: {...ship.latest_submission, state: 'SUBMITTED', verifier_observation: undefined}}),
    }));
    expect(await screen.findByText('REQUEST OPEN / NO RESULT')).toBeTruthy();
    expect(screen.getByText('SUBMITTED')).toBeTruthy();
    expect(screen.getByText('ACCEPTANCE NOT ESTABLISHED')).toBeTruthy();
    expect(screen.queryByText('PASS / OBSERVED')).toBeNull();
    expect(screen.queryByText('ACCEPTED / PROVEN')).toBeNull();
  });

  it('withholds stale cached optional signals, preview and proof after refetch failure', async () => {
    const api = client();
    const {queryClient} = renderProject(api);
    expect(await screen.findByText('Core flow works.')).toBeTruthy();
    for (const method of ['getProjectHelpLoop', 'getProjectExternalTests', 'getProjectShipState'] as const) {
      vi.mocked(api[method]).mockRejectedValue(new Error('offline'));
    }
    await act(async () => {await queryClient.invalidateQueries({queryKey: ['inkubator', 'project', 'P-001']});});
    await waitFor(() => expect(screen.getByText('TEST LINK UNAVAILABLE')).toBeTruthy());
    expect(screen.getByText('HELP LINK UNAVAILABLE')).toBeTruthy();
    expect(screen.getByText('SHIP LINK UNAVAILABLE')).toBeTruthy();
    expect(screen.queryByText('Core flow works.')).toBeNull();
    expect(screen.queryByText('Need one external tester.')).toBeNull();
    expect(screen.queryByTitle('Weird Little Thing v1 artifact preview')).toBeNull();
    expect(screen.queryByText('VERIFIER / PASS')).toBeNull();
    expect(within(screen.getByRole('status', {name: 'Latest recorded signal'})).queryByText(/VERIFIER|EXTERNAL TEST/)).toBeNull();
    expect(screen.getByRole('heading', {name: project.next_move})).toBeTruthy();
  });

  it.each(['getMyCommand', 'getPrivateProject'] as const)('removes the instrument projection after a cached %s refetch fails', async method => {
    const api = client();
    const {queryClient} = renderProject(api);
    expect(await screen.findByRole('region', {name: 'Living Project Thread'})).toBeTruthy();
    vi.mocked(api[method]).mockRejectedValue(new Error('core_offline'));
    await act(async () => {await queryClient.invalidateQueries({queryKey: ['inkubator', 'project']});});
    expect(await screen.findByRole('heading', {name: 'PROJECT LINK UNAVAILABLE'})).toBeTruthy();
    expect(screen.queryByRole('region', {name: 'Living Project Thread'})).toBeNull();
    expect(screen.queryByTitle('Weird Little Thing v1 artifact preview')).toBeNull();
  });

  it('does not show cached source observations as current when evidence is unavailable', async () => {
    renderProject(client({getMyCommand: vi.fn().mockResolvedValue({...command, github_evidence: {
      ...command.github_evidence, source_state: 'UNAVAILABLE', reason_code: 'source_unavailable_cached_evidence_not_current',
    }}), getProjectExternalTests: vi.fn().mockResolvedValue({...tests, results: []}), getProjectShipState: vi.fn().mockResolvedValue({...ship, latest_submission: undefined})}));
    expect(await screen.findByText('EVIDENCE UNAVAILABLE')).toBeTruthy();
    expect(screen.getByText('NO CURRENT TIMESTAMPED SIGNAL')).toBeTruthy();
    expect(screen.queryByText(/SOURCE \/ WORKFLOW \/ SUCCEEDED/)).toBeNull();
  });

  it('requires an acceptance receipt before showing a proven Ship treatment', async () => {
    const api = client({getProjectShipState: vi.fn().mockResolvedValue({...ship, latest_submission: {...ship.latest_submission, state: 'PROVEN'}})});
    const {container} = renderProject(api);
    expect(await within(await screen.findByRole('region', {name: 'Ship boundary'})).findByText('Acceptance receipt unavailable.')).toBeTruthy();
    expect(container.querySelector('[data-truth="proven"]')).toBeNull();
    expect(screen.queryByText('ACCEPTED / PROVEN')).toBeNull();
  });

  it('renders PROVEN only with the canonical accepted Ship receipt', async () => {
    const acceptedShip: ProjectShipStateView = {...ship, latest_submission: {...ship.latest_submission!, state: 'PROVEN', accepted_ship: {
      schema_version: 'ship.artifact.public.v1', receipt_id: 'RECEIPT-1', receipt_schema_version: 'inkubator.ship-receipt/1.0',
      submission_id: 'S-1', mission_id: 'M-001', project_id: 'P-001', owner_player_id: 'PLAYER-1',
      acceptance_rule_version: 'ship.acceptance.v1', artifact: ship.latest_submission!.artifact, builders: [], assists: [],
      evidence: {verifier_observation_id: 'V-1', acceptance_review_id: 'A-1'}, truth_state: 'PROVEN', shipped_at: '2026-09-08T13:40:00Z',
    }}};
    renderProject(client({getProjectShipState: vi.fn().mockResolvedValue(acceptedShip)}));
    expect(await screen.findByText('ACCEPTED / PROVEN')).toBeTruthy();
    expect(screen.getByText('ACCEPTED RECEIPT / RECEIPT-1')).toBeTruthy();
    expect(screen.getByRole('region', {name: 'Ship boundary'}).getAttribute('data-truth')).toBe('proven');
    expect(screen.getByText('URL SUPPLIED / CLAIMED')).toBeTruthy();
  });
});
