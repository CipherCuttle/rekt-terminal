import {createSign} from 'node:crypto';
import type {InkubatorDatabase} from './database.js';
import {readDatabaseNow} from './database.js';
import {finalizeGitHubSetup, type GitHubRuntimeOptions, type VerifiedGitHubRepository} from './github.js';
import {githubObservationPolicyWarnings, validateGitHubRepositoryAccessPolicy} from './github-reconcile.js';

const GITHUB_API_VERSION = '2026-03-10';
type FetchLike = typeof fetch;

export interface GitHubAppServerAuthOptions {
  appId: string;
  privateKey: string;
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function createGitHubAppJwt(options: GitHubAppServerAuthOptions, nowMs = Date.now()): string {
  if (!/^\d+$/.test(options.appId) || options.appId === '0') throw new Error('github_app_id_invalid');
  const now = Math.floor(nowMs / 1000);
  const header = base64urlJson({alg: 'RS256', typ: 'JWT'});
  const payload = base64urlJson({iat: now - 60, exp: now + (9 * 60), iss: options.appId});
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(options.privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
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

function appHeaders(jwt: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${jwt}`,
    'x-github-api-version': GITHUB_API_VERSION,
    'user-agent': 'rekt-inkubator',
  };
}

function installationHeaders(token: string): Record<string, string> {
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

async function repositoriesForInstallationToken(token: string, fetchImpl: FetchLike): Promise<VerifiedGitHubRepository[]> {
  const repositories: VerifiedGitHubRepository[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetchImpl(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, {
      headers: installationHeaders(token),
    });
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

/**
 * Reconciles installations already bound to this Player using GitHub App
 * installation authentication. This path never discovers or adopts a new
 * installation; first binding still requires the user-authenticated setup flow.
 */
export async function reconcileKnownGitHubAppInstallations(
  db: InkubatorDatabase,
  runtime: GitHubRuntimeOptions,
  serverAuth: GitHubAppServerAuthOptions,
  playerId: string,
  fetchImpl: FetchLike = fetch,
): Promise<{installationIds: string[]; repositoriesConnected: number; warnings: string[]}> {
  const player = await db
    .selectFrom('players')
    .select('github_user_id')
    .where('player_id', '=', playerId)
    .executeTakeFirst();
  if (!player?.github_user_id) throw new Error('github_identity_missing');

  const known = await db
    .selectFrom('github_installations')
    .select(['installation_id', 'account_id', 'account_type'])
    .where('player_id', '=', playerId)
    .where('revoked_at', 'is', null)
    .orderBy('installation_id', 'asc')
    .execute();
  if (known.length === 0) return {installationIds: [], repositoriesConnected: 0, warnings: []};

  const reconciledAt = await readDatabaseNow(db);
  const warnings = new Set<string>();
  let repositoriesConnected = 0;
  const installationIds: string[] = [];

  for (const bound of known) {
    const installationId = String(bound.installation_id);
    const jwt = createGitHubAppJwt(serverAuth);
    const installationResponse = await fetchImpl(
      `https://api.github.com/app/installations/${encodeURIComponent(installationId)}`,
      {headers: appHeaders(jwt)},
    );
    const installation = await readJson(installationResponse, 'github_installation_lookup_failed') as Record<string, unknown>;
    if (positiveIntegerId(installation.id, 'github_installation_id') !== installationId) {
      throw new Error('github_installation_identity_mismatch');
    }
    if (installation.app_slug !== runtime.appSlug) throw new Error('github_installation_app_mismatch');

    validateGitHubRepositoryAccessPolicy(installation.permissions);
    for (const warning of githubObservationPolicyWarnings(installation.events)) warnings.add(warning);

    const account = installation.account;
    if (!account || typeof account !== 'object') throw new Error('github_installation_account_invalid');
    const accountId = positiveIntegerId((account as {id?: unknown}).id, 'github_account_id');
    const accountType = requireString((account as {type?: unknown}).type, 'github_account_type', 50);
    if (accountId !== String(bound.account_id) || accountType !== bound.account_type) {
      throw new Error('github_installation_account_mismatch');
    }
    const repositorySelection = installation.repository_selection;
    if (repositorySelection !== 'all' && repositorySelection !== 'selected') {
      throw new Error('github_repository_selection_invalid');
    }

    const tokenResponse = await fetchImpl(
      `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      {
        method: 'POST',
        headers: {...appHeaders(jwt), 'content-type': 'application/json'},
        body: '{}',
      },
    );
    const tokenBody = await readJson(tokenResponse, 'github_installation_token_failed') as {token?: unknown};
    const token = requireString(tokenBody.token, 'github_installation_token', 2000);
    const repositories = await repositoriesForInstallationToken(token, fetchImpl);

    const result = await finalizeGitHubSetup(db, playerId, reconciledAt, {
      githubUserId: String(player.github_user_id),
      installationId,
      accountId,
      accountType,
      repositorySelection,
      repositories,
    });
    repositoriesConnected += result.repositoriesConnected;
    installationIds.push(installationId);
  }

  return {installationIds, repositoriesConnected, warnings: [...warnings]};
}
