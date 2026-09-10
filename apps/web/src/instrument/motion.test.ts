import { describe, expect, it } from 'vitest';
import { MOTION_PERIOD_MS, sampleInstrumentMotion } from './motion';

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
