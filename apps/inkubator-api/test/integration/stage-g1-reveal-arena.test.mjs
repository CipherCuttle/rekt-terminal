import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {buildApp} from '../../dist/app.js';
import {registerStageGRevealArenaRoutes} from '../../dist/challenge-reveal-api.js';
import {acceptChallengeSubmission, acquireChallengeSeat, createChallenge, persistFrozenBuildContract} from '../../dist/challenge-store.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {createSession, serializeSessionCookie} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function cookie(token) {
  return serializeSessionCookie(token, 3600).split(';')[0];
}

test('G1 route authenticates, stays sealed, then reveals all final work without private archive location', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({
    db,
    appOrigin: 'https://inkubator.test',
    allowDevAuth: false,
    sessionTtlSeconds: 3600,
    github: null,
  });
  registerStageGRevealArenaRoutes(app, db);

  try {
    const now = (await readDatabaseNow(db)).getTime();
    const organizer = await player(db, 'g1-organizer');
    const builder = await player(db, 'g1-builder');
    const challengeId = randomUUID();
    const entryId = randomUUID();
    const submissionId = randomUUID();
    const contract = freezeBuildContract({
      schema_version: 'inkubator.build-contract/1.0',
      challenge_id: challengeId,
      contract_version: 'g1-route-v1',
      mechanism_version: 'funded-challenge/1.1',
      settlement_policy_version: 'funded-challenge-settlement/1.0',
      ip_terms_version: 'bespoke-winner-transfer/1.0',
      title: 'G1 route challenge',
      brief: 'Prove simultaneous reveal.',
      outcome_contract: {criteria: [{id: 'OUT-1', description: 'Required outcome', mandatory: true}]},
      production_envelope: {criteria: []},
      delivery_contract: {criteria: []},
      preferences: {},
      reference_architecture: {},
      normative_constraints: [],
      normative_references: [],
      informational_references: [],
      knowledge: [],
      slot_limit: 2,
      activation_minimum: 1,
      entry_deadline: now + 60_000,
      build_start: now + 60_000,
      submission_deadline: now + 120_000,
      appeal_window_ms: 100,
      review_deadline: now + 180_000,
      prize_minor_units: 100,
      settlement_asset: 'TEST',
    });

    await createChallenge(db, {
      requestId: randomUUID(),
      challengeId,
      organizerPlayerId: organizer,
      organizerPayoutIdentity: `organizer-${challengeId}`,
      funderPayoutIdentity: `funder-${challengeId}`,
      mechanismVersion: contract.mechanism_version,
      settlementPolicyVersion: contract.settlement_policy_version,
      ipTermsVersion: contract.ip_terms_version,
      slotLimit: contract.slot_limit,
      activationMinimum: contract.activation_minimum,
      entryDeadlineMs: contract.entry_deadline,
      buildStartMs: contract.build_start,
      submissionDeadlineMs: contract.submission_deadline,
      appealWindowMs: contract.appeal_window_ms,
      reviewDeadlineMs: contract.review_deadline,
    });
    await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
    await db.updateTable('challenges').set({status: 'ENTRY_OPEN'}).where('challenge_id', '=', challengeId).execute();
    await acquireChallengeSeat(db, {
      requestId: randomUUID(), entryId, challengeId, builderPlayerId: builder,
      payoutIdentity: `builder-${challengeId}`,
    });
    await db.updateTable('challenges').set({status: 'BUILDING'}).where('challenge_id', '=', challengeId).execute();

    await acceptChallengeSubmission(db, {
      requestId: randomUUID(),
      submissionId,
      challengeId,
      entryId,
      manifest: {
        schema_version: 'inkubator.submission-manifest/1.0',
        challenge_id: challengeId,
        entry_id: entryId,
        terms_digest: contract.terms_digest,
        submission_version: 1,
        immutable_source_reference: {kind: 'GIT_COMMIT', value: 'a'.repeat(40)},
        artifact_digest: 'b'.repeat(64),
        evidence_references: ['private-evidence-ref-must-not-leak'],
        accepted_at: 0,
      },
    });
    await db.updateTable('challenge_submission_archives').set({
      status: 'CAPTURED',
      archive_digest: 'c'.repeat(64),
      archive_reference: 'r2://private-g1-bucket/top-secret-object',
      observed_at: new Date(now + 1_000),
      reason_code: null,
    }).where('submission_id', '=', submissionId).execute();

    const organizerSession = await createSession(db, organizer, 3600);
    const builderSession = await createSession(db, builder, 3600);
    const url = `/v1/challenges/${challengeId}/reveal-arena`;

    const unauthenticated = await app.inject({method: 'GET', url});
    assert.equal(unauthenticated.statusCode, 401);
    assert.deepEqual(unauthenticated.json(), {error: 'authentication_required'});

    const nonOrganizer = await app.inject({method: 'GET', url, headers: {cookie: cookie(builderSession.token)}});
    assert.equal(nonOrganizer.statusCode, 403);
    assert.deepEqual(nonOrganizer.json(), {error: 'challenge_organizer_required'});

    const sealed = await app.inject({method: 'GET', url, headers: {cookie: cookie(organizerSession.token)}});
    assert.equal(sealed.statusCode, 409);
    assert.deepEqual(sealed.json(), {error: 'challenge_reveal_sealed'});
    assert.equal(sealed.body.includes(submissionId), false);
    assert.equal(sealed.body.includes('private-evidence-ref-must-not-leak'), false);

    await db.updateTable('challenges').set({status: 'SUBMISSIONS_LOCKED'}).where('challenge_id', '=', challengeId).execute();
    const revealed = await app.inject({method: 'GET', url, headers: {cookie: cookie(organizerSession.token)}});
    assert.equal(revealed.statusCode, 200);
    const body = revealed.json();
    assert.equal(body.schema_version, 'challenge.reveal-arena/1.0');
    assert.equal(body.reveal_state, 'REVEALED');
    assert.equal(body.submissions.length, 1);
    assert.equal(body.submissions[0].submission_id, submissionId);
    assert.equal(body.submissions[0].archive.status, 'CAPTURED');
    assert.equal(body.submissions[0].archive.archive_digest, 'c'.repeat(64));
    assert.deepEqual(body.criteria, [{criterion_id: 'OUT-1', group: 'OUTCOME', description: 'Required outcome'}]);
    assert.equal(revealed.body.includes('archive_reference'), false);
    assert.equal(revealed.body.includes('private-g1-bucket'), false);
    assert.equal(revealed.body.includes('private-evidence-ref-must-not-leak'), false);

    const repeated = await app.inject({method: 'GET', url, headers: {cookie: cookie(organizerSession.token)}});
    assert.equal(repeated.statusCode, 200);
    assert.deepEqual(repeated.json(), body);
  } finally {
    await app.close();
    await db.destroy();
  }
});
