import {InkubatorApiError} from '../generated/inkubator-api-client';

// String ownership: the Inkubator API owns this error code. It is produced
// server-side as HTTP 404 with body {error: 'active_mission_not_found'}
// (apps/inkubator-api/src/app.ts, `error(reply, 404, 'active_mission_not_found')`),
// and the generated client surfaces that body field verbatim as
// InkubatorApiError.message. This module is the single client-side gate for
// that contract: call sites must use isActiveMissionNotFound, never match the
// raw message string directly.
export const ACTIVE_MISSION_NOT_FOUND = 'active_mission_not_found';

export function isActiveMissionNotFound(error: unknown): boolean {
  return error instanceof InkubatorApiError && error.status === 404 && error.message === ACTIVE_MISSION_NOT_FOUND;
}
