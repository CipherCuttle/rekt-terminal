import {describe, expect, it} from 'vitest';
import type {CommandView} from '../generated/inkubator-api-client';
import {commandGuidanceAction} from './command-guidance';

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
    gates: [],
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

describe('commandGuidanceAction', () => {
  it('routes an unconnected Mission to the existing source control', () => {
    const base = commandView();
    expect(commandGuidanceAction({...base, project: {...base.project, source_connected: false}})).toMatchObject({
      kind: 'CONTROL',
      phase: 'CONNECT',
      label: 'CONNECT REPOSITORY',
      targetId: 'command-source-control',
    });
  });

  it('routes an explicit blocker to the existing Help control', () => {
    const base = commandView();
    expect(commandGuidanceAction({...base, mission: {...base.mission, blocker: 'Need an OAuth tester.'}})).toMatchObject({
      kind: 'CONTROL',
      phase: 'HELP',
      label: 'ASK FOR HELP',
      targetId: 'command-help-control',
    });
  });

  it('routes stale source evidence to source recovery without claiming progress', () => {
    const base = commandView();
    expect(commandGuidanceAction({...base, github_evidence: {...base.github_evidence, signal_state: 'STALE'}})).toMatchObject({
      kind: 'CONTROL',
      phase: 'CONNECT',
      label: 'CHECK SOURCE',
      targetId: 'command-source-control',
    });
  });

  it('keeps ordinary BUILD work in the repo and only carries the canonical Next Move outward', () => {
    expect(commandGuidanceAction(commandView())).toMatchObject({
      kind: 'COPY_NEXT_MOVE',
      phase: 'BUILD',
      label: 'COPY NEXT MOVE',
    });
  });

  it('yields to the existing authoritative Ship action and terminal states', () => {
    const base = commandView();
    expect(commandGuidanceAction({...base, mission: {...base.mission, state: 'SHIP_READY'}})).toBeNull();
    expect(commandGuidanceAction({...base, mission: {...base.mission, state: 'SUBMITTED'}})).toBeNull();
  });
});
