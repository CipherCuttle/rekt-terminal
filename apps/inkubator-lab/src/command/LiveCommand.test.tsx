import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CommandView} from '../generated/inkubator-api-client';
import LiveCommand from './LiveCommand';

afterEach(cleanup);

function commandView(overrides: Partial<CommandView> = {}): CommandView {
  return {
    schema_version: 'command.private.v2',
    project: {
      project_id: 'P-001',
      name: 'WEIRD LITTLE THING',
      source_connected: true,
      source_visibility: 'PRIVATE',
      observation_state: 'OBSERVED',
    },
    mission: {
      mission_id: 'M-001',
      state: 'BUILDING',
      goal: 'Make the thing real.',
      ship_condition: 'A working link exists.',
      current_focus: 'Wire the canonical command projection.',
      next_move: 'CONNECT THE LIVE COMMAND BUS',
      progress_model_version: 'mission.progress.v1',
      stack_labels: ['TYPESCRIPT'],
      stack_source: 'PLAYER_CONFIRMED',
    },
    round: {
      round_id: 'R-001',
      code: 'R1',
      title: 'FOUNDING',
      constraint: 'Ship one working thing.',
      state: 'OPEN',
    },
    gates: [
      {key: 'FOUNDATION', label: 'FOUNDATION', state: 'PROVEN', position: 1},
      {key: 'CORE_EXPERIENCE', label: 'CORE EXPERIENCE', state: 'OBSERVED', position: 2},
      {key: 'QUALITY_TESTING', label: 'QUALITY TESTING', state: 'ACTIVE', position: 3},
      {key: 'SHIPABILITY', label: 'SHIPABILITY', state: 'UNKNOWN', position: 4},
    ],
    github_evidence: {
      rule_version: 'github-evidence.v1',
      source_state: 'AVAILABLE',
      signal_state: 'OBSERVED',
      stale_after_ms: 300000,
      invalid_observation_count: 0,
      reason_code: 'latest_observation_current',
      observed_stacks: ['JAVASCRIPT_TYPESCRIPT'],
      latest_observation: {
        observation_id: 'OBS-001',
        kind: 'WORKFLOW',
        outcome: 'SUCCEEDED',
        observed_at: '2026-09-08T13:00:00Z',
      },
    },
    daemon: {
      rule_version: 'daemon-advisory.v1',
      authority: 'ADVISORY_ONLY',
      what_changed: 'Workflow evidence advanced.',
      proposed_next_move: 'Keep the current slice bounded.',
    },
    ...overrides,
  };
}

function renderCommand(client: {getMyCommand: () => Promise<CommandView>}, queryClient = new QueryClient({
  defaultOptions: {queries: {retry: false}},
})) {
  const result = render(
    <QueryClientProvider client={queryClient}>
      <LiveCommand client={client} refetchIntervalMs={false} />
    </QueryClientProvider>,
  );
  return {...result, queryClient};
}

describe('Live Command', () => {
  it('renders canonical CommandView data without development fixture fallback', async () => {
    const client = {getMyCommand: vi.fn().mockResolvedValue(commandView())};
    const {container} = renderCommand(client);

    expect(await screen.findByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'CONNECT THE LIVE COMMAND BUS'})).toBeTruthy();
    expect(screen.getByText('PRIVATE')).toBeTruthy();
    expect(screen.getByText('ADVISORY ONLY')).toBeTruthy();
    expect(screen.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeTruthy();
    expect(container.querySelector('[data-renderer="pixi"]')?.getAttribute('data-renderer-lifecycle')).toBe('retained');
    expect(container.querySelectorAll('[data-truth="proven"]')).toHaveLength(1);
    expect(screen.queryByText(/development fixture/i)).toBeNull();
  });

  it('animates only from canonical projection deltas after a refetch', async () => {
    const first = commandView();
    const second = commandView({
      mission: {...first.mission, blocker: 'Verifier is red.', state: 'BLOCKED'},
      gates: first.gates.map((gate) => gate.key === 'QUALITY_TESTING' ? {...gate, state: 'BLOCKED'} : gate),
    });
    const client = {getMyCommand: vi.fn().mockResolvedValueOnce(first).mockResolvedValue(second)};
    const {container, queryClient} = renderCommand(client);

    await screen.findByRole('heading', {name: 'CONNECT THE LIVE COMMAND BUS'});
    await queryClient.refetchQueries({queryKey: ['inkubator', 'command', 'me']});

    await waitFor(() => expect(container.querySelector('.command-live')?.getAttribute('data-event-sequence')).toBe('1'));
    expect(screen.getByText(/EVENT \/\/ GATE:QUALITY_TESTING → BLOCKER → MISSION/i)).toBeTruthy();
    expect(screen.getByText('Verifier is red.')).toBeTruthy();
  });

  it('fails closed when the canonical command endpoint is unavailable', async () => {
    const client = {getMyCommand: vi.fn().mockRejectedValue(new Error('session_required'))};
    renderCommand(client);

    expect(await screen.findByRole('heading', {name: 'COMMAND LINK UNAVAILABLE'}, {timeout: 3000})).toBeTruthy();
    expect(screen.getByText('session_required')).toBeTruthy();
    expect(screen.getByText(/No development fixture fallback is permitted/i)).toBeTruthy();
  });
});
