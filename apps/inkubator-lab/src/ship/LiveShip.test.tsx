import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {
  AcceptedShipArtifactView,
  CommandView,
  InkubatorApiClient,
  ProjectShipStateView,
  ShipSubmissionPrivateView,
} from '../generated/inkubator-api-client';
import LiveShip from './LiveShip';

afterEach(cleanup);

type ShipClient = Pick<InkubatorApiClient, 'getMyCommand' | 'getProjectShipState' | 'submitShip'>;

const command: CommandView = {
  schema_version: 'command.private.v2',
  project: {
    project_id: 'PROJECT-1',
    name: 'REKT MACHINE',
    source_connected: true,
    source_visibility: 'PUBLIC',
    observation_state: 'OBSERVED',
  },
  mission: {
    mission_id: 'MISSION-1',
    state: 'SHIP_READY',
    goal: 'Ship a working strange thing.',
    ship_condition: 'Public HTTPS artifact that survives external verification.',
    current_focus: 'Submit the bounded artifact.',
    next_move: 'Submit the artifact for verification.',
    progress_model_version: 'mission.progress.v1',
    stack_labels: ['JAVASCRIPT_TYPESCRIPT'],
    stack_source: 'PLAYER_CONFIRMED',
  },
  gates: [
    {key: 'FOUNDATION', label: 'Foundation', state: 'PROVEN', position: 1},
    {key: 'CORE_EXPERIENCE', label: 'Core experience', state: 'PROVEN', position: 2},
    {key: 'QUALITY_TESTING', label: 'Quality testing', state: 'OBSERVED', position: 3},
    {key: 'SHIPABILITY', label: 'Shipability', state: 'CLAIMED', position: 4},
  ],
  github_evidence: {
    rule_version: 'github-evidence.v1',
    source_state: 'AVAILABLE',
    signal_state: 'OBSERVED',
    stale_after_ms: 300000,
    invalid_observation_count: 0,
    reason_code: 'latest_observation_current',
    observed_stacks: ['JAVASCRIPT_TYPESCRIPT'],
  },
  daemon: {
    rule_version: 'daemon-advisory.v1',
    authority: 'ADVISORY_ONLY',
    what_changed: 'Mission is ready for bounded Ship submission.',
    proposed_next_move: 'Submit the artifact.',
  },
};

const emptyShip: ProjectShipStateView = {
  schema_version: 'project.ship.public.v2',
  project_id: 'PROJECT-1',
};

const submittedShip: ProjectShipStateView = {
  schema_version: 'project.ship.public.v2',
  project_id: 'PROJECT-1',
  latest_submission: {
    schema_version: 'ship.submission.public.v2',
    submission_id: 'SUBMISSION-1',
    mission_id: 'MISSION-1',
    project_id: 'PROJECT-1',
    artifact: {title: 'REKT MACHINE', url: 'https://example.com/rekt'},
    state: 'OBSERVED',
    submitted_at: '2026-09-10T09:00:00Z',
    verifier_observation: {
      schema_version: 'ship.verifier_observation.public.v1',
      outcome: 'PASS',
      reason_code: 'artifact_reachable',
      http_status: 200,
      duration_ms: 140,
      redirects: 0,
      observed_at: '2026-09-10T09:00:03Z',
    },
  },
};

const accepted: AcceptedShipArtifactView = {
  schema_version: 'ship.artifact.public.v1',
  receipt_id: 'RECEIPT-1',
  receipt_schema_version: 'inkubator.ship-receipt/1.0',
  submission_id: 'SUBMISSION-1',
  mission_id: 'MISSION-1',
  project_id: 'PROJECT-1',
  owner_player_id: 'PLAYER-1',
  acceptance_rule_version: 'ship.acceptance.v1',
  artifact: {title: 'REKT MACHINE', url: 'https://example.com/rekt', demo_url: 'https://example.com/demo'},
  builders: [
    {player_id: 'PLAYER-1', display_name: 'CipherCuttle', role: 'OWNER'},
    {player_id: 'PLAYER-2', display_name: 'Helper', role: 'PARTY'},
  ],
  assists: [{assist_id: 'ASSIST-1', player_id: 'PLAYER-3', display_name: 'Tester', accepted_at: '2026-09-10T08:50:00Z', source_state: 'ACCEPTED'}],
  evidence: {verifier_observation_id: 'OBS-1', acceptance_review_id: 'REVIEW-1'},
  truth_state: 'PROVEN',
  shipped_at: '2026-09-10T09:01:00Z',
};

const provenShip: ProjectShipStateView = {
  schema_version: 'project.ship.public.v2',
  project_id: 'PROJECT-1',
  latest_submission: {
    schema_version: 'ship.submission.public.v2',
    submission_id: 'SUBMISSION-1',
    mission_id: 'MISSION-1',
    project_id: 'PROJECT-1',
    artifact: {title: 'REKT MACHINE', url: 'https://example.com/rekt', demo_url: 'https://example.com/demo'},
    state: 'PROVEN',
    submitted_at: '2026-09-10T09:00:00Z',
    verifier_observation: {
      schema_version: 'ship.verifier_observation.public.v1',
      outcome: 'PASS',
      reason_code: 'artifact_reachable',
      http_status: 200,
      duration_ms: 140,
      redirects: 0,
      observed_at: '2026-09-10T09:00:03Z',
    },
    accepted_ship: accepted,
  },
};

const privateSubmission: ShipSubmissionPrivateView = {
  schema_version: 'ship.submission.private.v1',
  submission_id: 'SUBMISSION-NEW',
  mission_id: 'MISSION-1',
  project_id: 'PROJECT-1',
  artifact: {title: 'REKT MACHINE', url: 'https://example.com/rekt'},
  state: 'SUBMITTED',
  submitted_at: '2026-09-10T09:10:00Z',
};

function client(overrides: Partial<ShipClient> = {}): ShipClient {
  return {
    getMyCommand: vi.fn().mockResolvedValue(command),
    getProjectShipState: vi.fn().mockResolvedValue(emptyShip),
    submitShip: vi.fn().mockResolvedValue(privateSubmission),
    ...overrides,
  };
}

function renderShip(shipClient = client()) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={queryClient}><LiveShip client={shipClient} refetchIntervalMs={false} /></QueryClientProvider>);
}

describe('Live SHIP', () => {
  it('submits only a valid SHIP_READY HTTPS artifact and preserves one request id across the unchanged attempt', async () => {
    const shipClient = client();
    const {container} = renderShip(shipClient);

    expect(await screen.findByRole('heading', {name: 'Ship the thing.'})).toBeTruthy();
    await screen.findByText('NO SUBMISSION RECORDED');
    expect(container.querySelector('[data-shell="terminal"]')?.getAttribute('data-shell-variant')).toBe('v2');

    const submit = screen.getByRole('button', {name: 'SUBMIT FOR VERIFICATION'}) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('PUBLIC ARTIFACT URL'), {target: {value: 'https://example.com/rekt'}});
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);

    await waitFor(() => expect(shipClient.submitShip).toHaveBeenCalledTimes(1));
    const [, body] = vi.mocked(shipClient.submitShip).mock.calls[0];
    expect(body.title).toBe('REKT MACHINE');
    expect(body.url).toBe('https://example.com/rekt');
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText('SUBMISSION-NEW')).toBeTruthy();
  });

  it('does not offer Ship authority before the canonical Mission reaches SHIP_READY', async () => {
    const building: CommandView = {...command, mission: {...command.mission, state: 'BUILDING', next_move: 'Finish the external test.'}};
    const shipClient = client({getMyCommand: vi.fn().mockResolvedValue(building)});
    renderShip(shipClient);

    expect(await screen.findByText('MISSION BUILDING — SHIP_READY REQUIRED')).toBeTruthy();
    const submit = screen.getByRole('button', {name: 'SUBMIT FOR VERIFICATION'}) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('PUBLIC ARTIFACT URL'), {target: {value: 'https://example.com/rekt'}});
    expect(submit.disabled).toBe(true);
    expect(shipClient.submitShip).not.toHaveBeenCalled();
  });

  it('keeps verifier PASS at OBSERVED and refuses to invent an accepted receipt', async () => {
    renderShip(client({getProjectShipState: vi.fn().mockResolvedValue(submittedShip)}));

    expect(await screen.findByText('artifact_reachable')).toBeTruthy();
    expect(screen.getByText('NO ACCEPTED SHIP RECEIPT YET')).toBeTruthy();
    expect(screen.getByText(/Observation alone is not proof/i)).toBeTruthy();
    expect(screen.queryByText('IMMUTABLE RECEIPT')).toBeNull();
  });

  it('renders PROVEN only from the accepted server projection with immutable evidence and credits', async () => {
    renderShip(client({
      getMyCommand: vi.fn().mockResolvedValue({...command, mission: {...command.mission, state: 'SHIPPED'}}),
      getProjectShipState: vi.fn().mockResolvedValue(provenShip),
    }));

    expect(await screen.findByRole('heading', {name: 'REKT MACHINE'})).toBeTruthy();
    expect(screen.getByText('RECEIPT-1')).toBeTruthy();
    expect(screen.getByText('OBS-1')).toBeTruthy();
    expect(screen.getByText('REVIEW-1')).toBeTruthy();
    expect(screen.getAllByText('CipherCuttle').length).toBeGreaterThan(0);
    expect(screen.getByText('Helper')).toBeTruthy();
    expect(screen.getByText('Tester')).toBeTruthy();
    expect(screen.getAllByText('PROVEN').length).toBeGreaterThan(0);
  });

  it('disables mutation when the canonical public Ship projection is unavailable', async () => {
    renderShip(client({getProjectShipState: vi.fn().mockRejectedValue(new Error('ship_state_offline'))}));

    expect(await screen.findByText('SHIP STATE UNAVAILABLE — SUBMISSION DISABLED')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('PUBLIC ARTIFACT URL'), {target: {value: 'https://example.com/rekt'}});
    expect((screen.getByRole('button', {name: 'SUBMIT FOR VERIFICATION'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('SUBMISSION-NEW')).toBeNull();
  });

  it('fails closed when canonical private COMMAND authority is unavailable', async () => {
    renderShip(client({getMyCommand: vi.fn().mockRejectedValue(new Error('authentication_required'))}));
    expect(await screen.findByRole('heading', {name: 'SHIP LINK UNAVAILABLE'}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('authentication_required')).toBeTruthy();
    expect(screen.getByText(/No development fixture fallback is permitted/i)).toBeTruthy();
  });
});