import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {InkubatorApiError, type CommandView, type RoundList} from '../generated/inkubator-api-client';
import MissionBootstrap from './MissionBootstrap';

afterEach(cleanup);

const rounds: RoundList = [
  {schema_version: 'round.private.v1', round_id: 'R-001', code: 'R1', title: 'FOUNDING', constraint: 'Ship one working thing.', state: 'OPEN', joined: false},
  {schema_version: 'round.private.v1', round_id: 'R-002', code: 'R2', title: 'CLOSED ROUND', constraint: 'Past round.', state: 'CLOSED', joined: false},
];

const createdCommand: CommandView = {
  schema_version: 'command.private.v2',
  project: {project_id: 'P-001', name: 'Coherence workbench', source_connected: false, source_visibility: 'NONE', observation_state: 'UNKNOWN'},
  mission: {
    mission_id: 'M-001', state: 'DECLARED', goal: 'Make a useful public artifact.', ship_condition: 'A public HTTPS artifact.',
    current_focus: 'Connect the repository.', next_move: 'Connect the repository.',
    progress_model_version: 'mission.progress.v1', stack_labels: [], stack_source: 'UNKNOWN',
  },
  round: {round_id: 'R-001', code: 'R1', title: 'FOUNDING', constraint: 'Ship one working thing.', state: 'OPEN'},
  gates: [{key: 'FOUNDATION', label: 'FOUNDATION', state: 'ACTIVE', position: 1}],
  github_evidence: {
    rule_version: 'github-evidence.v1', source_state: 'UNAVAILABLE', signal_state: 'UNKNOWN', stale_after_ms: 300000,
    invalid_observation_count: 0, reason_code: 'source_unavailable_no_evidence', observed_stacks: [],
  },
  daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'Mission declared.', proposed_next_move: 'Connect the repository.'},
};

function renderBootstrap(client: Record<string, unknown>) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <MissionBootstrap client={client as never} />
    </QueryClientProvider>,
  );
}

async function fillAndSubmit() {
  await screen.findByLabelText('Project name');
  fireEvent.change(screen.getByLabelText('Project name'), {target: {value: 'Coherence workbench'}});
  fireEvent.change(screen.getByLabelText('What are you building?'), {target: {value: 'Make a useful public artifact.'}});
  fireEvent.click(screen.getByRole('button', {name: 'CONTINUE →'}));
  fireEvent.change(screen.getByLabelText('What must work for this to count as shipped?'), {target: {value: 'A public HTTPS artifact.'}});
  fireEvent.change(screen.getByLabelText('What are you doing next?'), {target: {value: 'Connect the repository.'}});
  fireEvent.click(screen.getByRole('button', {name: 'DECLARE MISSION'}));
}

describe('MissionBootstrap first mission setup', () => {
  it('keeps a single open Round out of the decision path', async () => {
    renderBootstrap({listRounds: vi.fn().mockResolvedValue(rounds), joinRound: vi.fn(), createMission: vi.fn()});
    await screen.findByLabelText('Project name');
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.change(screen.getByLabelText('Project name'), {target: {value: 'Thing'}});
    fireEvent.change(screen.getByLabelText('What are you building?'), {target: {value: 'Build it'}});
    fireEvent.click(screen.getByRole('button', {name: 'CONTINUE →'}));
    expect(screen.getByText('FOUNDING')).toBeTruthy();
    expect(screen.getByText('Ship one working thing.')).toBeTruthy();
  });

  it('offers Round choice only when multiple Rounds are open', async () => {
    const multiRound: RoundList = [...rounds, {schema_version: 'round.private.v1', round_id: 'R-003', code: 'R3', title: 'SECOND OPEN', constraint: 'Another constraint.', state: 'OPEN', joined: false}];
    renderBootstrap({listRounds: vi.fn().mockResolvedValue(multiRound), joinRound: vi.fn(), createMission: vi.fn()});
    await screen.findByLabelText('Project name');
    fireEvent.change(screen.getByLabelText('Project name'), {target: {value: 'Thing'}});
    fireEvent.change(screen.getByLabelText('What are you building?'), {target: {value: 'Build it'}});
    fireEvent.click(screen.getByRole('button', {name: 'CONTINUE →'}));
    const roundSelect = screen.getByLabelText('Round');
    expect(roundSelect).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('joins the round and creates the mission with the first Next Move as current focus', async () => {
    const joinRound = vi.fn().mockResolvedValue(rounds[0]);
    const createMission = vi.fn().mockResolvedValue(createdCommand);
    renderBootstrap({listRounds: vi.fn().mockResolvedValue(rounds), joinRound, createMission});
    await fillAndSubmit();
    await waitFor(() => expect(createMission).toHaveBeenCalledTimes(1));
    expect(joinRound).toHaveBeenCalledWith('R-001');
    const body = createMission.mock.calls[0][0] as {request_id: string; round_id: string; project_name: string; goal: string; ship_condition: string; current_focus: string; next_move: string};
    expect(body.request_id).toBeTruthy();
    expect(body.round_id).toBe('R-001');
    expect(body.project_name).toBe('Coherence workbench');
    expect(body.current_focus).toBe('Connect the repository.');
    expect(body.next_move).toBe('Connect the repository.');
  });

  it('fails closed with UNAUTHORIZED when mission creation is denied and records nothing', async () => {
    const joinRound = vi.fn().mockResolvedValue(rounds[0]);
    const createMission = vi.fn().mockRejectedValue(new InkubatorApiError(403, 'authorization_denied'));
    renderBootstrap({listRounds: vi.fn().mockResolvedValue(rounds), joinRound, createMission});
    await fillAndSubmit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('UNAUTHORIZED');
    expect(alert.textContent).toContain('authorization_denied');
  });

  it('renders the no-open-round state as an EMPTY record and blocks submission', async () => {
    renderBootstrap({listRounds: vi.fn().mockResolvedValue(rounds.filter(round => round.state !== 'OPEN')), joinRound: vi.fn(), createMission: vi.fn()});
    expect(await screen.findByText('No Round is open. Your identity is saved; return when a Round opens.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'CONTINUE →'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'DECLARE MISSION'})).toBeNull();
  });

  it('surfaces a rounds UNAVAILABLE state with a retry instead of a fixture fallback', async () => {
    renderBootstrap({listRounds: vi.fn().mockRejectedValue(new Error('rounds_unavailable')), joinRound: vi.fn(), createMission: vi.fn()});
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Rounds unavailable');
    expect(screen.getByRole('button', {name: 'Retry'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'DECLARE MISSION'})).toBeNull();
  });
});
