import {useEffect, useMemo, useRef, useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {CommandView, ProjectHelpLoopView} from '../generated/inkubator-api-client';
import LiveCommand from './LiveCommand';

const states = ['building', 'rx', 'blocked', 'help', 'proven'] as const;
type PreviewState = typeof states[number];
// This module is imported only inside the DEV branch in main.tsx.
export function previewCommand(state: PreviewState): CommandView {
  const blocked = state === 'blocked' || state === 'help';
  const proven = state === 'proven';
  return {
    schema_version: 'command.private.v2',
    project: {project_id: 'LOCAL-PREVIEW', name: 'Project Nebula', source_connected: true, source_visibility: 'PUBLIC', observation_state: 'OBSERVED'},
    mission: {mission_id: 'LOCAL-MISSION', state: proven ? 'SHIPPED' : blocked ? 'BLOCKED' : 'BUILDING',
      goal: 'Build verifiers for open-source agents.',
      ship_condition: 'Accepted verifier evidence and a working artifact.',
      current_focus: proven ? 'Accepted evidence is recorded against this mission.' : blocked ? 'Repair the failing assertion, then run the verifier again.' : state === 'rx' ? 'A workflow observation arrived. Inspect its result before continuing.' : 'Verify the latest changes and review the first failing gate.',
      next_move: proven ? 'Review accepted proof' : state === 'help' ? 'Review helper response' : blocked ? 'Inspect failing test' : state === 'rx' ? 'Inspect source observation' : 'Run verifier tests',
      ...(blocked ? {blocker: 'Verifier test failed.'} : {}),
      progress_model_version: 'mission.progress.v1', stack_labels: ['TYPESCRIPT'], stack_source: 'PLAYER_CONFIRMED'},
    gates: [
      {key: 'FOUNDATION', label: 'Declare', state: 'OBSERVED', position: 1},
      {key: 'CORE_EXPERIENCE', label: 'Build', state: 'OBSERVED', position: 2},
      {key: 'QUALITY_TESTING', label: 'Test', state: proven ? 'OBSERVED' : blocked ? 'FAILED' : 'ACTIVE', position: 3},
      {key: 'SHIPABILITY', label: 'Ship', state: proven ? 'PROVEN' : 'UNKNOWN', position: 4},
    ],
    github_evidence: {rule_version: 'github-evidence.v1', source_state: 'AVAILABLE', signal_state: 'OBSERVED', stale_after_ms: 300000, invalid_observation_count: 0,
      reason_code: 'latest_observation_current', observed_stacks: ['JAVASCRIPT_TYPESCRIPT'],
      latest_observation: {observation_id: state === 'rx' ? 'LOCAL-OBS-2' : 'LOCAL-OBS-1', kind: 'WORKFLOW', outcome: blocked ? 'FAILED' : 'SUCCEEDED', observed_at: '2026-09-08T13:00:00Z'}},
    daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'Synthetic preview context.', proposed_next_move: 'Keep the verifier slice bounded.'},
  };
}
function helpLoop(state: PreviewState): ProjectHelpLoopView {
  return {schema_version: 'project.help_loop.public.v1', project_id: 'LOCAL-PREVIEW',
    owner: {schema_version: 'player.public.v2', player_id: 'LOCAL-PLAYER', display_name: 'Preview builder', skills_needed: [], can_help_with: []},
    party_members: [],
    ...(state === 'help' ? {open_help_beacon: {schema_version: 'help_beacon.public.v1' as const, beacon_id: 'LOCAL-BEACON', project_id: 'LOCAL-PREVIEW', summary: 'Review the verifier assertion.', skills_needed: [], state: 'OPEN' as const}} : {})};
}
export default function CommandPreview() {
  const requested = new URLSearchParams(location.search).get('state');
  const initial = states.includes(requested as PreviewState) ? requested as PreviewState : 'building';
  const [state, setState] = useState<PreviewState>('building');
  const stateRef = useRef<PreviewState>('building');
  const queryClient = useMemo(() => new QueryClient({defaultOptions: {queries: {retry: false}}}), []);
  const client = useMemo(() => ({getMyCommand: async () => previewCommand(stateRef.current), getProjectHelpLoop: async () => helpLoop(stateRef.current)}), []);
  const select = (next: PreviewState) => {
    stateRef.current = next; setState(next);
    history.replaceState(null, '', `?preview=command&state=${next}`);
    void queryClient.refetchQueries();
  };
  useEffect(() => {
    const timer = window.setTimeout(() => select(initial), 800);
    return () => {clearTimeout(timer); queryClient.clear();};
  }, []);
  return <QueryClientProvider client={queryClient}>
    <div className="command-preview-tools" role="region" aria-label="Development preview states"><span>LOCAL PREVIEW / SYNTHETIC</span>
      {states.map(item => <button key={item} aria-pressed={state === item} onClick={() => select(item)}>{item.toUpperCase()}</button>)}
    </div><LiveCommand client={client} refetchIntervalMs={false} />
  </QueryClientProvider>;
}
