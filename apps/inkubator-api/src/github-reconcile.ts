import {sql} from 'kysely';
import type {InkubatorDatabase} from './database.js';
import {readDatabaseNow} from './database.js';
import {
  finalizeGitHubSetup,
  type GitHubRuntimeOptions,
  type VerifiedGitHubInstallation,
  type VerifiedGitHubRepository,
} from './github.js';

type FetchLike = typeof fetch;

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

function authHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2026-03-10',
    'user-agent': 'rekt-inkubator',
  };
}

async function readJson(response: Response, errorName: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${errorName}:${response.status}`);
  return response.json();
}

export function validateGitHubRepositoryAccessPolicy(permissions: unknown): void {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new Error('github_installation_permissions_invalid');
  }
  const permissionEntries = Object.entries(permissions as Record<string, unknown>);
  if ((permissions as Record<string, unknown>).contents !== 'read') {
    throw new Error('github_contents_read_permission_required');
  }
  const allowedReadPermissions = new Set(['contents', 'metadata']);
  for (const [name, level] of permissionEntries) {
    if (level === 'write' || level === 'admin') throw new Error('github_write_permission_forbidden');
    if (level !== 'read' && level !== 'none') throw new Error('github_installation_permissions_invalid');
    if (level === 'read' && !allowedReadPermissions.has(name)) {
      throw new Error(`github_read_permission_excessive:${name}`);
    }
  }
}

export function githubObservationPolicyWarnings(events: unknown): string[] {
  if (!Array.isArray(events) || events.some((event) => typeof event !== 'string')) {
    return ['github_installation_events_invalid'];
  }
  const warnings: string[] = [];
  if (!events.includes('push')) warnings.push('github_push_event_required');
  const extraEvents = events.filter((event) => event !== 'push');
  if (extraEvents.length > 0) warnings.push(`github_event_subscription_excessive:${extraEvents.join(',')}`);
  return warnings;
}

async function repositoriesForInstallation(
  installationId: string,
  token: string,
  fetchImpl: FetchLike,
): Promise<VerifiedGitHubRepository[]> {
  const repositories: VerifiedGitHubRepository[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetchImpl(
      `https://api.github.com/user/installations/${encodeURIComponent(installationId)}/repositories?per_page=100&page=${page}`,
      {headers: authHeaders(token)},
    );
    const body = await readJson(response, 'github_repositories_lookup_failed') as {repositories?: unknown};
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
    if (body.repositories.length < 100) return repositories;
  }
  throw new Error('github_repository_list_too_large');
}

export interface GitHubInstallationDiscovery {
  installations: VerifiedGitHubInstallation[];
  warnings: string[];
}

/**
 * Reads the GitHub user's current installations for this App. Repository access
 * authority and observation/webhook health are deliberately separate: a missing
 * Push subscription degrades evidence capability but does not erase authorized
 * repository access.
 */
export async function discoverGitHubAppInstallationsWithHealth(
  runtime: GitHubRuntimeOptions,
  accessToken: string,
  expectedGithubUserId: string,
  fetchImpl: FetchLike = fetch,
): Promise<GitHubInstallationDiscovery> {
  const installations: VerifiedGitHubInstallation[] = [];
  const warnings = new Set<string>();
  let complete = false;

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetchImpl(`https://api.github.com/user/installations?per_page=100&page=${page}`, {
      headers: authHeaders(accessToken),
    });
    const body = await readJson(response, 'github_installations_lookup_failed') as {installations?: unknown};
    if (!Array.isArray(body.installations)) throw new Error('github_installations_response_invalid');

    for (const candidate of body.installations) {
      if (!candidate || typeof candidate !== 'object') throw new Error('github_installation_invalid');
      const installation = candidate as Record<string, unknown>;
      if (installation.app_slug !== runtime.appSlug) continue;

      validateGitHubRepositoryAccessPolicy(installation.permissions);
      for (const warning of githubObservationPolicyWarnings(installation.events)) warnings.add(warning);
      const account = installation.account;
      if (!account || typeof account !== 'object') throw new Error('github_installation_account_invalid');
      const repositorySelection = installation.repository_selection;
      if (repositorySelection !== 'all' && repositorySelection !== 'selected') {
        throw new Error('github_repository_selection_invalid');
      }
      const installationId = positiveIntegerId(installation.id, 'github_installation_id');
      installations.push({
        githubUserId: expectedGithubUserId,
        installationId,
        accountId: positiveIntegerId((account as {id?: unknown}).id, 'github_account_id'),
        accountType: requireString((account as {type?: unknown}).type, 'github_account_type', 50),
        repositorySelection,
        repositories: await repositoriesForInstallation(installationId, accessToken, fetchImpl),
      });
    }

    if (body.installations.length < 100) {
      complete = true;
      break;
    }
  }

  if (!complete) throw new Error('github_installation_list_too_large');
  return {installations, warnings: [...warnings]};
}

export async function discoverGitHubAppInstallations(
  runtime: GitHubRuntimeOptions,
  accessToken: string,
  expectedGithubUserId: string,
  fetchImpl: FetchLike = fetch,
): Promise<VerifiedGitHubInstallation[]> {
  return (await discoverGitHubAppInstallationsWithHealth(runtime, accessToken, expectedGithubUserId, fetchImpl)).installations;
}

/**
 * Anti-entropy reconciliation against GitHub's current user-access-token view.
 * Webhooks remain the normal continuous path; this is used after login and the
 * installation/update return. Observation-health warnings never launder into
 * repository authorization failures.
 */
export async function reconcileGitHubAppInstallations(
  db: InkubatorDatabase,
  runtime: GitHubRuntimeOptions,
  playerId: string,
  githubUserId: string,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<{installationIds: string[]; repositoriesConnected: number; warnings: string[]}> {
  const reconciledAt = await readDatabaseNow(db);
  const discovered = await discoverGitHubAppInstallationsWithHealth(runtime, accessToken, githubUserId, fetchImpl);
  let repositoriesConnected = 0;

  for (const installation of discovered.installations) {
    const result = await finalizeGitHubSetup(db, playerId, reconciledAt, installation);
    repositoriesConnected += result.repositoriesConnected;
  }

  const installationIds = discovered.installations.map((installation) => installation.installationId);
  await db.transaction().execute(async (transaction) => {
    const known = await transaction
      .selectFrom('github_installations')
      .select('installation_id')
      .where('player_id', '=', playerId)
      .where('revoked_at', 'is', null)
      .execute();
    const missing = known.map((row) => String(row.installation_id)).filter((id) => !installationIds.includes(id));
    if (missing.length === 0) return;

    await transaction
      .updateTable('github_installations')
      .set({revoked_at: sql<Date>`clock_timestamp()`})
      .where('player_id', '=', playerId)
      .where('installation_id', 'in', missing)
      .execute();
    await transaction
      .updateTable('github_repositories')
      .set({active: false, updated_at: sql<Date>`clock_timestamp()`})
      .where('installation_id', 'in', missing)
      .execute();
  });

  return {installationIds, repositoriesConnected, warnings: discovered.warnings};
}
