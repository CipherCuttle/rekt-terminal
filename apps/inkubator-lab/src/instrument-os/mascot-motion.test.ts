import {describe, expect, it} from 'vitest';
import {assertMascotMotionContracts, REKT_MASCOT_MOTIONS} from './mascot-motion';

describe('REKT mascot motion contract', () => {
  it('keeps every state on the four-frame restrained contract', () => {
    expect(() => assertMascotMotionContracts()).not.toThrow();
    expect(REKT_MASCOT_MOTIONS.every((definition) => definition.frames.length === 4)).toBe(true);
  });

  it('freezes the first grumpy-degen personality slice', () => {
    expect(REKT_MASCOT_MOTIONS.map((definition) => definition.state)).toEqual([
      'SLEEP', 'LAZY', 'BORED', 'WORK', 'GRUMPY', 'RELUCTANT_WIN',
    ]);
  });

  it('never moves the canonical mascot body more than three pixels in v0', () => {
    const drift = REKT_MASCOT_MOTIONS.flatMap((definition) => definition.frames.map((frame) => Math.max(Math.abs(frame.x), Math.abs(frame.y))));
    expect(Math.max(...drift)).toBeLessThanOrEqual(3);
  });

  it('has no angry, excited, wide-eyed, or sparkle vocabulary', () => {
    const serialized = JSON.stringify(REKT_MASCOT_MOTIONS).toLowerCase();
    expect(serialized).not.toContain('angry');
    expect(serialized).not.toContain('excited');
    expect(serialized).not.toContain('wide');
    expect(serialized).not.toContain('spark');
  });

  it('keeps grumpy reactions finite while lazy states may loop', () => {
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'GRUMPY')?.playback).toBe('ONCE');
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'RELUCTANT_WIN')?.playback).toBe('ONCE');
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'SLEEP')?.playback).toBe('PING_PONG');
    expect(REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'LAZY')?.playback).toBe('LOOP');
  });

  it('keeps work annoyed rather than celebratory', () => {
    const work = REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'WORK');
    const win = REKT_MASCOT_MOTIONS.find((definition) => definition.state === 'RELUCTANT_WIN');
    expect(work?.frames.some((frame) => frame.eye === 'grump')).toBe(true);
    expect(win?.frames.some((frame) => frame.eye === 'grump')).toBe(true);
    expect(win?.frames.some((frame) => frame.effect === 'sigh')).toBe(true);
  });
});
