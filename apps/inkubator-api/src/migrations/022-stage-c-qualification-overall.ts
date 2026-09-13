import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const stageCQualificationOverallMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await sql`alter table challenge_qualifications drop constraint challenge_qualifications_result`.execute(db);
    await sql`
      alter table challenge_qualifications
      add constraint challenge_qualifications_result
      check (result in ('QUALIFIED','NOT_QUALIFIED','DISPUTED'))
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

    await sql`alter table challenge_qualifications drop constraint challenge_qualifications_result`.execute(db);
    await sql`
      alter table challenge_qualifications
      add constraint challenge_qualifications_result
      check (result in ('PASS','FAIL','DISPUTED'))
    `.execute(db);
  },
};
