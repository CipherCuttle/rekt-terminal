import {randomUUID} from 'node:crypto';
import type {Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import type {DatabaseSchema, HistoryEventFamily, HistoryEventRow} from './database.js';

export const HISTORY_EVENT_VERSION = 'history.v1';

export interface AppendHistoryEventInput {
  eventFamily: HistoryEventFamily;
  eventType: string;
  dedupeKey: string;
  payload: unknown;
  actorPlayerId?: string | null;
  subjectType: string;
  subjectId: string;
}

export async function appendHistoryEvent(
  db: Kysely<DatabaseSchema>,
  input: AppendHistoryEventInput,
): Promise<HistoryEventRow> {
  const normalized = canonicalizeJson(input.payload);
  const actorPlayerId = input.actorPlayerId ?? null;

  const inserted = await db
    .insertInto('history_events')
    .values({
      history_event_id: randomUUID(),
      event_family: input.eventFamily,
      event_version: HISTORY_EVENT_VERSION,
      event_type: input.eventType,
      dedupe_key: input.dedupeKey,
      payload: normalized.value,
      payload_hash: normalized.sha256,
      actor_player_id: actorPlayerId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
    })
    .onConflict((conflict) => conflict.column('dedupe_key').doNothing())
    .returningAll()
    .executeTakeFirst();

  if (inserted) return inserted;

  const existing = await db
    .selectFrom('history_events')
    .selectAll()
    .where('dedupe_key', '=', input.dedupeKey)
    .executeTakeFirstOrThrow();

  if (
    existing.event_family !== input.eventFamily ||
    existing.event_version !== HISTORY_EVENT_VERSION ||
    existing.event_type !== input.eventType ||
    existing.payload_hash !== normalized.sha256 ||
    existing.actor_player_id !== actorPlayerId ||
    existing.subject_type !== input.subjectType ||
    existing.subject_id !== input.subjectId
  ) {
    throw new Error(`history_event_idempotency_conflict:${input.dedupeKey}`);
  }

  return existing;
}
