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

export interface DatabaseSchema {
  players: PlayerTable;
  sessions: SessionTable;
}

export type PlayerRow = Selectable<PlayerTable>;
export type InkubatorDatabase = Kysely<DatabaseSchema>;

export function createDatabase(databaseUrl: string): InkubatorDatabase {
  const client = postgres(databaseUrl, {max: 10});
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresJSDialect({postgres: client}),
  });
}
