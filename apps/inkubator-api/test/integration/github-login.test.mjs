import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../../dist/database.js';
import {establishGitHubLoginSession} from '../../dist/github-login.js';
import {SESSION_EXPIRY_JOB_TYPE} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {createPlayer} from '../../dist/players.js';
import {resolveSessionActor} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');

const DISPLAY_NAMES = [
  'OAuth New Builder',
  'OAuth Legacy Builder',
  'OAuth Ambiguous A',
  'OAuth Ambiguous B',
];

async function cleanup(db) {
  const players = await db
    .selectFrom('players')
    .select('player_id')
    .where('display_name', 'in', DISPLAY_NAMES)
    .execute();
  const playerIds = players.map((row) => row.player_id);

  if (playerIds.length > 0) {
    await db.deleteFrom('sessions').where('player_id', 'in', playerIds).execute();
    await db.deleteFrom('github_installations').where('player_id', 'in', playerIds).execute();
    await db.deleteFrom('players').where('player_id', 'in', playerIds).execute();
  }
  await db.deleteFrom('outbox_jobs').where('job_type', '=', SESSION_EXPIRY_JOB_TYPE).execute();
}

test('GitHub login creates, reuses and adopts exactly one PLAYER while ambiguity fails closed', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await cleanup(db);

  try {
    const firstIdentity = {githubUserId: '987650001', login: 'OAuth New Builder'};
    const first = await establishGitHubLoginSession(db, firstIdentity, 3600);
    assert.equal(first.created, true);
    assert.deepEqual(await resolveSessionActor(db, first.session.token), {playerId: first.player.player_id});

    const firstStored = await db
      .selectFrom('players')
      .select(['player_id', 'github_user_id'])
      .where('player_id', '=', first.player.player_id)
      .executeTakeFirstOrThrow();
    assert.equal(firstStored.github_user_id, firstIdentity.githubUserId);

    const repeated = await establishGitHubLoginSession(db, firstIdentity, 3600);
    assert.equal(repeated.created, false);
    assert.equal(repeated.player.player_id, first.player.player_id);
    assert.notEqual(repeated.session.sessionId, first.session.sessionId);
    const repeatedCount = await db
      .selectFrom('players')
      .select('player_id')
      .where('github_user_id', '=', firstIdentity.githubUserId)
      .execute();
    assert.equal(repeatedCount.length, 1);

    const legacyPlayer = await createPlayer(db, 'OAuth Legacy Builder');
    await db.insertInto('github_installations').values({
      installation_id: '987651001',
      player_id: legacyPlayer.player_id,
      github_user_id: '987650002',
      account_id: '987652001',
      account_type: 'User',
      repository_selection: 'selected',
      revoked_at: null,
    }).executeTakeFirstOrThrow();

    const adopted = await establishGitHubLoginSession(
      db,
      {githubUserId: '987650002', login: 'renamed-github-handle'},
      3600,
    );
    assert.equal(adopted.created, false);
    assert.equal(adopted.player.player_id, legacyPlayer.player_id);
    const adoptedStored = await db
      .selectFrom('players')
      .select('github_user_id')
      .where('player_id', '=', legacyPlayer.player_id)
      .executeTakeFirstOrThrow();
    assert.equal(adoptedStored.github_user_id, '987650002');

    const ambiguousA = await createPlayer(db, 'OAuth Ambiguous A');
    const ambiguousB = await createPlayer(db, 'OAuth Ambiguous B');
    await db.insertInto('github_installations').values([
      {
        installation_id: '987651002',
        player_id: ambiguousA.player_id,
        github_user_id: '987650003',
        account_id: '987652002',
        account_type: 'User',
        repository_selection: 'selected',
        revoked_at: null,
      },
      {
        installation_id: '987651003',
        player_id: ambiguousB.player_id,
        github_user_id: '987650003',
        account_id: '987652003',
        account_type: 'User',
        repository_selection: 'selected',
        revoked_at: null,
      },
    ]).execute();

    const sessionsBefore = await db.selectFrom('sessions').select('session_id').execute();
    await assert.rejects(
      () => establishGitHubLoginSession(db, {githubUserId: '987650003', login: 'ambiguous-login'}, 3600),
      /github_identity_ambiguous/,
    );
    const sessionsAfter = await db.selectFrom('sessions').select('session_id').execute();
    assert.equal(sessionsAfter.length, sessionsBefore.length);

    const ambiguousPlayers = await db
      .selectFrom('players')
      .select(['player_id', 'github_user_id'])
      .where('player_id', 'in', [ambiguousA.player_id, ambiguousB.player_id])
      .execute();
    assert.deepEqual(ambiguousPlayers.map((row) => row.github_user_id), [null, null]);
  } finally {
    await cleanup(db);
    await db.destroy();
  }
});
