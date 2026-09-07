import {randomUUID} from 'node:crypto';
import {type Generated, type Kysely, type Selectable} from 'kysely';
import type {DatabaseSchema, ShipSubmissionTable} from './database.js';
import {readDatabaseNow} from './database.js';
import {appendHistoryEvent} from './events.js';
import {snapshotShipAttribution} from './ship-artifact.js';

export const SHIP_ACCEPTANCE_RULE_VERSION = 'ship.acceptance.v1' as const;
export const SHIP_RECEIPT_SCHEMA_VERSION = 'inkubator.ship-receipt/1.0' as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE_SUBMISSION_STATES = ['SUBMITTED', 'OBSERVED', 'ATTENTION'] as const;

export type ShipAcceptanceDecision = 'ACCEPT' | 'REJECT';

type AcceptanceShipSubmissionTable = Omit<ShipSubmissionTable, 'state'> & {
  state: ShipSubmissionTable['state'] | 'ACCEPTED' | 'REJECTED';
};

interface ShipAcceptanceReviewTable {
  review_id: string;
  submission_id: string;
  creation_request_id: string;
  decision: ShipAcceptanceDecision;
  reason: string;
  rule_version: typeof SHIP_ACCEPTANCE_RULE_VERSION;
  reviewed_at: Generated<Date>;
}

interface ShipReceiptTable {
  receipt_id: string;
  submission_id: string;
  mission_id: string;
  project_id: string;
  owner_player_id: string;
  round_id: string | null;
  schema_version: typeof SHIP_RECEIPT_SCHEMA_VERSION;
  acceptance_rule_version: typeof SHIP_ACCEPTANCE_RULE_VERSION;
  verifier_observation_id: string;
  acceptance_review_id: string;
  artifact_title: string;
  artifact_url: string;
  demo_url: string | null;
  shipped_at: Generated<Date>;
}

type AcceptanceDatabaseSchema = Omit<DatabaseSchema, 'ship_submissions'> & {
  ship_submissions: AcceptanceShipSubmissionTable;
  ship_acceptance_reviews: ShipAcceptanceReviewTable;
  ship_receipts: ShipReceiptTable;
};

type AcceptanceDb = Kysely<AcceptanceDatabaseSchema>;

function acceptanceDb(db: Kysely<DatabaseSchema>): AcceptanceDb {
  return db as unknown as AcceptanceDb;
}

function uuid(value: string, name: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`invalid_${name}`);
  return value.toLowerCase();
}

function reviewReason(value: string): string {
  if (typeof value !== 'string') throw new Error('invalid_ship_acceptance_reason');
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > 240) throw new Error('invalid_ship_acceptance_reason');
  return normalized;
}

function decision(value: string): ShipAcceptanceDecision {
  if (value !== 'ACCEPT' && value !== 'REJECT') throw new Error('invalid_ship_acceptance_decision');
  return value;
}

function reviewView(row: Selectable<ShipAcceptanceReviewTable>) {
  return {
    schema_version: 'ship.acceptance_review.internal.v1' as const,
    review_id: row.review_id,
    submission_id: row.submission_id,
    decision: row.decision,
    reason: row.reason,
    rule_version: row.rule_version,
    reviewed_at: row.reviewed_at.toISOString(),
    truth_state: 'OBSERVED' as const,
  };
}

export function toPublicShipReceipt(row: Selectable<ShipReceiptTable>) {
  return {
    schema_version: SHIP_RECEIPT_SCHEMA_VERSION,
    receipt_id: row.receipt_id,
    submission_id: row.submission_id,
    mission_id: row.mission_id,
    project_id: row.project_id,
    owner_player_id: row.owner_player_id,
    ...(row.round_id ? {round_id: row.round_id} : {}),
    acceptance_rule_version: row.acceptance_rule_version,
    artifact: {
      title: row.artifact_title,
      url: row.artifact_url,
      ...(row.demo_url ? {demo_url: row.demo_url} : {}),
    },
    evidence: {
      verifier_observation_id: row.verifier_observation_id,
      acceptance_review_id: row.acceptance_review_id,
    },
    truth_state: 'PROVEN' as const,
    shipped_at: row.shipped_at.toISOString(),
  };
}

async function transitionNotAccepted(
  db: AcceptanceDb,
  submission: Selectable<AcceptanceShipSubmissionTable>,
  missionState: string,
): Promise<void> {
  if (submission.state === 'REJECTED') return;
  if (!ACTIVE_SUBMISSION_STATES.includes(submission.state as (typeof ACTIVE_SUBMISSION_STATES)[number])) {
    throw new Error('ship_acceptance_state_invalid');
  }
  if (missionState !== 'SUBMITTED') throw new Error('ship_acceptance_mission_state_invalid');
  const now = await readDatabaseNow(db as unknown as Kysely<DatabaseSchema>);
  await db.updateTable('ship_submissions')
    .set({state: 'REJECTED', updated_at: now})
    .where('submission_id', '=', submission.submission_id)
    .execute();
  await db.updateTable('missions')
    .set({state: 'SHIP_READY', updated_at: now})
    .where('mission_id', '=', submission.mission_id)
    .where('state', '=', 'SUBMITTED')
    .execute();
}

export async function evaluateShipAcceptance(
  dbInput: Kysely<DatabaseSchema>,
  submissionIdInput: string,
) {
  const submissionId = uuid(submissionIdInput, 'submission_id');
  const db = acceptanceDb(dbInput);
  const submission = await db.selectFrom('ship_submissions')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .forUpdate()
    .executeTakeFirst();
  if (!submission) throw new Error('ship_submission_not_found');

  const mission = await db.selectFrom('missions')
    .select(['mission_id', 'round_id', 'state'])
    .where('mission_id', '=', submission.mission_id)
    .forUpdate()
    .executeTakeFirst();
  if (!mission) throw new Error('mission_not_found');

  const existingReceipt = await db.selectFrom('ship_receipts')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .executeTakeFirst();
  if (existingReceipt) {
    if (submission.state !== 'ACCEPTED' || mission.state !== 'SHIPPED') {
      throw new Error('ship_acceptance_invariant_violation');
    }
    return toPublicShipReceipt(existingReceipt);
  }

  const review = await db.selectFrom('ship_acceptance_reviews')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .executeTakeFirst();
  if (!review) return null;

  const observation = await db.selectFrom('ship_verifier_observations')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .executeTakeFirst();
  if (!observation) return null;

  if (review.decision === 'REJECT') {
    if (submission.state === 'REJECTED' && mission.state === 'SHIP_READY') return null;
    await transitionNotAccepted(db, submission, mission.state);
    return null;
  }

  // UNAVAILABLE is explicitly absence of verifier authority, not negative evidence.
  // It must leave the Mission/submission in their Phase-6A non-accepted state.
  if (observation.outcome === 'UNAVAILABLE') return null;

  if (observation.outcome === 'FAILED') {
    if (submission.state === 'REJECTED' && mission.state === 'SHIP_READY') return null;
    await transitionNotAccepted(db, submission, mission.state);
    return null;
  }

  if (mission.state !== 'SUBMITTED') throw new Error('ship_acceptance_mission_state_invalid');
  if (!ACTIVE_SUBMISSION_STATES.includes(submission.state as (typeof ACTIVE_SUBMISSION_STATES)[number])) {
    throw new Error('ship_acceptance_state_invalid');
  }

  const now = await readDatabaseNow(dbInput);
  const receipt = await db.insertInto('ship_receipts').values({
    receipt_id: randomUUID(),
    submission_id: submissionId,
    mission_id: submission.mission_id,
    project_id: submission.project_id,
    owner_player_id: submission.owner_player_id,
    round_id: mission.round_id,
    schema_version: SHIP_RECEIPT_SCHEMA_VERSION,
    acceptance_rule_version: SHIP_ACCEPTANCE_RULE_VERSION,
    verifier_observation_id: observation.observation_id,
    acceptance_review_id: review.review_id,
    artifact_title: submission.artifact_title,
    artifact_url: submission.artifact_url,
    demo_url: submission.demo_url,
    shipped_at: now,
  }).returningAll().executeTakeFirstOrThrow();

  // Attribution is immutable Ship-time history. It is snapshotted inside the same trusted
  // acceptance transaction so later Party/Assist changes cannot rewrite an old Ship.
  await snapshotShipAttribution(dbInput, receipt);

  await db.updateTable('ship_submissions')
    .set({state: 'ACCEPTED', updated_at: now})
    .where('submission_id', '=', submissionId)
    .execute();
  await db.updateTable('missions')
    .set({state: 'SHIPPED', updated_at: now})
    .where('mission_id', '=', submission.mission_id)
    .where('state', '=', 'SUBMITTED')
    .execute();
  await appendHistoryEvent(dbInput, {
    eventFamily: 'evidence',
    eventType: 'project.ship.accepted',
    dedupeKey: `evidence:project.ship.accepted:${submissionId}`,
    actorPlayerId: null,
    subjectType: 'project', subjectId: submission.project_id,
    occurredAt: now,
    payload: {
      schema_version: 'project.ship.accepted.v1',
      receipt_id: receipt.receipt_id,
      submission_id: submissionId,
      mission_id: submission.mission_id,
      project_id: submission.project_id,
      acceptance_rule_version: SHIP_ACCEPTANCE_RULE_VERSION,
      verifier_observation_id: observation.observation_id,
      acceptance_review_id: review.review_id,
      truth_state: 'PROVEN',
    },
  });
  return toPublicShipReceipt(receipt);
}

export async function reconcileShipAcceptances(dbInput: Kysely<DatabaseSchema>) {
  const db = acceptanceDb(dbInput);
  const candidates = await db.selectFrom('ship_acceptance_reviews')
    .innerJoin('ship_submissions', 'ship_submissions.submission_id', 'ship_acceptance_reviews.submission_id')
    .innerJoin('ship_verifier_observations', 'ship_verifier_observations.submission_id', 'ship_acceptance_reviews.submission_id')
    .leftJoin('ship_receipts', 'ship_receipts.submission_id', 'ship_acceptance_reviews.submission_id')
    .select('ship_acceptance_reviews.submission_id')
    .where('ship_submissions.state', 'in', [...ACTIVE_SUBMISSION_STATES])
    .where('ship_receipts.receipt_id', 'is', null)
    .where((eb) => eb.or([
      eb('ship_acceptance_reviews.decision', '=', 'REJECT'),
      eb('ship_verifier_observations.outcome', 'in', ['PASS', 'FAILED']),
    ]))
    .orderBy('ship_acceptance_reviews.reviewed_at', 'asc')
    .limit(50)
    .execute();

  let accepted = 0;
  for (const candidate of candidates) {
    const receipt = await dbInput.transaction().execute((transaction) =>
      evaluateShipAcceptance(transaction, candidate.submission_id),
    );
    if (receipt) accepted += 1;
  }
  return {examined: candidates.length, accepted};
}

export async function operatorReviewShipAcceptance(
  dbInput: Kysely<DatabaseSchema>,
  submissionIdInput: string,
  input: {requestId: string; decision: ShipAcceptanceDecision; reason: string},
) {
  const submissionId = uuid(submissionIdInput, 'submission_id');
  const requestId = uuid(input.requestId, 'request_id');
  const reviewDecision = decision(input.decision);
  const reason = reviewReason(input.reason);

  return dbInput.transaction().execute(async (transaction) => {
    const db = acceptanceDb(transaction);
    const replay = await db.selectFrom('ship_acceptance_reviews')
      .selectAll()
      .where('creation_request_id', '=', requestId)
      .executeTakeFirst();
    if (replay) {
      if (
        replay.submission_id !== submissionId ||
        replay.decision !== reviewDecision ||
        replay.reason !== reason ||
        replay.rule_version !== SHIP_ACCEPTANCE_RULE_VERSION
      ) throw new Error('ship_acceptance_review_idempotency_conflict');
      const receipt = await evaluateShipAcceptance(transaction, submissionId);
      return {review: reviewView(replay), ...(receipt ? {accepted_receipt: receipt} : {})};
    }

    const submission = await db.selectFrom('ship_submissions')
      .select(['submission_id', 'project_id'])
      .where('submission_id', '=', submissionId)
      .forUpdate()
      .executeTakeFirst();
    if (!submission) throw new Error('ship_submission_not_found');

    const lockedReplay = await db.selectFrom('ship_acceptance_reviews')
      .selectAll()
      .where('creation_request_id', '=', requestId)
      .executeTakeFirst();
    if (lockedReplay) {
      if (
        lockedReplay.submission_id !== submissionId ||
        lockedReplay.decision !== reviewDecision ||
        lockedReplay.reason !== reason ||
        lockedReplay.rule_version !== SHIP_ACCEPTANCE_RULE_VERSION
      ) throw new Error('ship_acceptance_review_idempotency_conflict');
      const receipt = await evaluateShipAcceptance(transaction, submissionId);
      return {review: reviewView(lockedReplay), ...(receipt ? {accepted_receipt: receipt} : {})};
    }

    const existingReview = await db.selectFrom('ship_acceptance_reviews')
      .select('review_id')
      .where('submission_id', '=', submissionId)
      .executeTakeFirst();
    if (existingReview) throw new Error('ship_acceptance_review_exists');

    const now = await readDatabaseNow(transaction);
    const review = await db.insertInto('ship_acceptance_reviews').values({
      review_id: randomUUID(),
      submission_id: submissionId,
      creation_request_id: requestId,
      decision: reviewDecision,
      reason,
      rule_version: SHIP_ACCEPTANCE_RULE_VERSION,
      reviewed_at: now,
    }).returningAll().executeTakeFirstOrThrow();

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'ops.project_ship_acceptance_review.observed',
      dedupeKey: `evidence:ops.project_ship_acceptance_review.observed:${submissionId}`,
      actorPlayerId: null,
      subjectType: 'project', subjectId: submission.project_id,
      occurredAt: now,
      payload: {
        schema_version: 'ops.project_ship_acceptance_review.observed.v1',
        review_id: review.review_id,
        submission_id: submissionId,
        decision: reviewDecision,
        reason,
        acceptance_rule_version: SHIP_ACCEPTANCE_RULE_VERSION,
        request_id: requestId,
        truth_state: 'OBSERVED',
      },
    });

    const receipt = await evaluateShipAcceptance(transaction, submissionId);
    return {review: reviewView(review), ...(receipt ? {accepted_receipt: receipt} : {})};
  });
}
