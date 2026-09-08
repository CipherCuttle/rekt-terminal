import {InkubatorApiClient, InkubatorApiError, type FetchLike} from './generated/inkubator-api-client.js';

export {InkubatorApiError};
export interface InkubatorClientOptions { baseUrl: string; accessToken: string; fetchImpl?: FetchLike; }
export interface MutationOptions { idempotencyKey?: string; }
const requestId = (value?: string) => value ?? crypto.randomUUID();

export function createInkubatorClient(options: InkubatorClientOptions) {
  const transport = new InkubatorApiClient(options.baseUrl, options.fetchImpl ?? fetch, options.accessToken);
  return {
    player: {
      me: () => transport.getDevkitMe(),
      profile: () => transport.getDevkitPlayerProfile(),
    },
    mission: {
      current: () => transport.getDevkitCurrentMission(),
      status: () => transport.getDevkitCurrentMission(),
      update: (input: {currentFocus?: string; nextMove?: string; blocker?: string | null; stackLabels?: string[]} & MutationOptions) => transport.updateDevkitCurrentMission({
        request_id: requestId(input.idempotencyKey),
        ...(input.currentFocus !== undefined ? {current_focus: input.currentFocus} : {}),
        ...(input.nextMove !== undefined ? {next_move: input.nextMove} : {}),
        ...(input.blocker !== undefined ? {blocker: input.blocker} : {}),
        ...(input.stackLabels !== undefined ? {stack_labels: input.stackLabels} : {}),
      }),
      claim: (input: {gateKey: 'FOUNDATION'|'CORE_EXPERIENCE'|'QUALITY_TESTING'|'SHIPABILITY'; state?: 'UNKNOWN'|'CLAIMED'|'ACTIVE'|'ATTENTION'|'BLOCKED'|'STALE'|'FAILED'} & MutationOptions) => transport.claimDevkitMilestone(input.gateKey, {request_id: requestId(input.idempotencyKey), state: input.state ?? 'CLAIMED'}),
    },
    project: {
      current: () => transport.getDevkitCurrentProject(),
      activity: () => transport.getDevkitActivity(),
    },
    beacon: {
      list: () => transport.listDevkitHelpBeacons(),
      create: (input: {summary: string; skillsNeeded?: string[]} & MutationOptions) => transport.createDevkitHelpBeacon({request_id: requestId(input.idempotencyKey), summary: input.summary, ...(input.skillsNeeded ? {skills_needed: input.skillsNeeded} : {})}),
    },
    assist: {
      offer: (input: {beaconId: string; message: string} & MutationOptions) => transport.offerDevkitAssist(input.beaconId, {request_id: requestId(input.idempotencyKey), message: input.message}),
    },
    ship: {
      prepare: (input: {title: string; url: string; demoUrl?: string; sourceUrl?: string} & MutationOptions) => transport.prepareDevkitShip({request_id: requestId(input.idempotencyKey), title: input.title, url: input.url, ...(input.demoUrl ? {demo_url: input.demoUrl} : {}), ...(input.sourceUrl ? {source_url: input.sourceUrl} : {})}),
    },
  };
}
