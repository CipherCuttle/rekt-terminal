import type {Kysely} from 'kysely';
import type {DatabaseSchema} from './database.js';
import {createMission, type CommandSnapshot} from './mission-command.js';
import {
  PARTNER_MISSION_ORIGIN_VERSION,
  type PartnerMissionOrigin,
  readMissionPartnerOrigin,
} from './partner-origin.js';

export const PARTNER_CARTRIDGE_VERSION = 'partner-cartridge/0.1' as const;
export const PARTNER_EMBED_VERSION = 'partner.embed.public.v0' as const;

export type PartnerPrimitive = {
  id: string;
  kind: 'CONTRACT' | 'MARKET' | 'REWARD_SYSTEM';
  label: string;
  chain_id: 57073;
  address?: string;
  verification_state: 'CURATED_NOT_CHAIN_VERIFIED_IN_POC';
};

export type PartnerBuildRequest = {
  id: string;
  version: '0.1';
  title: string;
  summary: string;
  project_name: string;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  reward: {
    kind: 'EXTERNAL_PARTNER_PLEDGE';
    verification_state: 'UNVERIFIED';
    disclaimer: string;
  } | null;
};

export type PartnerCartridge = {
  schema_version: typeof PARTNER_CARTRIDGE_VERSION;
  slug: string;
  name: string;
  chain_id: 57073;
  status: 'CURATED';
  description: string;
  primitives: readonly PartnerPrimitive[];
  build_requests: readonly PartnerBuildRequest[];
};

export const APPLE_INU_CARTRIDGE: PartnerCartridge = Object.freeze({
  schema_version: PARTNER_CARTRIDGE_VERSION,
  slug: 'apple-inu',
  name: 'Apple Inu',
  chain_id: 57073,
  status: 'CURATED',
  description: 'External Ink project cartridge. Inkubator coordinates builders; Apple Inu remains independently owned.',
  primitives: Object.freeze([
    Object.freeze({
      id: 'ai-token', kind: 'CONTRACT', label: '$AI token', chain_id: 57073,
      address: '0x17188f3eAcEE452614eF676E2d022E53aa5151Dd',
      verification_state: 'CURATED_NOT_CHAIN_VERIFIED_IN_POC',
    }),
    Object.freeze({
      id: 'sentry-market', kind: 'MARKET', label: 'Sentry market', chain_id: 57073,
      verification_state: 'CURATED_NOT_CHAIN_VERIFIED_IN_POC',
    }),
    Object.freeze({
      id: 'stock-linked-rewards', kind: 'REWARD_SYSTEM', label: 'Stock-linked reward flow', chain_id: 57073,
      verification_state: 'CURATED_NOT_CHAIN_VERIFIED_IN_POC',
    }),
  ]),
  build_requests: Object.freeze([
    Object.freeze({
      id: 'BITE-001', version: '0.1', title: 'SEE THE MONEY',
      summary: 'Visualize the live $AI → fee → stock-linked reward → holder flow.',
      project_name: 'Apple Inu Reward Flow',
      goal: 'Make Apple Inu reward mechanics legible as a truthful live instrument.',
      ship_condition: 'Working public artifact consuming real Apple Inu / Ink state without presenting unverified data as PROVEN.',
      current_focus: 'Connect the first real onchain read.',
      next_move: 'Read and display one bounded Apple Inu primitive.',
      reward: null,
    }),
    Object.freeze({
      id: 'BITE-002', version: '0.1', title: 'PUT APPLE IN TELEGRAM',
      summary: 'Build a useful Telegram bot around Apple Inu state.',
      project_name: 'Apple Inu Telegram Bot',
      goal: 'Give the Apple Inu community useful Ink data inside Telegram.',
      ship_condition: 'Running Telegram bot consuming real Apple Inu / Ink state with a public demo or testable bot surface.',
      current_focus: 'Choose the smallest useful command surface.',
      next_move: 'Implement one read-only command against real Ink state.',
      reward: null,
    }),
    Object.freeze({
      id: 'BITE-003', version: '0.1', title: 'WILDCARD',
      summary: 'Build something useful or entertaining we did not ask for.',
      project_name: 'Apple Inu Wildcard',
      goal: 'Create an unexpected artifact using real Apple Inu / Ink primitives.',
      ship_condition: 'Working public artifact with a falsifiable use of at least one real Apple Inu / Ink primitive.',
      current_focus: 'Define the weird thing.',
      next_move: 'Connect one real primitive before polishing.',
      reward: null,
    }),
  ]),
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function assertPartnerCartridge(cartridge: PartnerCartridge): PartnerCartridge {
  if (cartridge.schema_version !== PARTNER_CARTRIDGE_VERSION) throw new Error('invalid_partner_cartridge_schema');
  if (!SLUG_PATTERN.test(cartridge.slug)) throw new Error('invalid_partner_cartridge_slug');
  if (cartridge.chain_id !== 57073) throw new Error('unsupported_partner_chain');
  if (cartridge.status !== 'CURATED') throw new Error('invalid_partner_cartridge_status');
  if (!cartridge.build_requests.length || cartridge.build_requests.length > 20) throw new Error('invalid_partner_build_requests');
  if (cartridge.primitives.length > 16) throw new Error('invalid_partner_primitives');
  const primitiveIds = new Set<string>();
  for (const primitive of cartridge.primitives) {
    if (primitive.chain_id !== 57073) throw new Error('unsupported_partner_chain');
    if (primitive.address && !EVM_ADDRESS_PATTERN.test(primitive.address)) throw new Error('invalid_partner_contract_address');
    if (primitiveIds.has(primitive.id)) throw new Error('duplicate_partner_primitive');
    primitiveIds.add(primitive.id);
  }
  const requestIds = new Set<string>();
  for (const request of cartridge.build_requests) {
    if (!/^BITE-[0-9]{3}$/.test(request.id)) throw new Error('invalid_partner_build_request_id');
    if (requestIds.has(request.id)) throw new Error('duplicate_partner_build_request');
    requestIds.add(request.id);
    if (request.reward?.verification_state === 'UNVERIFIED' && !request.reward.disclaimer) throw new Error('invalid_partner_reward_disclaimer');
  }
  return cartridge;
}

assertPartnerCartridge(APPLE_INU_CARTRIDGE);
const CARTRIDGES = new Map<string, PartnerCartridge>([[APPLE_INU_CARTRIDGE.slug, APPLE_INU_CARTRIDGE]]);

function safeCartridgeView(cartridge: PartnerCartridge) {
  return {
    schema_version: cartridge.schema_version, slug: cartridge.slug, name: cartridge.name,
    chain_id: cartridge.chain_id, status: cartridge.status, description: cartridge.description,
    primitives: cartridge.primitives.map((primitive) => ({...primitive})),
    build_requests: cartridge.build_requests.map((request) => ({
      id: request.id, version: request.version, title: request.title, summary: request.summary,
      ship_condition: request.ship_condition, reward: request.reward ? {...request.reward} : null,
    })),
  };
}

export function listPartnerCartridges() { return [...CARTRIDGES.values()].map(safeCartridgeView); }
export function getPartnerCartridge(slug: string) {
  const cartridge = CARTRIDGES.get(slug);
  return cartridge ? safeCartridgeView(cartridge) : null;
}

function getBuildRequest(partnerSlug: string, buildRequestId: string): {cartridge: PartnerCartridge; request: PartnerBuildRequest} {
  const cartridge = CARTRIDGES.get(partnerSlug);
  if (!cartridge) throw new Error('partner_cartridge_not_found');
  const request = cartridge.build_requests.find((item) => item.id === buildRequestId);
  if (!request) throw new Error('partner_build_request_not_found');
  return {cartridge, request};
}

export async function createPartnerMission(
  db: Kysely<DatabaseSchema>, playerId: string,
  input: {requestId: string; roundId: string; partnerSlug: string; buildRequestId: string},
): Promise<CommandSnapshot> {
  const {cartridge, request} = getBuildRequest(input.partnerSlug, input.buildRequestId);
  const origin: PartnerMissionOrigin = {
    schema_version: PARTNER_MISSION_ORIGIN_VERSION, kind: 'PARTNER_BUILD_REQUEST',
    partner_slug: cartridge.slug, partner_name: cartridge.name,
    build_request_id: request.id, build_request_title: request.title,
    request_version: request.version, partner_verification_state: 'CURATED',
  };
  return createMission(db, playerId, {
    requestId: input.requestId, roundId: input.roundId, projectName: request.project_name,
    goal: request.goal, shipCondition: request.ship_condition, currentFocus: request.current_focus,
    nextMove: request.next_move, origin,
  });
}

export async function partnerCartridgeEmbedView(db: Kysely<DatabaseSchema>, slug: string) {
  const cartridge = CARTRIDGES.get(slug);
  if (!cartridge) throw new Error('partner_cartridge_not_found');
  const declarations = await db.selectFrom('history_events').select(['subject_id', 'payload'])
    .where('event_type', '=', 'mission.declared').where('subject_type', '=', 'mission').execute();
  const missionIds: string[] = [];
  for (const declaration of declarations) {
    const origin = declaration.payload && typeof declaration.payload === 'object' && !Array.isArray(declaration.payload)
      ? (declaration.payload as Record<string, unknown>).origin : null;
    if (origin && typeof origin === 'object' && !Array.isArray(origin) && (origin as Record<string, unknown>).partner_slug === slug) {
      const parsed = await readMissionPartnerOrigin(db, declaration.subject_id);
      if (parsed?.partner_slug === slug) missionIds.push(declaration.subject_id);
    }
  }
  let activeBuilderCount = 0;
  let shippedCount = 0;
  const shipped: Array<{mission_id: string; project_id: string; project_name: string; build_request_id: string}> = [];
  for (const missionId of missionIds) {
    const mission = await db.selectFrom('missions').selectAll().where('mission_id', '=', missionId).executeTakeFirst();
    if (!mission) continue;
    const origin = await readMissionPartnerOrigin(db, missionId);
    if (!origin) continue;
    if (mission.state === 'SHIPPED') {
      shippedCount += 1;
      const project = await db.selectFrom('projects').select(['project_id', 'name']).where('project_id', '=', mission.project_id).executeTakeFirst();
      if (project) shipped.push({mission_id: mission.mission_id, project_id: project.project_id, project_name: project.name, build_request_id: origin.build_request_id});
    } else if (!['CLOSED_NOT_SHIPPED', 'ARCHIVED'].includes(mission.state)) activeBuilderCount += 1;
  }
  return {
    schema_version: PARTNER_EMBED_VERSION,
    partner: {slug: cartridge.slug, name: cartridge.name, chain_id: cartridge.chain_id},
    open_build_requests: cartridge.build_requests.length,
    active_builders: activeBuilderCount,
    shipped_count: shippedCount,
    shipped,
  };
}
