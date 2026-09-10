export type RektMascotState = 'SLEEP' | 'LAZY' | 'BORED' | 'WORK' | 'GRUMPY' | 'RELUCTANT_WIN';
export type MascotPlayback = 'LOOP' | 'PING_PONG' | 'ONCE';
export type MascotEyePose = 'closed' | 'half' | 'sideLeft' | 'sideRight' | 'focus' | 'squint' | 'grump';
export type MascotEffect = 'none' | 'z' | 'zz' | 'zzz' | 'ellipsis' | 'question' | 'sigh' | 'grumble' | 'task';

export type MascotFrame = Readonly<{
  x: number;
  y: number;
  eye: MascotEyePose;
  effect: MascotEffect;
}>;

export type MascotMotionDefinition = Readonly<{
  state: RektMascotState;
  label: string;
  playback: MascotPlayback;
  frameMs: number;
  frames: readonly [MascotFrame, MascotFrame, MascotFrame, MascotFrame];
}>;

const F = (x: number, y: number, eye: MascotEyePose, effect: MascotEffect = 'none'): MascotFrame => ({x, y, eye, effect});

/**
 * REKT MASCOT PERSONALITY CONTRACT V0.2
 *
 * REKT is a grumpy, lazy degen operator who resents being assigned work.
 * He is never furious, triumphant, kawaii, bouncy, or eager to please.
 * Emotional range: asleep -> lazy -> bored -> reluctant work -> grumble ->
 * begrudging acknowledgement -> back to lazy.
 *
 * The creator-derived mascot asset remains the body/silhouette authority.
 * V0.2 carries personality through grumpy eye poses, 0-3px body settling,
 * tiny exhale/grumble/task marks, and Zs. Gear/hood/body/tentacle geometry is
 * never redrawn by this contract.
 *
 * Personality is METAPHOR only. System truth continues to come from the
 * independent peripheral-motion contract.
 */
export const REKT_MASCOT_MOTIONS: readonly MascotMotionDefinition[] = [
  {
    state: 'SLEEP', label: 'SLEEPING ON THE CLOCK', playback: 'PING_PONG', frameMs: 760,
    frames: [F(0, 1, 'closed'), F(0, 2, 'closed', 'z'), F(0, 2, 'closed', 'zz'), F(0, 1, 'closed', 'zzz')],
  },
  {
    state: 'LAZY', label: 'ABSOLUTELY NOT VOLUNTEERING', playback: 'LOOP', frameMs: 860,
    frames: [F(0, 2, 'half'), F(0, 3, 'sideLeft'), F(0, 3, 'half', 'ellipsis'), F(0, 2, 'sideRight')],
  },
  {
    state: 'BORED', label: 'WAITING FOR THIS TO BECOME SOMEONE ELSE\'S PROBLEM', playback: 'LOOP', frameMs: 680,
    frames: [F(0, 1, 'sideLeft'), F(0, 1, 'grump'), F(0, 1, 'sideRight'), F(0, 1, 'half', 'ellipsis')],
  },
  {
    state: 'WORK', label: 'FINE. I\'LL DO THE TASK.', playback: 'LOOP', frameMs: 470,
    frames: [F(0, 0, 'grump', 'question'), F(0, 1, 'focus', 'task'), F(0, 1, 'sideLeft', 'task'), F(0, 0, 'grump', 'ellipsis')],
  },
  {
    state: 'GRUMPY', label: 'MUTTERING ABOUT MANAGEMENT', playback: 'ONCE', frameMs: 220,
    frames: [F(0, 0, 'grump'), F(-1, 0, 'squint', 'grumble'), F(1, 0, 'grump', 'sigh'), F(0, 0, 'half', 'ellipsis')],
  },
  {
    state: 'RELUCTANT_WIN', label: 'YEAH YEAH. IT WORKED. CAN I GO NOW?', playback: 'ONCE', frameMs: 300,
    frames: [F(0, 0, 'focus', 'task'), F(0, 0, 'grump'), F(0, 1, 'half', 'sigh'), F(0, 2, 'grump', 'ellipsis')],
  },
] as const;

export const REKT_MASCOT_BY_STATE = new Map(REKT_MASCOT_MOTIONS.map((definition) => [definition.state, definition]));

export function assertMascotMotionContracts(definitions: readonly MascotMotionDefinition[] = REKT_MASCOT_MOTIONS) {
  for (const definition of definitions) {
    if (definition.frames.length !== 4) throw new Error(`${definition.state}: mascot motion must contain exactly four frames`);
    if (definition.frameMs < 100) throw new Error(`${definition.state}: frame timing is too fast for the restrained instrument contract`);
    for (const [index, frame] of definition.frames.entries()) {
      if (Math.abs(frame.x) > 3 || Math.abs(frame.y) > 3) {
        throw new Error(`${definition.state}: frame ${index + 1} drifts too far from the canonical mascot anchor`);
      }
    }
  }
}
