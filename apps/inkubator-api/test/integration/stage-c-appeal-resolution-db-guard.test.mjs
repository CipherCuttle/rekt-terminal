import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const digest = (char) => char.repeat(64);

async function addPlayer(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

test('Stage C DB appeal resolution must point to the post-appeal revision, never first pass', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const now = await readDatabaseNow(db);
    const challengeId = randomUUID();
    const organizer = await addPlayer(db, 'appeal-guard-organizer');
    const builder = await addPlayer(db, 'appeal-guard-builder');
    const resolver = await addPlayer(db, 'appeal-guard-resolver');
    const entryId = randomUUID();
    const submissionId = randomUUID();
    const firstPassId = randomUUID();
    const appealId = randomUUID();
    const termsDigest = digest('a');

    await sql`
      insert into challenges (
        challenge_id, organizer_player_id, status,
        mechanism_version, settlement_policy_version, ip_terms_version,
        current_contract_version, current_terms_digest,
        slot_limit, activation_minimum,
        entry_deadline, build_start, submission_deadline, appeal_window_ms, review_deadline,
        organizer_payout_identity, funder_payout_identity
      ) values (
        ${challengeId}, ${organizer}, 'ENTRY_OPEN',
        'funded-challenge/1.1', 'funded-challenge-settlement/1.0', 'bespoke-winner-transfer/1.0',
        '1', ${termsDigest},
        2, 1,
        ${new Date(now.getTime() + 60_000)}, ${new Date(now.getTime() + 60_000)},
        ${new Date(now.getTime() + 120_000)}, 60_000, ${new Date(now.getTime() + 240_000)},
        'organizer-pay', 'funder-pay'
      )
    `.execute(db);

    await sql`
      insert into challenge_entries (entry_id, challenge_id, builder_player_id, payout_identity, state)
      values (${entryId}, ${challengeId}, ${builder}, 'builder-pay', 'SEATED')
    `.execute(db);

    await sql`
      insert into challenge_submissions (
        submission_id, challenge_id, entry_id, submission_version, terms_digest,
        manifest_json, manifest_digest, accepted_at, is_final
      ) values (
        ${submissionId}, ${challengeId}, ${entryId}, '1', ${termsDigest},
        '{}'::jsonb, ${digest('b')}, ${now}, true
      )
    `.execute(db);

    await sql`update challenges set status = 'QUALIFICATION' where challenge_id = ${challengeId}`.execute(db);
    await sql`
      insert into challenge_qualifications (
        qualification_id, challenge_id, entry_id, submission_id, terms_digest,
        qualification_version, result, qualification_json
      ) values (
        ${firstPassId}, ${challengeId}, ${entryId}, ${submissionId}, ${termsDigest},
        'first-pass.v1', 'QUALIFIED', '{"overall":"QUALIFIED","criteria":[]}'::jsonb
      )
    `.execute(db);

    await sql`
      update challenges
      set status = 'APPEAL_WINDOW', appeal_opened_at = clock_timestamp()
      where challenge_id = ${challengeId}
    `.execute(db);
    await sql`
      insert into challenge_appeals (
        appeal_id, challenge_id, entry_id, qualification_id, appeal_json, appeal_digest
      ) values (
        ${appealId}, ${challengeId}, ${entryId}, ${firstPassId},
        '{"type":"APPEAL","reason":"db guard"}'::jsonb, ${digest('c')}
      )
    `.execute(db);

    await assert.rejects(
      sql`
        insert into challenge_appeal_resolutions (
          resolution_id, appeal_id, effective_qualification_id, resolver_player_id,
          resolution_json, resolution_digest
        ) values (
          ${randomUUID()}, ${appealId}, ${firstPassId}, ${resolver},
          '{"type":"RESOLUTION","result":"PASS"}'::jsonb, ${digest('d')}
        )
      `.execute(db),
      /challenge_appeal_effective_qualification_invalid/,
    );

    const revisionId = randomUUID();
    await sql`
      insert into challenge_qualifications (
        qualification_id, challenge_id, entry_id, submission_id, terms_digest,
        qualification_version, result, qualification_json
      ) values (
        ${revisionId}, ${challengeId}, ${entryId}, ${submissionId}, ${termsDigest},
        'appeal-revision.v1', 'QUALIFIED', '{"overall":"QUALIFIED","criteria":[]}'::jsonb
      )
    `.execute(db);
    await sql`
      insert into challenge_appeal_resolutions (
        resolution_id, appeal_id, effective_qualification_id, resolver_player_id,
        resolution_json, resolution_digest
      ) values (
        ${randomUUID()}, ${appealId}, ${revisionId}, ${resolver},
        '{"type":"RESOLUTION","result":"PASS"}'::jsonb, ${digest('e')}
      )
    `.execute(db);

    const stored = (await sql`
      select effective_qualification_id, resolver_player_id
      from challenge_appeal_resolutions where appeal_id = ${appealId}
    `.execute(db)).rows[0];
    assert.equal(stored.effective_qualification_id, revisionId);
    assert.equal(stored.resolver_player_id, resolver);

    await sql`delete from challenges where challenge_id = ${challengeId}`.execute(db);
  } finally {
    await db.destroy();
  }
});
