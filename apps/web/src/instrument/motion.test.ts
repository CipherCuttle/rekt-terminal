import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REFERENCE_FPS,
  MOTION_PERIOD_MS,
  TAPE_GEOMETRY,
  predictMotionLandmark,
  sampleInstrumentMotion,
  stepReferenceTimeMs,
} from './motion';

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

describe('predictMotionLandmark', () => {
  it('uses the same frozen geometry as the neutral renderer', () => {
    const zero = sampleInstrumentMotion(0);
    expect(predictMotionLandmark(zero, 'left-reel-center')).toEqual({ x: TAPE_GEOMETRY.leftReelX, y: TAPE_GEOMETRY.y });
    expect(predictMotionLandmark(zero, 'right-reel-center')).toEqual({ x: TAPE_GEOMETRY.rightReelX, y: TAPE_GEOMETRY.y });
    expect(predictMotionLandmark(zero, 'left-spoke-tip')).toEqual({ x: TAPE_GEOMETRY.leftReelX + TAPE_GEOMETRY.spokeRadius, y: TAPE_GEOMETRY.y });
  });

  it('puts the transport landmark at the tape midpoint halfway through the provisional cycle', () => {
    const halfway = sampleInstrumentMotion(MOTION_PERIOD_MS / 2);
    const point = predictMotionLandmark(halfway, 'transport');
    expect(point.x).toBeCloseTo((TAPE_GEOMETRY.leftReelX + TAPE_GEOMETRY.rightReelX) / 2, 8);
    expect(point.y).toBe(TAPE_GEOMETRY.y);
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
