import {describe, expect, it} from 'vitest';
import type {CommandView} from '../generated/inkubator-api-client';
import {diffCommandProjection, summarizeCommandDeltas} from './projection-delta';

function command(): CommandView {
  return {
    schema_version: 'command.private.v2',
    project: {
      project_id: 'P-001',
      name: 'PROJECT',
      source_connected: true,
      source_visibility: 'PRIVATE',
      observation_state: 'ACTIVE',
    },
    mission: {
      mission_id: 'M-001',
      state: 'BUILDING',
      goal: 'Goal',
      ship_condition: 'Ship',
      current_focus: 'Focus',
      next_move: 'Next',
      progress_model_version: 'mission.progress.v1',
      stack_labels: [],
      stack_source: 'UNKNOWN',
    },
    gates: [
      {key: 'FOUNDATION', label: 'Foundation', state: 'ACTIVE', position: 1},
      {key: 'CORE_EXPERIENCE', label: 'Core', state: 'UNKNOWN', position: 2},
      {key: 'QUALITY_TESTING', label: 'Quality', state: 'UNKNOWN', position: 3},
      {key: 'SHIPABILITY', label: 'Shipability', state: 'UNKNOWN', position: 4},
    ],
    github_evidence: {
      rule_version: 'github-evidence.v1',
      source_state: 'AVAILABLE',
      signal_state: 'ACTIVE',
      stale_after_ms: 300000,
      invalid_observation_count: 0,
      reason_code: 'no_valid_observation',
      observed_stacks: [],
    },
    daemon: {
      rule_version: 'daemon-advisory.v1',
      authority: 'ADVISORY_ONLY',
      what_changed: 'Nothing canonical changed.',
      proposed_next_move: 'Continue.',
    },
  };
}

describe('command projection deltas', () => {

  it('permits reception only for a new current available observation', () => {
    const previous = command();
    const current = structuredClone(previous);
    current.project.observation_state = 'OBSERVED';
    current.github_evidence = {...current.github_evidence, signal_state: 'OBSERVED', reason_code: 'latest_observation_current',
      latest_observation: {observation_id: 'NEW', kind: 'WORKFLOW', outcome: 'SUCCEEDED', observed_at: '2026-09-08T13:00:00Z'}};
    expect(diffCommandProjection(previous, current)).toContainEqual({kind: 'SOURCE', received: true});
    current.github_evidence.signal_state = 'STALE';
    expect(diffCommandProjection(previous, current)).toEqual([{kind: 'SOURCE'}]);
    current.github_evidence.signal_state = 'OBSERVED';
    current.github_evidence.source_state = 'UNAVAILABLE';
    expect(diffCommandProjection(previous, current)).toEqual([{kind: 'SOURCE'}]);
  });

  it('reports removed gates and help closure without minting a gate', () => {
    const previous = command();
    const current = structuredClone(previous);
    current.gates.pop();
    const help = {schema_version: 'help_beacon.public.v1' as const, beacon_id: 'B', project_id: 'P-001', summary: 'Help', skills_needed: [], state: 'OPEN' as const};
    expect(diffCommandProjection(previous, current, help)).toEqual([{kind: 'GATE', gateKey: 'SHIPABILITY'}, {kind: 'HELP'}]);
  });
  it('returns no synthetic event when the canonical projection is unchanged', () => {
    const current = command();
    expect(diffCommandProjection(current, structuredClone(current))).toEqual([]);
    expect(summarizeCommandDeltas([])).toBe('NO CANONICAL CHANGE');
  });

  it('classifies backend projection changes without promoting truth', () => {
    const previous = command();
    const current = structuredClone(previous);
    current.project.observation_state = 'OBSERVED';
    current.github_evidence.signal_state = 'OBSERVED';
    current.github_evidence.reason_code = 'latest_observation_current';
    current.gates[1] = {...current.gates[1], state: 'OBSERVED'};
    current.mission.next_move = 'Test the live path.';
    current.daemon = {...current.daemon, what_changed: 'Observation arrived.'};

    const deltas = diffCommandProjection(previous, current);
    expect(deltas).toEqual([
      {kind: 'SOURCE'},
      {kind: 'GATE', gateKey: 'CORE_EXPERIENCE'},
      {kind: 'NEXT_MOVE'},
      {kind: 'DAEMON'},
    ]);
    expect(summarizeCommandDeltas(deltas)).toBe('SOURCE → GATE:CORE_EXPERIENCE → NEXT_MOVE → DAEMON');
  });
});
