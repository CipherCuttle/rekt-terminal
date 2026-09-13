export const CHALLENGE_SURFACES = [
  'DISCOVER',
  'COMPILER',
  'CHALLENGE',
  'MY_BUILD',
  'REVIEW',
  'HISTORY',
  'OPERATOR',
] as const;

export type ChallengeSurface = (typeof CHALLENGE_SURFACES)[number];

export const SURFACE_STATES = [
  'NORMAL',
  'LOADING',
  'EMPTY',
  'ERROR',
  'UNAVAILABLE_OR_STALE',
  'UNAUTHORIZED',
] as const;

export type SurfaceState = (typeof SURFACE_STATES)[number];

export type SurfacePresentation = {
  mobile: boolean;
  reducedMotion: boolean;
};

export function parseChallengeSurface(value: string | null | undefined): ChallengeSurface | undefined {
  const normalized = value?.trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
  return CHALLENGE_SURFACES.find((surface) => surface === normalized);
}

export const SURFACE_LABELS: Record<ChallengeSurface, string> = {
  DISCOVER: 'DISCOVER',
  COMPILER: 'COMPILER / CREATE',
  CHALLENGE: 'CHALLENGE',
  MY_BUILD: 'MY BUILD',
  REVIEW: 'REVIEW / TEST ARENA',
  HISTORY: 'RECEIPT / HISTORY',
  OPERATOR: 'OPERATOR EXCEPTIONS',
};

export const SURFACE_CUES: Record<ChallengeSurface, string> = {
  DISCOVER: 'FIND THE BUILD',
  COMPILER: 'MAKE IT PRECISE',
  CHALLENGE: 'READ THE CONTRACT',
  MY_BUILD: 'BUILD AGAINST TRUTH',
  REVIEW: 'COMPARE THE QUALIFIERS',
  HISTORY: 'KEEP THE RECEIPT',
  OPERATOR: 'FAIL CLOSED',
};
