export declare const PROTOCOL_VERSION: 'inkubator-devkit/0.1';
export declare const TRUTH_CLASSES: readonly ['CLAIM', 'OBSERVATION', 'PROOF'];
export declare const DEVKIT_SCOPES: readonly ['player:read', 'project:read', 'mission:read', 'claim:write', 'update:write', 'beacon:write', 'assist:write', 'ship:prepare'];
export type DevkitScope = typeof DEVKIT_SCOPES[number];
export declare const DEVKIT_FORBIDDEN_AUTHORITIES: readonly ['proof:write', 'achievement:grant', 'ship:approve', 'reputation:write', 'player:moderate', 'round:admin'];
