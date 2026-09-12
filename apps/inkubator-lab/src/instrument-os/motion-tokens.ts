export const MOTION_SECONDS = {
  snap: 0.07,
  switch: 0.12,
  relay: 0.18,
  mechanical: 0.24,
  signal: 0.38,
  mode: 0.48,
  ceremony: 0.9,
} as const;

export const MOTION_EASE = {
  relay: 'power2.out',
  mechanical: 'power1.inOut',
  signal: 'power2.inOut',
  error: 'steps(1)',
} as const;

export const MOTION_OVERLAP = {
  thread: '-=0.12',
  mission: '-=0.04',
  verifier: '-=0.12',
  error: '-=0.08',
} as const;
