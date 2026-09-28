import type {CommandView} from '../generated/inkubator-api-client';

export type CommandGuidanceAction =
  | {
      kind: 'CONTROL';
      phase: 'CONNECT' | 'HELP';
      label: string;
      targetId: 'command-source-control' | 'command-help-control';
      explanation: string;
    }
  | {
      kind: 'COPY_NEXT_MOVE';
      phase: 'BUILD';
      label: string;
      explanation: string;
    };

const TERMINAL_OR_HANDOFF_STATES = new Set(['SUBMITTED', 'SHIPPED', 'CLOSED_NOT_SHIPPED', 'ARCHIVED']);

/**
 * Product guidance may reveal an existing participant control or help carry the
 * canonical free-text Next Move back into the builder's normal work surface.
 * It never advances Mission state, creates evidence or invents a second Next Move.
 */
export function commandGuidanceAction(command: CommandView): CommandGuidanceAction | null {
  if (command.mission.state === 'SHIP_READY' || TERMINAL_OR_HANDOFF_STATES.has(command.mission.state)) return null;

  if (!command.project.source_connected) {
    return {
      kind: 'CONTROL',
      phase: 'CONNECT',
      label: 'CONNECT REPOSITORY',
      targetId: 'command-source-control',
      explanation: 'Connect the repository you are actually building. Then keep working there; Inkubator watches observed work around the Mission.',
    };
  }

  if (command.mission.blocker) {
    return {
      kind: 'CONTROL',
      phase: 'HELP',
      label: 'ASK FOR HELP',
      targetId: 'command-help-control',
      explanation: 'You marked this Mission blocked. Open a Help Beacon so another builder can respond to the specific thing stopping you.',
    };
  }

  if (command.github_evidence.source_state !== 'AVAILABLE' || command.github_evidence.signal_state === 'STALE') {
    return {
      kind: 'CONTROL',
      phase: 'CONNECT',
      label: 'CHECK SOURCE',
      targetId: 'command-source-control',
      explanation: 'Your build still lives in the repository, but Inkubator cannot currently rely on fresh source evidence. Check repository access before trusting progress signals.',
    };
  }

  return {
    kind: 'COPY_NEXT_MOVE',
    phase: 'BUILD',
    label: 'COPY NEXT MOVE',
    explanation: 'Keep building normally in your repo. Inkubator watches the Mission and reacts to observed work; this Next Move is the one thing to carry back into your editor or coding agent.',
  };
}
