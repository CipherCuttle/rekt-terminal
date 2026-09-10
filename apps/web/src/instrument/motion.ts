export type MotionSample = {
  tMs: number;
  transport: number;
  leftReel: number;
  rightReel: number;
  pulse: number;
};

export const MOTION_PERIOD_MS = 2400;

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
