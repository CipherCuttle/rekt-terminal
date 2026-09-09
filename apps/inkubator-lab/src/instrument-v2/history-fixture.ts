import type {RecordTruth} from './primitives';

// Presentation-only scenario. NOT a Player API projection; never passed to
// Query, a generated DTO, a domain reducer, or a production route.
export type HistoryEvent = {
  id: string; at: string; title: string; truth: RecordTruth;
  owner: 'COMMAND' | 'PROJECT' | 'SHIP' | 'PLAYER';
  source: string; reference: string; context: string; boundary: string;
  evidence?: {label: string; reference: string}[];
};

export const HISTORY_FIXTURE: readonly HistoryEvent[] = [
  {id: 'mission', at: '2026-09-01T09:00:00Z', title: 'Mission declared', truth: 'CLAIMED', owner: 'COMMAND', source: 'Builder declaration', reference: 'fixture:mission-01', context: 'Build a small public archive of independent tools. Ship condition: a working, browsable directory.', boundary: 'A declared intention. No completed work or acceptance is established.'},
  {id: 'repository', at: '2026-09-01T09:14:00Z', title: 'Repository connected', truth: 'CONNECTED', owner: 'PROJECT', source: 'Repository connection', reference: 'fixture:repository-01', context: 'A repository was connected to the Field Notes project.', boundary: 'Connection is operational state. It does not establish observed work or proof.'},
  {id: 'work', at: '2026-09-02T14:32:00Z', title: 'Work observed', truth: 'OBSERVED', owner: 'PROJECT', source: 'GitHub adapter observation', reference: 'fixture:observation-01', context: 'The source adapter recorded a repository update for Field Notes.', boundary: 'An observed update does not establish a working artifact.'},
  {id: 'test', at: '2026-09-04T11:08:00Z', title: 'External test recorded', truth: 'OBSERVED', owner: 'PROJECT', source: 'External tester record', reference: 'fixture:test-01', context: 'An external tester recorded a test of the directory. The record preserves the testing context.', boundary: 'Test presence alone does not imply PASS, acceptance, or PROVEN.'},
  {id: 'assist', at: '2026-09-04T16:45:00Z', title: 'Assist accepted', truth: 'OBSERVED', owner: 'PROJECT', source: 'Project owner acceptance', reference: 'fixture:assist-01', context: 'The project owner accepted help with the directory’s keyboard navigation.', boundary: 'Accepted help is observed contribution context, not a universal trust score.'},
  {id: 'submission', at: '2026-09-06T10:20:00Z', title: 'Ship submitted', truth: 'SUBMITTED', owner: 'SHIP', source: 'Artifact submission', reference: 'fixture:submission-01', context: 'Field Notes was submitted for review as a working public directory.', boundary: 'Submission is operational state. Verifier PASS would still not establish acceptance.'},
  {id: 'ship', at: '2026-09-07T13:06:00Z', title: 'Ship accepted', truth: 'PROVEN', owner: 'SHIP', source: 'Accepted Ship receipt · fixture', reference: 'fixture:receipt-01', context: 'The example acceptance record preserves the submitted artifact and its review evidence.', boundary: 'This is a simulated receipt-backed acceptance example, not a real Ship or a cryptographic proof.', evidence: [{label: 'Submission', reference: 'fixture:submission-01'}, {label: 'Observation', reference: 'fixture:verifier-01'}, {label: 'Acceptance review', reference: 'fixture:review-01'}]},
  {id: 'cheevo', at: '2026-09-07T13:06:01Z', title: 'Cheevo earned', truth: 'PROVEN', owner: 'PLAYER', source: 'Versioned award rule · fixture', reference: 'fixture:cheevo-01', context: '“Working URL or GTFO” — a calibration example of a backend-derived award with explicit evidence.', boundary: 'This example does not evaluate an award rule. Clicks and page visits cannot grant recognition.', evidence: [{label: 'Accepted Ship', reference: 'fixture:receipt-01'}, {label: 'Award rule', reference: 'fixture:award-rule-v1'}]},
];

export type HistoryScenario = 'record' | 'empty' | 'stale' | 'unavailable' | 'unsupported';
export const SCENARIO_COPY: Record<Exclude<HistoryScenario, 'record'>, {title: string; detail: string}> = {
  empty: {title: 'No history recorded', detail: 'There are no events in this example. Earned evidence will appear when a supported record exists.'},
  stale: {title: 'Historical snapshot · stale', detail: 'Showing the fixture saved on 07 SEP 2026. Current activity is unknown.'},
  unavailable: {title: 'History unavailable', detail: 'The source cannot be read in this scenario. No cached record or earned evidence is presented.'},
  unsupported: {title: 'Unsupported history format', detail: 'This scenario cannot safely represent the received event format. No truth label or award has been inferred.'},
};

export function formatEventDate(at: string) {
  return new Intl.DateTimeFormat('en-GB', {day: '2-digit', month: 'short', timeZone: 'UTC'}).format(new Date(at)).toUpperCase();
}
