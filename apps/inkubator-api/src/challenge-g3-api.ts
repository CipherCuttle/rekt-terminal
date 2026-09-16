import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {
  appendReceiptCorrection,
  assertFrozenBuildContract,
  assertReceiptMatchesContract,
  type BuildContract,
} from '@rekt-ink/protocol/challenge';
import {canonicalizeJson} from './canonical-json.js';
import {loadStageGRevealArenaView, type RevealArenaView} from './challenge-reveal-api.js';
import {
  readChallengeSnapshot,
  recordChallengeDecision,
  type ChallengeDecisionRow,
  type ChallengeReceiptRow,
  type ChallengeSnapshot,
} from './challenge-store.js';
import type {InkubatorDatabase} from './database.js';
import {readSessionToken, resolveSessionActor} from './session.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const G3_SELECTION_VERSION = 'stage-g3-selection-v1';
const COMPARISON_STATES = new Set(['SELECTION', 'DEFAULT_RESOLUTION', 'SETTLEMENT_PENDING', 'SETTLED', 'RECEIPT_FILED']);

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${label}`);
  return value.toLowerCase();
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`invalid_${label}`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function frozenContract(snapshot: ChallengeSnapshot): BuildContract {
  if (!snapshot.contract) throw new Error('challenge_contract_not_frozen');
  const contract = assertFrozenBuildContract(snapshot.contract.contract_json);
  if (
    snapshot.challenge.current_contract_version !== snapshot.contract.contract_version
    || snapshot.challenge.current_terms_digest !== snapshot.contract.terms_digest
    || contract.contract_version !== snapshot.contract.contract_version
    || contract.terms_digest !== snapshot.contract.terms_digest
  ) throw new Error('challenge_contract_pointer_invalid');
  return contract;
}

function finalQualifierIds(snapshot: ChallengeSnapshot): string[] {
  const rows = snapshot.decisions.filter((row) => row.decision_type === 'FINAL_QUALIFIERS');
  if (rows.length !== 1) throw new Error('challenge_final_qualifiers_authority_invalid');
  const decision = requireObject(rows[0].decision_json, 'final_qualifiers_decision');
  if (!exactKeys(decision, ['final_qualifier_ids']) || !Array.isArray(decision.final_qualifier_ids)) {
    throw new Error('challenge_final_qualifiers_authority_invalid');
  }
  const ids = decision.final_qualifier_ids.map((value, index) => requireUuid(value, `final_qualifier_${index}`));
  if (new Set(ids).size !== ids.length) throw new Error('challenge_final_qualifiers_authority_invalid');
  return [...ids].sort(compareText);
}

function storedSelection(snapshot: ChallengeSnapshot): {row: ChallengeDecisionRow; selected_entry_id: string} | null {
  const rows = snapshot.decisions.filter((row) => row.decision_type === 'SELECTION');
  if (rows.length > 1) throw new Error('challenge_selection_authority_conflict');
  if (rows.length === 0) return null;
  const decision = requireObject(rows[0].decision_json, 'selection_decision');
  if (!exactKeys(decision, ['selected_entry_id'])) throw new Error('challenge_selection_authority_conflict');
  return {row: rows[0], selected_entry_id: requireUuid(decision.selected_entry_id, 'selected_entry_id')};
}

export interface G3QualifierComparisonView {
  schema_version: 'challenge.qualifier-comparison/1.0';
  challenge_id: string;
  contract_version: string;
  terms_digest: string;
  status: string;
  preferences: Record<string, unknown>;
  final_qualifier_ids: string[];
  selected_entry_id: string | null;
  qualifiers: RevealArenaView['submissions'];
}

export function buildStageG3QualifierComparison(
  snapshot: ChallengeSnapshot,
  reveal: RevealArenaView,
  actorPlayerId: string,
): G3QualifierComparisonView {
  if (snapshot.challenge.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');
  if (!COMPARISON_STATES.has(snapshot.challenge.status)) throw new Error('challenge_qualifier_comparison_unavailable');
  const contract = frozenContract(snapshot);
  const qualifierIds = finalQualifierIds(snapshot);
  const selection = storedSelection(snapshot);
  if (selection && !qualifierIds.includes(selection.selected_entry_id)) throw new Error('challenge_selection_authority_conflict');
  const submissionByEntry = new Map(reveal.submissions.map((submission) => [submission.entry_id, submission]));
  const qualifiers = qualifierIds.map((entryId) => {
    const submission = submissionByEntry.get(entryId);
    if (!submission) throw new Error('challenge_qualifier_submission_missing');
    return submission;
  });
  return {
    schema_version: 'challenge.qualifier-comparison/1.0',
    challenge_id: snapshot.challenge.challenge_id,
    contract_version: contract.contract_version,
    terms_digest: contract.terms_digest!,
    status: snapshot.challenge.status,
    preferences: structuredClone(contract.preferences),
    final_qualifier_ids: qualifierIds,
    selected_entry_id: selection?.selected_entry_id ?? null,
    qualifiers,
  };
}

export async function loadStageG3QualifierComparison(
  db: InkubatorDatabase,
  challengeId: string,
  actorPlayerId: string,
): Promise<G3QualifierComparisonView> {
  const snapshot = await readChallengeSnapshot(db, challengeId);
  if (!snapshot) throw new Error('challenge_not_found');
  if (snapshot.challenge.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');
  if (!COMPARISON_STATES.has(snapshot.challenge.status)) throw new Error('challenge_qualifier_comparison_unavailable');
  const reveal = await loadStageGRevealArenaView(db, challengeId, actorPlayerId);
  return buildStageG3QualifierComparison(snapshot, reveal, actorPlayerId);
}

function safeBaseReceipt(row: ChallengeReceiptRow, contract: BuildContract) {
  const receipt = requireObject(row.receipt_json, 'stored_receipt');
  assertReceiptMatchesContract(contract, receipt);
  if (
    row.receipt_version !== 'inkubator.challenge-receipt/1.0'
    || receipt.schema_version !== row.receipt_version
    || receipt.receipt_id !== row.protocol_receipt_id
    || receipt.digest !== row.receipt_digest
    || row.terms_digest !== contract.terms_digest
  ) throw new Error('challenge_receipt_transport_authority_mismatch');
  const intent = requireObject(receipt.settlement_intent, 'stored_settlement_intent');
  return {
    protocol_receipt_id: row.protocol_receipt_id,
    schema_version: row.receipt_version,
    digest: row.receipt_digest,
    created_at: row.created_at.toISOString(),
    challenge_id: receipt.challenge_id as string,
    terms_digest: receipt.terms_digest as string,
    contract_version: receipt.contract_version as string,
    mechanism_version: receipt.mechanism_version as string,
    settlement_policy_version: receipt.settlement_policy_version as string,
    ip_terms_version: receipt.ip_terms_version as string,
    terminal_outcome: receipt.terminal_outcome as string,
    ip_transfer_fact: receipt.ip_transfer_fact as string,
    settlement_asset: intent.asset as string,
    total_minor_units: intent.total_minor_units as number,
    winner_entry_id: typeof intent.winner_entry_id === 'string' ? intent.winner_entry_id : null,
  };
}

function safeCorrectionReceipt(
  row: ChallengeReceiptRow,
  priorRows: ChallengeReceiptRow[],
  internalToProtocolId: Map<string, string>,
) {
  const receipt = requireObject(row.receipt_json, 'stored_receipt_correction');
  if (row.receipt_version !== 'inkubator.challenge-receipt-correction/1.0' || receipt.schema_version !== row.receipt_version) {
    throw new Error('challenge_receipt_schema_unsupported');
  }
  if (receipt.receipt_id !== row.protocol_receipt_id || receipt.digest !== row.receipt_digest || !row.supersedes_receipt_id) {
    throw new Error('challenge_receipt_transport_authority_mismatch');
  }
  const predecessorProtocolId = internalToProtocolId.get(row.supersedes_receipt_id);
  if (!predecessorProtocolId || receipt.supersedes !== predecessorProtocolId) throw new Error('challenge_receipt_predecessor_mismatch');
  const expected = appendReceiptCorrection(
    priorRows.map((prior) => requireObject(prior.receipt_json, 'stored_prior_receipt')),
    {
      supersedes: predecessorProtocolId,
      reason: receipt.reason as string,
      authority: receipt.authority as string,
      evidence_refs: Array.isArray(receipt.evidence_refs) ? receipt.evidence_refs as string[] : [],
      corrected_projection: requireObject(receipt.corrected_projection ?? {}, 'stored_corrected_projection'),
    },
  );
  if (canonicalizeJson(expected).sha256 !== canonicalizeJson(receipt).sha256) {
    throw new Error('challenge_receipt_correction_protocol_mismatch');
  }
  return {
    protocol_receipt_id: row.protocol_receipt_id,
    schema_version: row.receipt_version,
    digest: row.receipt_digest,
    created_at: row.created_at.toISOString(),
    supersedes_protocol_receipt_id: predecessorProtocolId,
  };
}

export function buildStageG3ReceiptTransport(snapshot: ChallengeSnapshot) {
  const contract = frozenContract(snapshot);
  const rows = [...snapshot.receipts].sort((left, right) => {
    const byTime = left.created_at.getTime() - right.created_at.getTime();
    return byTime !== 0 ? byTime : compareText(left.receipt_id, right.receipt_id);
  });
  const internalToProtocolId = new Map<string, string>();
  const priorRows: ChallengeReceiptRow[] = [];
  const receipts = rows.map((row) => {
    let projected;
    if (row.receipt_version === 'inkubator.challenge-receipt/1.0') {
      projected = safeBaseReceipt(row, contract);
    } else if (row.receipt_version === 'inkubator.challenge-receipt-correction/1.0') {
      projected = safeCorrectionReceipt(row, priorRows, internalToProtocolId);
    } else {
      throw new Error('challenge_receipt_schema_unsupported');
    }
    internalToProtocolId.set(row.receipt_id, row.protocol_receipt_id);
    priorRows.push(row);
    return projected;
  });
  return {
    schema_version: 'challenge.receipt-transport/1.0' as const,
    challenge_id: snapshot.challenge.challenge_id,
    receipts,
  };
}

export async function recordStageG3Selection(
  db: InkubatorDatabase,
  input: {requestId: string; decisionId: string; challengeId: string; selectedEntryId: string; actorPlayerId: string},
) {
  const requestId = requireUuid(input.requestId, 'request_id');
  const decisionId = requireUuid(input.decisionId, 'decision_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const selectedEntryId = requireUuid(input.selectedEntryId, 'selected_entry_id');
  const actorPlayerId = requireUuid(input.actorPlayerId, 'actor_player_id');
  const dedupeKey = `activity:challenge.decision.recorded:${challengeId}:${requestId}`;
  const existingCommand = await db.selectFrom('history_events').select('history_event_id').where('dedupe_key', '=', dedupeKey).executeTakeFirst();
  const snapshot = await readChallengeSnapshot(db, challengeId);
  if (!snapshot) throw new Error('challenge_not_found');
  if (snapshot.challenge.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');

  if (!existingCommand) {
    if (snapshot.challenge.status !== 'SELECTION') throw new Error('challenge_selection_not_open');
    if (storedSelection(snapshot)) throw new Error('challenge_selection_already_recorded');
  }

  return recordChallengeDecision(db, {
    requestId,
    decisionId,
    challengeId,
    entryId: selectedEntryId,
    decisionType: 'SELECTION',
    decisionVersion: G3_SELECTION_VERSION,
    decision: {selected_entry_id: selectedEntryId},
  });
}

async function authenticatedPlayerId(request: FastifyRequest, db: InkubatorDatabase): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  return (await resolveSessionActor(db, token))?.playerId ?? null;
}

function apiError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({error: message});
}

export function registerStageG3Routes(app: FastifyInstance, db: InkubatorDatabase): void {
  app.get('/v1/challenges/:challengeId/qualifier-comparison', async (request, reply) => {
    const actorPlayerId = await authenticatedPlayerId(request, db);
    if (!actorPlayerId) return apiError(reply, 401, 'authentication_required');
    const {challengeId} = request.params as {challengeId: string};
    try {
      const view = await loadStageG3QualifierComparison(db, challengeId, actorPlayerId);
      reply.header('cache-control', 'no-store');
      return view;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'challenge_qualifier_comparison_failed';
      if (message === 'invalid_challenge_id') return apiError(reply, 400, message);
      if (message === 'challenge_not_found') return apiError(reply, 404, message);
      if (message === 'challenge_organizer_required') return apiError(reply, 403, message);
      return apiError(reply, 409, message);
    }
  });

  app.post('/v1/challenges/:challengeId/selection', async (request, reply) => {
    const actorPlayerId = await authenticatedPlayerId(request, db);
    if (!actorPlayerId) return apiError(reply, 401, 'authentication_required');
    const {challengeId} = request.params as {challengeId: string};
    const body = request.body as Record<string, unknown> | null;
    if (!body || !exactKeys(body, ['request_id', 'decision_id', 'selected_entry_id'])) return apiError(reply, 400, 'invalid_request_body');
    try {
      const row = await recordStageG3Selection(db, {
        requestId: requireUuid(body.request_id, 'request_id'),
        decisionId: requireUuid(body.decision_id, 'decision_id'),
        challengeId,
        selectedEntryId: requireUuid(body.selected_entry_id, 'selected_entry_id'),
        actorPlayerId,
      });
      reply.header('cache-control', 'no-store');
      return {
        schema_version: 'challenge.selection/1.0',
        challenge_id: row.challenge_id,
        decision_id: row.decision_id,
        decision_version: row.decision_version,
        selected_entry_id: row.entry_id,
        decision_digest: row.decision_digest,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'challenge_selection_failed';
      if (message.startsWith('invalid_')) return apiError(reply, 400, message);
      if (message === 'challenge_not_found') return apiError(reply, 404, message);
      if (message === 'challenge_organizer_required') return apiError(reply, 403, message);
      return apiError(reply, 409, message);
    }
  });

  app.get('/v1/challenges/:challengeId/receipts', async (request, reply) => {
    const {challengeId} = request.params as {challengeId: string};
    try {
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return apiError(reply, 404, 'challenge_not_found');
      reply.header('cache-control', 'no-store');
      return buildStageG3ReceiptTransport(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'challenge_receipt_transport_failed';
      if (message === 'invalid_challenge_id') return apiError(reply, 400, message);
      return apiError(reply, 409, message);
    }
  });
}
