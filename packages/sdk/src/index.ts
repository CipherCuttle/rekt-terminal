import {InkubatorApiClient, InkubatorApiError, type FetchLike} from './generated/inkubator-api-client.js';

export {InkubatorApiError};
export interface InkubatorClientOptions { baseUrl: string; fetchImpl?: FetchLike; }
export interface MutationOptions { idempotencyKey?: string; }
const requestId = (value?: string) => value ?? crypto.randomUUID();

/**
 * Browser/cookie-session client.
 *
 * This root export deliberately has no bearer-token option. Browser calls use the
 * canonical cookie-authenticated routes, preserving the API's origin/CSRF boundary.
 * Credential-bearing CLI/MCP clients live only under `@rekt-ink/sdk/server`.
 */
export function createInkubatorClient(options: InkubatorClientOptions) {
  const transport = new InkubatorApiClient(options.baseUrl, options.fetchImpl ?? fetch);
  const current = () => transport.getMyCommand();

  return {
    player: {
      me: () => transport.getMe(),
      profile: () => transport.getMyProfile(),
    },
    mission: {
      current,
      status: current,
      update: async (input: {currentFocus?: string; nextMove?: string; blocker?: string | null; stackLabels?: string[]} & MutationOptions) => {
        const command = await current();
        return transport.updateMission(command.mission.mission_id, {
          request_id: requestId(input.idempotencyKey),
          ...(input.currentFocus !== undefined ? {current_focus: input.currentFocus} : {}),
          ...(input.nextMove !== undefined ? {next_move: input.nextMove} : {}),
          ...(input.blocker !== undefined ? {blocker: input.blocker} : {}),
          ...(input.stackLabels !== undefined ? {stack_labels: input.stackLabels} : {}),
        });
      },
      claim: async (input: {gateKey: 'FOUNDATION'|'CORE_EXPERIENCE'|'QUALITY_TESTING'|'SHIPABILITY'; state?: 'UNKNOWN'|'CLAIMED'|'ACTIVE'|'ATTENTION'|'BLOCKED'|'STALE'|'FAILED'} & MutationOptions) => {
        const command = await current();
        return transport.updateMissionGate(command.mission.mission_id, input.gateKey, {
          request_id: requestId(input.idempotencyKey),
          signal_state: input.state ?? 'CLAIMED',
        });
      },
    },
    project: {
      current: async () => (await current()).project,
    },
    beacon: {
      list: async () => {
        const command = await current();
        return transport.getProjectHelpLoop(command.project.project_id);
      },
      create: async (input: {summary: string; skillsNeeded?: string[]} & MutationOptions) => {
        const command = await current();
        return transport.createHelpBeacon(command.project.project_id, {
          request_id: requestId(input.idempotencyKey),
          summary: input.summary,
          ...(input.skillsNeeded ? {skills_needed: input.skillsNeeded} : {}),
        });
      },
    },
    assist: {
      offer: (input: {beaconId: string; message: string} & MutationOptions) => transport.offerAssist(input.beaconId, {
        request_id: requestId(input.idempotencyKey),
        message: input.message,
      }),
    },
    ship: {
      prepare: async (input: {title: string; url: string; demoUrl?: string; sourceUrl?: string} & MutationOptions) => {
        const command = await current();
        return transport.submitShip(command.mission.mission_id, {
          request_id: requestId(input.idempotencyKey),
          title: input.title,
          url: input.url,
          ...(input.demoUrl ? {demo_url: input.demoUrl} : {}),
          ...(input.sourceUrl ? {source_url: input.sourceUrl} : {}),
        });
      },
    },
  };
}
