import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  freezeBuildContract,
} from '@rekt-ink/protocol/challenge';
import {
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
  digestAcceptanceManifest,
} from '@rekt-ink/protocol/acceptance-manifest';
import {
  TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_DIGEST,
  TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID,
  TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION,
} from '../../dist/challenge-test-arena.js';
import {buildApp} from '../../dist/app.js';
import {acceptChallengeSubmission, acquireChallengeSeat, createChallenge, markFinalChallengeSubmission, persistFrozenBuildContract} from '../../dist/challenge-store.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {registerStageG2bTestArenaRoutes} from '../../dist/challenge-test-arena.js';
import {createSession, serializeSessionCookie} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  test('Stage G2B database integration requires DATABASE_URL', {skip: true}, () => {});
} else {
  function cookie(token) {
    return serializeSessionCookie(token, 3600).split(';')[0];
  }

  async function player(db, label) {
    const playerId = randomUUID();
    await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
    return playerId;
  }

  test('Stage G2B executes trusted automation, persists immutable evidence, and qualifies only after human completion', async () => {
    const db = createDatabase(databaseUrl);
    await migrateToLatest(db);
    const app = buildApp({db, appOrigin: 'https://inkubator.test', allowDevAuth: false, sessionTtlSeconds: 3600, github: null});
    registerStageG2bTestArenaRoutes(app, db);

    try {
      const now = (await readDatabaseNow(db)).getTime();
      const organizer = await player(db, 'g2b-organizer');
      const builder = await player(db, 'g2b-builder');
      const challengeId = randomUUID();
      const entryId = randomUUID();
      const submissionId = randomUUID();
      const artifactDigest = 'a'.repeat(64);
      const acceptanceManifest = {
        schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
        challenge_id: challengeId,
        contract_version: 'g2b-integration-v1',
        bindings: [
          {
            criterion_id: 'AUTO-1', mode: 'AUTOMATED',
            module_id: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID,
            module_version: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION,
            module_digest: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_DIGEST,
            fixture_reference_ids: [], config: {expected_artifact_digest: artifactDigest},
          },
          {criterion_id: 'HUMAN-1', mode: 'HUMAN_OBSERVATION', instructions: 'Confirm the frozen interaction.'},
        ],
      };
      const contract = freezeBuildContract({
        schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
        challenge_id: challengeId,
        contract_version: acceptanceManifest.contract_version,
        mechanism_version: 'funded-challenge/1.1',
        settlement_policy_version: 'funded-challenge-settlement/1.0',
        ip_terms_version: 'bespoke-winner-transfer/1.0',
        title: 'G2B integration challenge', brief: 'Prove objective execution.',
        outcome_contract: {criteria: [{id: 'AUTO-1', description: 'Artifact matches.', mandatory: true}]},
        production_envelope: {criteria: []},
        delivery_contract: {criteria: [{id: 'HUMAN-1', description: 'Interaction is correct.', mandatory: true}]},
        preferences: {}, reference_architecture: {}, normative_constraints: [],
        normative_references: [{id: 'REF-ACCEPTANCE', kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: digestAcceptanceManifest(acceptanceManifest)}],
        informational_references: [], knowledge: [], slot_limit: 2, activation_minimum: 1,
        entry_deadline: now + 60_000, build_start: now + 60_000, submission_deadline: now + 120_000,
        appeal_window_ms: 100, review_deadline: now + 180_000, prize_minor_units: 100, settlement_asset: 'TEST',
      });

      await createChallenge(db, {
        requestId: randomUUID(), challengeId, organizerPlayerId: organizer,
        organizerPayoutIdentity: `organizer-${challengeId}`, funderPayoutIdentity: `funder-${challengeId}`,
        mechanismVersion: contract.mechanism_version, settlementPolicyVersion: contract.settlement_policy_version,
        ipTermsVersion: contract.ip_terms_version, slotLimit: contract.slot_limit, activationMinimum: contract.activation_minimum,
        entryDeadlineMs: contract.entry_deadline, buildStartMs: contract.build_start,
        submissionDeadlineMs: contract.submission_deadline, appealWindowMs: contract.appeal_window_ms, reviewDeadlineMs: contract.review_deadline,
      });
      await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
      await db.updateTable('challenges').set({status: 'ENTRY_OPEN'}).where('challenge_id', '=', challengeId).execute();
      await acquireChallengeSeat(db, {requestId: randomUUID(), entryId, challengeId, builderPlayerId: builder, payoutIdentity: `builder-${challengeId}`});
      await db.updateTable('challenges').set({status: 'BUILDING'}).where('challenge_id', '=', challengeId).execute();
      await acceptChallengeSubmission(db, {
        requestId: randomUUID(), submissionId, challengeId, entryId,
        manifest: {
          schema_version: 'inkubator.submission-manifest/1.0', challenge_id: challengeId, entry_id: entryId,
          terms_digest: contract.terms_digest, submission_version: 1,
          immutable_source_reference: {kind: 'GIT_COMMIT', value: 'b'.repeat(40)}, artifact_digest: artifactDigest,
          evidence_references: [], accepted_at: 0,
        },
      });
      await db.updateTable('challenges').set({status: 'SUBMISSIONS_LOCKED'}).where('challenge_id', '=', challengeId).execute();
      await markFinalChallengeSubmission(db, {requestId: randomUUID(), challengeId, entryId, submissionId});
      await db.updateTable('challenges').set({status: 'QUALIFICATION'}).where('challenge_id', '=', challengeId).execute();

      const organizerSession = await createSession(db, organizer, 3600);
      const url = `/v1/challenges/${challengeId}/entries/${entryId}/test-arena/execute`;
      const base = {
        request_id: randomUUID(), qualification_id: randomUUID(), acceptance_manifest: acceptanceManifest,
      };
      const incomplete = await app.inject({
        method: 'POST', url, headers: {origin: 'https://inkubator.test', cookie: cookie(organizerSession.token)},
        payload: {...base, human_observations: []},
      });
      assert.equal(incomplete.statusCode, 200);
      assert.equal(incomplete.json().state, 'INCOMPLETE');
      assert.equal(await db.selectFrom('challenge_qualifications').select('qualification_id').where('challenge_id', '=', challengeId).execute().then((rows) => rows.length), 0);
      assert.equal(await db.selectFrom('history_events').select('history_event_id').where('event_type', '=', 'challenge.acceptance.automated_evidence_recorded').where('subject_id', '=', submissionId).execute().then((rows) => rows.length), 1);

      const completed = await app.inject({
        method: 'POST', url, headers: {origin: 'https://inkubator.test', cookie: cookie(organizerSession.token)},
        payload: {...base, human_observations: [{criterion_id: 'HUMAN-1', mode: 'HUMAN_OBSERVATION', result: 'PASS', evidence_refs: ['human-evidence-1']}]},
      });
      assert.equal(completed.statusCode, 200);
      assert.equal(completed.json().state, 'COMPLETE');
      assert.equal(completed.json().overall, 'QUALIFIED');
      assert.equal(completed.json().submission_id, submissionId);
      assert.match(completed.json().execution_digest, /^[0-9a-f]{64}$/);
      assert.equal(await db.selectFrom('challenge_qualifications').select('qualification_id').where('challenge_id', '=', challengeId).execute().then((rows) => rows.length), 1);
      assert.equal(await db.selectFrom('history_events').select('history_event_id').where('subject_id', '=', submissionId).where('event_family', '=', 'evidence').execute().then((rows) => rows.length), 2);

      const replay = await app.inject({
        method: 'POST', url, headers: {origin: 'https://inkubator.test', cookie: cookie(organizerSession.token)},
        payload: {...base, human_observations: [{criterion_id: 'HUMAN-1', mode: 'HUMAN_OBSERVATION', result: 'PASS', evidence_refs: ['human-evidence-1']}]},
      });
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.json().execution_digest, completed.json().execution_digest);
      assert.equal(await db.selectFrom('history_events').select('history_event_id').where('subject_id', '=', submissionId).where('event_family', '=', 'evidence').execute().then((rows) => rows.length), 2);

      const conflict = await app.inject({
        method: 'POST', url, headers: {origin: 'https://inkubator.test', cookie: cookie(organizerSession.token)},
        payload: {...base, human_observations: [{criterion_id: 'HUMAN-1', mode: 'HUMAN_OBSERVATION', result: 'FAIL', evidence_refs: ['changed-human-evidence']}]},
      });
      assert.equal(conflict.statusCode, 409);
      assert.match(conflict.body, /idempotency_conflict/);
    } finally {
      await app.close();
      await db.destroy();
    }
  });
}
