import {sql, type Kysely} from 'kysely';
import {CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE} from './challenge-archive.js';
import type {DatabaseSchema} from './database.js';

export interface RestoredPrivacyRetentionReport {
  schema_version: 'inkubator.restore-privacy-retention-report/1.0';
  purge_event_count: number;
  purged_archive_count: number;
  violations: string[];
}

type PurgeRow = {
  submission_id: string | null;
  status: string | null;
  source_reference: string | null;
  archive_reference: string | null;
  source_count: number;
};

function violation(violations: string[], code: string, id: string | null): void {
  violations.push(`${code}:${id ?? 'null'}`);
}

export async function verifyRestoredPrivacyRetention(
  db: Kysely<DatabaseSchema>,
): Promise<RestoredPrivacyRetentionReport> {
  const purgeRows = (await sql<PurgeRow>`
    select
      h.subject_id as submission_id,
      a.status,
      a.source_reference,
      a.archive_reference,
      (
        select count(*)::int
        from challenge_submission_archive_sources s
        where s.submission_id = h.subject_id
      ) as source_count
    from history_events h
    left join challenge_submission_archives a on a.submission_id = h.subject_id
    where h.event_type = 'challenge.submission_private_material.purged'
    order by h.subject_id
  `.execute(db)).rows;

  const purgeIds = new Set<string>();
  const violations: string[] = [];
  for (const row of purgeRows) {
    if (!row.submission_id) {
      violation(violations, 'privacy_purge_event_subject_missing', row.submission_id);
      continue;
    }
    purgeIds.add(row.submission_id);
    if (row.source_reference === null) {
      violation(violations, 'privacy_purge_archive_missing', row.submission_id);
      continue;
    }
    if (row.source_reference !== CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE) {
      violation(violations, 'privacy_source_reference_resurrected', row.submission_id);
    }
    if (row.status === 'CAPTURED') {
      if (row.archive_reference !== CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE) {
        violation(violations, 'privacy_archive_reference_resurrected', row.submission_id);
      }
    } else if (row.archive_reference !== null) {
      violation(violations, 'privacy_unexpected_archive_reference_after_purge', row.submission_id);
    }
    if (Number(row.source_count) !== 0) {
      violation(violations, 'privacy_frozen_source_resurrected', row.submission_id);
    }
  }

  const markedArchives = (await sql<{submission_id: string}>`
    select submission_id
    from challenge_submission_archives
    where source_reference = ${CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE}
       or archive_reference = ${CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE}
    order by submission_id
  `.execute(db)).rows;
  for (const row of markedArchives) {
    if (!purgeIds.has(row.submission_id)) {
      violation(violations, 'privacy_purge_tombstone_event_missing', row.submission_id);
    }
  }

  const report: RestoredPrivacyRetentionReport = {
    schema_version: 'inkubator.restore-privacy-retention-report/1.0',
    purge_event_count: purgeRows.length,
    purged_archive_count: markedArchives.length,
    violations,
  };
  if (violations.length > 0) throw new Error(`restore_privacy_invalid:${violations.join(',')}`);
  return report;
}
