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
