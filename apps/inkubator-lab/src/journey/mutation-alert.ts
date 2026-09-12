import {InkubatorApiError} from '../generated/inkubator-api-client';

/**
 * Fail-closed mutation error rendering. Server response is canonical:
 * a rejected mutation never reads as success, and authorization failures
 * are named as UNAUTHORIZED instead of raw transport noise.
 */
export function mutationAlert(error: unknown): string {
  if (error instanceof InkubatorApiError && [401, 403].includes(error.status)) {
    return `UNAUTHORIZED / Server rejected the mutation (${error.message}). No record changed.`;
  }
  return error instanceof Error ? error.message : 'MUTATION FAILED';
}
