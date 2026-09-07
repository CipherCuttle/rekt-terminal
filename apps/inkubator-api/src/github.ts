import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import type {Kysely} from 'kysely';
import {sql} from 'kysely';
import type {DatabaseSchema, GitHubRepositoryRow} from './database.js';
import {appendHistoryEvent} from './events.js';
import {detectStackFromManifestPaths, type DetectedStack} from './evidence.js';
import {enqueueOutboxJob, PROJECT_GITHUB_OBSERVATION_JOB_TYPE} from './jobs.js';
import {findLinkedProjectIdForRepository} from './projects.js';

const GITHUB_API_VERSION = '2026-03-10';
const SETUP_TTL_SECONDS = 10 * 60;
const DELIVERY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GIT_SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
const REF_PATTERN = /^refs\/[A-Za-z0-9._\/-]{1,240}$/;
const ALLOWED_READ_PERMISSIONS = new Set(['contents', 'metadata']);

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

export interface ClaimedGitHubSetupState {
  createdAt: Date;
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

export function validateGitHubInstallationPolicy(permissions: unknown, events: unknown): void {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new Error('github_installation_permissions_invalid');
  }
  const permissionEntries = Object.entries(permissions as Record<string, unknown>);
  if ((permissions as Record<string, unknown>).contents !== 'read') {
    throw new Error('github_contents_read_permission_required');
  }
  for (const [name, level] of permissionEntries) {
    if (level === 'write' || level === 'admin') throw new Error('github_write_permission_forbidden');
    if (level !== 'read' && level !== 'none') throw new Error('github_installation_permissions_invalid');
    if (level === 'read' && !ALLOWED_READ_PERMISSIONS.has(name)) {
      throw new Error(`github_read_permission_excessive:${name}`);
    }
  }

  if (!Array.isArray(events) || events.some((event) => typeof event !== 'string')) {
    throw new Error('github_installation_events_invalid');
  }
  if (!events.includes('push')) throw new Error('github_push_event_required');
  const extraEvents = events.filter((event) => event !== 'push');
  if (extraEvents.length > 0) throw new Error(`github_event_subscription_excessive:${extraEvents.join(',')}`);
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

export async function claimGitHubSetupState(
  db: Kysely<DatabaseSchema>,
  state: string,
  playerId: string,
): Promise<ClaimedGitHubSetupState> {
  const claimed = await sql<{created_at: Date}>`
    update github_setup_states
    set consumed_at = clock_timestamp()
    where state_hash = ${setupStateHash(state)}
      and player_id = ${playerId}::uuid
      and consumed_at is null
      and expires_at > clock_timestamp()
    returning created_at
  `.execute(db);
  const createdAt = claimed.rows[0]?.created_at;
  if (!(createdAt instanceof Date) || claimed.rows.length !== 1) throw new Error('github_setup_state_invalid');
  return {createdAt};
}

async function lockGitHubInstallation(db: Kysely<DatabaseSchema>, installationId: string): Promise<void> {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`rekt:github:installation:${installationId}`}, 0)
    )
  `.execute(db);
}

async function readInstallationTombstone(db: Kysely<DatabaseSchema>, installationId: string) {
  return db
    .selectFrom('github_installation_tombstones')
    .select(['installation_id', 'revoked_at', 'source_key'])
    .where('installation_id', '=', installationId)
    .executeTakeFirst();
}

async function readRepositoryTombstone(db: Kysely<DatabaseSchema>, repositoryId: string) {
  return db
    .selectFrom('github_repository_tombstones')
    .select(['repository_id', 'installation_id', 'removed_at', 'source_key'])
    .where('repository_id', '=', repositoryId)
    .executeTakeFirst();
}

async function writeInstallationTombstone(
  db: Kysely<DatabaseSchema>,
  installationId: string,
  sourceKey: string,
): Promise<void> {
  await sql`
    insert into github_installation_tombstones (installation_id, revoked_at, source_key)
    values (${installationId}::bigint, clock_timestamp(), ${sourceKey})
    on conflict (installation_id) do update
      set revoked_at = clock_timestamp(), source_key = excluded.source_key
  `.execute(db);
}

async function writeRepositoryTombstone(
  db: Kysely<DatabaseSchema>,
  repositoryId: string,
  installationId: string,
  sourceKey: string,
): Promise<void> {
  const result = await sql<{repository_id: string}>`
    insert into github_repository_tombstones (repository_id, installation_id, removed_at, source_key)
    values (${repositoryId}::bigint, ${installationId}::bigint, clock_timestamp(), ${sourceKey})
    on conflict (repository_id) do update
      set removed_at = clock_timestamp(), source_key = excluded.source_key
    where github_repository_tombstones.installation_id = excluded.installation_id
    returning repository_id
  `.execute(db);
  if (result.rows.length !== 1) throw new Error('github_repository_already_bound');
}

async function upsertInstallationOwnership(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  verified: VerifiedGitHubInstallation,
): Promise<void> {
  const result = await sql<{player_id: string}>`
    insert into github_installations (
      installation_id, player_id, github_user_id, account_id, account_type, repository_selection, revoked_at
    ) values (
      ${verified.installationId}::bigint,
      ${playerId}::uuid,
      ${verified.githubUserId}::bigint,
      ${verified.accountId}::bigint,
      ${verified.accountType},
      ${verified.repositorySelection},
      null
    )
    on conflict (installation_id) do update set
      github_user_id = excluded.github_user_id,
      account_id = excluded.account_id,
      account_type = excluded.account_type,
      repository_selection = excluded.repository_selection,
      revoked_at = null
    where github_installations.player_id = excluded.player_id
    returning player_id
  `.execute(db);
  if (result.rows.length !== 1) throw new Error('github_installation_already_bound');
}

async function upsertRepositoryBinding(
  db: Kysely<DatabaseSchema>,
  installationId: string,
  repository: VerifiedGitHubRepository,
  active: boolean,
): Promise<void> {
  const result = await sql<{repository_id: string}>`
    insert into github_repositories (
      repository_id, installation_id, full_name, private, active, updated_at
    ) values (
      ${repository.repositoryId}::bigint,
      ${installationId}::bigint,
      ${repository.fullName},
      ${repository.private},
      ${active},
      clock_timestamp()
    )
    on conflict (repository_id) do update set
      full_name = excluded.full_name,
      private = excluded.private,
      active = excluded.active,
      updated_at = clock_timestamp()
    where github_repositories.installation_id = excluded.installation_id
    returning repository_id
  `.execute(db);
  if (result.rows.length !== 1) throw new Error('github_repository_already_bound');
}

async function bindVerifiedInstallation(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  setupCreatedAt: Date,
  verified: VerifiedGitHubInstallation,
): Promise<number> {
  const installationTombstone = await readInstallationTombstone(db, verified.installationId);
  if (installationTombstone && setupCreatedAt.getTime() <= installationTombstone.revoked_at.getTime()) {
    throw new Error('github_installation_revoked_during_setup');
  }
  if (installationTombstone) {
    await db
      .deleteFrom('github_installation_tombstones')
      .where('installation_id', '=', verified.installationId)
      .execute();
  }

  await upsertInstallationOwnership(db, playerId, verified);

  await db
    .updateTable('github_repositories')
    .set({active: false, updated_at: sql<Date>`clock_timestamp()`})
    .where('installation_id', '=', verified.installationId)
    .execute();

  let repositoriesConnected = 0;
  for (const repository of verified.repositories) {
    const tombstone = await readRepositoryTombstone(db, repository.repositoryId);
    const canReactivate = !tombstone || setupCreatedAt.getTime() > tombstone.removed_at.getTime();
    if (tombstone && canReactivate) {
      await db
        .deleteFrom('github_repository_tombstones')
        .where('repository_id', '=', repository.repositoryId)
        .execute();
    }
    await upsertRepositoryBinding(db, verified.installationId, repository, canReactivate);
    if (canReactivate) repositoriesConnected += 1;
  }

  return repositoriesConnected;
}

export async function finalizeGitHubSetup(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  setupCreatedAt: Date,
  verified: VerifiedGitHubInstallation,
): Promise<{repositoriesConnected: number}> {
  return db.transaction().execute(async (transaction) => {
    await lockGitHubInstallation(transaction, verified.installationId);
    const repositoriesConnected = await bindVerifiedInstallation(transaction, playerId, setupCreatedAt, verified);
    return {repositoriesConnected};
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
        const body = (await readJson(response, 'github_installations_lookup_failed')) as {installations?: unknown};
        if (!Array.isArray(body.installations)) throw new Error('github_installations_response_invalid');
        installation = body.installations.find(
          (candidate) =>
            candidate && typeof candidate === 'object' &&
            positiveIntegerId((candidate as {id?: unknown}).id, 'github_installation_id') === installationId,
        ) as Record<string, unknown> | undefined;
        if (body.installations.length < 100) break;
      }
      if (!installation) throw new Error('github_installation_not_accessible_to_user');

      validateGitHubInstallationPolicy(installation.permissions, installation.events);
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
    .values({delivery_id: deliveryId, event_name: eventName, payload_hash: payloadHash, installation_id: installationId, repository_id: repositoryId})
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
  ) throw new Error('github_delivery_conflict');
  return 'duplicate';
}

function installationIdFromPayload(payload: Record<string, unknown>): string | null {
  const installation = payload.installation;
  if (!installation || typeof installation !== 'object') return null;
  return positiveIntegerId((installation as {id?: unknown}).id, 'github_installation_id');
}

type ManifestChange = {
  path_hash: string;
  stack: DetectedStack;
  state: 'PRESENT' | 'REMOVED';
};

function canonicalManifestProjectionRef(repository: Record<string, unknown>, pushRef: string): string | null {
  const defaultBranch = repository.default_branch;
  if (typeof defaultBranch !== 'string' || defaultBranch.length < 1 || defaultBranch.length > 200) return null;
  const canonicalRef = `refs/heads/${defaultBranch}`;
  if (!REF_PATTERN.test(canonicalRef)) return null;
  return canonicalRef === pushRef ? canonicalRef : null;
}

function boundedManifestChanges(payload: Record<string, unknown>): {changes: ManifestChange[]; complete: boolean} {
  const commitsRaw = Array.isArray(payload.commits) ? payload.commits : [];
  const commits = commitsRaw.slice(0, 64);
  const changes = new Map<string, ManifestChange>();
  let complete = Array.isArray(payload.commits) && commitsRaw.length <= 64;
  if (
    typeof payload.size === 'number' && Number.isInteger(payload.size) && payload.size >= 0 &&
    payload.size > commitsRaw.length
  ) complete = false;
  for (const candidate of commits) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      complete = false;
      continue;
    }
    const commit = candidate as Record<string, unknown>;
    for (const key of ['added', 'modified', 'removed'] as const) {
      const rawValues = commit[key];
      if (!Array.isArray(rawValues)) {
        complete = false;
        continue;
      }
      if (rawValues.length > 128) complete = false;
      const values = rawValues.slice(0, 128);
      for (const value of values) {
        if (typeof value !== 'string' || value.length < 1 || value.length > 300) continue;
        const detection = detectStackFromManifestPaths([value]);
        for (const detected of detection.detections) {
          for (const evidencePath of detected.evidencePaths) {
            const pathHash = createHash('sha256').update(evidencePath, 'utf8').digest('hex');
            if (!changes.has(pathHash) && changes.size >= 128) {
              complete = false;
              continue;
            }
            changes.set(pathHash, {
              path_hash: pathHash,
              stack: detected.stack,
              state: key === 'removed' ? 'REMOVED' : 'PRESENT',
            });
          }
        }
      }
    }
  }
  return {
    changes: [...changes.values()].sort((left, right) => left.path_hash.localeCompare(right.path_hash)),
    complete,
  };
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
  deliveryId: string,
): Promise<void> {
  const action = payload.action;
  if (action !== 'deleted' && action !== 'suspend') return;
  await writeInstallationTombstone(db, installationId, `github:delivery:${deliveryId}`);
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

async function existingRepositoryInstallation(
  db: Kysely<DatabaseSchema>,
  repositoryId: string,
): Promise<string | null> {
  const row = await db
    .selectFrom('github_repositories')
    .select('installation_id')
    .where('repository_id', '=', repositoryId)
    .executeTakeFirst();
  return row?.installation_id ?? null;
}

async function processRepositoryControl(
  db: Kysely<DatabaseSchema>,
  payload: Record<string, unknown>,
  installationId: string,
  deliveryId: string,
): Promise<void> {
  const installation = await db
    .selectFrom('github_installations')
    .select(['installation_id', 'revoked_at'])
    .where('installation_id', '=', installationId)
    .executeTakeFirst();

  const added = Array.isArray(payload.repositories_added) ? payload.repositories_added : [];
  const removed = Array.isArray(payload.repositories_removed) ? payload.repositories_removed : [];

  for (const candidate of removed) {
    if (!candidate || typeof candidate !== 'object') continue;
    const repository = candidate as {id?: unknown};
    const repositoryId = positiveIntegerId(repository.id, 'github_repository_id');
    const existingInstallationId = await existingRepositoryInstallation(db, repositoryId);
    if (existingInstallationId && existingInstallationId !== installationId) {
      throw new Error('github_repository_already_bound');
    }
    await writeRepositoryTombstone(db, repositoryId, installationId, `github:delivery:${deliveryId}`);
    await db
      .updateTable('github_repositories')
      .set({active: false, updated_at: sql<Date>`clock_timestamp()`})
      .where('repository_id', '=', repositoryId)
      .where('installation_id', '=', installationId)
      .execute();
  }

  if (!installation || installation.revoked_at) return;

  for (const candidate of added) {
    if (!candidate || typeof candidate !== 'object') continue;
    const repository = candidate as {id?: unknown; full_name?: unknown; private?: unknown};
    if (typeof repository.private !== 'boolean' || typeof repository.full_name !== 'string') continue;
    const repositoryId = positiveIntegerId(repository.id, 'github_repository_id');
    const existingInstallationId = await existingRepositoryInstallation(db, repositoryId);
    if (existingInstallationId && existingInstallationId !== installationId) {
      throw new Error('github_repository_already_bound');
    }
    const tombstone = await readRepositoryTombstone(db, repositoryId);
    const active = !tombstone;
    await upsertRepositoryBinding(
      db,
      installationId,
      {repositoryId, fullName: repository.full_name, private: repository.private},
      active,
    );
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
    const receipt = await recordDelivery(transaction, deliveryId, input.eventName, payloadHash, installationId, repositoryId);
    if (receipt === 'duplicate') return {status: 'duplicate'};

    if (input.eventName === 'installation' && installationId) {
      await lockGitHubInstallation(transaction, installationId);
      await processInstallationControl(transaction, payload, installationId, deliveryId);
      return {status: 'control'};
    }
    if (input.eventName === 'installation_repositories' && installationId) {
      await lockGitHubInstallation(transaction, installationId);
      await processRepositoryControl(transaction, payload, installationId, deliveryId);
      return {status: 'control'};
    }
    if (input.eventName !== 'push') return {status: 'ignored'};
    if (!installationId || !repositoryId) throw new Error('github_push_identity_missing');

    await lockGitHubInstallation(transaction, installationId);
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
      .where('active', '=', true)
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

    const manifestProjectionRef = canonicalManifestProjectionRef(repository, ref);
    const manifestChanges = manifestProjectionRef ? boundedManifestChanges(payload) : {changes: [], complete: true};
    const projectId = await findLinkedProjectIdForRepository(transaction, repositoryId);
    if (projectId) {
      await enqueueOutboxJob(transaction, {
        jobType: PROJECT_GITHUB_OBSERVATION_JOB_TYPE,
        idempotencyKey: `project.github_observation:${projectId}:${deliveryId}`,
        payload: {
          schema_version: 'project.github_observation.job.v2',
          project_id: projectId,
          delivery_id: deliveryId,
          repository_id: repositoryId,
          ref,
          before,
          after,
          repository_private: repository.private,
          manifest_projection_ref: manifestProjectionRef,
          manifest_changes: manifestChanges.changes,
          manifest_changes_complete: manifestChanges.complete,
        },
      });
    }

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
