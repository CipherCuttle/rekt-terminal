import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {sql} from 'kysely';
import {
  buildSettlementIntent,
  fileReceipt,
} from '@rekt-ink/protocol/challenge';
import {
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
  digestAcceptanceManifest,
} from '@rekt-ink/protocol/acceptance-manifest';
import {buildApp} from '../../dist/app.js';
import {
  compileOrganizerDraft,
  registerStageEChallengeProductRoutes,
} from '../../dist/challenge-product-api.js';
import {registerStageGRevealArenaRoutes} from '../../dist/challenge-reveal-api.js';
import {registerStageG2BTestArenaRoutes} from '../../dist/challenge-test-arena-api.js';
import {registerStageG3Routes} from '../../dist/challenge-g3-api.js';
import {recordProtocolChallengeReceipt} from '../../dist/challenge-receipt-store.js';
import {
  acquireChallengeSeat,
  createChallenge,
  markFinalChallengeSubmission,
  readChallengeSnapshot,
  recordChallengeDecision,
} from '../../dist/challenge-store.js';
import {createDatabase} from '../../dist/database.js';
import {runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const t0 = 1_900_000_000_000;
const acceptanceReferenceId = 'REF-INTEGRATION-ACCEPTANCE';

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

async function createActor(app, displayName) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/dev/session',
    headers: {origin: appOrigin},
    payload: {display_name: displayName},
  });
  assert.equal(response.statusCode, 201, response.body);
  return {playerId: response.json().player.player_id, cookie: cookieFrom(response)};
}

async function issueSubmitToken(app, cookie) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/devkit/tokens',
    headers: {origin: appOrigin, cookie, 'content-type': 'application/json'},
    payload: {
      request_id: randomUUID(),
      credential_class: 'CLI',
      label: 'integration rehearsal builder',
      scopes: ['challenge:submit'],
      expires_in_seconds: 3600,
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().token;
}

function acceptedCompilerState() {
  return compileOrganizerDraft({
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: 'Build a deterministic public static launch page.',
    requirements: [
      'accounts',
      'persistence',
      'uploads_private',
      'realtime',
      'notifications',
      'onchain_read',
      'wallet_transactions',
      'custody_private_keys',
    ].map((key) => ({key, value: false, provenance: 'ORGANIZER_ACCEPTED'})),
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  });
}

function acceptanceManifest(challengeId) {
  return {
    schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
    challenge_id: challengeId,
    contract_version: 'integration-rehearsal-v1',
    bindings: [],
  };
}

function contractAuthority(manifest) {
  return {
    contract_version: 'integration-rehearsal-v1',
    title: 'Integrated funded Challenge rehearsal',
    brief: 'Exercise the complete deterministic pre-money Challenge loop.',
    preferences: {},
    normative_constraints: [],
    normative_references: [{
      id: acceptanceReferenceId,
      kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND,
      content_digest: digestAcceptanceManifest(manifest),
    }],
    informational_references: [],
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  };
}

test('integrated funded Challenge rehearsal reaches a safe receipt with zero provider inference', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600});
  registerStageEChallengeProductRoutes(app, db);
  registerStageGRevealArenaRoutes(app, db);
  registerStageG2BTestArenaRoutes(app, db);
  registerStageG3Routes(app, db);

  try {
    const organizer = await createActor(app, `Integration Organizer ${randomUUID().slice(0, 6)}`);
    const builder = await createActor(app, `Integration Builder ${randomUUID().slice(0, 6)}`);
    const challengeId = randomUUID();
    const entryId = randomUUID();
    const submissionId = randomUUID();
    const manifest = acceptanceManifest(challengeId);

    await createChallenge(db, {
      requestId: randomUUID(),
      challengeId,
      organizerPlayerId: organizer.playerId,
      organizerPayoutIdentity: `organizer-pay-${challengeId}`,
      funderPayoutIdentity: `funder-pay-${challengeId}`,
      mechanismVersion: 'funded-challenge/1.1',
      settlementPolicyVersion: 'funded-challenge-settlement/1.0',
      ipTermsVersion: 'bespoke-winner-transfer/1.0',
      slotLimit: 1,
      activationMinimum: 1,
      entryDeadlineMs: t0 + 100,
      buildStartMs: t0 + 100,
      submissionDeadlineMs: t0 + 10_000,
      appealWindowMs: 100,
      reviewDeadlineMs: t0 + 20_000,
    });

    // Stage E: explicit organizer source -> deterministic compile -> canonical frozen contract.
    const compilerState = acceptedCompilerState();
    assert.equal(compilerState.status, 'READY');
    const authority = contractAuthority(manifest);
    const preview = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract-preview`,
      headers: {origin: appOrigin, 'content-type': 'application/json'},
      payload: {compiler_state: compilerState, authority},
    });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(preview.json().canonical, false);

    const frozen = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/build-contract`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: {
        request_id: randomUUID(),
        compiler_state: compilerState,
        authority,
        expected_terms_digest: preview.json().contract.terms_digest,
      },
    });
    assert.equal(frozen.statusCode, 200, frozen.body);
    const termsDigest = frozen.json().terms_digest;
    assert.match(termsDigest, /^[0-9a-f]{64}$/);

    // Stage F: builder joins, becomes active and submits one immutable manifest through the DevKit route.
    await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(db);
    const entry = await acquireChallengeSeat(db, {
      requestId: randomUUID(),
      entryId,
      challengeId,
      builderPlayerId: builder.playerId,
      payoutIdentity: `builder-pay-${entryId}`,
    });
    await sql`update challenges set status = 'BUILDING' where challenge_id = ${challengeId}`.execute(db);
    await sql`
      update challenge_entries
      set state = 'ACTIVE',
          build_start = (select build_start from challenges where challenge_id = ${challengeId}),
          submission_deadline = (select submission_deadline from challenges where challenge_id = ${challengeId})
      where entry_id = ${entryId}
    `.execute(db);

    const submitToken = await issueSubmitToken(app, builder.cookie);
    const submitted = await app.inject({
      method: 'POST',
      url: `/v1/devkit/challenges/${challengeId}/submissions`,
      headers: {authorization: `Bearer ${submitToken}`, 'content-type': 'application/json'},
      payload: {
        request_id: randomUUID(),
        submission_id: submissionId,
        entry_id: entryId,
        expected_terms_digest: termsDigest,
        submission_version: 1,
        immutable_source_reference: {kind: 'GIT_COMMIT', value: 'a'.repeat(40)},
        artifact_digest: 'b'.repeat(64),
        evidence_references: ['integration-rehearsal-evidence'],
      },
    });
    assert.equal(submitted.statusCode, 201, submitted.body);
    assert.equal(submitted.json().submission_id, submissionId);

    // Stage F3: asynchronous evidence capture uses the normal leased job path.
    await db.updateTable('outbox_jobs')
      .set({next_attempt_at: new Date(0)})
      .where('idempotency_key', '=', `challenge.submission.archive:${submissionId}`)
      .execute();
    const archiveResult = await runOneJob(db, {
      challengeSubmissionArchiveClient: {
        capture: async () => ({
          outcome: 'CAPTURED',
          archive_digest: 'c'.repeat(64),
          archive_reference: `private://integration-rehearsal/${submissionId}`,
        }),
      },
    });
    assert.equal(archiveResult.status, 'succeeded');

    // Stage G1: seal/finalize then reveal through the organizer-only product route.
    await sql`update challenges set status = 'SUBMISSIONS_LOCKED' where challenge_id = ${challengeId}`.execute(db);
    await markFinalChallengeSubmission(db, {
      requestId: randomUUID(), challengeId, entryId, submissionId,
    });
    const reveal = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${challengeId}/reveal-arena`,
      headers: {cookie: organizer.cookie},
    });
    assert.equal(reveal.statusCode, 200, reveal.body);
    assert.equal(reveal.json().submissions.length, 1);
    assert.equal(reveal.json().submissions[0].submission_id, submissionId);
    assert.equal(reveal.body.includes('archive_reference'), false);
    assert.equal(reveal.body.includes('private://integration-rehearsal'), false);

    // Stage G2B: zero-inference qualification. Empty frozen criteria means there are
    // no model, hidden-test, human-observation or trusted-module calls to invent.
    await sql`update challenges set status = 'QUALIFICATION' where challenge_id = ${challengeId}`.execute(db);
    const qualified = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/test-arena/entries/${entryId}/qualify`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: {
        request_id: randomUUID(),
        qualification_id: randomUUID(),
        acceptance_manifest_reference_id: acceptanceReferenceId,
        acceptance_manifest: manifest,
        human_observations: [],
      },
    });
    assert.equal(qualified.statusCode, 200, qualified.body);
    assert.equal(qualified.json().result, 'QUALIFIED');
    assert.match(qualified.json().execution_digest, /^[0-9a-f]{64}$/);

    const executionEvent = (await sql`
      select payload from history_events
      where subject_id = ${challengeId} and event_type = 'challenge.test_arena.executed'
    `.execute(db)).rows[0];
    assert.ok(executionEvent);
    assert.deepEqual(executionEvent.payload.execution.observations, []);

    // Stage G3: close appeals, freeze final qualifiers and let the organizer select.
    await sql`
      update challenges
      set status = 'APPEAL_WINDOW', appeal_opened_at = clock_timestamp() - interval '2 seconds'
      where challenge_id = ${challengeId}
    `.execute(db);
    await recordChallengeDecision(db, {
      requestId: randomUUID(),
      decisionId: randomUUID(),
      challengeId,
      entryId: null,
      decisionType: 'FINAL_QUALIFIERS',
      decisionVersion: 'stage-c-effective-v1',
      decision: {final_qualifier_ids: [entryId]},
    });
    await sql`update challenges set status = 'SELECTION' where challenge_id = ${challengeId}`.execute(db);

    const selected = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/selection`,
      headers: {origin: appOrigin, cookie: organizer.cookie, 'content-type': 'application/json'},
      payload: {
        request_id: randomUUID(),
        decision_id: randomUUID(),
        selected_entry_id: entryId,
      },
    });
    assert.equal(selected.statusCode, 200, selected.body);
    assert.equal(selected.json().selected_entry_id, entryId);

    // Pre-money rehearsal only: record a synthetic finalized settlement fact. No
    // wallet, signer, broadcaster or external value rail is invoked by this test.
    const contract = preview.json().contract;
    const settlementIntent = buildSettlementIntent({
      contract,
      resolution: {
        type: 'WINNER_PAYOUT',
        winner_entry_id: entryId,
        distributions: [{entry_id: entryId, amount_minor_units: 100}],
      },
      recipientByEntryId: {[entryId]: entry.payout_identity},
    });
    await recordChallengeDecision(db, {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId,
      decisionType: 'SETTLEMENT_INTENT',
      decisionVersion: 'integration-rehearsal-intent-v1',
      decision: settlementIntent,
    });
    const settlementExecutionFact = {
      challenge_id: challengeId,
      terms_digest: termsDigest,
      settlement_policy_version: contract.settlement_policy_version,
      asset: contract.settlement_asset,
      total_minor_units: contract.prize_minor_units,
      recipients: settlementIntent.recipients,
      finality: 'FINALIZED',
      execution_id: `rehearsal-fixture-no-broadcast-${challengeId}`,
    };
    await recordChallengeDecision(db, {
      requestId: randomUUID(), decisionId: randomUUID(), challengeId, entryId,
      decisionType: 'SETTLEMENT_EXECUTION_FACT',
      decisionVersion: 'integration-rehearsal-execution-v1',
      decision: settlementExecutionFact,
    });
    await sql`update challenges set status = 'SETTLED' where challenge_id = ${challengeId}`.execute(db);

    const receipt = fileReceipt({contract, settlementIntent, settlementExecutionFact});
    await recordProtocolChallengeReceipt(db, {
      requestId: randomUUID(), challengeId, receipt,
    });

    const transported = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${challengeId}/receipts`,
    });
    assert.equal(transported.statusCode, 200, transported.body);
    assert.equal(transported.json().receipts.length, 1);
    assert.equal(transported.json().receipts[0].winner_entry_id, entryId);
    assert.equal(transported.body.includes(entry.payout_identity), false);
    assert.equal(transported.body.includes(settlementExecutionFact.execution_id), false);

    const finalSnapshot = await readChallengeSnapshot(db, challengeId);
    assert.equal(finalSnapshot.challenge.status, 'RECEIPT_FILED');
    assert.equal(finalSnapshot.submissions.length, 1);
    assert.equal(finalSnapshot.qualifications.length, 1);
    assert.equal(finalSnapshot.receipts.length, 1);
    assert.equal(finalSnapshot.decisions.filter((row) => row.decision_type === 'SELECTION').length, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});
