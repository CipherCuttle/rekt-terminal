export type MotionSample = {
  tMs: number;
  transport: number;
  leftReel: number;
  rightReel: number;
  pulse: number;
};

export const MOTION_PERIOD_MS = 2400;
export const DEFAULT_REFERENCE_FPS = 30;

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

export function stepReferenceTimeMs(currentMs: number, direction: -1 | 1, fps: number, durationMs = Number.POSITIVE_INFINITY): number {
  const safeFps = Number.isFinite(fps) ? Math.min(240, Math.max(1, fps)) : DEFAULT_REFERENCE_FPS;
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : Number.POSITIVE_INFINITY;
  const next = currentMs + direction * (1000 / safeFps);
  return Math.min(safeDuration, Math.max(0, next));
}
