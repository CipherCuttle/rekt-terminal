import {randomUUID} from 'node:crypto';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {sql} from 'kysely';
import {
  IP_TERMS_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  assertFrozenBuildContract,
  digestBuildContract,
  transitionChallenge,
} from '@rekt-ink/protocol/challenge';
import {buildBuilderCapsule} from './builder-capsule.js';
import {challengeDueStateJobInput} from './challenge-due-state.js';
import {
  acceptChallengeSubmission,
  acquireChallengeSeat,
  createChallenge,
  readChallengeSnapshot,
} from './challenge-store.js';
import {toPublicChallengeView} from './challenge-product-api.js';
import {readDatabaseNow, type InkubatorDatabase} from './database.js';
import {
  consumeDevkitRateLimit,
  hasDevkitScope,
  issueDevkitToken,
  readBearerToken,
  resolveDevkitCredential,
  type ResolvedDevkitCredential,
} from './devkit.js';
import {appendHistoryEvent} from './events.js';
import {enqueueOutboxJob} from './jobs.js';
import {readSessionToken, resolveSessionActor} from './session.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_KINDS = new Set(['GIT_COMMIT', 'CONTENT_ADDRESS', 'ARCHIVE_DIGEST']);
const MOCK_SETTLEMENT_ASSET = 'TEST';
const DEFAULT_SUBMIT_TOKEN_TTL_SECONDS = 60 * 60;
const MAX_STAGE_I_SUBMIT_TOKEN_TTL_SECONDS = 24 * 60 * 60;

function error(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({error: message});
}

async function sessionPlayer(request: FastifyRequest, reply: FastifyReply, db: InkubatorDatabase): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) { error(reply, 401, 'authentication_required'); return null; }
  const actor = await resolveSessionActor(db, token);
  if (!actor) { error(reply, 401, 'authentication_required'); return null; }
  return actor.playerId;
}

async function submitCredential(
  request: FastifyRequest,
  reply: FastifyReply,
  db: InkubatorDatabase,
): Promise<ResolvedDevkitCredential | null> {
  const token = readBearerToken(request.headers.authorization);
  if (!token) { error(reply, 401, 'challenge_submit_credential_required'); return null; }
  const resolved = await resolveDevkitCredential(db, token);
  if (!resolved) { error(reply, 401, 'challenge_submit_credential_invalid'); return null; }
  const rate = await consumeDevkitRateLimit(db, resolved.tokenId);
  if (!rate.allowed) {
    if (rate.invalid) { error(reply, 401, 'challenge_submit_credential_invalid'); return null; }
    reply.header('retry-after', String(rate.retryAfterSeconds));
    reply.header('x-ratelimit-limit', '60');
    error(reply, 429, 'challenge_submit_rate_limited');
    return null;
  }
  reply.header('x-ratelimit-limit', '60');
  reply.header('x-ratelimit-remaining', String(rate.remaining));
  if (!hasDevkitScope(resolved, 'challenge:submit')) { error(reply, 403, 'challenge_submit_scope_denied'); return null; }
  return resolved;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${label}`);
  return value.toLowerCase();
}

function safeInt(value: unknown, label: string, min = 0): number {
  if (!Number.isSafeInteger(value) || Number(value) < min) throw new Error(`invalid_${label}`);
  return Number(value);
}

function createInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_challenge_create_body');
  const body = value as Record<string, unknown>;
  const requestId = uuid(body.request_id, 'request_id');
  const challengeId = uuid(body.challenge_id, 'challenge_id');
  const slotLimit = safeInt(body.slot_limit, 'slot_limit', 1);
  const activationMinimum = safeInt(body.activation_minimum, 'activation_minimum', 1);
  const entryDeadlineMs = safeInt(body.entry_deadline_ms, 'entry_deadline_ms');
  const submissionDeadlineMs = safeInt(body.submission_deadline_ms, 'submission_deadline_ms');
  const appealWindowMs = safeInt(body.appeal_window_ms, 'appeal_window_ms', 1);
  const reviewDeadlineMs = safeInt(body.review_deadline_ms, 'review_deadline_ms');
  if (activationMinimum > slotLimit) throw new Error('invalid_activation_minimum');
  if (!(entryDeadlineMs < submissionDeadlineMs && submissionDeadlineMs < reviewDeadlineMs)) {
    throw new Error('invalid_challenge_deadlines');
  }
  return {requestId, challengeId, slotLimit, activationMinimum, entryDeadlineMs, submissionDeadlineMs, appealWindowMs, reviewDeadlineMs};
}

function joinInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_challenge_join_body');
  const body = value as Record<string, unknown>;
  const requestId = uuid(body.request_id, 'request_id');
  const entryId = uuid(body.entry_id, 'entry_id');
  if (typeof body.expected_terms_digest !== 'string' || !DIGEST_PATTERN.test(body.expected_terms_digest)) throw new Error('invalid_expected_terms_digest');
  return {requestId, entryId, expectedTermsDigest: body.expected_terms_digest};
}

function tokenInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_submit_credential_body');
  const body = value as Record<string, unknown>;
  const requestId = uuid(body.request_id, 'request_id');
  const expiresInSeconds = body.expires_in_seconds === undefined
    ? DEFAULT_SUBMIT_TOKEN_TTL_SECONDS
    : safeInt(body.expires_in_seconds, 'expires_in_seconds', 300);
  if (expiresInSeconds > MAX_STAGE_I_SUBMIT_TOKEN_TTL_SECONDS) throw new Error('invalid_expires_in_seconds');
  return {requestId, expiresInSeconds};
}

type SubmissionInput = ReturnType<typeof submissionInput>;
function submissionInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_submission_body');
  const body = value as Record<string, unknown>;
  const requestId = uuid(body.request_id, 'request_id');
  const submissionId = uuid(body.submission_id, 'submission_id');
  const entryId = uuid(body.entry_id, 'entry_id');
  if (typeof body.expected_terms_digest !== 'string' || !DIGEST_PATTERN.test(body.expected_terms_digest)) throw new Error('invalid_expected_terms_digest');
  const submissionVersion = safeInt(body.submission_version, 'submission_version', 1);
  const source = body.immutable_source_reference;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('invalid_immutable_source_reference');
  const sourceRecord = source as Record<string, unknown>;
  if (typeof sourceRecord.kind !== 'string' || !SOURCE_KINDS.has(sourceRecord.kind)) throw new Error('invalid_immutable_source_kind');
  if (typeof sourceRecord.value !== 'string' || sourceRecord.value.trim().length < 1 || sourceRecord.value.length > 500) throw new Error('invalid_immutable_source_value');
  if (typeof body.artifact_digest !== 'string' || !DIGEST_PATTERN.test(body.artifact_digest)) throw new Error('invalid_artifact_digest');
  if (!Array.isArray(body.evidence_references) || body.evidence_references.length > 100 || body.evidence_references.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 500) || new Set(body.evidence_references).size !== body.evidence_references.length) throw new Error('invalid_evidence_references');
  if (body.optional_live_url !== undefined) {
    if (typeof body.optional_live_url !== 'string' || body.optional_live_url.length > 2000) throw new Error('invalid_optional_live_url');
    try { new URL(body.optional_live_url); } catch { throw new Error('invalid_optional_live_url'); }
  }
  const shipSubmissionId = body.ship_submission_id === undefined ? undefined : uuid(body.ship_submission_id, 'ship_submission_id');
  return {
    requestId,
    submissionId,
    entryId,
    expectedTermsDigest: body.expected_terms_digest,
    submissionVersion,
    immutableSourceReference: {kind: sourceRecord.kind as 'GIT_COMMIT'|'CONTENT_ADDRESS'|'ARCHIVE_DIGEST', value: sourceRecord.value},
    artifactDigest: body.artifact_digest,
    evidenceReferences: body.evidence_references as string[],
    optionalLiveUrl: body.optional_live_url as string | undefined,
    shipSubmissionId,
  };
}

function submissionError(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'challenge_submission_failed';
  if (message === 'challenge_entry_not_found' || message === 'challenge_not_found') return error(reply, 404, message);
  if (message === 'challenge_entry_owner_required') return error(reply, 403, message);
  if (
    message === 'challenge_contract_not_frozen' || message === 'challenge_contract_pointer_invalid' ||
    message === 'challenge_terms_digest_stale' || message === 'challenge_not_building' ||
    message === 'challenge_submission_deadline_elapsed' || message === 'challenge_submission_protocol_ineligible' ||
    message === 'challenge_submission_immutable_conflict' || message === 'challenge_ship_lineage_invalid' ||
    message.includes('idempotency_conflict') || message.includes('_conflict')
  ) return error(reply, 409, message);
  if (message.startsWith('invalid_')) return error(reply, 400, message);
  throw cause;
}

async function launchStageIMockChallenge(db: InkubatorDatabase, challengeId: string, actorPlayerId: string, requestId: string) {
  const normalizedChallengeId = uuid(challengeId, 'challenge_id');
  const normalizedRequestId = uuid(requestId, 'request_id');
  const dedupeKey = `activity:challenge.stage_i_mock_launched:${normalizedChallengeId}:${normalizedRequestId}`;

  await db.transaction().execute(async (tx) => {
    const locked = (await sql<{organizer_player_id: string; status: string}>`
      select organizer_player_id, status from challenges
      where challenge_id = ${normalizedChallengeId}
      for update
    `.execute(tx)).rows[0];
    if (!locked) throw new Error('challenge_not_found');
    if (locked.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');

    const replay = await tx.selectFrom('history_events').select('history_event_id').where('dedupe_key', '=', dedupeKey).executeTakeFirst();
    if (replay) return;
    if (locked.status !== 'DRAFT') throw new Error('stage_i_mock_launch_requires_draft');

    const snapshot = await readChallengeSnapshot(tx, normalizedChallengeId);
    if (!snapshot?.contract || !snapshot.challenge.current_terms_digest) throw new Error('challenge_contract_not_frozen');
    const contract = assertFrozenBuildContract(snapshot.contract.contract_json);
    if (contract.terms_digest !== snapshot.challenge.current_terms_digest || contract.terms_digest !== snapshot.contract.terms_digest) throw new Error('challenge_contract_pointer_invalid');
    if (contract.settlement_asset !== MOCK_SETTLEMENT_ASSET) throw new Error('stage_i_mock_settlement_asset_required');

    const now = await readDatabaseNow(tx);
    const protocolChallenge = {challenge_id: normalizedChallengeId, status: 'DRAFT' as const, contract};
    transitionChallenge(protocolChallenge, 'AWAITING_FUNDING');
    const fundingFact = {
      status: 'CONFIRMED',
      challenge_id: normalizedChallengeId,
      asset: MOCK_SETTLEMENT_ASSET,
      amount_minor_units: contract.prize_minor_units,
      contract_digest: digestBuildContract(contract),
      evidence: 'STAGE_I_MOCK_ONLY',
    };
    transitionChallenge({...protocolChallenge, status: 'AWAITING_FUNDING' as const}, 'FUNDED', {fundingFact});
    transitionChallenge({...protocolChallenge, status: 'FUNDED' as const}, 'ENTRY_OPEN', {now: now.getTime()});

    const updated = await sql<{challenge_id: string}>`
      update challenges
      set status = 'ENTRY_OPEN', updated_at = ${now}
      where challenge_id = ${normalizedChallengeId}
      returning challenge_id
    `.execute(tx);
    if (!updated.rows[0]) throw new Error('challenge_not_found');
    await appendHistoryEvent(tx, {
      eventFamily: 'activity',
      eventType: 'challenge.stage_i_mock_launched',
      dedupeKey,
      actorPlayerId,
      subjectType: 'challenge',
      subjectId: normalizedChallengeId,
      occurredAt: now,
      payload: {
        schema_version: 'challenge.stage-i-mock-launch.v1',
        from_status: 'DRAFT',
        validated_transitions: ['AWAITING_FUNDING', 'FUNDED', 'ENTRY_OPEN'],
        settlement_asset: MOCK_SETTLEMENT_ASSET,
        terms_digest: contract.terms_digest,
        real_value_moved: false,
      },
    });
    await enqueueOutboxJob(tx, challengeDueStateJobInput(normalizedChallengeId, 'ENTRY_OPEN', contract.entry_deadline));
  });

  const snapshot = await readChallengeSnapshot(db, normalizedChallengeId);
  if (!snapshot) throw new Error('challenge_not_found');
  return toPublicChallengeView(snapshot);
}

export function registerStageIAlphaRoutes(app: FastifyInstance, db: InkubatorDatabase): void {
  app.post('/v1/challenges', async (request, reply) => {
    const actorPlayerId = await sessionPlayer(request, reply, db); if (!actorPlayerId) return;
    try {
      const input = createInput(request.body);
      const mockIdentity = `stage-i-mock:${actorPlayerId}`;
      await createChallenge(db, {
        requestId: input.requestId,
        challengeId: input.challengeId,
        organizerPlayerId: actorPlayerId,
        organizerPayoutIdentity: mockIdentity,
        funderPayoutIdentity: mockIdentity,
        mechanismVersion: MECHANISM_VERSION,
        settlementPolicyVersion: SETTLEMENT_POLICY_VERSION,
        ipTermsVersion: IP_TERMS_VERSION,
        slotLimit: input.slotLimit,
        activationMinimum: input.activationMinimum,
        entryDeadlineMs: input.entryDeadlineMs,
        buildStartMs: input.entryDeadlineMs,
        submissionDeadlineMs: input.submissionDeadlineMs,
        appealWindowMs: input.appealWindowMs,
        reviewDeadlineMs: input.reviewDeadlineMs,
      });
      const snapshot = await readChallengeSnapshot(db, input.challengeId);
      if (!snapshot) throw new Error('challenge_not_found');
      reply.header('cache-control', 'no-store');
      return reply.code(201).send(toPublicChallengeView(snapshot));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'challenge_create_failed';
      if (message.includes('idempotency_conflict') || message.includes('_conflict')) return error(reply, 409, message);
      if (message.startsWith('invalid_')) return error(reply, 400, message);
      throw cause;
    }
  });

  app.post('/v1/challenges/:challengeId/stage-i-mock-launch', async (request, reply) => {
    const actorPlayerId = await sessionPlayer(request, reply, db); if (!actorPlayerId) return;
    const {challengeId} = request.params as {challengeId: string};
    const body = request.body as {request_id?: unknown} | null;
    try {
      if (typeof body?.request_id !== 'string') throw new Error('invalid_request_id');
      reply.header('cache-control', 'no-store');
      return await launchStageIMockChallenge(db, challengeId, actorPlayerId, body.request_id);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'stage_i_mock_launch_failed';
      if (message === 'challenge_not_found') return error(reply, 404, message);
      if (message === 'challenge_organizer_required') return error(reply, 403, message);
      if (message.startsWith('invalid_')) return error(reply, 400, message);
      if (message === 'stage_i_mock_settlement_asset_required' || message.includes('idempotency_conflict') || message.includes('requires_') || message.includes('contract_') || message.includes('cannot open entries')) return error(reply, 409, message);
      throw cause;
    }
  });

  app.post('/v1/challenges/:challengeId/entries', async (request, reply) => {
    const actorPlayerId = await sessionPlayer(request, reply, db); if (!actorPlayerId) return;
    const {challengeId} = request.params as {challengeId: string};
    try {
      const input = joinInput(request.body);
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return error(reply, 404, 'challenge_not_found');
      if (!snapshot.challenge.current_terms_digest || !snapshot.contract) return error(reply, 409, 'challenge_contract_not_frozen');
      if (snapshot.challenge.current_terms_digest !== input.expectedTermsDigest) return error(reply, 409, 'challenge_terms_digest_stale');
      const row = await acquireChallengeSeat(db, {
        requestId: input.requestId,
        entryId: input.entryId,
        challengeId,
        builderPlayerId: actorPlayerId,
        payoutIdentity: `stage-i-mock:${actorPlayerId}`,
      });
      reply.header('cache-control', 'no-store');
      return reply.code(201).send({
        schema_version: 'challenge.entry.joined.v1',
        challenge_id: row.challenge_id,
        entry_id: row.entry_id,
        state: row.state,
        terms_digest: snapshot.challenge.current_terms_digest,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'challenge_join_failed';
      if (message === 'challenge_not_found') return error(reply, 404, message);
      if (message.includes('organizer') || message.includes('funder') || message.includes('owner')) return error(reply, 403, message);
      if (message.startsWith('invalid_')) return error(reply, 400, message);
      if (message.includes('idempotency_conflict') || message.includes('_conflict') || message.includes('entry') || message.includes('seat') || message.includes('challenge_not_entry_open')) return error(reply, 409, message);
      throw cause;
    }
  });

  app.get('/v1/challenges/:challengeId/my-build', async (request, reply) => {
    const actorPlayerId = await sessionPlayer(request, reply, db); if (!actorPlayerId) return;
    const {challengeId} = request.params as {challengeId: string};
    try {
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return error(reply, 404, 'challenge_not_found');
      const capsule = buildBuilderCapsule(snapshot, actorPlayerId);
      reply.header('cache-control', 'no-store');
      return capsule;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'builder_capsule_unavailable';
      if (message === 'challenge_entry_required') return error(reply, 403, message);
      if (message === 'challenge_contract_not_frozen' || message === 'challenge_contract_pointer_invalid') return error(reply, 409, message);
      if (message === 'invalid_challenge_id') return error(reply, 400, message);
      throw cause;
    }
  });

  app.post('/v1/challenges/:challengeId/submit-credential', async (request, reply) => {
    const actorPlayerId = await sessionPlayer(request, reply, db); if (!actorPlayerId) return;
    const {challengeId} = request.params as {challengeId: string};
    try {
      const input = tokenInput(request.body);
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return error(reply, 404, 'challenge_not_found');
      buildBuilderCapsule(snapshot, actorPlayerId);
      const issued = await issueDevkitToken(db, actorPlayerId, {
        requestId: input.requestId,
        credentialClass: 'CLI',
        label: `Stage I Challenge ${challengeId} submit`,
        scopes: ['challenge:submit'],
        expiresInSeconds: input.expiresInSeconds,
      });
      reply.header('cache-control', 'no-store');
      return reply.code(201).send({...issued, challenge_id: challengeId.toLowerCase(), purpose: 'FINAL_SUBMISSION_ONLY'});
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'submit_credential_issue_failed';
      if (message === 'challenge_not_found') return error(reply, 404, message);
      if (message === 'challenge_entry_required') return error(reply, 403, message);
      if (message === 'devkit_token_issue_replayed' || message.includes('idempotency_conflict')) return error(reply, 409, message);
      if (message.startsWith('invalid_')) return error(reply, 400, message);
      throw cause;
    }
  });

  app.post('/v1/challenges/:challengeId/submissions', async (request, reply) => {
    const auth = await submitCredential(request, reply, db); if (!auth) return;
    const {challengeId} = request.params as {challengeId: string};
    try {
      const input: SubmissionInput = submissionInput(request.body);
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return error(reply, 404, 'challenge_not_found');
      const entry = snapshot.entries.find((candidate) => candidate.entry_id === input.entryId);
      if (!entry) return error(reply, 404, 'challenge_entry_not_found');
      if (entry.builder_player_id !== auth.playerId) return error(reply, 403, 'challenge_entry_owner_required');
      if (!snapshot.contract || !snapshot.challenge.current_terms_digest) return error(reply, 409, 'challenge_contract_not_frozen');
      if (snapshot.contract.terms_digest !== snapshot.challenge.current_terms_digest) return error(reply, 409, 'challenge_contract_pointer_invalid');
      if (input.expectedTermsDigest !== snapshot.challenge.current_terms_digest) return error(reply, 409, 'challenge_terms_digest_stale');
      const manifest = {
        schema_version: 'inkubator.submission-manifest/1.0' as const,
        challenge_id: challengeId.toLowerCase(),
        entry_id: input.entryId,
        terms_digest: snapshot.challenge.current_terms_digest,
        submission_version: input.submissionVersion,
        immutable_source_reference: input.immutableSourceReference,
        artifact_digest: input.artifactDigest,
        evidence_references: input.evidenceReferences,
        ...(input.optionalLiveUrl ? {optional_live_url: input.optionalLiveUrl} : {}),
        accepted_at: 0,
      };
      const row = await acceptChallengeSubmission(db, {
        requestId: input.requestId,
        submissionId: input.submissionId,
        challengeId,
        entryId: input.entryId,
        manifest,
        ...(input.shipSubmissionId ? {shipSubmissionId: input.shipSubmissionId} : {}),
      });
      reply.header('cache-control', 'no-store');
      return reply.code(201).send({
        schema_version: 'challenge.submission.accepted.v1',
        submission_id: row.submission_id,
        challenge_id: row.challenge_id,
        entry_id: row.entry_id,
        submission_version: row.submission_version,
        terms_digest: row.terms_digest,
        manifest_digest: row.manifest_digest,
        accepted_at: row.accepted_at.toISOString(),
        ship_submission_id: row.ship_submission_id,
      });
    } catch (cause) {
      return submissionError(reply, cause);
    }
  });
}