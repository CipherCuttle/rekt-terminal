import {Generated, Kysely, sql, type Selectable} from 'kysely';
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

export interface GitHubSetupStateTable {
  state_hash: string;
  player_id: string;
  created_at: Generated<Date>;
  expires_at: Date;
  consumed_at: Date | null;
}

export type GitHubRepositorySelection = 'all' | 'selected';

export interface GitHubInstallationTable {
  installation_id: string;
  player_id: string;
  github_user_id: string;
  account_id: string;
  account_type: string;
  repository_selection: GitHubRepositorySelection;
  installed_at: Generated<Date>;
  revoked_at: Date | null;
}

export interface GitHubRepositoryTable {
  repository_id: string;
  installation_id: string;
  full_name: string;
  private: boolean;
  active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface GitHubDeliveryTable {
  delivery_id: string;
  event_name: string;
  payload_hash: string;
  installation_id: string | null;
  repository_id: string | null;
  received_at: Generated<Date>;
}

export interface GitHubInstallationTombstoneTable {
  installation_id: string;
  revoked_at: Generated<Date>;
  source_key: string;
}

export interface GitHubRepositoryTombstoneTable {
  repository_id: string;
  installation_id: string;
  removed_at: Generated<Date>;
  source_key: string;
}

export interface DatabaseSchema {
  players: PlayerTable;
  sessions: SessionTable;
  history_events: HistoryEventTable;
  outbox_jobs: OutboxJobTable;
  github_setup_states: GitHubSetupStateTable;
  github_installations: GitHubInstallationTable;
  github_repositories: GitHubRepositoryTable;
  github_deliveries: GitHubDeliveryTable;
  github_installation_tombstones: GitHubInstallationTombstoneTable;
  github_repository_tombstones: GitHubRepositoryTombstoneTable;
}

export type PlayerRow = Selectable<PlayerTable>;
export type HistoryEventRow = Selectable<HistoryEventTable>;
export type OutboxJobRow = Selectable<OutboxJobTable>;
export type GitHubRepositoryRow = Selectable<GitHubRepositoryTable>;
export type InkubatorDatabase = Kysely<DatabaseSchema>;

export function createDatabase(databaseUrl: string): InkubatorDatabase {
  const client = postgres(databaseUrl, {max: 10});
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresJSDialect({postgres: client}),
  });
}

export async function readDatabaseNow(db: Kysely<DatabaseSchema>): Promise<Date> {
  const result = await sql<{now: Date}>`select clock_timestamp() as now`.execute(db);
  const now = result.rows[0]?.now;
  if (!(now instanceof Date)) throw new Error('database_clock_unavailable');
  return now;
}
