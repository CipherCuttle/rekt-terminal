import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import type {Actor} from './authorization.js';
import {readDatabaseNow, type DatabaseSchema} from './database.js';

export const SESSION_COOKIE_NAME = '__Host-rekt_session';

export function createOpaqueSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === SESSION_COOKIE_NAME) return rest.join('=') || null;
  }
  return null;
}

export function serializeSessionCookie(token: string, ttlSeconds: number): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSeconds}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  ttlSeconds: number,
): Promise<{sessionId: string; token: string; expiresAt: Date}> {
  const sessionId = randomUUID();
  const token = createOpaqueSessionToken();
  const databaseNow = await readDatabaseNow(db);
  const expiresAt = new Date(databaseNow.getTime() + ttlSeconds * 1000);
  await db
    .insertInto('sessions')
    .values({
      session_id: sessionId,
      player_id: playerId,
      token_hash: hashSessionToken(token),
      expires_at: expiresAt,
      revoked_at: null,
    })
    .executeTakeFirstOrThrow();
  return {sessionId, token, expiresAt};
}

export async function resolveSessionActor(db: Kysely<DatabaseSchema>, token: string): Promise<Actor | null> {
  const session = await db
    .selectFrom('sessions')
    .select(['player_id'])
    .where('token_hash', '=', hashSessionToken(token))
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', sql<Date>`clock_timestamp()`)
    .executeTakeFirst();
  return session ? {playerId: session.player_id} : null;
}

export async function revokeSession(db: Kysely<DatabaseSchema>, token: string): Promise<void> {
  await db
    .updateTable('sessions')
    .set({revoked_at: sql<Date>`clock_timestamp()`})
    .where('token_hash', '=', hashSessionToken(token))
    .where('revoked_at', 'is', null)
    .execute();
}
