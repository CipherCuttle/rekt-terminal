import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import {readDatabaseNow, type DatabaseSchema, type DevkitCredentialClass} from './database.js';

export const DEVKIT_SCOPES = [
  'player:read', 'project:read', 'mission:read', 'claim:write',
  'update:write', 'beacon:write', 'assist:write', 'ship:prepare',
] as const;
export type DevkitScope = typeof DEVKIT_SCOPES[number];
export const DEVKIT_RATE_LIMIT_PER_MINUTE = 60;
export const DEVKIT_TOKEN_MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEVKIT_TOKEN_MIN_TTL_SECONDS = 5 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPE_SET = new Set<string>(DEVKIT_SCOPES);
const CLASS_SET = new Set<DevkitCredentialClass>(['CLI', 'MCP', 'AUTOMATION']);

export interface ResolvedDevkitCredential {
  tokenId: string;
  playerId: string;
  credentialClass: DevkitCredentialClass;
  scopes: DevkitScope[];
  expiresAt: Date;
}

export interface IssueDevkitTokenInput {
  requestId: string;
  credentialClass: DevkitCredentialClass;
  label: string;
  scopes: string[];
  expiresInSeconds: number;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function normalizeScopes(scopes: unknown): DevkitScope[] {
  if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > DEVKIT_SCOPES.length) throw new Error('invalid_devkit_scopes');
  const normalized = [...new Set(scopes.map((scope) => {
    if (typeof scope !== 'string' || !SCOPE_SET.has(scope)) throw new Error('invalid_devkit_scope');
    return scope as DevkitScope;
  }))].sort();
  return normalized;
}

function normalizeLabel(label: string): string {
  if (typeof label !== 'string') throw new Error('invalid_devkit_label');
  const normalized = label.trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > 80) throw new Error('invalid_devkit_label');
  return normalized;
}

export function readBearerToken(value: string | string[] | undefined): string | null {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function hasDevkitScope(credential: ResolvedDevkitCredential, scope: DevkitScope): boolean {
  return credential.scopes.includes(scope);
}

export async function issueDevkitToken(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  input: IssueDevkitTokenInput,
) {
  if (!UUID_PATTERN.test(input.requestId)) throw new Error('invalid_request_id');
  if (!CLASS_SET.has(input.credentialClass)) throw new Error('invalid_devkit_credential_class');
  const label = normalizeLabel(input.label);
  const scopes = normalizeScopes(input.scopes);
  if (!Number.isSafeInteger(input.expiresInSeconds) || input.expiresInSeconds < DEVKIT_TOKEN_MIN_TTL_SECONDS || input.expiresInSeconds > DEVKIT_TOKEN_MAX_TTL_SECONDS) {
    throw new Error('invalid_devkit_token_ttl');
  }
  const rawToken = `rekt_dk_${randomBytes(32).toString('base64url')}`;
  const tokenId = randomUUID();
  const now = await readDatabaseNow(db);
  const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000);

  await db.transaction().execute(async (tx) => {
    await tx.selectFrom('players').select('player_id').where('player_id', '=', playerId).forUpdate().executeTakeFirstOrThrow();
    const replay = await tx.selectFrom('devkit_tokens').select('token_id')
      .where('player_id', '=', playerId)
      .where('creation_request_id', '=', input.requestId.toLowerCase())
      .executeTakeFirst();
    if (replay) throw new Error('devkit_token_issue_replayed');
    await tx.insertInto('devkit_tokens').values({
      token_id: tokenId,
      player_id: playerId,
      creation_request_id: input.requestId.toLowerCase(),
      credential_class: input.credentialClass,
      label,
      token_hash: tokenHash(rawToken),
      scopes,
      expires_at: expiresAt,
      revoked_at: null,
      last_used_at: null,
    }).executeTakeFirstOrThrow();
  });

  return {
    schema_version: 'devkit.token.issued.v1' as const,
    token_id: tokenId,
    credential_class: input.credentialClass,
    label,
    scopes,
    token: rawToken,
    expires_at: expiresAt.toISOString(),
  };
}

export async function listDevkitTokens(db: Kysely<DatabaseSchema>, playerId: string) {
  const rows = await db.selectFrom('devkit_tokens').select([
    'token_id', 'credential_class', 'label', 'scopes', 'created_at', 'expires_at', 'revoked_at', 'last_used_at',
  ]).where('player_id', '=', playerId).orderBy('created_at', 'desc').execute();
  return rows.map((row) => ({
    schema_version: 'devkit.token.summary.v1' as const,
    token_id: row.token_id,
    credential_class: row.credential_class,
    label: row.label,
    scopes: normalizeScopes(row.scopes),
    created_at: row.created_at.toISOString(),
    expires_at: row.expires_at.toISOString(),
    revoked_at: row.revoked_at?.toISOString() ?? null,
    last_used_at: row.last_used_at?.toISOString() ?? null,
  }));
}

export async function revokeDevkitToken(db: Kysely<DatabaseSchema>, playerId: string, tokenId: string) {
  if (!UUID_PATTERN.test(tokenId)) throw new Error('invalid_devkit_token_id');
  const row = await db.updateTable('devkit_tokens')
    .set({revoked_at: sql<Date>`coalesce(revoked_at, clock_timestamp())`})
    .where('token_id', '=', tokenId.toLowerCase())
    .where('player_id', '=', playerId)
    .returning(['token_id', 'revoked_at'])
    .executeTakeFirst();
  if (!row) throw new Error('devkit_token_not_found');
  return {schema_version: 'devkit.token.revoked.v1' as const, token_id: row.token_id, revoked_at: row.revoked_at!.toISOString()};
}

export async function resolveDevkitCredential(db: Kysely<DatabaseSchema>, token: string): Promise<ResolvedDevkitCredential | null> {
  const row = await db.selectFrom('devkit_tokens').select(['token_id', 'player_id', 'credential_class', 'scopes', 'expires_at'])
    .where('token_hash', '=', tokenHash(token))
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', sql<Date>`clock_timestamp()`)
    .executeTakeFirst();
  if (!row) return null;
  return {tokenId: row.token_id, playerId: row.player_id, credentialClass: row.credential_class, scopes: normalizeScopes(row.scopes), expiresAt: row.expires_at};
}

export async function consumeDevkitRateLimit(db: Kysely<DatabaseSchema>, tokenId: string) {
  return db.transaction().execute(async (tx) => {
    const row = await tx.selectFrom('devkit_tokens').select(['rate_window_started_at', 'rate_count', 'revoked_at', 'expires_at'])
      .where('token_id', '=', tokenId).forUpdate().executeTakeFirst();
    if (!row || row.revoked_at || row.expires_at.getTime() <= Date.now()) return {allowed: false as const, invalid: true as const, retryAfterSeconds: 0};
    const now = await readDatabaseNow(tx);
    const elapsedMs = now.getTime() - row.rate_window_started_at.getTime();
    if (elapsedMs >= 60_000) {
      await tx.updateTable('devkit_tokens').set({rate_window_started_at: now, rate_count: 1, last_used_at: now}).where('token_id', '=', tokenId).execute();
      return {allowed: true as const, remaining: DEVKIT_RATE_LIMIT_PER_MINUTE - 1};
    }
    if (row.rate_count >= DEVKIT_RATE_LIMIT_PER_MINUTE) {
      return {allowed: false as const, invalid: false as const, retryAfterSeconds: Math.max(1, Math.ceil((60_000 - elapsedMs) / 1000))};
    }
    await tx.updateTable('devkit_tokens').set({rate_count: row.rate_count + 1, last_used_at: now}).where('token_id', '=', tokenId).execute();
    return {allowed: true as const, remaining: DEVKIT_RATE_LIMIT_PER_MINUTE - row.rate_count - 1};
  });
}
