import type {Kysely} from 'kysely';
import type {DatabaseSchema} from './database.js';

export const PARTNER_MISSION_ORIGIN_VERSION = 'partner.mission-origin.v0' as const;

export interface PartnerMissionOrigin {
  schema_version: typeof PARTNER_MISSION_ORIGIN_VERSION;
  kind: 'PARTNER_BUILD_REQUEST';
  partner_slug: string;
  partner_name: string;
  build_request_id: string;
  build_request_title: string;
  request_version: string;
  partner_verification_state: 'CURATED';
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUEST_ID = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`invalid_${name}`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > max) throw new Error(`invalid_${name}`);
  return normalized;
}

export function normalizePartnerMissionOrigin(value: PartnerMissionOrigin): PartnerMissionOrigin {
  if (!value || typeof value !== 'object') throw new Error('invalid_partner_origin');
  if (value.schema_version !== PARTNER_MISSION_ORIGIN_VERSION) throw new Error('invalid_partner_origin_schema_version');
  if (value.kind !== 'PARTNER_BUILD_REQUEST') throw new Error('invalid_partner_origin_kind');
  const partnerSlug = text(value.partner_slug, 'partner_slug', 64);
  if (!SLUG.test(partnerSlug)) throw new Error('invalid_partner_slug');
  const requestId = text(value.build_request_id, 'partner_build_request_id', 64);
  if (!REQUEST_ID.test(requestId)) throw new Error('invalid_partner_build_request_id');
  const requestVersion = text(value.request_version, 'partner_request_version', 32);
  if (value.partner_verification_state !== 'CURATED') throw new Error('invalid_partner_verification_state');
  return {
    schema_version: PARTNER_MISSION_ORIGIN_VERSION,
    kind: 'PARTNER_BUILD_REQUEST',
    partner_slug: partnerSlug,
    partner_name: text(value.partner_name, 'partner_name', 120),
    build_request_id: requestId,
    build_request_title: text(value.build_request_title, 'partner_build_request_title', 160),
    request_version: requestVersion,
    partner_verification_state: 'CURATED',
  };
}

export function parsePartnerMissionOrigin(value: unknown): PartnerMissionOrigin | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return normalizePartnerMissionOrigin(value as PartnerMissionOrigin);
  } catch {
    return null;
  }
}

export async function readMissionPartnerOrigin(
  db: Kysely<DatabaseSchema>,
  missionId: string,
): Promise<PartnerMissionOrigin | null> {
  const declared = await db.selectFrom('history_events')
    .select('payload')
    .where('event_type', '=', 'mission.declared')
    .where('subject_type', '=', 'mission')
    .where('subject_id', '=', missionId)
    .executeTakeFirst();
  if (!declared?.payload || typeof declared.payload !== 'object' || Array.isArray(declared.payload)) return null;
  return parsePartnerMissionOrigin((declared.payload as Record<string, unknown>).origin);
}
