import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {buildSettlementIntent, fileReceipt, freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {recordChallengeAppeal, resolveChallengeAppeal} from '../../dist/challenge-appeal-authority.js';
import {challengeDueStateJobInput} from '../../dist/challenge-due-state.js';
import {recordProtocolChallengeReceipt} from '../../dist/challenge-receipt-store.js';
import {
  acceptChallengeSubmission,
  acquireChallengeSeat,
  createChallenge,
  persistFrozenBuildContract,
  recordChallengeDecision,
  recordChallengeQualification,
} from '../../dist/challenge-store.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {enqueueOutboxJob, runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const waitUntil = async (epochMs) => {
  const delay = Math.max(0, epochMs - Date.now() + 40);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
};

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, start) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0', challenge_id: challengeId, contract_version: '1',
    mechanism_version: 'funded-challenge/1.1', settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0', title: 'Stage C authority crucible',
    brief: 'Exercise the durable Stage-B authority chain adversarially',
    outcome_contract: {criteria: [{id: 'OUT', description: 'Works', mandatory: true}]},
    production_envelope: {criteria: []}, delivery_contract: {criteria: []}, preferences: {}, reference_architecture: {},
    normative_constraints: [], normative_references: [], informational_references: [], knowledge: [],
    slot_limit: 3, activation_minimum: 1,
    entry_deadline: start + 250, build_start: start + 250, submission_deadline: start + 750,
    appeal_window_ms: 120, review_deadline: start + 1_700,
    prize_minor_units: 100, settlement_asset: 'TEST',
  });
}

async function setup(db) {
  const now = await readDatabaseNow(db);
  const challengeId = randomUUID();
  const organizer = await player(db, 'crucible-organizer');
  const builder = await player(db, 'crucible-builder');
  const abandonedBuilder = await player(db, 'crucible-abandoned');
  const lateBuilder = await player(db, 'crucible-late');
  const contract = contractFor(challengeId, now.getTime());
  await createChallenge(db, {
    requestId: randomUUID(), challengeId, organizerPlayerId: organizer,
    organizerPayoutIdentity: `org-pay-${challengeId}`, funderPayoutIdentity: `fund-pay-${challengeId}`,
    mechanismVersion: contract.mechanism_version, settlementPolicyVersion: contract.settlement_policy_version,
    ipTermsVersion: contract.ip_terms_version, slotLimit: contract.slot_limit, activationMinimum: contract.activation_minimum,
    entryDeadlineMs: contract.entry_deadline, buildStartMs: contract.build_start,
    submissionDeadlineMs: contract.submission_deadline, appealWindowMs: contract.appeal_window_ms,
    reviewDeadlineMs: contract.review_deadline,
  });
  await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
  const entryJob = challengeDueStateJobInput(challengeId, 'ENTRY_OPEN', contract.entry_deadline);
  await db.transaction().execute(async (transaction) => {
    await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(transaction);
    await enqueueOutboxJob(transaction, entryJob);
  });
  const entry = await acquireChallengeSeat(db, {
    requestId: randomUUID(), entryId: randomUUID(), challengeId, builderPlayerId: builder, payoutIdentity: `builder-pay-${challengeId}`,
  });
  const abandoned = await acquireChallengeSeat(db, {
    requestId: randomUUID(), entryId: randomUUID(), challengeId, builderPlayerId: abandonedBuilder, payoutIdentity: `abandoned-pay-${challengeId}`,
  });
  return {challengeId, organizer, builder, lateBuilder, contract, entry, abandoned};
}

test('Stage C Postgres authority crucible conserves authority across the full chain', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await setup(db);
    const {challengeId, organizer, builder, lateBuilder, contract, entry, abandoned} = fixture;

    const replayRequest = randomUUID();
    const replayEntry = randomUUID();
    await acquireChallengeSeat(db, {
      requestId: replayRequest, entryId: replayEntry, challengeId, builderPlayerId: lateBuilder, payoutIdentity: `late-before-${challengeId}`,
    });
    await assert.rejects(
      acquireChallengeSeat(db, {
        requestId: replayRequest, entryId: replayEntry, challengeId, builderPlayerId: lateBuilder, payoutIdentity: `changed-${challengeId}`,
      }),
      /history_event_idempotency_conflict/,
    );

    await waitUntil(contract.entry_deadline);
    const stillOpen = await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db);
    assert.equal(stillOpen.rows[0].status, 'ENTRY_OPEN');
    await assert.rejects(
      acquireChallengeSeat(db, {
        requestId: randomUUID(), entryId: randomUUID(), challengeId,
        builderPlayerId: await player(db, 'after-entry-deadline'), payoutIdentity: `too-late-${challengeId}`,
      }),
      /challenge_entry_deadline_elapsed/,
    );

    assert.equal((await runOneJob(db, {retryBaseMs: 50})).status, 'succeeded');
    assert.equal((await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db)).rows[0].status, 'BUILDING');

    const submissionId = randomUUID();
    const manifest = {
      schema_version: 'inkubator.submission-manifest/1.0', challenge_id: challengeId, entry_id: entry.entry_id,
      terms_digest: contract.terms_digest, submission_version: 1,
      immutable_source_reference: {kind: 'GIT_COMMIT', value: 'a'.repeat(40)}, artifact_digest: 'b'.repeat(64),
      evidence_references: [], accepted_at: 0,
    };
    await acceptChallengeSubmission(db, {requestId: randomUUID(), submissionId, challengeId, entryId: entry.entry_id, manifest});

    await waitUntil(contract.submission_deadline);
    await assert.rejects(
      acceptChallengeSubmission(db, {
        requestId: randomUUID(), submissionId: randomUUID(), challengeId, entryId: entry.entry_id,
        manifest: {...manifest, submission_version: 2, immutable_source_reference: {kind: 'GIT_COMMIT', value: 'c'.repeat(40)}},
      }),
      /challenge_submission_deadline_elapsed/,
    );
    assert.equal((await runOneJob(db, {retryBaseMs: 50})).status, 'succeeded');
    assert.equal((await runOneJob(db, {retryBaseMs: 50})).status, 'succeeded');
    assert.equal((await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db)).rows[0].status, 'QUALIFICATION');
    const abandonedState = await sql`select state from challenge_entries where entry_id = ${abandoned.entry_id}`.execute(db);
    assert.equal(abandonedState.rows[0].state, 'ABANDONED');

    const qualificationId = randomUUID();
    await recordChallengeQualification(db, {
      requestId: randomUUID(), qualificationId, challengeId, entryId: entry.entry_id, submissionId,
      qualificationVersion: 'first-pass.v1', criterionResults: [{criterion_id: 'OUT', result: 'PASS', evidence_refs: ['first-pass']}],
    });
    await assert.rejects(
      recordChallengeQualification(db, {
        requestId: randomUUID(), qualificationId: randomUUID(), challengeId, entryId: entry.entry_id, submissionId,
        qualificationVersion: 'first-pass.v2', criterionResults: [{criterion_id: 'OUT', result: 'PASS', evidence_refs: []}],
      }),
      /challenge_first_pass_qualification_already_recorded/,
    );

    assert.equal((await runOneJob(db, {retryBaseMs: 50})).status, 'succeeded');
    const opened = await sql`select status, appeal_opened_at from challenges where challenge_id = ${challengeId}`.execute(db);
    assert.equal(opened.rows[0].status, 'APPEAL_WINDOW');
    assert.ok(opened.rows[0].appeal_opened_at instanceof Date);

    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId,
        decisionType: 'FINAL_QUALIFIERS', decisionVersion: 'forged-early',
        decision: {final_qualifier_ids: [entry.entry_id]},
      }),
      /challenge_appeal_window_not_elapsed/,
    );

    const appealId = randomUUID();
    await recordChallengeAppeal(db, {
      requestId: randomUUID(), appealId, challengeId, entryId: entry.entry_id,
      actorPlayerId: builder, reason: 'Re-check frozen OUT evidence', evidenceRefs: ['appeal-evidence'],
    });
    const closeAt = opened.rows[0].appeal_opened_at.getTime() + contract.appeal_window_ms;
    await waitUntil(closeAt);

    assert.equal((await runOneJob(db, {retryBaseMs: 50})).status, 'succeeded');
    assert.equal((await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db)).rows[0].status, 'APPEAL_WINDOW');
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId,
        decisionType: 'FINAL_QUALIFIERS', decisionVersion: 'forged-unresolved',
        decision: {final_qualifier_ids: [entry.entry_id]},
      }),
      /challenge_appeals_unresolved/,
    );

    await resolveChallengeAppeal(db, {
      requestId: randomUUID(), resolutionId: randomUUID(), appealId, challengeId, resolverPlayerId: organizer,
      qualificationId: randomUUID(), qualificationVersion: 'appeal-revision.v1',
      criterionResults: [{criterion_id: 'OUT', result: 'PASS', evidence_refs: ['appeal-reviewed']}],
      reason: 'Frozen evidence still passes', evidenceRefs: ['resolution-evidence'],
    });
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId,
        decisionType: 'FINAL_QUALIFIERS', decisionVersion: 'forged-member',
        decision: {final_qualifier_ids: [abandoned.entry_id]},
      }),
      /challenge_final_qualifiers_authority_mismatch/,
    );

    const closeNow = await readDatabaseNow(db);
    await enqueueOutboxJob(db, challengeDueStateJobInput(challengeId, 'APPEAL_WINDOW', closeNow.getTime()));
    assert.equal((await runOneJob(db, {retryBaseMs: 50})).status, 'succeeded');
    const finalPhase = await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db);
    assert.equal(finalPhase.rows[0].status, 'SELECTION');
    const finalDecision = await sql`
      select decision_json from challenge_decisions where challenge_id = ${challengeId} and decision_type = 'FINAL_QUALIFIERS'
    `.execute(db);
    assert.deepEqual(finalDecision.rows[0].decision_json, {final_qualifier_ids: [entry.entry_id]});

    const selectedRequest = randomUUID();
    const selectedDecisionId = randomUUID();
    await recordChallengeDecision(db, {
      requestId: selectedRequest, decisionId: selectedDecisionId, challengeId, entryId: entry.entry_id,
      decisionType: 'SELECTION', decisionVersion: '1', decision: {selected_entry_id: entry.entry_id},
    });
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: selectedRequest, decisionId: selectedDecisionId, challengeId, entryId: abandoned.entry_id,
        decisionType: 'SELECTION', decisionVersion: '1', decision: {selected_entry_id: abandoned.entry_id},
      }),
      /not a final qualifier|history_event_idempotency_conflict/,
    );
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: entry.entry_id,
        decisionType: 'DEFAULT_RESOLUTION', decisionVersion: 'early',
        decision: {type: 'WINNER_PAYOUT', winner_entry_id: entry.entry_id, distributions: [{entry_id: entry.entry_id, amount_minor_units: 100}]},
      }),
      /challenge_review_deadline_not_reached/,
    );

    await waitUntil(contract.review_deadline);
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: entry.entry_id,
        decisionType: 'DEFAULT_RESOLUTION', decisionVersion: 'after-selection',
        decision: {type: 'WINNER_PAYOUT', winner_entry_id: entry.entry_id, distributions: [{entry_id: entry.entry_id, amount_minor_units: 100}]},
      }),
      /challenge_valid_selection_already_exists/,
    );

    const settlementIntent = buildSettlementIntent({
      contract,
      resolution: {type: 'WINNER_PAYOUT', winner_entry_id: entry.entry_id, distributions: [{entry_id: entry.entry_id, amount_minor_units: 100}]},
      recipientByEntryId: {[entry.entry_id]: entry.payout_identity},
    });
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: entry.entry_id,
        decisionType: 'SETTLEMENT_INTENT', decisionVersion: 'bad-recipient',
        decision: {...settlementIntent, recipients: [{recipient_id: 'attacker', amount_minor_units: 100}]},
      }),
      /settlement_intent_resolution_mismatch|settlement intent/,
    );
    await recordChallengeDecision(db, {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: entry.entry_id,
      decisionType: 'SETTLEMENT_INTENT', decisionVersion: '1', decision: settlementIntent,
    });
    assert.equal((await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db)).rows[0].status, 'SETTLEMENT_PENDING');

    const settlementExecutionFact = {
      challenge_id: challengeId, terms_digest: contract.terms_digest,
      settlement_policy_version: contract.settlement_policy_version, asset: contract.settlement_asset,
      total_minor_units: contract.prize_minor_units, recipients: settlementIntent.recipients,
      finality: 'FINALIZED', execution_id: 'crucible-execution-1',
    };
    const receipt = fileReceipt({contract, settlementIntent, settlementExecutionFact});
    await assert.rejects(
      recordProtocolChallengeReceipt(db, {requestId: randomUUID(), challengeId, receipt}),
      /challenge_receipt_requires_settled_status|challenge_receipt_settlement_execution_fact_authority_missing/,
    );

    await recordChallengeDecision(db, {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: entry.entry_id,
      decisionType: 'SETTLEMENT_EXECUTION_FACT', decisionVersion: '1', decision: settlementExecutionFact,
    });
    assert.equal((await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db)).rows[0].status, 'SETTLED');
    await assert.rejects(
      recordChallengeDecision(db, {
        requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId: entry.entry_id,
        decisionType: 'SETTLEMENT_EXECUTION_FACT', decisionVersion: '2',
        decision: {...settlementExecutionFact, execution_id: 'conflicting-execution'},
      }),
      /challenge_settlement_execution_lifecycle_invalid|challenge_settlement_execution_already_recorded/,
    );

    const storedReceipt = await recordProtocolChallengeReceipt(db, {requestId: randomUUID(), challengeId, receipt});
    assert.equal(storedReceipt.protocol_receipt_id, receipt.receipt_id);
    assert.equal((await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db)).rows[0].status, 'RECEIPT_FILED');
  } finally {
    await db.destroy();
  }
});
