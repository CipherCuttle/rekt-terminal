export type RektMascotState = 'SLEEP' | 'LAZY' | 'BORED' | 'WORK' | 'ANGRY' | 'EXCITED';
export type MascotPlayback = 'LOOP' | 'PING_PONG' | 'ONCE';
export type MascotEyePose = 'closed' | 'half' | 'left' | 'right' | 'focus' | 'angry' | 'wide';
export type MascotEffect = 'none' | 'z' | 'zz' | 'zzz' | 'ellipsis' | 'question' | 'anger' | 'spark';

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
 * V0 deliberately keeps the canonical mascot silhouette almost fixed.
 * Personality is carried by eye pose, tiny 0-3px body shifts and peripheral FX.
 * Gear/hood/body/tentacle geometry comes from the canonical creator-derived asset.
 */
export const REKT_MASCOT_MOTIONS: readonly MascotMotionDefinition[] = [
  {
    state: 'SLEEP', label: 'SLEEPING ON THE CLOCK', playback: 'PING_PONG', frameMs: 720,
    frames: [F(0, 1, 'closed', 'z'), F(0, 2, 'closed', 'zz'), F(0, 2, 'closed', 'zzz'), F(0, 1, 'closed', 'zz')],
  },
  {
    state: 'LAZY', label: 'ABSOLUTELY NOT WORKING', playback: 'LOOP', frameMs: 820,
    frames: [F(0, 2, 'half'), F(0, 3, 'half'), F(0, 3, 'left', 'ellipsis'), F(0, 2, 'half')],
  },
  {
    state: 'BORED', label: 'WAITING FOR SOMETHING INTERESTING', playback: 'LOOP', frameMs: 620,
    frames: [F(0, 0, 'left'), F(0, 0, 'focus'), F(0, 0, 'right'), F(0, 0, 'focus', 'ellipsis')],
  },
  {
    state: 'WORK', label: 'RELUCTANTLY WORKING', playback: 'LOOP', frameMs: 430,
    frames: [F(0, 0, 'focus', 'question'), F(0, 0, 'left'), F(0, 1, 'focus'), F(0, 0, 'right')],
  },
  {
    state: 'ANGRY', label: 'THIS WAS NOT IN THE JOB DESCRIPTION', playback: 'ONCE', frameMs: 130,
    frames: [F(0, 0, 'focus'), F(-1, 0, 'angry'), F(1, 0, 'angry', 'anger'), F(0, 0, 'angry', 'anger')],
  },
  {
    state: 'EXCITED', label: 'SOMEHOW WE SHIPPED', playback: 'ONCE', frameMs: 150,
    frames: [F(0, 0, 'focus'), F(0, -2, 'wide'), F(0, -3, 'wide', 'spark'), F(0, 0, 'wide', 'spark')],
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
