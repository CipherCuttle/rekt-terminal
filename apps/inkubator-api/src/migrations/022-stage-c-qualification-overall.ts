import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const stageCQualificationOverallMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await sql`alter table challenge_qualifications drop constraint challenge_qualifications_result`.execute(db);
    await sql`
      update challenge_qualifications
      set result = case result
        when 'PASS' then 'QUALIFIED'
        when 'FAIL' then 'NOT_QUALIFIED'
        else result
      end,
      qualification_json = case
        when qualification_json ? 'overall' then jsonb_set(
          qualification_json,
          '{overall}',
          to_jsonb(case qualification_json ->> 'overall'
            when 'PASS' then 'QUALIFIED'
            when 'FAIL' then 'NOT_QUALIFIED'
            else qualification_json ->> 'overall'
          end),
          false
        )
        else qualification_json
      end
      where result in ('PASS','FAIL')
         or qualification_json ->> 'overall' in ('PASS','FAIL')
    `.execute(db);
    await sql`
      alter table challenge_qualifications
      add constraint challenge_qualifications_result
      check (result in ('QUALIFIED','NOT_QUALIFIED','DISPUTED'))
    `.execute(db);

    await sql`alter table challenges add column organizer_payout_identity text`.execute(db);
    await sql`alter table challenges add column funder_payout_identity text`.execute(db);
    await sql`
      update challenges challenge
      set organizer_payout_identity = created.payload ->> 'organizer_payout_identity',
          funder_payout_identity = created.payload ->> 'funder_payout_identity'
      from history_events created
      where created.event_family = 'activity'
        and created.event_type = 'challenge.created'
        and created.subject_type = 'challenge'
        and created.subject_id = challenge.challenge_id::text
        and challenge.organizer_payout_identity is null
        and challenge.funder_payout_identity is null
        and created.payload ? 'organizer_payout_identity'
        and created.payload ? 'funder_payout_identity'
    `.execute(db);
    const missingPayoutAuthority = await sql<{count: string}>`
      select count(*)::text as count
      from challenges
      where organizer_payout_identity is null or funder_payout_identity is null
    `.execute(db);
    if (Number(missingPayoutAuthority.rows[0]?.count ?? '0') !== 0) {
      throw new Error('stage_c_reserved_payout_identity_backfill_missing');
    }
    await sql`alter table challenges alter column organizer_payout_identity set not null`.execute(db);
    await sql`alter table challenges alter column funder_payout_identity set not null`.execute(db);
    await sql`
      alter table challenges
      add constraint challenges_organizer_payout_identity_shape
      check (char_length(organizer_payout_identity) between 1 and 256)
    `.execute(db);
    await sql`
      alter table challenges
      add constraint challenges_funder_payout_identity_shape
      check (char_length(funder_payout_identity) between 1 and 256)
    `.execute(db);

    await sql`alter table challenge_receipts add column protocol_receipt_id text`.execute(db);
    await sql`
      update challenge_receipts
      set protocol_receipt_id = receipt_json ->> 'receipt_id'
      where protocol_receipt_id is null
    `.execute(db);
    await sql`alter table challenge_receipts alter column protocol_receipt_id set not null`.execute(db);
    await sql`
      alter table challenge_receipts
      add constraint challenge_receipts_protocol_id_unique unique (protocol_receipt_id)
    `.execute(db);
    await sql`
      alter table challenge_receipts
      add constraint challenge_receipts_protocol_id_shape
      check (protocol_receipt_id ~ '^(receipt|correction)_[0-9a-f]{64}$')
    `.execute(db);
  },

  async down(db: Kysely<DatabaseSchema>) {
    await sql`alter table challenge_receipts drop constraint challenge_receipts_protocol_id_shape`.execute(db);
    await sql`alter table challenge_receipts drop constraint challenge_receipts_protocol_id_unique`.execute(db);
    await sql`alter table challenge_receipts drop column protocol_receipt_id`.execute(db);

    await sql`alter table challenges drop constraint challenges_funder_payout_identity_shape`.execute(db);
    await sql`alter table challenges drop constraint challenges_organizer_payout_identity_shape`.execute(db);
    await sql`alter table challenges drop column funder_payout_identity`.execute(db);
    await sql`alter table challenges drop column organizer_payout_identity`.execute(db);

    await sql`alter table challenge_qualifications drop constraint challenge_qualifications_result`.execute(db);
    await sql`
      update challenge_qualifications
      set result = case result
        when 'QUALIFIED' then 'PASS'
        when 'NOT_QUALIFIED' then 'FAIL'
        else result
      end,
      qualification_json = case
        when qualification_json ? 'overall' then jsonb_set(
          qualification_json,
          '{overall}',
          to_jsonb(case qualification_json ->> 'overall'
            when 'QUALIFIED' then 'PASS'
            when 'NOT_QUALIFIED' then 'FAIL'
            else qualification_json ->> 'overall'
          end),
          false
        )
        else qualification_json
      end
      where result in ('QUALIFIED','NOT_QUALIFIED')
         or qualification_json ->> 'overall' in ('QUALIFIED','NOT_QUALIFIED')
    `.execute(db);
    await sql`
      alter table challenge_qualifications
      add constraint challenge_qualifications_result
      check (result in ('PASS','FAIL','DISPUTED'))
    `.execute(db);
  },
};
