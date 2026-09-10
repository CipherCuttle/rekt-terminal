import {describe, expect, it} from 'vitest';
import {assertMascotMotionContracts, REKT_MASCOT_MOTIONS} from './mascot-motion';

describe('REKT mascot motion contract', () => {
  it('keeps every state on the four-frame restrained contract', () => {
    expect(() => assertMascotMotionContracts()).not.toThrow();
    expect(REKT_MASCOT_MOTIONS.every((definition) => definition.frames.length === 4)).toBe(true);
  });

  it('ships the first personality slice', () => {
    expect(REKT_MASCOT_MOTIONS.map((definition) => definition.state)).toEqual([
      'SLEEP', 'LAZY', 'BORED', 'WORK', 'ANGRY', 'EXCITED',
    ]);
  });

  it('never moves the canonical mascot body more than three pixels in v0', () => {
    const drift = REKT_MASCOT_MOTIONS.flatMap((definition) => definition.frames.map((frame) => Math.max(Math.abs(frame.x), Math.abs(frame.y))));
    expect(Math.max(...drift)).toBeLessThanOrEqual(3);
  });

  it('keeps reactive moods finite while idle moods may loop', () => {
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'ANGRY')?.playback).toBe('ONCE');
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'EXCITED')?.playback).toBe('ONCE');
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'SLEEP')?.playback).toBe('PING_PONG');
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'LAZY')?.playback).toBe('LOOP');
  });
});
