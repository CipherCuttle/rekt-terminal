import {Generated, Kysely, type Selectable} from 'kysely';
import {PostgresJSDialect} from 'kysely-postgres-js';
import postgres from 'postgres';

export interface PlayerTable {
  player_id: string;
  display_name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SessionTable {
  session_id: string;
  player_id: string;
  token_hash: string;
  created_at: Generated<Date>;
  expires_at: Date;
  revoked_at: Date | null;
}

export type HistoryEventFamily = 'activity' | 'evidence';

export interface HistoryEventTable {
  history_event_id: string;
  event_family: HistoryEventFamily;
  event_version: string;
  event_type: string;
  dedupe_key: string;
  payload: unknown;
  payload_hash: string;
  actor_player_id: string | null;
  subject_type: string;
  subject_id: string;
  occurred_at: Generated<Date>;
}

export type OutboxJobState = 'pending' | 'running' | 'succeeded' | 'failed';

export interface OutboxJobTable {
  job_id: string;
  job_version: string;
  job_type: string;
  idempotency_key: string;
  payload: unknown;
  payload_hash: string;
  state: Generated<OutboxJobState>;
  attempts: Generated<number>;
  max_attempts: number;
  next_attempt_at: Date;
  locked_at: Date | null;
  lock_token: string | null;
  last_error: string | null;
  created_at: Generated<Date>;
  completed_at: Date | null;
}

export interface DatabaseSchema {
  players: PlayerTable;
  sessions: SessionTable;
  history_events: HistoryEventTable;
  outbox_jobs: OutboxJobTable;
}

export type PlayerRow = Selectable<PlayerTable>;
export type HistoryEventRow = Selectable<HistoryEventTable>;
export type OutboxJobRow = Selectable<OutboxJobTable>;
export type InkubatorDatabase = Kysely<DatabaseSchema>;

export function createDatabase(databaseUrl: string): InkubatorDatabase {
  const client = postgres(databaseUrl, {max: 10});
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresJSDialect({postgres: client}),
  });
}
