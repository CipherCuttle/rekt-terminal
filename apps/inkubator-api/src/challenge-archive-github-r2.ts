import {createHash} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import type {
  ChallengeSubmissionArchiveCaptureClient,
  ChallengeSubmissionArchiveCaptureInput,
  ChallengeSubmissionArchiveCaptureResult,
} from './challenge-archive.js';
import type {DatabaseSchema} from './database.js';
import {createGitHubAppJwt} from './github-app-auth.js';

const GITHUB_API_VERSION = '2026-03-10';
const DEFAULT_MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MIN_MAX_ARCHIVE_BYTES = 1024 * 1024;
const MAX_MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const GIT_SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
type FetchLike = typeof fetch;

export interface GitHubR2ArchiveOptions {
  githubAppId: string;
  githubPrivateKey: string;
  r2AccountId: string;
  r2Bucket: string;
  r2ApiToken: string;
  maxArchiveBytes: number;
}

type FrozenSourceContext = {
  repository_id: string;
  frozen_installation_id: string;
  accepted_at: Date;
  builder_player_id: string;
  full_name: string | null;
  active: boolean | null;
  current_installation_id: string | null;
  installation_player_id: string | null;
  installation_revoked_at: Date | null;
  repository_removed_at: Date | null;
  installation_tombstone_revoked_at: Date | null;
};

function requiredEnv(value: string | undefined, name: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function parseMaxArchiveBytes(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_MAX_ARCHIVE_BYTES;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_MAX_ARCHIVE_BYTES || parsed > MAX_MAX_ARCHIVE_BYTES) {
    throw new Error(`INKUBATOR_ARCHIVE_MAX_BYTES must be between ${MIN_MAX_ARCHIVE_BYTES} and ${MAX_MAX_ARCHIVE_BYTES}`);
  }
  return parsed;
}

export function loadGitHubR2ArchiveOptions(env: NodeJS.ProcessEnv = process.env): GitHubR2ArchiveOptions | null {
  const r2Names = ['INKUBATOR_ARCHIVE_R2_ACCOUNT_ID', 'INKUBATOR_ARCHIVE_R2_BUCKET', 'INKUBATOR_ARCHIVE_R2_API_TOKEN'] as const;
  const r2Values = r2Names.map((name) => env[name]?.trim() ?? '');
  if (r2Values.every((value) => !value)) return null;
  if (r2Values.some((value) => !value)) throw new Error('R2 archive configuration must be all-or-none');

  const githubAppId = requiredEnv(env.GITHUB_APP_ID, 'GITHUB_APP_ID');
  const rawPrivateKey = requiredEnv(env.GITHUB_APP_PRIVATE_KEY, 'GITHUB_APP_PRIVATE_KEY');
  if (!/^\d+$/.test(githubAppId) || githubAppId === '0') throw new Error('GITHUB_APP_ID is invalid');
  const githubPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');
  if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(githubPrivateKey) || !/-----END (?:RSA )?PRIVATE KEY-----/.test(githubPrivateKey)) {
    throw new Error('GITHUB_APP_PRIVATE_KEY is invalid');
  }

  const [r2AccountId, r2Bucket, r2ApiToken] = r2Values;
  if (!/^[A-Fa-f0-9]{32}$/.test(r2AccountId)) throw new Error('INKUBATOR_ARCHIVE_R2_ACCOUNT_ID is invalid');
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(r2Bucket) || r2Bucket.length > 64) throw new Error('INKUBATOR_ARCHIVE_R2_BUCKET is invalid');
  if (r2ApiToken.length < 20 || r2ApiToken.length > 2048) throw new Error('INKUBATOR_ARCHIVE_R2_API_TOKEN is invalid');

  return {
    githubAppId,
    githubPrivateKey,
    r2AccountId,
    r2Bucket,
    r2ApiToken,
    maxArchiveBytes: parseMaxArchiveBytes(env.INKUBATOR_ARCHIVE_MAX_BYTES),
  };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': GITHUB_API_VERSION,
    'user-agent': 'rekt-inkubator',
  };
}

function transient(reasonCode: string): ChallengeSubmissionArchiveCaptureResult {
  return {outcome: 'TRANSIENT_PLATFORM_UNAVAILABLE', reason_code: reasonCode};
}

function unknown(reasonCode: string): ChallengeSubmissionArchiveCaptureResult {
  return {outcome: 'UNKNOWN_UNAVAILABLE', reason_code: reasonCode};
}

function statusFailure(status: number, platform: 'GITHUB' | 'R2'): ChallengeSubmissionArchiveCaptureResult {
  if (status === 429 || status >= 500) return transient(`${platform}_PLATFORM_UNAVAILABLE`);
  if (status === 401 || status === 403) return unknown(`${platform}_AUTH_UNAVAILABLE`);
  if (status === 404) return unknown(`${platform}_SOURCE_UNAVAILABLE`);
  return unknown(`${platform}_RESPONSE_UNAVAILABLE`);
}

async function frozenSourceContext(
  db: Kysely<DatabaseSchema>,
  submissionId: string,
): Promise<FrozenSourceContext | null> {
  const result = await sql<FrozenSourceContext>`
    select
      source.repository_id::text as repository_id,
      source.installation_id::text as frozen_installation_id,
      submission.accepted_at,
      entry.builder_player_id,
      repository.full_name,
      repository.active,
      repository.installation_id::text as current_installation_id,
      installation.player_id as installation_player_id,
      installation.revoked_at as installation_revoked_at,
      repository_tombstone.removed_at as repository_removed_at,
      installation_tombstone.revoked_at as installation_tombstone_revoked_at
    from challenge_submission_archive_sources source
    join challenge_submissions submission on submission.submission_id = source.submission_id
    join challenge_entries entry on entry.entry_id = submission.entry_id
    left join github_repositories repository on repository.repository_id = source.repository_id
    left join github_installations installation on installation.installation_id = repository.installation_id
    left join github_repository_tombstones repository_tombstone on repository_tombstone.repository_id = source.repository_id
    left join github_installation_tombstones installation_tombstone on installation_tombstone.installation_id = source.installation_id
    where source.submission_id = ${submissionId}
  `.execute(db);
  return result.rows[0] ?? null;
}

function accessUnavailableReason(context: FrozenSourceContext): string {
  const acceptedAt = context.accepted_at.getTime();
  if (
    (context.repository_removed_at instanceof Date && context.repository_removed_at.getTime() >= acceptedAt) ||
    (context.installation_tombstone_revoked_at instanceof Date && context.installation_tombstone_revoked_at.getTime() >= acceptedAt)
  ) {
    // Tombstones prove that access disappeared after acceptance, but do not by
    // themselves prove which human caused it. Preserve UNKNOWN rather than
    // accusing the builder without stronger causal evidence.
    return 'GITHUB_ACCESS_REMOVED_AFTER_ACCEPTANCE';
  }
  return 'GITHUB_REPOSITORY_ACCESS_UNAVAILABLE';
}

async function installationToken(
  options: GitHubR2ArchiveOptions,
  installationId: string,
  fetchImpl: FetchLike,
): Promise<{token: string} | ChallengeSubmissionArchiveCaptureResult> {
  const jwt = createGitHubAppJwt({appId: options.githubAppId, privateKey: options.githubPrivateKey});
  let response: Response;
  try {
    response = await fetchImpl(`https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
      method: 'POST',
      headers: {...githubHeaders(jwt), 'content-type': 'application/json'},
      body: '{}',
    });
  } catch {
    return transient('GITHUB_NETWORK_UNAVAILABLE');
  }
  if (!response.ok) return statusFailure(response.status, 'GITHUB');
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return unknown('GITHUB_TOKEN_RESPONSE_INVALID');
  }
  const token = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as {token?: unknown}).token
    : null;
  if (typeof token !== 'string' || token.length < 1 || token.length > 2_000) return unknown('GITHUB_TOKEN_RESPONSE_INVALID');
  return {token};
}

function repositorySegments(fullName: string): [string, string] | null {
  const parts = fullName.split('/');
  if (parts.length !== 2 || parts.some((part) => part.length < 1 || part.length > 100)) return null;
  return [encodeURIComponent(parts[0]), encodeURIComponent(parts[1])];
}

async function resolveRepositoryName(
  context: FrozenSourceContext,
  token: string,
  fetchImpl: FetchLike,
): Promise<{owner: string; repo: string} | ChallengeSubmissionArchiveCaptureResult> {
  if (!context.full_name) return unknown(accessUnavailableReason(context));
  const segments = repositorySegments(context.full_name);
  if (!segments) return unknown('GITHUB_REPOSITORY_NAME_INVALID');
  let response: Response;
  try {
    response = await fetchImpl(`https://api.github.com/repos/${segments[0]}/${segments[1]}`, {
      headers: githubHeaders(token),
      redirect: 'follow',
    });
  } catch {
    return transient('GITHUB_NETWORK_UNAVAILABLE');
  }
  if (!response.ok) return statusFailure(response.status, 'GITHUB');
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unknown('GITHUB_REPOSITORY_RESPONSE_INVALID');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return unknown('GITHUB_REPOSITORY_RESPONSE_INVALID');
  const repository = body as {id?: unknown; full_name?: unknown};
  if (String(repository.id ?? '') !== context.repository_id || typeof repository.full_name !== 'string') {
    return unknown('GITHUB_REPOSITORY_IDENTITY_MISMATCH');
  }
  const resolved = repositorySegments(repository.full_name);
  if (!resolved) return unknown('GITHUB_REPOSITORY_RESPONSE_INVALID');
  return {owner: resolved[0], repo: resolved[1]};
}

async function readBoundedArchive(response: Response, maxBytes: number): Promise<Buffer | null> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) return null;
  if (!response.body) throw new Error('archive_body_missing');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

async function downloadGitHubArchive(
  owner: string,
  repo: string,
  commit: string,
  token: string,
  maxBytes: number,
  fetchImpl: FetchLike,
): Promise<{bytes: Buffer; digest: string} | ChallengeSubmissionArchiveCaptureResult> {
  let response: Response;
  try {
    response = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(commit)}`, {
      headers: githubHeaders(token),
      redirect: 'follow',
    });
  } catch {
    return transient('GITHUB_NETWORK_UNAVAILABLE');
  }
  if (!response.ok) return statusFailure(response.status, 'GITHUB');
  let bytes: Buffer | null;
  try {
    bytes = await readBoundedArchive(response, maxBytes);
  } catch {
    return transient('GITHUB_ARCHIVE_READ_FAILED');
  }
  if (!bytes) return {outcome: 'UNSUPPORTED_SOURCE', reason_code: 'ARCHIVE_TOO_LARGE'};
  return {bytes, digest: createHash('sha256').update(bytes).digest('hex')};
}

function encodedObjectKey(key: string): string {
  // Cloudflare's R2 REST API requires slash separators to remain literal.
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function uploadR2Archive(
  options: GitHubR2ArchiveOptions,
  submissionId: string,
  archive: {bytes: Buffer; digest: string},
  fetchImpl: FetchLike,
): Promise<ChallengeSubmissionArchiveCaptureResult> {
  const objectKey = `challenge-submissions/${submissionId}/source.tar.gz`;
  const form = new FormData();
  form.append('body', new Blob([archive.bytes], {type: 'application/gzip'}), 'source.tar.gz');

  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.r2AccountId)}/r2/buckets/${encodeURIComponent(options.r2Bucket)}/objects/${encodedObjectKey(objectKey)}`,
      {
        method: 'PUT',
        headers: {authorization: `Bearer ${options.r2ApiToken}`},
        body: form,
      },
    );
  } catch {
    return transient('R2_NETWORK_UNAVAILABLE');
  }
  if (!response.ok) return statusFailure(response.status, 'R2');

  let receipt: unknown;
  try {
    receipt = await response.json();
  } catch {
    return unknown('R2_UPLOAD_RECEIPT_INVALID');
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return unknown('R2_UPLOAD_RECEIPT_INVALID');
  const envelope = receipt as {success?: unknown; result?: unknown};
  const result = envelope.result && typeof envelope.result === 'object' && !Array.isArray(envelope.result)
    ? envelope.result as {key?: unknown; size?: unknown}
    : null;
  if (envelope.success !== true || !result || result.key !== objectKey || Number(result.size) !== archive.bytes.byteLength) {
    return unknown('R2_UPLOAD_RECEIPT_INVALID');
  }

  return {
    outcome: 'CAPTURED',
    archive_digest: archive.digest,
    archive_reference: `r2://${options.r2Bucket}/${objectKey}`,
  };
}

export function createGitHubR2ChallengeArchiveCaptureClient(
  db: Kysely<DatabaseSchema>,
  options: GitHubR2ArchiveOptions,
  fetchImpl: FetchLike = fetch,
): ChallengeSubmissionArchiveCaptureClient {
  return {
    async capture(input: ChallengeSubmissionArchiveCaptureInput): Promise<ChallengeSubmissionArchiveCaptureResult> {
      if (input.sourceKind !== 'GIT_COMMIT') {
        return {outcome: 'UNSUPPORTED_SOURCE', reason_code: 'SOURCE_KIND_UNSUPPORTED'};
      }
      if (!GIT_SHA_PATTERN.test(input.sourceReference)) {
        return {outcome: 'UNSUPPORTED_SOURCE', reason_code: 'GIT_COMMIT_INVALID'};
      }

      const context = await frozenSourceContext(db, input.submissionId);
      if (!context) return {outcome: 'UNSUPPORTED_SOURCE', reason_code: 'GITHUB_REPOSITORY_LINEAGE_MISSING'};
      if (!(context.accepted_at instanceof Date)) return unknown('SUBMISSION_ACCEPTANCE_TIME_INVALID');
      if (
        context.active !== true || !context.full_name || !context.current_installation_id ||
        context.current_installation_id !== context.frozen_installation_id ||
        context.installation_player_id !== context.builder_player_id ||
        context.installation_revoked_at !== null
      ) {
        return unknown(accessUnavailableReason(context));
      }

      const auth = await installationToken(options, context.frozen_installation_id, fetchImpl);
      if (!('token' in auth)) return auth;
      const repository = await resolveRepositoryName(context, auth.token, fetchImpl);
      if (!('owner' in repository)) return repository;
      const archive = await downloadGitHubArchive(
        repository.owner,
        repository.repo,
        input.sourceReference,
        auth.token,
        options.maxArchiveBytes,
        fetchImpl,
      );
      if (!('bytes' in archive)) return archive;
      return uploadR2Archive(options, input.submissionId, archive, fetchImpl);
    },
  };
}
