import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import type {Kysely} from 'kysely';
import {sql} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import type {DatabaseSchema, GitHubRepositoryRow} from './database.js';
import {appendHistoryEvent} from './events.js';

const GITHUB_API_VERSION = '2026-03-10';
const SETUP_TTL_SECONDS = 10 * 60;
const DELIVERY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GIT_SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
const REF_PATTERN = /^refs\/[A-Za-z0-9._\/-]{1,240}$/;

export interface GitHubRuntimeOptions {
  appSlug: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}

export interface VerifiedGitHubRepository {
  repositoryId: string;
  fullName: string;
  private: boolean;
}

export interface VerifiedGitHubInstallation {
  githubUserId: string;
  installationId: string;
  accountId: string;
  accountType: string;
  repositorySelection: 'all' | 'selected';
  repositories: VerifiedGitHubRepository[];
}

export interface GitHubUserVerifier {
  verifyInstallation(code: string, installationId: string): Promise<VerifiedGitHubInstallation>;
}

export interface GitHubWebhookResult {
  status: 'observed' | 'duplicate' | 'control' | 'ignored';
  repositoryId?: string;
}

function positiveIntegerId(value: unknown, name: string): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))) {
    throw new Error(`${name}_invalid`);
  }
  const normalized = String(value);
  if (normalized === '0') throw new Error(`${name}_invalid`);
  return normalized;
}

function requireString(value: unknown, name: string, maxLength = 500): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) throw new Error(`${name}_invalid`);
  return value;
}

function setupStateHash(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export function hashRawPayload(rawBody: Buffer): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function verifyGitHubWebhookSignature(secret: string, rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBytes = Buffer.from(expected, 'ascii');
  const actualBytes = Buffer.from(signature.toLowerCase(), 'ascii');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export function validateDeliveryId(value: string | undefined): string {
  if (!value || !DELIVERY_PATTERN.test(value)) throw new Error('github_delivery_id_invalid');
  return value.toLowerCase();
}

export function buildGitHubInstallUrl(appSlug: string, state: string): string {
  if (!/^[A-Za-z0-9-]{1,100}$/.test(appSlug)) throw new Error('github_app_slug_invalid');
  const url = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function createGitHubSetupState(
  db: Kysely<DatabaseSchema>,
  playerId: string,
): Promise<{state: string; expiresAt: Date}> {
  const state = randomBytes(32).toString('base64url');
  const result = await sql<{expires_at: Date}>`
    insert into github_setup_states (state_hash, player_id, expires_at)
    values (${setupStateHash(state)}, ${playerId}::uuid, clock_timestamp() + (${SETUP_TTL_SECONDS} * interval '1 second'))
    returning expires_at
  `.execute(db);
  const expiresAt = result.rows[0]?.expires_at;
  if (!(expiresAt instanceof Date)) throw new Error('github_setup_state_create_failed');
  return {state, expiresAt};
}

async function bindVerifiedInstallation(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  verified: VerifiedGitHubInstallation,
): Promise<void> {
  const existing = await db
    .selectFrom('github_installations')
    .selectAll()
    .where('installation_id', '=', verified.installationId)
    .executeTakeFirst();

  if (existing && existing.player_id !== playerId) throw new Error('github_installation_already_bound');

  await db
    .insertInto('github_installations')
    .values({
      installation_id: verified.installationId,
      player_id: playerId,
      github_user_id: verified.githubUserId,
      account_id: verified.accountId,
      account_type: verified.accountType,
      repository_selection: verified.repositorySelection,
      revoked_at: null,
    })
    .onConflict((conflict) =>
      conflict.column('installation_id').doUpdateSet({
        github_user_id: verified.githubUserId,
        account_id: verified.accountId,
        account_type: verified.accountType,
        repository_selection: verified.repositorySelection,
        revoked_at: null,
      }),
    )
    .execute();

  await db
    .updateTable('github_repositories')
    .set({active: false, updated_at: sql<Date>`clock_timestamp()`})
    .where('installation_id', '=', verified.installationId)
    .execute();

  for (const repository of verified.repositories) {
    await db
      .insertInto('github_repositories')
      .values({
        repository_id: repository.repositoryId,
        installation_id: verified.installationId,
        full_name: repository.fullName,
        private: repository.private,
        active: true,
      })
      .onConflict((conflict) =>
        conflict.column('repository_id').doUpdateSet({
          installation_id: verified.installationId,
          full_name: repository.fullName,
          private: repository.private,
          active: true,
          updated_at: sql<Date>`clock_timestamp()`,
        }),
      )
      .execute();
  }
}

export async function finalizeGitHubSetup(
  db: Kysely<DatabaseSchema>,
  state: string,
  playerId: string,
  verified: VerifiedGitHubInstallation,
): Promise<void> {
  await db.transaction().execute(async (transaction) => {
    const consumed = await sql<{player_id: string}>`
      update github_setup_states
      set consumed_at = clock_timestamp()
      where state_hash = ${setupStateHash(state)}
        and player_id = ${playerId}::uuid
        and consumed_at is null
        and expires_at > clock_timestamp()
      returning player_id
    `.execute(transaction);
    if (consumed.rows.length !== 1) throw new Error('github_setup_state_invalid');
    await bindVerifiedInstallation(transaction, playerId, verified);
  });
}

function authHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': GITHUB_API_VERSION,
    'user-agent': 'rekt-inkubator',
  };
}

async function readJson(response: Response, errorName: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${errorName}:${response.status}`);
  return response.json();
}

export function createGitHubUserVerifier(options: GitHubRuntimeOptions): GitHubUserVerifier {
  return {
    async verifyInstallation(code, installationId) {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'rekt-inkubator'},
        body: JSON.stringify({client_id: options.clientId, client_secret: options.clientSecret, code}),
      });
      const tokenBody = (await readJson(tokenResponse, 'github_oauth_exchange_failed')) as {access_token?: unknown};
      const token = requireString(tokenBody.access_token, 'github_oauth_token', 1000);

      const userResponse = await fetch('https://api.github.com/user', {headers: authHeaders(token)});
      const userBody = (await readJson(userResponse, 'github_user_lookup_failed')) as {id?: unknown};
      const githubUserId = positiveIntegerId(userBody.id, 'github_user_id');

      let installation: Record<string, unknown> | undefined;
      for (let page = 1; page <= 10 && !installation; page += 1) {
        const response = await fetch(`https://api.github.com/user/installations?per_page=100&page=${page}`, {
          headers: authHeaders(token),
        });
        const body = (await readJson(response, 'github_installations_lookup_failed')) as {
          installations?: unknown;
        };
        if (!Array.isArray(body.installations)) throw new Error('github_installations_response_invalid');
        installation = body.installations.find(
          (candidate) =>
            candidate && typeof candidate === 'object' &&
            positiveIntegerId((candidate as {id?: unknown}).id, 'github_installation_id') === installationId,
        ) as Record<string, unknown> | undefined;
        if (body.installations.length < 100) break;
      }
      if (!installation) throw new Error('github_installation_not_accessible_to_user');

      const account = installation.account;
      if (!account || typeof account !== 'object') throw new Error('github_installation_account_invalid');
      const repositorySelection = installation.repository_selection;
      if (repositorySelection !== 'all' && repositorySelection !== 'selected') {
        throw new Error('github_repository_selection_invalid');
      }

      const repositories: VerifiedGitHubRepository[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const response = await fetch(
          `https://api.github.com/user/installations/${encodeURIComponent(installationId)}/repositories?per_page=100&page=${page}`,
          {headers: authHeaders(token)},
        );
        const body = (await readJson(response, 'github_repositories_lookup_failed')) as {repositories?: unknown};
        if (!Array.isArray(body.repositories)) throw new Error('github_repositories_response_invalid');
        for (const candidate of body.repositories) {
          if (!candidate || typeof candidate !== 'object') throw new Error('github_repository_invalid');
          const repository = candidate as {id?: unknown; full_name?: unknown; private?: unknown};
          if (typeof repository.private !== 'boolean') throw new Error('github_repository_private_invalid');
          repositories.push({
            repositoryId: positiveIntegerId(repository.id, 'github_repository_id'),
            fullName: requireString(repository.full_name, 'github_repository_full_name', 300),
            private: repository.private,
          });
        }
        if (body.repositories.length < 100) break;
        if (page === 10) throw new Error('github_repository_list_too_large');
      }

      return {
        githubUserId,
        installationId,
        accountId: positiveIntegerId((account as {id?: unknown}).id, 'github_account_id'),
        accountType: requireString((account as {type?: unknown}).type, 'github_account_type', 50),
        repositorySelection,
        repositories,
      };
    },
  };
}

function parsePayload(rawBody: Buffer): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('github_payload_invalid_json');
  }
}

async function recordDelivery(
  db: Kysely<DatabaseSchema>,
  deliveryId: string,
  eventName: string,
  payloadHash: string,
  installationId: string | null,
  repositoryId: string | null,
): Promise<'inserted' | 'duplicate'> {
  const inserted = await db
    .insertInto('github_deliveries')
    .values({
      delivery_id: deliveryId,
      event_name: eventName,
      payload_hash: payloadHash,
      installation_id: installationId,
      repository_id: repositoryId,
    })
    .onConflict((conflict) => conflict.column('delivery_id').doNothing())
    .returning('delivery_id')
    .executeTakeFirst();
  if (inserted) return 'inserted';
  const existing = await db
    .selectFrom('github_deliveries')
    .select(['event_name', 'payload_hash', 'installation_id', 'repository_id'])
    .where('delivery_id', '=', deliveryId)
    .executeTakeFirstOrThrow();
  if (
    existing.event_name !== eventName || existing.payload_hash !== payloadHash ||
    existing.installation_id !== installationId || existing.repository_id !== repositoryId
  ) {
    throw new Error('github_delivery_conflict');
  }
  return 'duplicate';
}

function installationIdFromPayload(payload: Record<string, unknown>): string | null {
  const installation = payload.installation;
  if (!installation || typeof installation !== 'object') return null;
  return positiveIntegerId((installation as {id?: unknown}).id, 'github_installation_id');
}

function repositoryIdFromPayload(payload: Record<string, unknown>): string | null {
  const repository = payload.repository;
  if (!repository || typeof repository !== 'object') return null;
  return positiveIntegerId((repository as {id?: unknown}).id, 'github_repository_id');
}

async function activeRepository(
  db: Kysely<DatabaseSchema>,
  installationId: string,
  repositoryId: string,
): Promise<GitHubRepositoryRow | null> {
  const row = await db
    .selectFrom('github_repositories as repository')
    .innerJoin('github_installations as installation', 'installation.installation_id', 'repository.installation_id')
    .selectAll('repository')
    .where('repository.repository_id', '=', repositoryId)
    .where('repository.installation_id', '=', installationId)
    .where('repository.active', '=', true)
    .where('installation.revoked_at', 'is', null)
    .executeTakeFirst();
  return row ?? null;
}

async function processInstallationControl(
  db: Kysely<DatabaseSchema>,
  payload: Record<string, unknown>,
  installationId: string,
): Promise<void> {
  const action = payload.action;
  if (action === 'deleted' || action === 'suspend') {
    await db
      .updateTable('github_installations')
      .set({revoked_at: sql<Date>`clock_timestamp()`})
      .where('installation_id', '=', installationId)
      .execute();
    await db
      .updateTable('github_repositories')
      .set({active: false, updated_at: sql<Date>`clock_timestamp()`})
      .where('installation_id', '=', installationId)
      .execute();
  }
}

async function processRepositoryControl(
  db: Kysely<DatabaseSchema>,
  payload: Record<string, unknown>,
  installationId: string,
): Promise<void> {
  const installation = await db
    .selectFrom('github_installations')
    .select('installation_id')
    .where('installation_id', '=', installationId)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (!installation) return;

  const added = Array.isArray(payload.repositories_added) ? payload.repositories_added : [];
  const removed = Array.isArray(payload.repositories_removed) ? payload.repositories_removed : [];
  for (const candidate of added) {
    if (!candidate || typeof candidate !== 'object') continue;
    const repository = candidate as {id?: unknown; full_name?: unknown; private?: unknown};
    if (typeof repository.private !== 'boolean' || typeof repository.full_name !== 'string') continue;
    const repositoryId = positiveIntegerId(repository.id, 'github_repository_id');
    await db
      .insertInto('github_repositories')
      .values({repository_id: repositoryId, installation_id: installationId, full_name: repository.full_name, private: repository.private, active: true})
      .onConflict((conflict) => conflict.column('repository_id').doUpdateSet({
        installation_id: installationId,
        full_name: repository.full_name as string,
        private: repository.private as boolean,
        active: true,
        updated_at: sql<Date>`clock_timestamp()`,
      }))
      .execute();
  }
  for (const candidate of removed) {
    if (!candidate || typeof candidate !== 'object') continue;
    const repositoryId = positiveIntegerId((candidate as {id?: unknown}).id, 'github_repository_id');
    await db
      .updateTable('github_repositories')
      .set({active: false, updated_at: sql<Date>`clock_timestamp()`})
      .where('repository_id', '=', repositoryId)
      .where('installation_id', '=', installationId)
      .execute();
  }
}

export async function processGitHubWebhook(
  db: Kysely<DatabaseSchema>,
  input: {deliveryId: string; eventName: string; rawBody: Buffer},
): Promise<GitHubWebhookResult> {
  const deliveryId = validateDeliveryId(input.deliveryId);
  if (!/^[a-z_]{1,80}$/.test(input.eventName)) throw new Error('github_event_name_invalid');
  const payloadHash = hashRawPayload(input.rawBody);
  const payload = parsePayload(input.rawBody);
  const installationId = installationIdFromPayload(payload);
  const repositoryId = repositoryIdFromPayload(payload);

  return db.transaction().execute(async (transaction) => {
    const receipt = await recordDelivery(
      transaction,
      deliveryId,
      input.eventName,
      payloadHash,
      installationId,
      repositoryId,
    );
    if (receipt === 'duplicate') return {status: 'duplicate'};

    if (input.eventName === 'installation' && installationId) {
      await processInstallationControl(transaction, payload, installationId);
      return {status: 'control'};
    }
    if (input.eventName === 'installation_repositories' && installationId) {
      await processRepositoryControl(transaction, payload, installationId);
      return {status: 'control'};
    }
    if (input.eventName !== 'push') return {status: 'ignored'};
    if (!installationId || !repositoryId) throw new Error('github_push_identity_missing');

    const binding = await activeRepository(transaction, installationId, repositoryId);
    if (!binding) throw new Error('github_repository_not_bound');

    const repository = payload.repository as Record<string, unknown>;
    const ref = requireString(payload.ref, 'github_push_ref', 250);
    if (!REF_PATTERN.test(ref)) throw new Error('github_push_ref_invalid');
    const before = requireString(payload.before, 'github_push_before', 64);
    const after = requireString(payload.after, 'github_push_after', 64);
    if (!GIT_SHA_PATTERN.test(before) || !GIT_SHA_PATTERN.test(after)) throw new Error('github_push_sha_invalid');
    if (typeof repository.private !== 'boolean') throw new Error('github_repository_private_invalid');

    await transaction
      .updateTable('github_repositories')
      .set({private: repository.private, updated_at: sql<Date>`clock_timestamp()`})
      .where('repository_id', '=', repositoryId)
      .where('installation_id', '=', installationId)
      .execute();

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'github.repository_push.observed',
      dedupeKey: `github:delivery:${deliveryId}`,
      actorPlayerId: null,
      subjectType: 'github_repository',
      subjectId: repositoryId,
      payload: {
        schema_version: 'github.repository_push.observed.v1',
        provider: 'github',
        delivery_id: deliveryId,
        installation_id: installationId,
        repository_id: repositoryId,
        ref,
        before,
        after,
        repository_private: repository.private,
        truth_state: 'OBSERVED',
      },
    });

    return {status: 'observed', repositoryId};
  });
}

export function toPublicGitHubRepositoryProjection(repository: GitHubRepositoryRow): Record<string, unknown> {
  return {
    schema_version: 'github.repository.public.v1',
    connected: repository.active,
    observation_capability: repository.active ? 'OBSERVED' : 'UNAVAILABLE',
  };
}

export function toPrivateGitHubRepositoryProjection(repository: GitHubRepositoryRow): Record<string, unknown> {
  return {
    schema_version: 'github.repository.private.v1',
    repository_id: repository.repository_id,
    installation_id: repository.installation_id,
    full_name: repository.full_name,
    private: repository.private,
    active: repository.active,
  };
}
