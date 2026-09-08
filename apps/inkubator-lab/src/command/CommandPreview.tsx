import {useMemo} from 'react';
import type {CommandView} from '../generated/inkubator-api-client';
import LiveCommand from './LiveCommand';

const BASE: CommandView = {
  schema_version: 'command.private.v2',
  project: {
    project_id: 'PREVIEW-001',
    name: 'PROJECT NEBULA',
    source_connected: true,
    source_visibility: 'PRIVATE',
    observation_state: 'OBSERVED',
  },
  mission: {
    mission_id: 'MISSION-001',
    state: 'BUILDING',
    goal: 'Build verifiers for open-source agents.',
    ship_condition: 'Verifier evidence is observed and the ship gate is explicitly proven.',
    current_focus: 'Wire the canonical Living Thread projection.',
    next_move: 'RUN VERIFIER TESTS',
    progress_model_version: 'mission.progress.v1',
    stack_labels: ['TYPESCRIPT'],
    stack_source: 'PLAYER_CONFIRMED',
  },
  round: {
    round_id: 'ROUND-001',
    code: 'R1',
    title: 'FOUNDING',
    constraint: 'Ship one working thing.',
    state: 'OPEN',
  },
  gates: [
    {key: 'DECLARE', label: 'DECLARE', state: 'PROVEN', position: 1},
    {key: 'SOURCE', label: 'SOURCE', state: 'OBSERVED', position: 2},
    {key: 'BUILD', label: 'BUILD', state: 'ACTIVE', position: 3},
    {key: 'TEST', label: 'TEST', state: 'UNKNOWN', position: 4},
    {key: 'VERIFY', label: 'VERIFY', state: 'UNKNOWN', position: 5},
    {key: 'SHIP', label: 'SHIP', state: 'UNKNOWN', position: 6},
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
      observation_id: 'OBS-PREVIEW-001',
      kind: 'WORKFLOW',
      outcome: 'SUCCEEDED',
      observed_at: '2026-09-08T15:00:00Z',
    },
  },
  daemon: {
    rule_version: 'daemon-advisory.v1',
    authority: 'ADVISORY_ONLY',
    what_changed: 'Testing evidence is the current locus.',
    proposed_next_move: 'Keep the verification slice bounded.',
  },
};

type PreviewState = 'building' | 'rx' | 'blocked' | 'proven';

function stateFromLocation(): PreviewState {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'rx' || value === 'blocked' || value === 'proven' ? value : 'building';
}

function targetFor(state: PreviewState): CommandView {
  if (state === 'blocked') {
    return {
      ...BASE,
      mission: {
        ...BASE.mission,
        state: 'BLOCKED',
        blocker: 'Verifier test failed.',
        next_move: 'INSPECT FAILING TEST',
        current_focus: 'Repair the verifier failure at the TEST gate.',
      },
      gates: BASE.gates.map((gate) => gate.key === 'TEST' ? {...gate, state: 'BLOCKED'} : gate),
      daemon: {
        ...BASE.daemon,
        what_changed: 'Testing evidence stopped advancing.',
        likely_blocker: 'No external test result has been observed.',
      },
    };
  }

  if (state === 'proven') {
    return {
      ...BASE,
      mission: {
        ...BASE.mission,
        state: 'SHIP_READY',
        next_move: 'OPEN SHIP RECEIPT',
        current_focus: 'Proof is complete. Review the immutable receipt.',
      },
      gates: BASE.gates.map((gate) => ({...gate, state: 'PROVEN'})),
      github_evidence: {
        ...BASE.github_evidence,
        latest_observation: BASE.github_evidence.latest_observation
          ? {...BASE.github_evidence.latest_observation, outcome: 'SUCCEEDED'}
          : BASE.github_evidence.latest_observation,
      },
      daemon: {
        ...BASE.daemon,
        what_changed: 'Canonical verifier evidence reached the final gate.',
        proposed_next_move: 'Open the ship receipt.',
      },
    };
  }

  if (state === 'rx') {
    return {
      ...BASE,
      mission: {
        ...BASE.mission,
        current_focus: 'A new trusted source observation entered the Thread.',
        next_move: 'INSPECT SOURCE OBSERVATION',
      },
      github_evidence: {
        ...BASE.github_evidence,
        latest_observation: {
          observation_id: 'OBS-PREVIEW-002',
          kind: 'WORKFLOW',
          outcome: 'SUCCEEDED',
          observed_at: '2026-09-08T15:01:00Z',
        },
      },
      daemon: {
        ...BASE.daemon,
        what_changed: 'A trusted GitHub observation advanced the source locus.',
      },
    };
  }

  return BASE;
}

function PreviewNav({state}: {state: PreviewState}) {
  const states: PreviewState[] = ['building', 'rx', 'blocked', 'proven'];
  return (
    <nav
      aria-label="Visual preview states"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 50,
        display: 'flex',
        gap: 4,
        padding: 4,
        border: '1px solid #34313a',
        background: 'rgba(5,5,6,.92)',
        font: '9px ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: '.08em',
      }}
    >
      {states.map((item) => (
        <a
          key={item}
          href={`?preview=command&state=${item}`}
          aria-current={item === state ? 'page' : undefined}
          style={{
            color: item === state ? '#e8e4da' : '#85818c',
            textDecoration: 'none',
            textTransform: 'uppercase',
            padding: '6px 8px',
            background: item === state ? 'rgba(255,255,255,.05)' : 'transparent',
          }}
        >
          {item}
        </a>
      ))}
    </nav>
  );
}

export default function CommandPreview() {
  const state = stateFromLocation();
  const client = useMemo(() => {
    const target = targetFor(state);
    let calls = 0;
    return {
      getMyCommand: async () => {
        calls += 1;
        if (state !== 'building' && calls === 1) return BASE;
        return target;
      },
    };
  }, [state]);

  return (
    <>
      <LiveCommand client={client} refetchIntervalMs={state === 'building' ? false : 1200} />
      <PreviewNav state={state} />
    </>
  );
}
