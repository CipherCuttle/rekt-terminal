import type {CommandView, MissionGateKey} from '../generated/inkubator-api-client';

export type CommandProjectionDelta =
  | {kind: 'SOURCE'}
  | {kind: 'GATE'; gateKey: MissionGateKey}
  | {kind: 'NEXT_MOVE'}
  | {kind: 'BLOCKER'}
  | {kind: 'MISSION'}
  | {kind: 'DAEMON'};

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function diffCommandProjection(previous: CommandView, current: CommandView): CommandProjectionDelta[] {
  const deltas: CommandProjectionDelta[] = [];

  if (!sameJson(previous.github_evidence, current.github_evidence)
    || previous.project.source_connected !== current.project.source_connected
    || previous.project.source_visibility !== current.project.source_visibility
    || previous.project.observation_state !== current.project.observation_state) {
    deltas.push({kind: 'SOURCE'});
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
  return deltas;
}

export function summarizeCommandDeltas(deltas: CommandProjectionDelta[]): string {
  if (deltas.length === 0) return 'NO CANONICAL CHANGE';
  return deltas.map((delta) => delta.kind === 'GATE' ? `GATE:${delta.gateKey}` : delta.kind).join(' → ');
}
