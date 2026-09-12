import {randomUUID} from 'node:crypto';
import type {Kysely} from 'kysely';
import type {DatabaseSchema, PlayerRow} from './database.js';

export function normalizeDisplayName(value: string): string {
  const displayName = value.trim();
  if (displayName.length < 1 || displayName.length > 80) {
    throw new Error('display_name must contain 1-80 non-whitespace characters');
  }
  return displayName;
}

export async function createPlayer(db: Kysely<DatabaseSchema>, displayNameInput: string): Promise<PlayerRow> {
  const displayName = normalizeDisplayName(displayNameInput);
  return db
    .insertInto('players')
    .values({player_id: randomUUID(), display_name: displayName})
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function getPlayer(db: Kysely<DatabaseSchema>, playerId: string): Promise<PlayerRow | undefined> {
  return db.selectFrom('players').selectAll().where('player_id', '=', playerId).executeTakeFirst();
}
