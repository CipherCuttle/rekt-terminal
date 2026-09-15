import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {acceptChallengeSubmission, acquireChallengeSeat, createChallenge, persistFrozenBuildContract} from '../../dist/challenge-store.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

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
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'f3b-race-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'Stage F3B repository race',
    brief: 'Repository identity must be point-in-time correct at authoritative acceptance.',
    outcome_contract: {criteria: [{id: 'OUT-1', description: 'Freeze the authoritative repository', mandatory: true}]},
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
}

async function pendingFixture(db) {
  const now = (await readDatabaseNow(db)).getTime();
  const organizer = await player(db, 'f3b-race-organizer');
  const builder = await player(db, 'f3b-race-builder');
  const installationId = numericId();
  const originalRepositoryId = numericId();
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
  await db.insertInto('github_repositories').values([
    {
      repository_id: originalRepositoryId,
      installation_id: installationId,
      full_name: 'builder/race-original',
      private: true,
      active: true,
    },
    {
      repository_id: replacementRepositoryId,
      installation_id: installationId,
      full_name: 'builder/race-replacement',
      private: true,
      active: true,
    },
  ]).execute();
  await db.insertInto('projects').values({
    project_id: projectId,
    schema_version: 'project.current.v1',
    owner_player_id: builder,
    name: 'F3B race project',
    repository_id: originalRepositoryId,
  }).execute();

  const challengeId = randomUUID();
  const contract = contractFor(challengeId, now);
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
  const entry = await acquireChallengeSeat(db, {
    requestId: randomUUID(),
    entryId: randomUUID(),
    challengeId,
    builderPlayerId: builder,
    payoutIdentity: `builder-${challengeId}`,
    projectId,
  });
  await db.updateTable('challenges').set({status: 'BUILDING'}).where('challenge_id', '=', challengeId).execute();
  await db.updateTable('challenge_entries').set({
    state: 'ACTIVE',
    build_start: new Date(contract.build_start),
    submission_deadline: new Date(contract.submission_deadline),
  }).where('entry_id', '=', entry.entry_id).execute();

  const submissionId = randomUUID();
  return {
    projectId,
    originalRepositoryId,
    replacementRepositoryId,
    challengeId,
    entryId: entry.entry_id,
    submissionId,
    manifest: {
      schema_version: 'inkubator.submission-manifest/1.0',
      challenge_id: challengeId,
      entry_id: entry.entry_id,
      terms_digest: contract.terms_digest,
      submission_version: 1,
      immutable_source_reference: {kind: 'GIT_COMMIT', value: 'c'.repeat(40)},
      artifact_digest: 'd'.repeat(64),
      evidence_references: [],
      accepted_at: 0,
    },
  };
}

async function waitForBlockedAdvisoryLock(db) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await sql`
      select count(*)::int as waiting
      from pg_locks
      where locktype = 'advisory' and granted = false
    `.execute(db);
    if (Number(result.rows[0]?.waiting ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('submission acceptance never waited on the project repository advisory lock');
}

test('F3B acceptance serializes behind an in-flight Project repository rebind before accepted_at', async () => {
  const setupDb = createDatabase(databaseUrl);
  const blockerDb = createDatabase(databaseUrl);
  const acceptanceDb = createDatabase(databaseUrl);
  const observerDb = createDatabase(databaseUrl);
  await migrateToLatest(setupDb);

  let releaseRebind;
  const releaseRebindPromise = new Promise((resolve) => { releaseRebind = resolve; });
  let rebindReady;
  const rebindReadyPromise = new Promise((resolve) => { rebindReady = resolve; });

  try {
    const fixture = await pendingFixture(setupDb);
    let rebindObservedAt;
    const rebind = blockerDb.transaction().execute(async (transaction) => {
      const lockKey = `rekt:project-repository-link:project:${fixture.projectId}`;
      await sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`.execute(transaction);
      await transaction.updateTable('projects').set({
        repository_id: fixture.replacementRepositoryId,
        updated_at: sql`clock_timestamp()`,
      }).where('project_id', '=', fixture.projectId).execute();
      rebindObservedAt = await readDatabaseNow(transaction);
      rebindReady();
      await releaseRebindPromise;
    });

    await rebindReadyPromise;
    const acceptance = acceptChallengeSubmission(acceptanceDb, {
      requestId: randomUUID(),
      submissionId: fixture.submissionId,
      challengeId: fixture.challengeId,
      entryId: fixture.entryId,
      manifest: fixture.manifest,
    });

    await waitForBlockedAdvisoryLock(observerDb);
    const beforeRelease = await observerDb.selectFrom('challenge_submissions').select('submission_id')
      .where('submission_id', '=', fixture.submissionId).executeTakeFirst();
    assert.equal(beforeRelease, undefined);

    releaseRebind();
    await rebind;
    const accepted = await acceptance;

    const source = await sql`
      select repository_id::text as repository_id
      from challenge_submission_archive_sources
      where submission_id = ${fixture.submissionId}
    `.execute(observerDb);
    assert.equal(source.rows.length, 1);
    assert.equal(source.rows[0].repository_id, fixture.replacementRepositoryId);
    assert.notEqual(source.rows[0].repository_id, fixture.originalRepositoryId);
    assert.ok(rebindObservedAt instanceof Date);
    assert.ok(accepted.accepted_at.getTime() >= rebindObservedAt.getTime());
  } finally {
    releaseRebind?.();
    await Promise.allSettled([setupDb.destroy(), blockerDb.destroy(), acceptanceDb.destroy(), observerDb.destroy()]);
  }
});
