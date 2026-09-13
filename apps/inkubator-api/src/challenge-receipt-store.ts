import {randomUUID} from 'node:crypto';
import {
  appendReceiptCorrection,
  assertFrozenBuildContract,
  assertReceiptMatchesContract,
  type BuildContract,
} from '@rekt-ink/protocol/challenge';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import type {DatabaseSchema} from './database.js';
import {appendHistoryEvent, HISTORY_EVENT_VERSION} from './events.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const PROTOCOL_RECEIPT_ID_PATTERN = /^(receipt|correction)_[0-9a-f]{64}$/;

type ChallengeAuthorityRow = {
  challenge_id: string;
  organizer_player_id: string;
  current_contract_version: string | null;
  current_terms_digest: string | null;
};

type ContractRow = {
  terms_digest: string;
  contract_json: unknown;
};

export type ProtocolChallengeReceiptRow = {
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
};

export interface RecordProtocolChallengeReceiptInput {
  requestId: string;
  challengeId: string;
  receipt: unknown;
  shipReceiptId?: string | null;
}

function requireUuid(value: string, name: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${name}`);
  return value.toLowerCase();
}

function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`invalid_${name}`);
  return value as Record<string, unknown>;
}

function requireText(value: unknown, name: string, maxLength = 256): string {
  if (typeof value !== 'string') throw new Error(`invalid_${name}`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) throw new Error(`invalid_${name}`);
  return normalized;
}

function requireDigest(value: unknown, name: string): string {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) throw new Error(`invalid_${name}`);
  return value;
}

function requireProtocolReceiptId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !PROTOCOL_RECEIPT_ID_PATTERN.test(value)) throw new Error(`invalid_${name}`);
  return value;
}

async function commandReplay(
  db: Kysely<DatabaseSchema>,
  dedupeKey: string,
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
    existing.event_type !== 'challenge.receipt.recorded' ||
    existing.payload_hash !== normalized.sha256 ||
    existing.actor_player_id !== actorPlayerId ||
    existing.subject_type !== 'challenge' ||
    existing.subject_id !== challengeId
  ) throw new Error(`history_event_idempotency_conflict:${dedupeKey}`);
  return true;
}

async function loadContract(
  db: Kysely<DatabaseSchema>,
  challenge: ChallengeAuthorityRow,
): Promise<BuildContract> {
  if (!challenge.current_contract_version || !challenge.current_terms_digest) throw new Error('challenge_contract_not_frozen');
  const row = (await sql<ContractRow>`
    select terms_digest, contract_json
    from challenge_contract_versions
    where challenge_id = ${challenge.challenge_id}
      and contract_version = ${challenge.current_contract_version}
  `.execute(db)).rows[0];
  if (!row || row.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_contract_pointer_invalid');
  return assertFrozenBuildContract(row.contract_json as BuildContract);
}

export async function recordProtocolChallengeReceipt(
  db: Kysely<DatabaseSchema>,
  input: RecordProtocolChallengeReceiptInput,
): Promise<ProtocolChallengeReceiptRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const shipReceiptId = input.shipReceiptId ? requireUuid(input.shipReceiptId, 'ship_receipt_id') : null;
  const receipt = requireObject(input.receipt, 'receipt');
  if (receipt.challenge_id !== challengeId) throw new Error('challenge_receipt_lineage_mismatch');

  const schemaVersion = requireText(receipt.schema_version, 'receipt_schema_version', 120);
  const protocolReceiptId = requireProtocolReceiptId(receipt.receipt_id, 'protocol_receipt_id');
  const receiptDigest = requireDigest(receipt.digest, 'receipt_digest');
  const normalized = canonicalizeJson(receipt);
  const dedupeKey = `activity:challenge.receipt.recorded:${challengeId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const challenge = (await sql<ChallengeAuthorityRow>`
      select challenge_id, organizer_player_id, current_contract_version, current_terms_digest
      from challenges where challenge_id = ${challengeId} for update
    `.execute(transaction)).rows[0];
    if (!challenge) throw new Error('challenge_not_found');
    const contract = await loadContract(transaction, challenge);

    let termsDigest: string;
    let supersedesInternalId: string | null = null;
    let supersedesProtocolId: string | null = null;

    if (schemaVersion === 'inkubator.challenge-receipt/1.0') {
      assertReceiptMatchesContract(contract, receipt);
      termsDigest = requireDigest(receipt.terms_digest, 'terms_digest');
      if (termsDigest !== challenge.current_terms_digest) throw new Error('challenge_receipt_terms_mismatch');
    } else if (schemaVersion === 'inkubator.challenge-receipt-correction/1.0') {
      if (shipReceiptId) throw new Error('challenge_receipt_correction_ship_link_forbidden');
      supersedesProtocolId = requireProtocolReceiptId(receipt.supersedes, 'supersedes_protocol_receipt_id');
      const predecessor = (await sql<ProtocolChallengeReceiptRow>`
        select * from challenge_receipts
        where challenge_id = ${challengeId} and protocol_receipt_id = ${supersedesProtocolId}
        for update
      `.execute(transaction)).rows[0];
      if (!predecessor) throw new Error('challenge_receipt_predecessor_mismatch');
      supersedesInternalId = predecessor.receipt_id;
      termsDigest = predecessor.terms_digest;
      if (termsDigest !== challenge.current_terms_digest) throw new Error('challenge_receipt_terms_mismatch');

      const priorRows = (await sql<ProtocolChallengeReceiptRow>`
        select * from challenge_receipts
        where challenge_id = ${challengeId}
        order by created_at, receipt_id
      `.execute(transaction)).rows;
      const expected = appendReceiptCorrection(
        priorRows.map((row) => requireObject(row.receipt_json, 'stored_receipt')),
        {
          supersedes: supersedesProtocolId,
          reason: requireText(receipt.reason, 'correction_reason', 2000),
          authority: requireText(receipt.authority, 'correction_authority', 256),
          evidence_refs: Array.isArray(receipt.evidence_refs) ? receipt.evidence_refs : [],
          corrected_projection: requireObject(receipt.corrected_projection ?? {}, 'corrected_projection'),
        },
      );
      if (canonicalizeJson(expected).sha256 !== normalized.sha256) throw new Error('challenge_receipt_correction_protocol_mismatch');
    } else {
      throw new Error('challenge_receipt_schema_unsupported');
    }

    const payload = {
      request_id: requestId,
      challenge_id: challengeId,
      protocol_receipt_id: protocolReceiptId,
      receipt_version: schemaVersion,
      receipt_digest: receiptDigest,
      ship_receipt_id: shipReceiptId,
      supersedes_protocol_receipt_id: supersedesProtocolId,
    };

    if (await commandReplay(transaction, dedupeKey, challenge.organizer_player_id, challengeId, payload)) {
      const replay = (await sql<ProtocolChallengeReceiptRow>`
        select * from challenge_receipts where protocol_receipt_id = ${protocolReceiptId}
      `.execute(transaction)).rows[0];
      if (!replay) throw new Error('challenge_receipt_replay_missing');
      return replay;
    }

    const internalReceiptId = randomUUID();
    try {
      const inserted = await sql<ProtocolChallengeReceiptRow>`
        insert into challenge_receipts (
          receipt_id, protocol_receipt_id, challenge_id, terms_digest, receipt_version,
          receipt_json, receipt_digest, ship_receipt_id, supersedes_receipt_id
        ) values (
          ${internalReceiptId}, ${protocolReceiptId}, ${challengeId}, ${termsDigest}, ${schemaVersion},
          ${normalized.value}::jsonb, ${receiptDigest}, ${shipReceiptId}, ${supersedesInternalId}
        )
        on conflict (challenge_id, receipt_digest) do nothing
        returning *
      `.execute(transaction);
      const row = inserted.rows[0] ?? (await sql<ProtocolChallengeReceiptRow>`
        select * from challenge_receipts
        where challenge_id = ${challengeId} and receipt_digest = ${receiptDigest}
      `.execute(transaction)).rows[0];
      if (!row || row.protocol_receipt_id !== protocolReceiptId || canonicalizeJson(row.receipt_json).sha256 !== normalized.sha256) {
        throw new Error('challenge_receipt_immutable_conflict');
      }

      await appendHistoryEvent(transaction, {
        eventFamily: 'activity',
        eventType: 'challenge.receipt.recorded',
        dedupeKey,
        actorPlayerId: challenge.organizer_player_id,
        subjectType: 'challenge',
        subjectId: challengeId,
        payload,
      });
      return row;
    } catch (error) {
      if ((error as {code?: unknown})?.code === '23505') throw new Error('challenge_receipt_immutable_conflict');
      throw error;
    }
  });
}
