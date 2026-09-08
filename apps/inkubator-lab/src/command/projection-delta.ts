import type {CommandView, MissionGateKey, HelpBeaconView} from '../generated/inkubator-api-client';

export type CommandProjectionDelta =
  | {kind: 'SOURCE'; received?: true}
  | {kind: 'GATE'; gateKey: MissionGateKey}
  | {kind: 'NEXT_MOVE'}
  | {kind: 'BLOCKER'}
  | {kind: 'MISSION'}
  | {kind: 'DAEMON'}
  | {kind: 'HELP'};

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function hasCurrentCommandSource(command: CommandView): boolean {
  const evidence = command.github_evidence;
  return command.project.source_connected && command.project.observation_state === 'OBSERVED'
    && evidence.source_state === 'AVAILABLE' && evidence.signal_state === 'OBSERVED'
    && evidence.reason_code === 'latest_observation_current' && Boolean(evidence.latest_observation);
}

export function diffCommandProjection(previous: CommandView, current: CommandView, previousHelp?: HelpBeaconView, currentHelp?: HelpBeaconView): CommandProjectionDelta[] {
  const deltas: CommandProjectionDelta[] = [];

  if (!sameJson(previous.github_evidence, current.github_evidence)
    || previous.project.source_connected !== current.project.source_connected
    || previous.project.source_visibility !== current.project.source_visibility
    || previous.project.observation_state !== current.project.observation_state) {
    const received = hasCurrentCommandSource(current)
      && previous.github_evidence.latest_observation?.observation_id !== current.github_evidence.latest_observation?.observation_id;
    deltas.push(received ? {kind: 'SOURCE', received: true} : {kind: 'SOURCE'});
  }

  for (const gate of previous.gates) {
    if (!current.gates.some(currentGate => currentGate.key === gate.key)) deltas.push({kind: 'GATE', gateKey: gate.key});
  }

  const previousGates = new Map(previous.gates.map((gate) => [gate.key, gate]));
  for (const gate of current.gates) {
    const prior = previousGates.get(gate.key);
    if (!prior || prior.state !== gate.state || prior.position !== gate.position || prior.label !== gate.label) {
      deltas.push({kind: 'GATE', gateKey: gate.key});
    }
  }

  if (previous.mission.next_move !== current.mission.next_move) deltas.push({kind: 'NEXT_MOVE'});
  if ((previous.mission.blocker ?? null) !== (current.mission.blocker ?? null)) deltas.push({kind: 'BLOCKER'});

  if (previous.mission.state !== current.mission.state
    || previous.mission.goal !== current.mission.goal
    || previous.mission.current_focus !== current.mission.current_focus
    || previous.mission.ship_condition !== current.mission.ship_condition) {
    deltas.push({kind: 'MISSION'});
  }

  if (!sameJson(previous.daemon, current.daemon)) deltas.push({kind: 'DAEMON'});
  if (!sameJson(previousHelp, currentHelp)) deltas.push({kind: 'HELP'});
  return deltas;
}

export function summarizeCommandDeltas(deltas: CommandProjectionDelta[]): string {
  if (deltas.length === 0) return 'NO CANONICAL CHANGE';
  return deltas.map((delta) => delta.kind === 'GATE' ? `GATE:${delta.gateKey}` : delta.kind).join(' → ');
}
