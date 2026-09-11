import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema, PlayerRow} from './database.js';
import type {GitHubRuntimeOptions} from './github.js';
import {enqueueOutboxJob, SESSION_EXPIRY_JOB_TYPE} from './jobs.js';
import {createPlayer, getPlayer} from './players.js';
import {createSession} from './session.js';

const GITHUB_API_VERSION = '2026-03-10';
const OAUTH_TTL_SECONDS = 10 * 60;
export const GITHUB_OAUTH_STATE_COOKIE = '__Host-rekt_github_oauth_state';
export const GITHUB_OAUTH_VERIFIER_COOKIE = '__Host-rekt_github_oauth_verifier';

export interface GitHubLoginIdentity {
  githubUserId: string;
  login: string;
}

export interface GitHubLoginAttempt {
  state: string;
  verifier: string;
  challenge: string;
}

type FetchLike = typeof fetch;

function positiveIntegerId(value: unknown): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))) {
    throw new Error('github_user_id_invalid');
  }
  const normalized = String(value);
  if (normalized === '0') throw new Error('github_user_id_invalid');
  return normalized;
}

function requireLogin(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(value)) throw new Error('github_login_invalid');
  return value;
}

function callbackUrl(appOrigin: string): string {
  return new URL('/v1/auth/github/callback', appOrigin).toString();
}

export function createGitHubLoginAttempt(): GitHubLoginAttempt {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier, 'utf8').digest('base64url');
  return {state, verifier, challenge};
}

export function serializeGitHubOauthCookie(name: string, value: string): string {
  if (name !== GITHUB_OAUTH_STATE_COOKIE && name !== GITHUB_OAUTH_VERIFIER_COOKIE) {
    throw new Error('github_oauth_cookie_name_invalid');
  }
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${OAUTH_TTL_SECONDS}`;
}

export function clearGitHubOauthCookie(name: string): string {
  if (name !== GITHUB_OAUTH_STATE_COOKIE && name !== GITHUB_OAUTH_VERIFIER_COOKIE) {
    throw new Error('github_oauth_cookie_name_invalid');
  }
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return rest.join('=') || null;
  }
  return null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function claimGitHubLoginAttempt(cookieHeader: string | undefined, returnedState: string): {verifier: string} {
  const expectedState = readCookie(cookieHeader, GITHUB_OAUTH_STATE_COOKIE);
  const verifier = readCookie(cookieHeader, GITHUB_OAUTH_VERIFIER_COOKIE);
  if (!expectedState || !verifier || !safeEqual(expectedState, returnedState)) {
    throw new Error('github_oauth_state_invalid');
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) throw new Error('github_oauth_verifier_invalid');
  return {verifier};
}

export function buildGitHubLoginUrl(runtime: GitHubRuntimeOptions, appOrigin: string, attempt: GitHubLoginAttempt): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', runtime.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(appOrigin));
  url.searchParams.set('state', attempt.state);
  url.searchParams.set('code_challenge', attempt.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function readJson(response: Response, errorName: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${errorName}:${response.status}`);
  return response.json();
}

export async function verifyGitHubLoginIdentity(
  runtime: GitHubRuntimeOptions,
  appOrigin: string,
  code: string,
  verifier: string,
  fetchImpl: FetchLike = fetch,
): Promise<GitHubLoginIdentity> {
  if (!code || code.length > 1000) throw new Error('github_oauth_code_invalid');
  const tokenResponse = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'rekt-inkubator'},
    body: JSON.stringify({
      client_id: runtime.clientId,
      client_secret: runtime.clientSecret,
      code,
      redirect_uri: callbackUrl(appOrigin),
      code_verifier: verifier,
    }),
  });
  const tokenBody = await readJson(tokenResponse, 'github_oauth_exchange_failed') as {access_token?: unknown};
  if (typeof tokenBody.access_token !== 'string' || tokenBody.access_token.length < 1 || tokenBody.access_token.length > 2000) {
    throw new Error('github_oauth_token_invalid');
  }

  const userResponse = await fetchImpl('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${tokenBody.access_token}`,
      'x-github-api-version': GITHUB_API_VERSION,
      'user-agent': 'rekt-inkubator',
    },
  });
  const userBody = await readJson(userResponse, 'github_user_lookup_failed') as {id?: unknown; login?: unknown};
  return {githubUserId: positiveIntegerId(userBody.id), login: requireLogin(userBody.login)};
}

async function resolveExistingPlayerId(db: Kysely<DatabaseSchema>, githubUserId: string): Promise<string | null> {
  const direct = await sql<{player_id: string}>`
    select player_id from players where github_user_id = ${githubUserId}::bigint
  `.execute(db);
  if (direct.rows.length > 1) throw new Error('github_identity_ambiguous');
  if (direct.rows[0]?.player_id) return direct.rows[0].player_id;

  const legacy = await sql<{player_id: string}>`
    select distinct player_id from github_installations where github_user_id = ${githubUserId}::bigint
  `.execute(db);
  if (legacy.rows.length > 1) throw new Error('github_identity_ambiguous');
  return legacy.rows[0]?.player_id ?? null;
}

export async function establishGitHubLoginSession(
  db: Kysely<DatabaseSchema>,
  identity: GitHubLoginIdentity,
  ttlSeconds: number,
): Promise<{player: PlayerRow; session: {sessionId: string; token: string; expiresAt: Date}; created: boolean}> {
  return db.transaction().execute(async (transaction) => {
    await sql`select pg_advisory_xact_lock(hashtextextended(${`rekt:github:identity:${identity.githubUserId}`}, 0))`.execute(transaction);
    const existingPlayerId = await resolveExistingPlayerId(transaction, identity.githubUserId);
    let player: PlayerRow | undefined;
    let created = false;

    if (existingPlayerId) {
      const bound = await sql<{github_user_id: string | null}>`
        select github_user_id from players where player_id = ${existingPlayerId}::uuid for update
      `.execute(transaction);
      const currentGithubId = bound.rows[0]?.github_user_id ?? null;
      if (currentGithubId && currentGithubId !== identity.githubUserId) throw new Error('github_identity_conflict');
      await sql`
        update players set github_user_id = ${identity.githubUserId}::bigint, github_login = ${identity.login}, updated_at = clock_timestamp()
        where player_id = ${existingPlayerId}::uuid
      `.execute(transaction);
      player = await getPlayer(transaction, existingPlayerId);
    } else {
      player = await createPlayer(transaction, identity.login);
      await sql`
        update players set github_user_id = ${identity.githubUserId}::bigint, github_login = ${identity.login}, updated_at = clock_timestamp()
        where player_id = ${player.player_id}::uuid
      `.execute(transaction);
      player = await getPlayer(transaction, player.player_id);
      created = true;
    }

    if (!player) throw new Error('github_identity_player_missing');
    const session = await createSession(transaction, player.player_id, ttlSeconds);
    await enqueueOutboxJob(transaction, {
      jobType: SESSION_EXPIRY_JOB_TYPE,
      idempotencyKey: `session.expiry:${session.sessionId}`,
      payload: {session_id: session.sessionId},
      nextAttemptAt: session.expiresAt,
    });
    return {player, session, created};
  });
}
