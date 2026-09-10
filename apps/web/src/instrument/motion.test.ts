import { describe, expect, it } from 'vitest';
import { DEFAULT_REFERENCE_FPS, MOTION_PERIOD_MS, sampleInstrumentMotion, stepReferenceTimeMs } from './motion';

describe('sampleInstrumentMotion', () => {
  it('is deterministic and periodic', () => {
    const a = sampleInstrumentMotion(600);
    const b = sampleInstrumentMotion(600);
    const wrapped = sampleInstrumentMotion(600 + MOTION_PERIOD_MS);
    expect(a).toEqual(b);
    expect(wrapped.transport).toBeCloseTo(a.transport, 12);
    expect(wrapped.leftReel).toBeCloseTo(a.leftReel, 12);
    expect(wrapped.rightReel).toBeCloseTo(a.rightReel, 12);
    expect(wrapped.pulse).toBeCloseTo(a.pulse, 12);
  });

  it('keeps transport bounded', () => {
    for (let t = -MOTION_PERIOD_MS; t <= MOTION_PERIOD_MS * 2; t += 37) {
      const sample = sampleInstrumentMotion(t);
      expect(sample.transport).toBeGreaterThanOrEqual(0);
      expect(sample.transport).toBeLessThanOrEqual(1);
      expect(sample.pulse).toBeGreaterThanOrEqual(0);
      expect(sample.pulse).toBeLessThanOrEqual(1);
    }
  });
});

describe('stepReferenceTimeMs', () => {
  it('steps by one frame at the declared reference fps', () => {
    expect(stepReferenceTimeMs(1000, 1, 25)).toBeCloseTo(1040, 8);
    expect(stepReferenceTimeMs(1000, -1, 25)).toBeCloseTo(960, 8);
  });

  it('clamps at zero and the known reference duration', () => {
    expect(stepReferenceTimeMs(0, -1, DEFAULT_REFERENCE_FPS, 2000)).toBe(0);
    expect(stepReferenceTimeMs(1990, 1, DEFAULT_REFERENCE_FPS, 2000)).toBe(2000);
  });

  it('falls back to the default fps for non-finite input', () => {
    expect(stepReferenceTimeMs(0, 1, Number.NaN)).toBeCloseTo(1000 / DEFAULT_REFERENCE_FPS, 8);
  });
});
