export type MotionSample = {
  tMs: number;
  transport: number;
  leftReel: number;
  rightReel: number;
  pulse: number;
};

export const MOTION_PERIOD_MS = 2400;
export const DEFAULT_REFERENCE_FPS = 30;

export const TAPE_GEOMETRY = {
  width: 320,
  height: 150,
  y: 74,
  leftReelX: 78,
  rightReelX: 242,
  reelRadius: 22,
  spokeRadius: 17,
} as const;

export type MotionLandmark = 'transport' | 'left-reel-center' | 'right-reel-center' | 'left-spoke-tip' | 'right-spoke-tip';

export type MotionPoint = { x: number; y: number };

export function sampleInstrumentMotion(tMs: number): MotionSample {
  const phase = ((tMs % MOTION_PERIOD_MS) + MOTION_PERIOD_MS) % MOTION_PERIOD_MS / MOTION_PERIOD_MS;
  const eased = phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2;
  return {
    tMs,
    transport: eased,
    leftReel: phase * Math.PI * 2,
    rightReel: -phase * Math.PI * 2,
    pulse: 0.5 - 0.5 * Math.cos(phase * Math.PI * 2),
  };
}

export function predictMotionLandmark(sample: MotionSample, landmark: MotionLandmark): MotionPoint {
  const g = TAPE_GEOMETRY;
  if (landmark === 'left-reel-center') return { x: g.leftReelX, y: g.y };
  if (landmark === 'right-reel-center') return { x: g.rightReelX, y: g.y };
  if (landmark === 'left-spoke-tip') {
    return {
      x: g.leftReelX + Math.cos(sample.leftReel) * g.spokeRadius,
      y: g.y + Math.sin(sample.leftReel) * g.spokeRadius,
    };
  }
  if (landmark === 'right-spoke-tip') {
    return {
      x: g.rightReelX + Math.cos(sample.rightReel) * g.spokeRadius,
      y: g.y + Math.sin(sample.rightReel) * g.spokeRadius,
    };
  }
  const start = g.leftReelX + g.reelRadius;
  const end = g.rightReelX - g.reelRadius;
  return { x: start + sample.transport * (end - start), y: g.y };
}

export function stepReferenceTimeMs(currentMs: number, direction: -1 | 1, fps: number, durationMs = Number.POSITIVE_INFINITY): number {
  const safeFps = Number.isFinite(fps) ? Math.min(240, Math.max(1, fps)) : DEFAULT_REFERENCE_FPS;
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : Number.POSITIVE_INFINITY;
  const next = currentMs + direction * (1000 / safeFps);
  return Math.min(safeDuration, Math.max(0, next));
}
