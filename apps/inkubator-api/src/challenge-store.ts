import {randomUUID} from 'node:crypto';
import {
  applyFinalizedSettlementFact,
  assertFrozenBuildContract,
  assertSettlementIntentMatchesContract,
  assertSubmissionManifest,
  buildSettlementIntent,
  computeDefaultResolution,
  computeQualification,
  isSubmissionEligible,
  selectFinalSubmission,
  transitionChallenge,
  validateSelection,
  type BuildContract,
  type QualificationCriterionResult,
  type QualificationOverall,
  type SettlementExecutionFact,
  type SettlementIntent,
  type SubmissionManifest,
} from '@rekt-ink/protocol/challenge';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import {readDatabaseNow, type DatabaseSchema} from './database.js';
import {appendHistoryEvent, HISTORY_EVENT_VERSION} from './events.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SUPPORTED_DECISION_TYPES = new Set([
  'FINAL_QUALIFIERS',
  'SELECTION',
  'DEFAULT_RESOLUTION',
  'SETTLEMENT_INTENT',
  'SETTLEMENT_EXECUTION_FACT',
]);

export type ChallengeStatus =
  | 'DRAFT' | 'AWAITING_FUNDING' | 'FUNDED' | 'ENTRY_OPEN' | 'NOT_ACTIVATED'
  | 'BUILDING' | 'SUBMISSIONS_LOCKED' | 'QUALIFICATION' | 'APPEAL_WINDOW'
  | 'FINAL_QUALIFIERS' | 'SELECTION' | 'DEFAULT_RESOLUTION'
  | 'SETTLEMENT_PENDING' | 'SETTLED' | 'RECEIPT_FILED';

export type ChallengeEntryState = 'SEATED' | 'WITHDRAWN_PRE_BUILD' | 'ACTIVE' | 'SUBMITTED' | 'INVALID_SUBMISSION' | 'ABANDONED';
export type QualificationResult = QualificationOverall;

export interface ChallengeRow {
  challenge_id: string;
  organizer_player_id: string;
  organizer_payout_identity: string | null;
  funder_payout_identity: string | null;
  status: ChallengeStatus;
  mechanism_version: string;
  settlement_policy_version: string;
  ip_terms_version: string;
  current_contract_version: string | null;
  current_terms_digest: string | null;
  slot_limit: number;
  activation_minimum: number;
  entry_deadline: Date;
  build_start: Date;
  submission_deadline: Date;
  appeal_window_ms: string;
  review_deadline: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ChallengeContractVersionRow {
  challenge_id: string;
  contract_version: string;
  schema_version: string;
  terms_digest: string;
  contract_json: unknown;
  frozen_at: Date;
}

export interface ChallengeEntryRow {
  entry_id: string;
  challenge_id: string;
  builder_player_id: string;
  project_id: string | null;
  mission_id: string | null;
  payout_identity: string;
  state: ChallengeEntryState;
  build_start: Date | null;
  submission_deadline: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChallengeSubmissionRow {
  submission_id: string;
  challenge_id: string;
  entry_id: string;
  submission_version: string;
  terms_digest: string;
  manifest_json: unknown;
  manifest_digest: string;
  ship_submission_id: string | null;
  accepted_at: Date;
  is_final: boolean;
  created_at: Date;
}

export interface ChallengeQualificationRow {
  qualification_id: string;
  challenge_id: string;
  entry_id: string;
  submission_id: string;
  terms_digest: string;
  qualification_version: string;
  result: QualificationResult;
  qualification_json: unknown;
  created_at: Date;
}

export interface ChallengeDecisionRow {
  decision_id: string;
  challenge_id: string;
  entry_id: string | null;
  decision_type: string;
  decision_version: string;
  decision_json: unknown;
  decision_digest: string;
  created_at: Date;
}

export interface ChallengeReceiptRow {
  receipt_id: string;
  protocol_receipt_id: string;
  challenge_id: string;
  terms_digest: string;
  receipt_version: string;
  receipt_json: unknown;
  receipt_digest: string;
  ship_receipt_id: string | null;
  supersedes_receipt_id: string | null;
  created_at: Date;
}

export interface CreateChallengeInput {
  requestId: string;
  challengeId: string;
  organizerPlayerId: string;
  organizerPayoutIdentity: string;
  funderPayoutIdentity: string;
  mechanismVersion: string;
  settlementPolicyVersion: string;
  ipTermsVersion: string;
  slotLimit: number;
  activationMinimum: number;
  entryDeadlineMs: number;
  buildStartMs: number;
  submissionDeadlineMs: number;
  appealWindowMs: number;
  reviewDeadlineMs: number;
}

export interface PersistFrozenContractInput {
  requestId: string;
  actorPlayerId: string;
  challengeId: string;
  contract: unknown;
}

export interface AcquireSeatInput {
  requestId: string;
  entryId: string;
  challengeId: string;
  builderPlayerId: string;
  payoutIdentity: string;
  projectId?: string | null;
  missionId?: string | null;
}

export interface AcceptSubmissionInput {
  requestId: string;
  submissionId: string;
  challengeId: string;
  entryId: string;
  manifest: unknown;
  shipSubmissionId?: string | null;
}

export interface MarkFinalSubmissionInput {
  requestId: string;
  challengeId: string;
  entryId: string;
  submissionId: string;
}

export interface RecordQualificationInput {
  requestId: string;
  qualificationId: string;
  challengeId: string;
  entryId: string;
  submissionId: string;
  qualificationVersion: string;
  criterionResults: Array<{criterion_id: string; result: QualificationCriterionResult; evidence_refs?: string[]}>;
}

export interface RecordDecisionInput {
  requestId: string;
  decisionId: string;
  challengeId: string;
  entryId?: string | null;
  decisionType: string;
  decisionVersion: string;
  decision: unknown;
}

function requireUuid(value: unknown, name: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${name}`);
  return value.toLowerCase();
}

function requireDigest(value: unknown, name: string): string {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) throw new Error(`invalid_${name}`);
  return value;
}

function requireText(value: unknown, name: string, maxLength = 256): string {
  if (typeof value !== 'string') throw new Error(`invalid_${name}`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) throw new Error(`invalid_${name}`);
  return normalized;
}

function requireSafeMs(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid_${name}`);
  return value;
}

function requirePositiveSafeInt(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`invalid_${name}`);
  return value;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`invalid_${label}`);
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(`invalid_${label}`);
}

function withoutTermsDigest(contract: Record<string, unknown>): Record<string, unknown> {
  const payload = {...contract};
  delete payload.terms_digest;
  return payload;
}

async function existingCommand(
  db: Kysely<DatabaseSchema>,
  dedupeKey: string,
  eventType: string,
  actorPlayerId: string,
  subjectType: string,
  subjectId: string,
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
    existing.subject_type !== subjectType ||
    existing.subject_id !== subjectId
  ) throw new Error(`history_event_idempotency_conflict:${dedupeKey}`);
  return true;
}

async function challengeById(db: Kysely<DatabaseSchema>, challengeId: string, forUpdate = false): Promise<ChallengeRow | null> {
  const suffix = forUpdate ? sql` for update` : sql``;
  const result = await sql<ChallengeRow>`select * from challenges where challenge_id = ${challengeId}${suffix}`.execute(db);
  return result.rows[0] ?? null;
}

async function contractForChallenge(db: Kysely<DatabaseSchema>, challenge: ChallengeRow): Promise<BuildContract> {
  if (!challenge.current_contract_version || !challenge.current_terms_digest) throw new Error('challenge_contract_not_frozen');
  const row = (await sql<ChallengeContractVersionRow>`
    select * from challenge_contract_versions
    where challenge_id = ${challenge.challenge_id} and contract_version = ${challenge.current_contract_version}
  `.execute(db)).rows[0];
  if (!row || row.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_contract_pointer_invalid');
  return assertFrozenBuildContract(row.contract_json);
}

async function entryById(db: Kysely<DatabaseSchema>, entryId: string): Promise<ChallengeEntryRow | null> {
  const result = await sql<ChallengeEntryRow>`select * from challenge_entries where entry_id = ${entryId}`.execute(db);
  return result.rows[0] ?? null;
}

function challengeContractAuthorityMatches(challenge: ChallengeRow, contract: BuildContract): boolean {
  const durable = {
    mechanism_version: challenge.mechanism_version,
    settlement_policy_version: challenge.settlement_policy_version,
    ip_terms_version: challenge.ip_terms_version,
    slot_limit: challenge.slot_limit,
    activation_minimum: challenge.activation_minimum,
    entry_deadline: challenge.entry_deadline.getTime(),
    build_start: challenge.build_start.getTime(),
    submission_deadline: challenge.submission_deadline.getTime(),
    appeal_window_ms: Number(challenge.appeal_window_ms),
    review_deadline: challenge.review_deadline.getTime(),
  };
  const frozen = {
    mechanism_version: contract.mechanism_version,
    settlement_policy_version: contract.settlement_policy_version,
    ip_terms_version: contract.ip_terms_version,
    slot_limit: contract.slot_limit,
    activation_minimum: contract.activation_minimum,
    entry_deadline: contract.entry_deadline,
    build_start: contract.build_start,
    submission_deadline: contract.submission_deadline,
    appeal_window_ms: contract.appeal_window_ms,
    review_deadline: contract.review_deadline,
  };
  return canonicalizeJson(durable).sha256 === canonicalizeJson(frozen).sha256;
}

function finalQualifierIdsFromDecision(value: unknown): string[] {
  const decision = objectValue(value, 'final_qualifiers_decision');
  assertExactKeys(decision, ['final_qualifier_ids'], 'final_qualifiers_decision');
  if (!Array.isArray(decision.final_qualifier_ids)) throw new Error('invalid_final_qualifiers_decision');
  const ids = decision.final_qualifier_ids.map((value, index) => requireUuid(value, `final_qualifier_ids_${index}`));
  if (new Set(ids).size !== ids.length) throw new Error('invalid_final_qualifiers_decision');
  return ids;
}

async function decisionRows(db: Kysely<DatabaseSchema>, challengeId: string, decisionType: string): Promise<ChallengeDecisionRow[]> {
  return (await sql<ChallengeDecisionRow>`
    select * from challenge_decisions
    where challenge_id = ${challengeId} and decision_type = ${decisionType}
    order by created_at desc, decision_id desc
  `.execute(db)).rows;
}

async function storedFinalQualifierIds(db: Kysely<DatabaseSchema>, challenge: ChallengeRow, contract: BuildContract): Promise<string[]> {
  const row = (await decisionRows(db, challenge.challenge_id, 'FINAL_QUALIFIERS'))[0];
  if (!row) throw new Error('challenge_final_qualifiers_required');
  const ids = finalQualifierIdsFromDecision(row.decision_json);
  computeDefaultResolution(ids, contract.prize_minor_units);
  return ids;
}

async function payoutIdentityByEntryIds(
  db: Kysely<DatabaseSchema>,
  challengeId: string,
  entryIds: string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entryId of entryIds) {
    const entry = await entryById(db, entryId);
    if (!entry || entry.challenge_id !== challengeId) throw new Error('challenge_decision_entry_mismatch');
    result[entryId] = entry.payout_identity;
  }
  return result;
}

function requireReservedPayoutAuthority(challenge: ChallengeRow): {organizer: string; funder: string} {
  if (!challenge.organizer_payout_identity || !challenge.funder_payout_identity) throw new Error('challenge_reserved_payout_identity_missing');
  return {organizer: challenge.organizer_payout_identity, funder: challenge.funder_payout_identity};
}

async function validateSettlementIntent(
  db: Kysely<DatabaseSchema>,
  challenge: ChallengeRow,
  contract: BuildContract,
  entryId: string | null,
  decisionInput: unknown,
): Promise<SettlementIntent> {
  const intent = assertSettlementIntentMatchesContract(
    contract,
    objectValue(decisionInput, 'settlement_intent') as unknown as SettlementIntent,
  );
  const reserved = requireReservedPayoutAuthority(challenge);

  if (intent.type === 'WINNER_PAYOUT') {
    if (!intent.winner_entry_id) throw new Error('challenge_settlement_intent_resolution_mismatch');
    const finalQualifierIds = await storedFinalQualifierIds(db, challenge, contract);
    validateSelection(intent.winner_entry_id, finalQualifierIds);
    const selection = (await decisionRows(db, challenge.challenge_id, 'SELECTION'))[0];
    if (selection) {
      const selected = requireUuid(objectValue(selection.decision_json, 'selection_decision').selected_entry_id, 'selected_entry_id');
      if (selected !== intent.winner_entry_id) throw new Error('challenge_settlement_intent_resolution_mismatch');
    } else if (finalQualifierIds.length !== 1 || finalQualifierIds[0] !== intent.winner_entry_id) {
      throw new Error('challenge_settlement_intent_resolution_mismatch');
    }
    const recipientByEntryId = await payoutIdentityByEntryIds(db, challenge.challenge_id, [intent.winner_entry_id]);
    const expected = buildSettlementIntent({
      contract,
      resolution: {
        type: 'WINNER_PAYOUT',
        winner_entry_id: intent.winner_entry_id,
        distributions: [{entry_id: intent.winner_entry_id, amount_minor_units: contract.prize_minor_units}],
      },
      recipientByEntryId,
    });
    if (canonicalizeJson(expected).sha256 !== canonicalizeJson(intent).sha256) throw new Error('challenge_settlement_intent_resolution_mismatch');
    if (entryId !== intent.winner_entry_id) throw new Error('challenge_decision_entry_mismatch');
    return intent;
  }

  if (entryId !== null) throw new Error('challenge_decision_entry_mismatch');

  if (intent.type === 'DEFAULT_DISTRIBUTION') {
    const finalQualifierIds = await storedFinalQualifierIds(db, challenge, contract);
    const resolution = computeDefaultResolution(finalQualifierIds, contract.prize_minor_units);
    if (resolution.type !== 'DEFAULT_DISTRIBUTION') throw new Error('challenge_settlement_intent_resolution_mismatch');
    const recipientByEntryId = await payoutIdentityByEntryIds(db, challenge.challenge_id, finalQualifierIds);
    const expected = buildSettlementIntent({contract, resolution, recipientByEntryId});
    if (canonicalizeJson(expected).sha256 !== canonicalizeJson(intent).sha256) throw new Error('challenge_settlement_intent_resolution_mismatch');
    return intent;
  }

  if (intent.type === 'REFUND_NO_QUALIFIER') {
    const finalQualifierIds = await storedFinalQualifierIds(db, challenge, contract);
    const resolution = computeDefaultResolution(finalQualifierIds, contract.prize_minor_units);
    if (resolution.type !== 'REFUND_NO_QUALIFIER') throw new Error('challenge_settlement_intent_resolution_mismatch');
    const expected = buildSettlementIntent({contract, resolution, refundRecipientId: reserved.funder});
    if (canonicalizeJson(expected).sha256 !== canonicalizeJson(intent).sha256) throw new Error('challenge_settlement_intent_resolution_mismatch');
    return intent;
  }

  if (intent.type === 'REFUND_PRE_BUILD') {
    const expected = buildSettlementIntent({
      contract,
      resolution: {type: 'REFUND_PRE_BUILD', winner_entry_id: null, distributions: []},
      refundRecipientId: reserved.funder,
    });
    if (canonicalizeJson(expected).sha256 !== canonicalizeJson(intent).sha256) throw new Error('challenge_settlement_intent_resolution_mismatch');
    transitionChallenge(
      {challenge_id: challenge.challenge_id, status: challenge.status, contract},
      'SETTLEMENT_PENDING',
      {settlementIntent: intent, refundRecipientId: reserved.funder},
    );
    return intent;
  }

  if (intent.type === 'CANCELLED_BY_RESOLUTION') {
    throw new Error('challenge_cancelled_by_resolution_authority_missing');
  }

  throw new Error('challenge_settlement_intent_resolution_mismatch');
}

async function validateExecutionFact(
  db: Kysely<DatabaseSchema>,
  challenge: ChallengeRow,
  entryId: string | null,
  decisionInput: unknown,
): Promise<SettlementExecutionFact> {
  const fact = objectValue(decisionInput, 'settlement_execution_fact') as unknown as SettlementExecutionFact;
  const intents = await decisionRows(db, challenge.challenge_id, 'SETTLEMENT_INTENT');
  if (intents.length === 0) throw new Error('challenge_settlement_intent_required');

  for (const row of intents) {
    try {
      const intent = row.decision_json as SettlementIntent;
      const normalized = applyFinalizedSettlementFact(intent, fact);
      if (entryId !== (intent.winner_entry_id ?? null)) throw new Error('challenge_decision_entry_mismatch');
      return normalized;
    } catch (error) {
      if (error instanceof Error && error.message === 'challenge_decision_entry_mismatch') throw error;
    }
  }
  throw new Error('challenge_settlement_execution_fact_mismatch');
}

async function validateDecisionForPersistence(
  db: Kysely<DatabaseSchema>,
  challenge: ChallengeRow,
  entryId: string | null,
  decisionType: string,
  decisionInput: unknown,
): Promise<unknown> {
  if (!SUPPORTED_DECISION_TYPES.has(decisionType)) throw new Error('challenge_decision_type_unsupported');
  const contract = await contractForChallenge(db, challenge);

  if (decisionType === 'FINAL_QUALIFIERS') {
    const finalQualifierIds = finalQualifierIdsFromDecision(decisionInput);
    computeDefaultResolution(finalQualifierIds, contract.prize_minor_units);
    if (entryId !== null) throw new Error('challenge_decision_entry_mismatch');
    for (const qualifierId of finalQualifierIds) {
      const entry = await entryById(db, qualifierId);
      if (!entry || entry.challenge_id !== challenge.challenge_id) throw new Error('challenge_decision_entry_mismatch');
    }
    return {final_qualifier_ids: finalQualifierIds};
  }

  if (decisionType === 'SELECTION') {
    const decision = objectValue(decisionInput, 'selection_decision');
    assertExactKeys(decision, ['selected_entry_id'], 'selection_decision');
    const selectedEntryId = requireUuid(decision.selected_entry_id, 'selected_entry_id');
    const finalQualifierIds = await storedFinalQualifierIds(db, challenge, contract);
    validateSelection(selectedEntryId, finalQualifierIds);
    if (entryId !== selectedEntryId) throw new Error('challenge_decision_entry_mismatch');
    return {selected_entry_id: selectedEntryId};
  }

  if (decisionType === 'DEFAULT_RESOLUTION') {
    const finalQualifierIds = await storedFinalQualifierIds(db, challenge, contract);
    const expected = computeDefaultResolution(finalQualifierIds, contract.prize_minor_units);
    if (canonicalizeJson(decisionInput).sha256 !== canonicalizeJson(expected).sha256) throw new Error('challenge_default_resolution_protocol_mismatch');
    if (entryId !== (expected.winner_entry_id ?? null)) throw new Error('challenge_decision_entry_mismatch');
    return expected;
  }

  if (decisionType === 'SETTLEMENT_INTENT') return validateSettlementIntent(db, challenge, contract, entryId, decisionInput);
  return validateExecutionFact(db, challenge, entryId, decisionInput);
}

export async function createChallenge(db: Kysely<DatabaseSchema>, input: CreateChallengeInput): Promise<ChallengeRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const organizerPlayerId = requireUuid(input.organizerPlayerId, 'organizer_player_id');
  const organizerPayoutIdentity = requireText(input.organizerPayoutIdentity, 'organizer_payout_identity');
  const funderPayoutIdentity = requireText(input.funderPayoutIdentity, 'funder_payout_identity');
  const mechanismVersion = requireText(input.mechanismVersion, 'mechanism_version', 120);
  const settlementPolicyVersion = requireText(input.settlementPolicyVersion, 'settlement_policy_version', 120);
  const ipTermsVersion = requireText(input.ipTermsVersion, 'ip_terms_version', 120);
  const slotLimit = requirePositiveSafeInt(input.slotLimit, 'slot_limit');
  const activationMinimum = requirePositiveSafeInt(input.activationMinimum, 'activation_minimum');
  const entryDeadlineMs = requireSafeMs(input.entryDeadlineMs, 'entry_deadline_ms');
  const buildStartMs = requireSafeMs(input.buildStartMs, 'build_start_ms');
  const submissionDeadlineMs = requireSafeMs(input.submissionDeadlineMs, 'submission_deadline_ms');
  const appealWindowMs = requirePositiveSafeInt(input.appealWindowMs, 'appeal_window_ms');
  const reviewDeadlineMs = requireSafeMs(input.reviewDeadlineMs, 'review_deadline_ms');
  const payload = {
    request_id: requestId,
    challenge_id: challengeId,
    organizer_player_id: organizerPlayerId,
    organizer_payout_identity: organizerPayoutIdentity,
    funder_payout_identity: funderPayoutIdentity,
    mechanism_version: mechanismVersion,
    settlement_policy_version: settlementPolicyVersion,
    ip_terms_version: ipTermsVersion,
    slot_limit: slotLimit,
    activation_minimum: activationMinimum,
    entry_deadline_ms: entryDeadlineMs,
    build_start_ms: buildStartMs,
    submission_deadline_ms: submissionDeadlineMs,
    appeal_window_ms: appealWindowMs,
    review_deadline_ms: reviewDeadlineMs,
  };
  const dedupeKey = `activity:challenge.created:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const inserted = await sql<ChallengeRow>`
      insert into challenges (
        challenge_id, organizer_player_id, organizer_payout_identity, funder_payout_identity,
        status, mechanism_version, settlement_policy_version, ip_terms_version,
        slot_limit, activation_minimum, entry_deadline, build_start, submission_deadline, appeal_window_ms, review_deadline
      ) values (
        ${challengeId}, ${organizerPlayerId}, ${organizerPayoutIdentity}, ${funderPayoutIdentity},
        'DRAFT', ${mechanismVersion}, ${settlementPolicyVersion}, ${ipTermsVersion},
        ${slotLimit}, ${activationMinimum}, ${new Date(entryDeadlineMs)}, ${new Date(buildStartMs)},
        ${new Date(submissionDeadlineMs)}, ${String(appealWindowMs)}, ${new Date(reviewDeadlineMs)}
      )
      on conflict (challenge_id) do nothing
      returning *
    `.execute(transaction);
    const challenge = inserted.rows[0] ?? await challengeById(transaction, challengeId, true);
    if (!challenge) throw new Error('challenge_create_failed');
    const existingShape = {
      challenge_id: challenge.challenge_id,
      organizer_player_id: challenge.organizer_player_id,
      organizer_payout_identity: challenge.organizer_payout_identity,
      funder_payout_identity: challenge.funder_payout_identity,
      mechanism_version: challenge.mechanism_version,
      settlement_policy_version: challenge.settlement_policy_version,
      ip_terms_version: challenge.ip_terms_version,
      slot_limit: challenge.slot_limit,
      activation_minimum: challenge.activation_minimum,
      entry_deadline_ms: challenge.entry_deadline.getTime(),
      build_start_ms: challenge.build_start.getTime(),
      submission_deadline_ms: challenge.submission_deadline.getTime(),
      appeal_window_ms: Number(challenge.appeal_window_ms),
      review_deadline_ms: challenge.review_deadline.getTime(),
    };
    const requestedShape = {...payload};
    delete (requestedShape as {request_id?: string}).request_id;
    if (canonicalizeJson(existingShape).sha256 !== canonicalizeJson(requestedShape).sha256) throw new Error('challenge_identity_conflict');
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'challenge.created', dedupeKey,
      actorPlayerId: organizerPlayerId, subjectType: 'challenge', subjectId: challengeId, payload,
    });
    return challenge;
  });
}

export async function persistFrozenBuildContract(
  db: Kysely<DatabaseSchema>,
  input: PersistFrozenContractInput,
): Promise<ChallengeContractVersionRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const actorPlayerId = requireUuid(input.actorPlayerId, 'actor_player_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const contract = objectValue(input.contract, 'contract');
  const protocolContract = assertFrozenBuildContract(contract);
  if (protocolContract.challenge_id !== challengeId) throw new Error('contract_challenge_mismatch');
  const contractVersion = requireText(protocolContract.contract_version, 'contract_version', 120);
  const schemaVersion = requireText(protocolContract.schema_version, 'schema_version', 120);
  const termsDigest = requireDigest(protocolContract.terms_digest, 'terms_digest');
  const computedDigest = canonicalizeJson(withoutTermsDigest(contract)).sha256;
  if (computedDigest !== termsDigest) throw new Error('contract_terms_digest_mismatch');
  const normalizedContract = canonicalizeJson(protocolContract);
  const payload = {request_id: requestId, challenge_id: challengeId, contract_version: contractVersion, terms_digest: termsDigest, contract_digest: normalizedContract.sha256};
  const dedupeKey = `activity:challenge.contract.frozen:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeById(transaction, challengeId, true);
    if (!challenge) throw new Error('challenge_not_found');
    if (challenge.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');
    if (!challengeContractAuthorityMatches(challenge, protocolContract)) throw new Error('contract_challenge_authority_mismatch');
    if (await existingCommand(transaction, dedupeKey, 'challenge.contract.frozen', actorPlayerId, 'challenge', challengeId, payload)) {
      const replay = await sql<ChallengeContractVersionRow>`select * from challenge_contract_versions where challenge_id = ${challengeId} and contract_version = ${contractVersion}`.execute(transaction);
      if (!replay.rows[0]) throw new Error('challenge_contract_replay_missing');
      return replay.rows[0];
    }
    if (challenge.current_contract_version && (challenge.current_contract_version !== contractVersion || challenge.current_terms_digest !== termsDigest)) throw new Error('challenge_contract_already_frozen');

    const inserted = await sql<ChallengeContractVersionRow>`
      insert into challenge_contract_versions (challenge_id, contract_version, schema_version, terms_digest, contract_json)
      values (${challengeId}, ${contractVersion}, ${schemaVersion}, ${termsDigest}, ${normalizedContract.value}::jsonb)
      on conflict (challenge_id, contract_version) do nothing
      returning *
    `.execute(transaction);
    const row = inserted.rows[0] ?? (await sql<ChallengeContractVersionRow>`select * from challenge_contract_versions where challenge_id = ${challengeId} and contract_version = ${contractVersion}`.execute(transaction)).rows[0];
    if (!row || row.terms_digest !== termsDigest) throw new Error('challenge_contract_immutable_conflict');
    const equality = await sql<{matches: boolean}>`
      select contract_json = ${normalizedContract.value}::jsonb as matches
      from challenge_contract_versions
      where challenge_id = ${challengeId} and contract_version = ${contractVersion}
    `.execute(transaction);
    if (equality.rows[0]?.matches !== true) throw new Error('challenge_contract_immutable_conflict');

    await sql`update challenges set current_contract_version = ${contractVersion}, current_terms_digest = ${termsDigest}, updated_at = clock_timestamp() where challenge_id = ${challengeId}`.execute(transaction);
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'challenge.contract.frozen', dedupeKey,
      actorPlayerId, subjectType: 'challenge', subjectId: challengeId, payload,
    });
    return row;
  });
}

export async function acquireChallengeSeat(db: Kysely<DatabaseSchema>, input: AcquireSeatInput): Promise<ChallengeEntryRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const entryId = requireUuid(input.entryId, 'entry_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const builderPlayerId = requireUuid(input.builderPlayerId, 'builder_player_id');
  const payoutIdentity = requireText(input.payoutIdentity, 'payout_identity');
  const projectId = input.projectId ? requireUuid(input.projectId, 'project_id') : null;
  const missionId = input.missionId ? requireUuid(input.missionId, 'mission_id') : null;
  const payload = {request_id: requestId, entry_id: entryId, challenge_id: challengeId, builder_player_id: builderPlayerId, payout_identity: payoutIdentity, project_id: projectId, mission_id: missionId};
  const dedupeKey = `activity:challenge.entry.seated:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeById(transaction, challengeId, true);
    if (!challenge) throw new Error('challenge_not_found');
    if (await existingCommand(transaction, dedupeKey, 'challenge.entry.seated', builderPlayerId, 'challenge', challengeId, payload)) {
      const replay = await entryById(transaction, entryId);
      if (!replay) throw new Error('challenge_entry_replay_missing');
      return replay;
    }
    if (challenge.status !== 'ENTRY_OPEN') throw new Error('challenge_entry_not_open');
    if (challenge.organizer_player_id === builderPlayerId) throw new Error('challenge_organizer_cannot_build');
    const reserved = requireReservedPayoutAuthority(challenge);
    if (payoutIdentity === reserved.organizer || payoutIdentity === reserved.funder) throw new Error('challenge_reserved_payout_identity_cannot_build');
    if (projectId) {
      const project = await transaction.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).executeTakeFirst();
      if (!project || project.owner_player_id !== builderPlayerId) throw new Error('challenge_project_not_owned');
    }
    if (missionId) {
      const mission = await transaction.selectFrom('missions').select(['mission_id', 'project_id', 'owner_player_id']).where('mission_id', '=', missionId).executeTakeFirst();
      if (!mission || mission.owner_player_id !== builderPlayerId || (projectId && mission.project_id !== projectId)) throw new Error('challenge_mission_lineage_invalid');
    }
    const count = await sql<{count: string}>`select count(*)::text as count from challenge_entries where challenge_id = ${challengeId} and state = 'SEATED'`.execute(transaction);
    if (Number(count.rows[0]?.count ?? '0') >= challenge.slot_limit) throw new Error('challenge_slot_limit_reached');

    try {
      const inserted = await sql<ChallengeEntryRow>`
        insert into challenge_entries (entry_id, challenge_id, builder_player_id, project_id, mission_id, payout_identity, state)
        values (${entryId}, ${challengeId}, ${builderPlayerId}, ${projectId}, ${missionId}, ${payoutIdentity}, 'SEATED')
        returning *
      `.execute(transaction);
      const row = inserted.rows[0];
      if (!row) throw new Error('challenge_entry_create_failed');
      await appendHistoryEvent(transaction, {
        eventFamily: 'activity', eventType: 'challenge.entry.seated', dedupeKey,
        actorPlayerId: builderPlayerId, subjectType: 'challenge', subjectId: challengeId, payload,
      });
      return row;
    } catch (error) {
      if ((error as {code?: unknown})?.code === '23505') throw new Error('challenge_entry_uniqueness_conflict');
      throw error;
    }
  });
}

export async function acceptChallengeSubmission(db: Kysely<DatabaseSchema>, input: AcceptSubmissionInput): Promise<ChallengeSubmissionRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const submissionId = requireUuid(input.submissionId, 'submission_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const entryId = requireUuid(input.entryId, 'entry_id');
  const shipSubmissionId = input.shipSubmissionId ? requireUuid(input.shipSubmissionId, 'ship_submission_id') : null;
  const requestedManifest = assertSubmissionManifest(objectValue(input.manifest, 'manifest') as unknown as SubmissionManifest);
  const submissionVersion = requireText(String(requestedManifest.submission_version), 'submission_version', 120);
  const termsDigest = requireDigest(requestedManifest.terms_digest, 'terms_digest');
  requireSafeMs(Number(requestedManifest.accepted_at), 'accepted_at');
  const requestManifestDigest = canonicalizeJson(requestedManifest).sha256;
  const payload = {request_id: requestId, submission_id: submissionId, challenge_id: challengeId, entry_id: entryId, submission_version: submissionVersion, terms_digest: termsDigest, request_manifest_digest: requestManifestDigest, ship_submission_id: shipSubmissionId};
  const dedupeKey = `activity:challenge.submission.accepted:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeById(transaction, challengeId, true);
    if (!challenge) throw new Error('challenge_not_found');
    const entry = await entryById(transaction, entryId);
    if (!entry || entry.challenge_id !== challengeId) throw new Error('challenge_entry_not_found');
    if (await existingCommand(transaction, dedupeKey, 'challenge.submission.accepted', entry.builder_player_id, 'challenge', challengeId, payload)) {
      const replay = await sql<ChallengeSubmissionRow>`select * from challenge_submissions where submission_id = ${submissionId}`.execute(transaction);
      if (!replay.rows[0]) throw new Error('challenge_submission_replay_missing');
      return replay.rows[0];
    }
    if (challenge.status !== 'BUILDING') throw new Error('challenge_not_building');
    const databaseNow = await readDatabaseNow(transaction);
    if (databaseNow.getTime() > challenge.submission_deadline.getTime()) throw new Error('challenge_submission_deadline_elapsed');
    const contract = await contractForChallenge(transaction, challenge);
    const manifest = assertSubmissionManifest({...requestedManifest, accepted_at: databaseNow.getTime()});
    if (!isSubmissionEligible(manifest, contract, entryId)) throw new Error('challenge_submission_protocol_ineligible');
    const normalizedManifest = canonicalizeJson(manifest);

    if (shipSubmissionId) {
      const ship = await transaction.selectFrom('ship_submissions').select(['submission_id', 'project_id', 'mission_id', 'owner_player_id']).where('submission_id', '=', shipSubmissionId).executeTakeFirst();
      if (!ship || ship.owner_player_id !== entry.builder_player_id || (entry.project_id && ship.project_id !== entry.project_id) || (entry.mission_id && ship.mission_id !== entry.mission_id)) throw new Error('challenge_ship_lineage_invalid');
    }

    const inserted = await sql<ChallengeSubmissionRow>`
      insert into challenge_submissions (submission_id, challenge_id, entry_id, submission_version, terms_digest, manifest_json, manifest_digest, ship_submission_id, accepted_at)
      values (${submissionId}, ${challengeId}, ${entryId}, ${submissionVersion}, ${termsDigest}, ${normalizedManifest.value}::jsonb, ${normalizedManifest.sha256}, ${shipSubmissionId}, ${databaseNow})
      on conflict (entry_id, submission_version) do nothing
      returning *
    `.execute(transaction);
    const row = inserted.rows[0] ?? (await sql<ChallengeSubmissionRow>`select * from challenge_submissions where entry_id = ${entryId} and submission_version = ${submissionVersion}`.execute(transaction)).rows[0];
    if (!row || row.manifest_digest !== normalizedManifest.sha256 || row.submission_id !== submissionId) throw new Error('challenge_submission_immutable_conflict');
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'challenge.submission.accepted', dedupeKey,
      actorPlayerId: entry.builder_player_id, subjectType: 'challenge', subjectId: challengeId, payload,
    });
    return row;
  });
}

export async function markFinalChallengeSubmission(db: Kysely<DatabaseSchema>, input: MarkFinalSubmissionInput): Promise<ChallengeSubmissionRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const entryId = requireUuid(input.entryId, 'entry_id');
  const submissionId = requireUuid(input.submissionId, 'submission_id');
  const payload = {request_id: requestId, challenge_id: challengeId, entry_id: entryId, submission_id: submissionId};
  const dedupeKey = `activity:challenge.submission.finalized:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeById(transaction, challengeId, true);
    if (!challenge) throw new Error('challenge_not_found');
    if (await existingCommand(transaction, dedupeKey, 'challenge.submission.finalized', challenge.organizer_player_id, 'challenge', challengeId, payload)) {
      const replay = await sql<ChallengeSubmissionRow>`select * from challenge_submissions where submission_id = ${submissionId}`.execute(transaction);
      if (!replay.rows[0]) throw new Error('challenge_submission_replay_missing');
      return replay.rows[0];
    }
    if (challenge.status !== 'SUBMISSIONS_LOCKED') throw new Error('challenge_submissions_not_locked');
    const entry = await entryById(transaction, entryId);
    if (!entry || entry.challenge_id !== challengeId) throw new Error('challenge_entry_not_found');
    const contract = await contractForChallenge(transaction, challenge);
    const rows = (await sql<ChallengeSubmissionRow>`
      select * from challenge_submissions
      where challenge_id = ${challengeId} and entry_id = ${entryId}
      order by accepted_at, submission_id
      for update
    `.execute(transaction)).rows;
    const selected = selectFinalSubmission(rows.map((row) => row.manifest_json as SubmissionManifest), contract, entryId);
    if (!selected) throw new Error('challenge_final_submission_missing');
    const selectedDigest = canonicalizeJson(selected).sha256;
    const selectedRow = rows.find((row) =>
      String(row.submission_version) === String(selected.submission_version)
      && row.manifest_digest === selectedDigest,
    );
    if (!selectedRow) throw new Error('challenge_final_submission_missing');
    if (selectedRow.submission_id !== submissionId) throw new Error('challenge_final_submission_not_protocol_selected');

    try {
      await sql`update challenge_submissions set is_final = (submission_id = ${submissionId}) where entry_id = ${entryId}`.execute(transaction);
      const final = (await sql<ChallengeSubmissionRow>`select * from challenge_submissions where submission_id = ${submissionId}`.execute(transaction)).rows[0];
      if (!final || !final.is_final) throw new Error('challenge_submission_finalize_failed');
      await appendHistoryEvent(transaction, {
        eventFamily: 'activity', eventType: 'challenge.submission.finalized', dedupeKey,
        actorPlayerId: challenge.organizer_player_id, subjectType: 'challenge', subjectId: challengeId, payload,
      });
      return final;
    } catch (error) {
      if ((error as {code?: unknown})?.code === '23505') throw new Error('challenge_final_submission_conflict');
      throw error;
    }
  });
}

export async function recordChallengeQualification(db: Kysely<DatabaseSchema>, input: RecordQualificationInput): Promise<ChallengeQualificationRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const qualificationId = requireUuid(input.qualificationId, 'qualification_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const entryId = requireUuid(input.entryId, 'entry_id');
  const submissionId = requireUuid(input.submissionId, 'submission_id');
  const qualificationVersion = requireText(input.qualificationVersion, 'qualification_version', 120);
  const dedupeKey = `activity:challenge.qualification.recorded:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeById(transaction, challengeId, true);
    if (!challenge) throw new Error('challenge_not_found');
    const contract = await contractForChallenge(transaction, challenge);
    const qualification = computeQualification(contract, input.criterionResults);
    const normalized = canonicalizeJson(qualification);
    const payload = {
      request_id: requestId,
      qualification_id: qualificationId,
      challenge_id: challengeId,
      entry_id: entryId,
      submission_id: submissionId,
      qualification_version: qualificationVersion,
      result: qualification.overall,
      qualification_digest: normalized.sha256,
    };
    if (await existingCommand(transaction, dedupeKey, 'challenge.qualification.recorded', challenge.organizer_player_id, 'challenge', challengeId, payload)) {
      const replay = await sql<ChallengeQualificationRow>`select * from challenge_qualifications where qualification_id = ${qualificationId}`.execute(transaction);
      if (!replay.rows[0]) throw new Error('challenge_qualification_replay_missing');
      return replay.rows[0];
    }
    if (challenge.status !== 'QUALIFICATION') throw new Error('challenge_not_qualifying');
    const entry = await entryById(transaction, entryId);
    if (!entry || entry.challenge_id !== challengeId) throw new Error('challenge_entry_not_found');
    const submission = (await sql<ChallengeSubmissionRow>`select * from challenge_submissions where submission_id = ${submissionId} and challenge_id = ${challengeId} and entry_id = ${entryId} and is_final = true`.execute(transaction)).rows[0];
    if (!submission || submission.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_qualification_lineage_invalid');
    const inserted = await sql<ChallengeQualificationRow>`
      insert into challenge_qualifications (qualification_id, challenge_id, entry_id, submission_id, terms_digest, qualification_version, result, qualification_json)
      values (${qualificationId}, ${challengeId}, ${entryId}, ${submissionId}, ${challenge.current_terms_digest}, ${qualificationVersion}, ${qualification.overall}, ${normalized.value}::jsonb)
      on conflict (entry_id, qualification_version) do nothing
      returning *
    `.execute(transaction);
    const row = inserted.rows[0] ?? (await sql<ChallengeQualificationRow>`select * from challenge_qualifications where entry_id = ${entryId} and qualification_version = ${qualificationVersion}`.execute(transaction)).rows[0];
    if (!row || row.qualification_id !== qualificationId || canonicalizeJson(row.qualification_json).sha256 !== normalized.sha256 || row.result !== qualification.overall) throw new Error('challenge_qualification_immutable_conflict');
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'challenge.qualification.recorded', dedupeKey,
      actorPlayerId: challenge.organizer_player_id, subjectType: 'challenge', subjectId: challengeId, payload,
    });
    return row;
  });
}

export async function recordChallengeDecision(db: Kysely<DatabaseSchema>, input: RecordDecisionInput): Promise<ChallengeDecisionRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const decisionId = requireUuid(input.decisionId, 'decision_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const entryId = input.entryId ? requireUuid(input.entryId, 'entry_id') : null;
  const decisionType = requireText(input.decisionType, 'decision_type', 120);
  const decisionVersion = requireText(input.decisionVersion, 'decision_version', 120);
  const dedupeKey = `activity:challenge.decision.recorded:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = await challengeById(transaction, challengeId, true);
    if (!challenge) throw new Error('challenge_not_found');
    const validatedDecision = await validateDecisionForPersistence(transaction, challenge, entryId, decisionType, input.decision);
    const normalized = canonicalizeJson(validatedDecision);
    const payload = {request_id: requestId, decision_id: decisionId, challenge_id: challengeId, entry_id: entryId, decision_type: decisionType, decision_version: decisionVersion, decision_digest: normalized.sha256};
    if (await existingCommand(transaction, dedupeKey, 'challenge.decision.recorded', challenge.organizer_player_id, 'challenge', challengeId, payload)) {
      const replay = await sql<ChallengeDecisionRow>`select * from challenge_decisions where decision_id = ${decisionId}`.execute(transaction);
      if (!replay.rows[0]) throw new Error('challenge_decision_replay_missing');
      return replay.rows[0];
    }
    const inserted = await sql<ChallengeDecisionRow>`
      insert into challenge_decisions (decision_id, challenge_id, entry_id, decision_type, decision_version, decision_json, decision_digest)
      values (${decisionId}, ${challengeId}, ${entryId}, ${decisionType}, ${decisionVersion}, ${normalized.value}::jsonb, ${normalized.sha256})
      on conflict (challenge_id, decision_type, decision_version) do nothing
      returning *
    `.execute(transaction);
    const row = inserted.rows[0] ?? (await sql<ChallengeDecisionRow>`select * from challenge_decisions where challenge_id = ${challengeId} and decision_type = ${decisionType} and decision_version = ${decisionVersion}`.execute(transaction)).rows[0];
    if (!row || row.decision_id !== decisionId || row.decision_digest !== normalized.sha256) throw new Error('challenge_decision_immutable_conflict');
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'challenge.decision.recorded', dedupeKey,
      actorPlayerId: challenge.organizer_player_id, subjectType: 'challenge', subjectId: challengeId, payload,
    });
    return row;
  });
}

export interface ChallengeSnapshot {
  challenge: ChallengeRow;
  contract: ChallengeContractVersionRow | null;
  entries: ChallengeEntryRow[];
  submissions: ChallengeSubmissionRow[];
  qualifications: ChallengeQualificationRow[];
  decisions: ChallengeDecisionRow[];
  receipts: ChallengeReceiptRow[];
}

export async function readChallengeSnapshot(db: Kysely<DatabaseSchema>, challengeIdInput: string): Promise<ChallengeSnapshot | null> {
  const challengeId = requireUuid(challengeIdInput, 'challenge_id');
  const challenge = await challengeById(db, challengeId);
  if (!challenge) return null;
  const contract = challenge.current_contract_version
    ? (await sql<ChallengeContractVersionRow>`select * from challenge_contract_versions where challenge_id = ${challengeId} and contract_version = ${challenge.current_contract_version}`.execute(db)).rows[0] ?? null
    : null;
  const entries = (await sql<ChallengeEntryRow>`select * from challenge_entries where challenge_id = ${challengeId} order by created_at, entry_id`.execute(db)).rows;
  const submissions = (await sql<ChallengeSubmissionRow>`select * from challenge_submissions where challenge_id = ${challengeId} order by accepted_at, submission_id`.execute(db)).rows;
  const qualifications = (await sql<ChallengeQualificationRow>`select * from challenge_qualifications where challenge_id = ${challengeId} order by created_at, qualification_id`.execute(db)).rows;
  const decisions = (await sql<ChallengeDecisionRow>`select * from challenge_decisions where challenge_id = ${challengeId} order by created_at, decision_id`.execute(db)).rows;
  const receipts = (await sql<ChallengeReceiptRow>`select * from challenge_receipts where challenge_id = ${challengeId} order by created_at, receipt_id`.execute(db)).rows;
  return {challenge, contract, entries, submissions, qualifications, decisions, receipts};
}

export function stageCCommandId(): string {
  return randomUUID();
}
