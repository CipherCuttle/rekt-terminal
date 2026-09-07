import type {InkSignalState} from './primitives';

export const fixtureMission = {
  title: 'SHIP THE WEIRD LITTLE THING',
  goal: 'Make the REKT build loop tangible enough that another builder can understand it, touch it, and want to make the next thing.',
  shipCondition: 'A public working artifact survives an external test and receives an accepted Ship Receipt.',
  currentFocus: 'Close the first external test without widening scope.',
  nextMove: 'Invite one builder to break the live interaction and record what actually blocks them.',
  blocker: 'External tester has not completed the critical flow yet.',
  state: 'BUILDING' as const,
};

export const fixtureThread: Array<{title: string; detail: string; state: InkSignalState}> = [
  {title: 'MISSION DECLARED', detail: 'Goal and ship condition are explicit.', state: 'PROVEN'},
  {title: 'CORE LOOP', detail: 'Playable path exists in the current build.', state: 'OBSERVED'},
  {title: 'EXTERNAL TEST', detail: 'Waiting on one outside builder.', state: 'ATTENTION'},
  {title: 'SHIP', detail: 'Receipt cannot exist before accepted evaluation.', state: 'UNKNOWN'},
];

export const fixtureEvents = [
  {title: 'Repository push observed', body: 'Trusted GitHub adapter reported a new main-branch commit.', time: '02:14', kind: 'commit' as const},
  {title: 'Scope warning cleared', body: 'The current change returned to the declared Mission boundary.', time: '01:48', kind: 'signal' as const},
  {title: 'Help Beacon opened', body: 'Needs one hostile mobile test before Ship preparation.', time: '00:31', kind: 'help' as const},
];

export const worldSignals = [
  {name: 'MICA / GLASSHOUSE', detail: 'External test requested', state: 'ATTENTION' as InkSignalState},
  {name: 'BASALT / GHOST KEY', detail: 'Deployment observed', state: 'OBSERVED' as InkSignalState},
  {name: 'NOISEWAVE / TINY GOD', detail: 'First artifact proven', state: 'PROVEN' as InkSignalState},
  {name: 'MOTH / DEAD DROP', detail: 'Mission blocked on auth', state: 'BLOCKED' as InkSignalState},
];

export const evidence = [
  {label: 'REPOSITORY PUSH', detail: 'refs/heads/main · source private', state: 'OBSERVED' as InkSignalState, source: 'GITHUB'},
  {label: 'PUBLIC BUILD', detail: 'Deployment responds and is externally reachable', state: 'OBSERVED' as InkSignalState, source: 'ADAPTER'},
  {label: 'EXTERNAL TEST', detail: 'No accepted tester result yet', state: 'UNKNOWN' as InkSignalState, source: 'HUMAN'},
];

// Development fixture for the ARTIFACT golden screen. It mirrors the bounded public
// Phase-6C projection: receipt 1.0 remains immutable while attribution lives in the
// separately versioned shareable Artifact projection.
export const fixtureAcceptedShip = {
  schema_version: 'ship.artifact.public.v1' as const,
  receipt_id: '9b2dd782-3854-4c82-8bd7-f65d93a45f02',
  receipt_schema_version: 'inkubator.ship-receipt/1.0' as const,
  submission_id: 'bb26d7a9-c48d-4c26-ad33-d34bf4acf49b',
  mission_id: '1dd307c7-95d9-466a-bdad-b0765296a4df',
  project_id: 'f3b430ed-d3f4-4994-97e5-8b75420616b7',
  owner_player_id: 'd2ef1542-43bf-4905-a172-1d362557ca5f',
  round_id: '07289206-4ae0-4d77-83d8-5bc03b915a85',
  acceptance_rule_version: 'ship.acceptance.v1' as const,
  artifact: {
    title: 'REKT MACHINE',
    url: 'https://example.com/rekt-machine',
    demo_url: 'https://example.com/rekt-machine/demo',
  },
  builders: [
    {player_id: 'd2ef1542-43bf-4905-a172-1d362557ca5f', display_name: 'CipherCuttle', role: 'OWNER' as const},
    {player_id: '04e45ce8-945e-4fbc-8e12-70dd288b3396', display_name: 'Honeyslop', role: 'PARTY' as const},
  ],
  assists: [
    {assist_id: '8739029d-7781-4c29-a65b-cfbe93b81b62', player_id: '04e45ce8-945e-4fbc-8e12-70dd288b3396', display_name: 'Honeyslop', accepted_at: '2026-09-07T18:40:00.000Z', source_state: 'ACCEPTED' as const},
  ],
  evidence: {
    verifier_observation_id: '3954da06-16f1-4234-a2a7-8c0a6a6f283c',
    acceptance_review_id: '0862e02e-ec79-4544-8d63-731c2667b263',
  },
  truth_state: 'PROVEN' as const,
  shipped_at: '2026-09-07T18:45:00.000Z',
};
