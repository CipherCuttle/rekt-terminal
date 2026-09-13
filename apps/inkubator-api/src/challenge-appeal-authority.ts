import {
  appendAppealEvent,
  assertFrozenBuildContract,
  computeQualification,
  type BuildContract,
  type QualificationCriterionResult,
  type QualificationOverall,
} from '@rekt-ink/protocol/challenge';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import {readDatabaseNow, type DatabaseSchema} from './database.js';
import {appendHistoryEvent, HISTORY_EVENT_VERSION} from './events.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ChallengeAppealRow {
  appeal_id: string;
  challenge_id: string;
  entry_id: string;
  qualification_id: string;
  appeal_json: unknown;
  appeal_digest: string;
  created_at: Date;
}

export interface ChallengeAppealResolutionRow {
  resolution_id: string;
  appeal_id: string;
  effective_qualification_id: string;
  resolver_player_id: string;
  resolution_json: unknown;
  resolution_digest: string;
  created_at: Date;
}

type ChallengeAuthorityRow = {
  challenge_id: string;
  organizer_player_id: string;
  status: string;
  current_contract_version: string | null;
  current_terms_digest: string | null;
  appeal_opened_at: Date | null;
  appeal_window_ms: string;
};

type ContractRow = {terms_digest: string; contract_json: unknown};
type EntryRow = {entry_id: string; challenge_id: string; builder_player_id: string};
type QualificationRow = {
  qualification_id: string;
  challenge_id: string;
  entry_id: string;
  submission_id: string;
  terms_digest: string;
  qualification_version: string;
  result: QualificationOverall;
  qualification_json: unknown;
  created_at: Date;
};

export interface RecordChallengeAppealInput {
  requestId: string;
  appealId: string;
  challengeId: string;
  entryId: string;
  actorPlayerId: string;
  reason: string;
  evidenceRefs?: string[];
}

export interface ResolveChallengeAppealInput {
  requestId: string;
  resolutionId: string;
  appealId: string;
  challengeId: string;
  resolverPlayerId: string;
  qualificationId: string;
  qualificationVersion: string;
  criterionResults: Array<{criterion_id: string; result: QualificationCriterionResult; evidence_refs?: string[]}>;
  reason?: string;
  evidenceRefs?: string[];
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${label}`);
  return value.toLowerCase();
}

function text(value: unknown, label: string, max = 2000): string {
  if (typeof value !== 'string') throw new Error(`invalid_${label}`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) throw new Error(`invalid_${label}`);
  return normalized;
}

function refs(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('invalid_evidence_refs');
  return value.map((item, index) => text(item, `evidence_ref_${index}`, 2048));
}

async function challengeForUpdate(db: Kysely<DatabaseSchema>, challengeId: string): Promise<ChallengeAuthorityRow> {
  const row = (await sql<ChallengeAuthorityRow>`
    select challenge_id, organizer_player_id, status, current_contract_version,
           current_terms_digest, appeal_opened_at, appeal_window_ms
    from challenges where challenge_id = ${challengeId} for update
  `.execute(db)).rows[0];
  if (!row) throw new Error('challenge_not_found');
  return row;
}

async function contractFor(db: Kysely<DatabaseSchema>, challenge: ChallengeAuthorityRow): Promise<BuildContract> {
  if (!challenge.current_contract_version || !challenge.current_terms_digest) throw new Error('challenge_contract_not_frozen');
  const row = (await sql<ContractRow>`
    select terms_digest, contract_json from challenge_contract_versions
    where challenge_id = ${challenge.challenge_id}
      and contract_version = ${challenge.current_contract_version}
  `.execute(db)).rows[0];
  if (!row || row.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_contract_pointer_invalid');
  return assertFrozenBuildContract(row.contract_json);
}

async function firstPassQualification(db: Kysely<DatabaseSchema>, challengeId: string, entryId: string): Promise<QualificationRow> {
  const row = (await sql<QualificationRow>`
    select qualification.*
    from challenge_qualifications qualification
    join challenge_submissions submission on submission.submission_id = qualification.submission_id
    where qualification.challenge_id = ${challengeId}
      and qualification.entry_id = ${entryId}
      and submission.is_final = true
    order by qualification.created_at, qualification.qualification_id
    limit 1
  `.execute(db)).rows[0];
  if (!row) throw new Error('challenge_first_pass_qualification_missing');
  return row;
}

async function commandReplay(
  db: Kysely<DatabaseSchema>,
  dedupeKey: string,
  eventType: string,
  actorPlayerId: string,
  challengeId: string,
  payload: unknown,
): Promise<boolean> {
  const existing = await db.selectFrom('history_events').selectAll().where('dedupe_key', '=', dedupeKey).executeTakeFirst();
  if (!existing) return false;
  const normalized = canonicalizeJson(payload);
  if (
    existing.event_family !== 'activity' ||
    existing.event_version !== HISTORY_EVENT_VERSION ||
    existing.event_type !== eventType ||
    existing.payload_hash !== normalized.sha256 ||
    existing.actor_player_id !== actorPlayerId ||
    existing.subject_type !== 'challenge' ||
    existing.subject_id !== challengeId
  ) throw new Error(`history_event_idempotency_conflict:${dedupeKey}`);
  return true;
}

export async function recordChallengeAppeal(
  db: Kysely<DatabaseSchema>,
  input: RecordChallengeAppealInput,
): Promise<ChallengeAppealRow> {
  const requestId = uuid(input.requestId, 'request_id');
  const appealId = uuid(input.appealId, 'appeal_id');
  const challengeId = uuid(input.challengeId, 'challenge_id');
  const entryId = uuid(input.entryId, 'entry_id');
  const actorPlayerId = uuid(input.actorPlayerId, 'actor_player_id');
  const appealEvent = {type: 'APPEAL', reason: text(input.reason, 'appeal_reason'), evidence_refs: refs(input.evidenceRefs)};
  appendAppealEvent([], appealEvent);
  const normalized = canonicalizeJson(appealEvent);
  const payload = {request_id: requestId, appeal_id: appealId, challenge_id: challengeId, entry_id: entryId, appeal_digest: normalized.sha256};
  const dedupeKey = `activity:challenge.appeal.recorded:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeForUpdate(transaction, challengeId);
    if (challenge.status !== 'APPEAL_WINDOW' || !challenge.appeal_opened_at) throw new Error('challenge_appeal_window_not_open');
    const now = await readDatabaseNow(transaction);
    const closesAt = challenge.appeal_opened_at.getTime() + Number(challenge.appeal_window_ms);
    if (now.getTime() >= closesAt) throw new Error('challenge_appeal_window_closed');
    const entry = (await sql<EntryRow>`select entry_id, challenge_id, builder_player_id from challenge_entries where entry_id = ${entryId}`.execute(transaction)).rows[0];
    if (!entry || entry.challenge_id !== challengeId) throw new Error('challenge_entry_not_found');
    if (entry.builder_player_id !== actorPlayerId) throw new Error('challenge_appeal_builder_authority_required');
    const qualification = await firstPassQualification(transaction, challengeId, entryId);
    if (qualification.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_appeal_qualification_lineage_invalid');

    if (await commandReplay(transaction, dedupeKey, 'challenge.appeal.recorded', actorPlayerId, challengeId, payload)) {
      const replay = (await sql<ChallengeAppealRow>`select * from challenge_appeals where appeal_id = ${appealId}`.execute(transaction)).rows[0];
      if (!replay) throw new Error('challenge_appeal_replay_missing');
      return replay;
    }

    const inserted = await sql<ChallengeAppealRow>`
      insert into challenge_appeals (appeal_id, challenge_id, entry_id, qualification_id, appeal_json, appeal_digest)
      values (${appealId}, ${challengeId}, ${entryId}, ${qualification.qualification_id}, ${normalized.value}::jsonb, ${normalized.sha256})
      returning *
    `.execute(transaction);
    const row = inserted.rows[0];
    if (!row) throw new Error('challenge_appeal_create_failed');
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'challenge.appeal.recorded', dedupeKey,
      actorPlayerId, subjectType: 'challenge', subjectId: challengeId, payload,
    });
    return row;
  });
}

export async function resolveChallengeAppeal(
  db: Kysely<DatabaseSchema>,
  input: ResolveChallengeAppealInput,
): Promise<ChallengeAppealResolutionRow> {
  const requestId = uuid(input.requestId, 'request_id');
  const resolutionId = uuid(input.resolutionId, 'resolution_id');
  const appealId = uuid(input.appealId, 'appeal_id');
  const challengeId = uuid(input.challengeId, 'challenge_id');
  const resolverPlayerId = uuid(input.resolverPlayerId, 'resolver_player_id');
  const qualificationId = uuid(input.qualificationId, 'qualification_id');
  const qualificationVersion = text(input.qualificationVersion, 'qualification_version', 120);
  const evidenceRefs = refs(input.evidenceRefs);
  const reason = input.reason === undefined ? undefined : text(input.reason, 'resolution_reason');
  const dedupeKey = `activity:challenge.appeal.resolved:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeForUpdate(transaction, challengeId);
    if (challenge.status !== 'APPEAL_WINDOW') throw new Error('challenge_appeal_resolution_lifecycle_invalid');
    if (challenge.organizer_player_id !== resolverPlayerId) throw new Error('challenge_appeal_resolution_authority_invalid');
    const appeal = (await sql<ChallengeAppealRow>`
      select * from challenge_appeals where appeal_id = ${appealId} and challenge_id = ${challengeId} for update
    `.execute(transaction)).rows[0];
    if (!appeal) throw new Error('challenge_appeal_not_found');
    const existingResolution = (await sql<ChallengeAppealResolutionRow>`select * from challenge_appeal_resolutions where appeal_id = ${appealId}`.execute(transaction)).rows[0];

    const contract = await contractFor(transaction, challenge);
    const qualification = computeQualification(contract, input.criterionResults);
    const normalizedQualification = canonicalizeJson(qualification);
    const resolutionResult = qualification.overall === 'QUALIFIED'
      ? 'PASS'
      : qualification.overall === 'NOT_QUALIFIED'
        ? 'FAIL'
        : 'DISPUTED';
    const resolutionEvent = {
      type: 'RESOLUTION',
      result: resolutionResult,
      ...(reason === undefined ? {} : {reason}),
      evidence_refs: evidenceRefs,
      resolver_id: resolverPlayerId,
    };
    appendAppealEvent([appeal.appeal_json], resolutionEvent);
    const normalizedResolution = canonicalizeJson(resolutionEvent);
    const payload = {
      request_id: requestId,
      resolution_id: resolutionId,
      appeal_id: appealId,
      challenge_id: challengeId,
      qualification_id: qualificationId,
      qualification_version: qualificationVersion,
      qualification_digest: normalizedQualification.sha256,
      resolution_digest: normalizedResolution.sha256,
    };

    if (await commandReplay(transaction, dedupeKey, 'challenge.appeal.resolved', resolverPlayerId, challengeId, payload)) {
      if (!existingResolution) throw new Error('challenge_appeal_resolution_replay_missing');
      return existingResolution;
    }
    if (existingResolution) throw new Error('challenge_appeal_resolution_already_recorded');

    const firstPass = await firstPassQualification(transaction, challengeId, appeal.entry_id);
    if (firstPass.qualification_id !== appeal.qualification_id) throw new Error('challenge_appeal_first_pass_lineage_invalid');
    if (firstPass.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_appeal_qualification_lineage_invalid');

    const revised = await sql<QualificationRow>`
      insert into challenge_qualifications (
        qualification_id, challenge_id, entry_id, submission_id, terms_digest,
        qualification_version, result, qualification_json
      ) values (
        ${qualificationId}, ${challengeId}, ${appeal.entry_id}, ${firstPass.submission_id}, ${firstPass.terms_digest},
        ${qualificationVersion}, ${qualification.overall}, ${normalizedQualification.value}::jsonb
      )
      returning *
    `.execute(transaction);
    if (!revised.rows[0]) throw new Error('challenge_appeal_revised_qualification_create_failed');

    const inserted = await sql<ChallengeAppealResolutionRow>`
      insert into challenge_appeal_resolutions (
        resolution_id, appeal_id, effective_qualification_id, resolver_player_id, resolution_json, resolution_digest
      ) values (
        ${resolutionId}, ${appealId}, ${qualificationId}, ${resolverPlayerId}, ${normalizedResolution.value}::jsonb, ${normalizedResolution.sha256}
      )
      returning *
    `.execute(transaction);
    const row = inserted.rows[0];
    if (!row) throw new Error('challenge_appeal_resolution_create_failed');
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'challenge.appeal.resolved', dedupeKey,
      actorPlayerId: resolverPlayerId, subjectType: 'challenge', subjectId: challengeId, payload,
    });
    return row;
  });
}
