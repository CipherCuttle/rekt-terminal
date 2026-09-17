import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, randomUUID} from 'node:crypto';
import test from 'node:test';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {createGitHubR2ChallengeArchiveCaptureClient} from '../../dist/challenge-archive-github-r2.js';
import {acceptChallengeSubmission, acquireChallengeSeat, createChallenge, persistFrozenBuildContract} from '../../dist/challenge-store.js';
import {CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE} from '../../dist/challenge-archive.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const PRIVATE_KEY = generateKeyPairSync('rsa', {modulusLength: 2048}).privateKey.export({type: 'pkcs8', format: 'pem'}).toString();

function numericId() {
  return BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`).toString();
}

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, now) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0', challenge_id: challengeId, contract_version: 'f3b-test-v1',
    mechanism_version: 'funded-challenge/1.1', settlement_policy_version: 'funded-challenge-settlement/1.0', ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'Stage F3B capture challenge', brief: 'Freeze repository identity and capture the accepted commit.',
    outcome_contract: {criteria: [{id: 'OUT-1', description: 'Capture is durable', mandatory: true}]}, production_envelope: {criteria: []}, delivery_contract: {criteria: []},
    preferences: {}, reference_architecture: {}, normative_constraints: [], normative_references: [], informational_references: [], knowledge: [],
    slot_limit: 2, activation_minimum: 1, entry_deadline: now + 60_000, build_start: now + 60_000, submission_deadline: now + 120_000, appeal_window_ms: 100, review_deadline: now + 180_000,
    prize_minor_units: 100, settlement_asset: 'TEST',
  });
}

async function acceptedGitHubFixture(db) {
  const now = (await readDatabaseNow(db)).getTime();
  const organizer = await player(db, 'f3b-organizer');
  const builder = await player(db, 'f3b-builder');
  const installationId = numericId();
  const repositoryId = numericId();
  const replacementRepositoryId = numericId();
  const projectId = randomUUID();

  await db.insertInto('github_installations').values({
    installation_id: installationId,
    player_id: builder,
    github_user_id: numericId(),
    account_id: numericId(),
    account_type: 'User',
    repository_selection: 'selected',
    revoked_at: null,
  }).execute();
  await db.insertInto('github_repositories').values({
    repository_id: repositoryId,
    installation_id: installationId,
    full_name: 'builder/original-repo',
    private: true,
    active: true,
  }).execute();
  await db.insertInto('github_repositories').values({
    repository_id: replacementRepositoryId,
    installation_id: installationId,
    full_name: 'builder/replacement-repo',
    private: true,
    active: true,
  }).execute();
  await db.insertInto('projects').values({
    project_id: projectId,
    schema_version: 'project.current.v1',
    owner_player_id: builder,
    name: 'F3B project',
    repository_id: repositoryId,
  }).execute();

  const challengeId = randomUUID();
  const contract = contractFor(challengeId, now);
  await createChallenge(db, {
    requestId: randomUUID(), challengeId, organizerPlayerId: organizer,
    organizerPayoutIdentity: `organizer-${challengeId}`, funderPayoutIdentity: `funder-${challengeId}`,
    mechanismVersion: contract.mechanism_version, settlementPolicyVersion: contract.settlement_policy_version,
    ipTermsVersion: contract.ip_terms_version, slotLimit: contract.slot_limit, activationMinimum: contract.activation_minimum,
    entryDeadlineMs: contract.entry_deadline, buildStartMs: contract.build_start, submissionDeadlineMs: contract.submission_deadline,
    appealWindowMs: contract.appeal_window_ms, reviewDeadlineMs: contract.review_deadline,
  });
  await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
  await db.updateTable('challenges').set({status: 'ENTRY_OPEN'}).where('challenge_id', '=', challengeId).execute();
  const entry = await acquireChallengeSeat(db, {
    requestId: randomUUID(), entryId: randomUUID(), challengeId, builderPlayerId: builder,
    payoutIdentity: `builder-${challengeId}`, projectId,
  });
  await db.updateTable('challenges').set({status: 'BUILDING'}).where('challenge_id', '=', challengeId).execute();
  await db.updateTable('challenge_entries').set({
    state: 'ACTIVE', build_start: new Date(contract.build_start), submission_deadline: new Date(contract.submission_deadline),
  }).where('entry_id', '=', entry.entry_id).execute();

  const submissionId = randomUUID();
  const commit = 'a'.repeat(40);
  const manifest = {
    schema_version: 'inkubator.submission-manifest/1.0', challenge_id: challengeId, entry_id: entry.entry_id,
    terms_digest: contract.terms_digest, submission_version: 1,
    immutable_source_reference: {kind: 'GIT_COMMIT', value: commit}, artifact_digest: 'b'.repeat(64),
    evidence_references: [], accepted_at: 0,
  };
  const accepted = await acceptChallengeSubmission(db, {
    requestId: randomUUID(), submissionId, challengeId, entryId: entry.entry_id, manifest,
  });
  const source = await sql`
    select repository_id::text as repository_id, installation_id::text as installation_id, frozen_at
    from challenge_submission_archive_sources where submission_id = ${submissionId}
  `.execute(db);
  assert.equal(source.rows.length, 1);
  assert.equal(source.rows[0].repository_id, repositoryId);
  assert.equal(source.rows[0].installation_id, installationId);

  const job = await db.selectFrom('outbox_jobs').selectAll()
    .where('job_type', '=', CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE)
    .where('idempotency_key', '=', `challenge.submission.archive:${submissionId}`).executeTakeFirstOrThrow();
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(-1)}).where('job_id', '=', job.job_id).execute();

  return {
    builder, installationId, repositoryId, replacementRepositoryId, projectId,
    challengeId, entryId: entry.entry_id, submissionId, commit, accepted, job,
  };
}

function providerOptions(maxArchiveBytes = 8 * 1024 * 1024) {
  return {
    githubAppId: '4910184', githubPrivateKey: PRIVATE_KEY,
    r2AccountId: 'a'.repeat(32), r2Bucket: 'rekt-inkubator-private-evidence',
    r2ApiToken: 'token_'.padEnd(40, 'x'), maxArchiveBytes,
  };
}

function successFetch(fixture, archiveBytes, observations = []) {
  return async (url, init = {}) => {
    const href = String(url);
    observations.push({href, method: init.method ?? 'GET'});
    if (href === `https://api.github.com/app/installations/${fixture.installationId}/access_tokens`) {
      return new Response(JSON.stringify({token: 'ghs_f3b_test_token'}), {status: 201, headers: {'content-type': 'application/json'}});
    }
    if (href === 'https://api.github.com/repos/builder/original-repo') {
      return new Response(JSON.stringify({id: Number(fixture.repositoryId), full_name: 'builder/original-repo'}), {status: 200, headers: {'content-type': 'application/json'}});
    }
    if (href === `https://api.github.com/repos/builder/original-repo/tarball/${fixture.commit}`) {
      return new Response(archiveBytes, {status: 200, headers: {'content-length': String(archiveBytes.byteLength)}});
    }
    if (href.includes('api.cloudflare.com/client/v4/accounts/') && init.method === 'PUT') {
      const key = `challenge-submissions/${fixture.submissionId}/source.tar.gz`;
      assert.equal(href.endsWith(`/objects/${key}`), true);
      assert.equal(init.headers.authorization, `Bearer ${providerOptions().r2ApiToken}`);
      assert.ok(init.body instanceof FormData);
      const body = init.body.get('body');
      assert.ok(body instanceof Blob);
      assert.equal(body.size, archiveBytes.byteLength);
      return new Response(JSON.stringify({success: true, result: {key, size: String(archiveBytes.byteLength)}}), {status: 200, headers: {'content-type': 'application/json'}});
    }
    throw new Error(`unexpected_fetch:${href}`);
  };
}

test('F3B freezes GitHub numeric repository identity and Project rebind cannot redirect capture', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedGitHubFixture(db);
    await db.updateTable('projects').set({repository_id: fixture.replacementRepositoryId}).where('project_id', '=', fixture.projectId).execute();

    const archiveBytes = Buffer.from('private immutable source archive');
    const observations = [];
    const client = createGitHubR2ChallengeArchiveCaptureClient(db, providerOptions(), successFetch(fixture, archiveBytes, observations));
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: client})).status, 'succeeded');

    const state = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(state.status, 'CAPTURED');
    assert.equal(state.archive_digest, createHash('sha256').update(archiveBytes).digest('hex'));
    assert.equal(state.archive_reference, `r2://rekt-inkubator-private-evidence/challenge-submissions/${fixture.submissionId}/source.tar.gz`);
    assert.equal(observations.some(({href}) => href.includes('replacement-repo')), false);
    assert.equal(observations.some(({href}) => href.includes('original-repo/tarball/')), true);

    const submission = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.deepEqual(submission.manifest_json, fixture.accepted.manifest_json);
    assert.equal(submission.accepted_at.getTime(), fixture.accepted.accepted_at.getTime());
  } finally { await db.destroy(); }
});

test('F3B missing frozen repository lineage fails closed before GitHub or R2 network calls', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedGitHubFixture(db);
    await sql`delete from challenge_submission_archive_sources where submission_id = ${fixture.submissionId}`.execute(db);
    let fetches = 0;
    const client = createGitHubR2ChallengeArchiveCaptureClient(db, providerOptions(), async () => {
      fetches += 1;
      throw new Error('network must not be used');
    });
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: client})).status, 'succeeded');
    const state = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(state.status, 'UNSUPPORTED_SOURCE');
    assert.equal(state.reason_code, 'GITHUB_REPOSITORY_LINEAGE_MISSING');
    assert.equal(fetches, 0);
  } finally { await db.destroy(); }
});

test('F3B access removal after acceptance remains UNKNOWN rather than builder-caused', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedGitHubFixture(db);
    await db.updateTable('github_repositories').set({active: false}).where('repository_id', '=', fixture.repositoryId).execute();
    await db.insertInto('github_repository_tombstones').values({
      repository_id: fixture.repositoryId,
      installation_id: fixture.installationId,
      source_key: `f3b-test:${fixture.submissionId}`,
    }).execute();
    await db.updateTable('outbox_jobs').set({max_attempts: 1}).where('job_id', '=', fixture.job.job_id).execute();

    let fetches = 0;
    const client = createGitHubR2ChallengeArchiveCaptureClient(db, providerOptions(), async () => {
      fetches += 1;
      throw new Error('network must not be used');
    });
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: client})).status, 'succeeded');
    const state = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(state.status, 'PLATFORM_UNAVAILABLE');
    assert.equal(state.reason_code, 'GITHUB_ACCESS_REMOVED_AFTER_ACCEPTANCE');
    assert.notEqual(state.status, 'BUILDER_CAUSED_UNAVAILABLE');
    assert.equal(fetches, 0);
  } finally { await db.destroy(); }
});

test('F3B R2 lost response retries the exact deterministic object key', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedGitHubFixture(db);
    const archiveBytes = Buffer.from('same archive on every retry');
    const r2Urls = [];
    let r2Attempts = 0;
    const baseFetch = successFetch(fixture, archiveBytes, []);
    const fetchImpl = async (url, init = {}) => {
      const href = String(url);
      if (href.includes('api.cloudflare.com/client/v4/accounts/') && init.method === 'PUT') {
        r2Urls.push(href);
        r2Attempts += 1;
        if (r2Attempts === 1) throw new Error('simulated lost response');
      }
      return baseFetch(url, init);
    };
    const client = createGitHubR2ChallengeArchiveCaptureClient(db, providerOptions(), fetchImpl);
    assert.equal((await runOneJob(db, {retryBaseMs: 1, challengeSubmissionArchiveClient: client})).status, 'retry');
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', fixture.job.job_id).execute();
    assert.equal((await runOneJob(db, {retryBaseMs: 1, challengeSubmissionArchiveClient: client})).status, 'succeeded');
    assert.equal(r2Urls.length, 2);
    assert.equal(r2Urls[0], r2Urls[1]);
    const state = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(state.status, 'CAPTURED');
  } finally { await db.destroy(); }
});

test('F3B archive size cap rejects oversized source before R2 upload', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedGitHubFixture(db);
    const maxBytes = 1024 * 1024;
    let r2Writes = 0;
    const fetchImpl = async (url, init = {}) => {
      const href = String(url);
      if (href === `https://api.github.com/app/installations/${fixture.installationId}/access_tokens`) {
        return new Response(JSON.stringify({token: 'ghs_f3b_test_token'}), {status: 201, headers: {'content-type': 'application/json'}});
      }
      if (href === 'https://api.github.com/repos/builder/original-repo') {
        return new Response(JSON.stringify({id: Number(fixture.repositoryId), full_name: 'builder/original-repo'}), {status: 200, headers: {'content-type': 'application/json'}});
      }
      if (href === `https://api.github.com/repos/builder/original-repo/tarball/${fixture.commit}`) {
        return new Response('not-read', {status: 200, headers: {'content-length': String(maxBytes + 1)}});
      }
      if (href.includes('api.cloudflare.com/')) {
        r2Writes += 1;
        throw new Error('R2 must not be called');
      }
      throw new Error(`unexpected_fetch:${href}`);
    };
    const client = createGitHubR2ChallengeArchiveCaptureClient(db, providerOptions(maxBytes), fetchImpl);
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: client})).status, 'succeeded');
    const state = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(state.status, 'UNSUPPORTED_SOURCE');
    assert.equal(state.reason_code, 'ARCHIVE_TOO_LARGE');
    assert.equal(r2Writes, 0);
  } finally { await db.destroy(); }
});
