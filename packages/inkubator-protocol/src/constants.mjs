export const PROTOCOL_VERSION = 'inkubator-devkit/0.1';
export const TRUTH_CLASSES = Object.freeze(['CLAIM', 'OBSERVATION', 'PROOF']);
export const DEVKIT_SCOPES = Object.freeze([
  'player:read',
  'project:read',
  'mission:read',
  'claim:write',
  'update:write',
  'beacon:write',
  'assist:write',
  'ship:prepare',
]);
export const DEVKIT_FORBIDDEN_AUTHORITIES = Object.freeze([
  'proof:write',
  'achievement:grant',
  'ship:approve',
  'reputation:write',
  'player:moderate',
  'round:admin',
]);
