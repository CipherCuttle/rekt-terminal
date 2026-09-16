import type {ChallengeSubmissionArchiveDeletionClient} from './challenge-archive.js';
import type {GitHubR2ArchiveOptions} from './challenge-archive-github-r2.js';

type FetchLike = typeof fetch;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodedObjectKey(key: string): string {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function objectKey(submissionId: string): string {
  if (!UUID_PATTERN.test(submissionId)) throw new Error('challenge_archive_delete_submission_id_invalid');
  return `challenge-submissions/${submissionId.toLowerCase()}/source.tar.gz`;
}

export function createGitHubR2ChallengeArchiveDeletionClient(
  options: GitHubR2ArchiveOptions,
  fetchImpl: FetchLike = fetch,
): ChallengeSubmissionArchiveDeletionClient {
  return {
    async delete({submissionId, archiveReference}): Promise<void> {
      const key = objectKey(submissionId);
      const expectedReference = `r2://${options.r2Bucket}/${key}`;
      if (archiveReference !== expectedReference) throw new Error('challenge_archive_delete_reference_invalid');

      let response: Response;
      try {
        response = await fetchImpl(
          `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.r2AccountId)}/r2/buckets/${encodeURIComponent(options.r2Bucket)}/objects/${encodedObjectKey(key)}`,
          {
            method: 'DELETE',
            headers: {authorization: `Bearer ${options.r2ApiToken}`},
          },
        );
      } catch {
        throw new Error('challenge_archive_delete_network_unavailable');
      }
      if (response.status === 404) return;
      if (!response.ok) throw new Error('challenge_archive_delete_failed');

      const body = await response.text();
      if (!body.trim()) return;
      try {
        const envelope = JSON.parse(body) as {success?: unknown};
        if (envelope.success === false) throw new Error('challenge_archive_delete_failed');
      } catch (error) {
        if (error instanceof Error && error.message === 'challenge_archive_delete_failed') throw error;
        throw new Error('challenge_archive_delete_receipt_invalid');
      }
    },
  };
}
