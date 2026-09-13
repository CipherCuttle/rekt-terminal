import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const stageCAppealAuthorityMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await sql`alter table challenges add column appeal_opened_at timestamptz`.execute(db);

    await db.schema
      .createTable('challenge_appeals')
      .addColumn('appeal_id', 'uuid', (c) => c.primaryKey())
      .addColumn('challenge_id', 'uuid', (c) => c.notNull().references('challenges.challenge_id').onDelete('cascade'))
      .addColumn('entry_id', 'uuid', (c) => c.notNull().references('challenge_entries.entry_id').onDelete('cascade'))
      .addColumn('qualification_id', 'uuid', (c) => c.notNull().references('challenge_qualifications.qualification_id'))
      .addColumn('appeal_json', 'jsonb', (c) => c.notNull())
      .addColumn('appeal_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addUniqueConstraint('challenge_appeals_entry_unique', ['challenge_id', 'entry_id'])
      .addCheckConstraint('challenge_appeals_digest', sql`appeal_digest ~ '^[0-9a-f]{64}$'`)
      .execute();

    await db.schema
      .createTable('challenge_appeal_resolutions')
      .addColumn('resolution_id', 'uuid', (c) => c.primaryKey())
      .addColumn('appeal_id', 'uuid', (c) => c.notNull().references('challenge_appeals.appeal_id').onDelete('cascade'))
      .addColumn('effective_qualification_id', 'uuid', (c) => c.notNull().references('challenge_qualifications.qualification_id'))
      .addColumn('resolver_player_id', 'uuid', (c) => c.notNull().references('players.player_id'))
      .addColumn('resolution_json', 'jsonb', (c) => c.notNull())
      .addColumn('resolution_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addUniqueConstraint('challenge_appeal_resolutions_appeal_unique', ['appeal_id'])
      .addCheckConstraint('challenge_appeal_resolutions_digest', sql`resolution_digest ~ '^[0-9a-f]{64}$'`)
      .execute();

    await sql`
      create function stage_c_guard_entry_deadline()
      returns trigger
      language plpgsql
      as $$
      declare authority challenges%rowtype;
      begin
        select * into authority from challenges where challenge_id = new.challenge_id for update;
        if not found then
          raise exception 'challenge_not_found' using errcode = '23514';
        end if;
        if authority.status <> 'ENTRY_OPEN' then
          raise exception 'challenge_entry_not_open' using errcode = '23514';
        end if;
        if clock_timestamp() >= authority.entry_deadline then
          raise exception 'challenge_entry_deadline_elapsed' using errcode = '23514';
        end if;
        return new;
      end;
      $$
    `.execute(db);
    await sql`
      create trigger challenge_entries_deadline_guard
      before insert on challenge_entries
      for each row execute function stage_c_guard_entry_deadline()
    `.execute(db);

    await sql`
      create function stage_c_guard_qualification_lineage()
      returns trigger
      language plpgsql
      as $$
      declare authority challenges%rowtype;
      declare existing_count integer;
      begin
        select * into authority from challenges where challenge_id = new.challenge_id for update;
        if not found then
          raise exception 'challenge_not_found' using errcode = '23514';
        end if;
        if not exists (
          select 1 from challenge_submissions submission
          where submission.submission_id = new.submission_id
            and submission.challenge_id = new.challenge_id
            and submission.entry_id = new.entry_id
            and submission.is_final = true
            and submission.terms_digest = authority.current_terms_digest
        ) then
          raise exception 'challenge_qualification_lineage_invalid' using errcode = '23514';
        end if;

        select count(*) into existing_count
        from challenge_qualifications qualification
        where qualification.challenge_id = new.challenge_id
          and qualification.entry_id = new.entry_id;

        if authority.status = 'QUALIFICATION' then
          if existing_count <> 0 then
            raise exception 'challenge_first_pass_qualification_already_recorded' using errcode = '23514';
          end if;
        elsif authority.status = 'APPEAL_WINDOW' then
          if existing_count <> 1 then
            raise exception 'challenge_appeal_revision_budget_invalid' using errcode = '23514';
          end if;
          if not exists (
            select 1 from challenge_appeals appeal
            left join challenge_appeal_resolutions resolution on resolution.appeal_id = appeal.appeal_id
            where appeal.challenge_id = new.challenge_id
              and appeal.entry_id = new.entry_id
              and resolution.appeal_id is null
          ) then
            raise exception 'challenge_appeal_revision_requires_unresolved_appeal' using errcode = '23514';
          end if;
        else
          raise exception 'challenge_qualification_lifecycle_invalid' using errcode = '23514';
        end if;
        return new;
      end;
      $$
    `.execute(db);
    await sql`
      create trigger challenge_qualifications_lineage_guard
      before insert on challenge_qualifications
      for each row execute function stage_c_guard_qualification_lineage()
    `.execute(db);

    await sql`
      create function stage_c_guard_appeal_lineage()
      returns trigger
      language plpgsql
      as $$
      declare authority challenges%rowtype;
      begin
        select * into authority from challenges where challenge_id = new.challenge_id for update;
        if not found or authority.status <> 'APPEAL_WINDOW' or authority.appeal_opened_at is null then
          raise exception 'challenge_appeal_window_not_open' using errcode = '23514';
        end if;
        if clock_timestamp() >= authority.appeal_opened_at + (authority.appeal_window_ms * interval '1 millisecond') then
          raise exception 'challenge_appeal_window_closed' using errcode = '23514';
        end if;
        if not exists (
          select 1
          from challenge_qualifications qualification
          join challenge_submissions submission on submission.submission_id = qualification.submission_id
          where qualification.qualification_id = new.qualification_id
            and qualification.challenge_id = new.challenge_id
            and qualification.entry_id = new.entry_id
            and qualification.terms_digest = authority.current_terms_digest
            and submission.is_final = true
        ) then
          raise exception 'challenge_appeal_qualification_lineage_invalid' using errcode = '23514';
        end if;
        return new;
      end;
      $$
    `.execute(db);
    await sql`
      create trigger challenge_appeals_lineage_guard
      before insert on challenge_appeals
      for each row execute function stage_c_guard_appeal_lineage()
    `.execute(db);

    await sql`
      create function stage_c_guard_appeal_resolution_lineage()
      returns trigger
      language plpgsql
      as $$
      declare appeal_row challenge_appeals%rowtype;
      declare authority challenges%rowtype;
      begin
        select * into appeal_row from challenge_appeals where appeal_id = new.appeal_id for update;
        if not found then
          raise exception 'challenge_appeal_not_found' using errcode = '23514';
        end if;
        select * into authority from challenges where challenge_id = appeal_row.challenge_id for update;
        if authority.status <> 'APPEAL_WINDOW' then
          raise exception 'challenge_appeal_resolution_lifecycle_invalid' using errcode = '23514';
        end if;
        if new.resolver_player_id <> authority.organizer_player_id then
          raise exception 'challenge_appeal_resolution_authority_invalid' using errcode = '23514';
        end if;
        if not exists (
          select 1
          from challenge_qualifications qualification
          join challenge_submissions submission on submission.submission_id = qualification.submission_id
          where qualification.qualification_id = new.effective_qualification_id
            and qualification.challenge_id = appeal_row.challenge_id
            and qualification.entry_id = appeal_row.entry_id
            and qualification.terms_digest = authority.current_terms_digest
            and submission.is_final = true
        ) then
          raise exception 'challenge_appeal_effective_qualification_invalid' using errcode = '23514';
        end if;
        return new;
      end;
      $$
    `.execute(db);
    await sql`
      create trigger challenge_appeal_resolutions_lineage_guard
      before insert on challenge_appeal_resolutions
      for each row execute function stage_c_guard_appeal_resolution_lineage()
    `.execute(db);

    await sql`
      create function stage_c_guard_decision_lifecycle()
      returns trigger
      language plpgsql
      as $$
      declare authority challenges%rowtype;
      declare expected_qualifiers jsonb;
      declare stored_qualifiers jsonb;
      declare selected_entry text;
      declare intent_type text;
      begin
        select * into authority from challenges where challenge_id = new.challenge_id for update;
        if not found then
          raise exception 'challenge_not_found' using errcode = '23514';
        end if;

        if new.decision_type = 'FINAL_QUALIFIERS' then
          if authority.status <> 'APPEAL_WINDOW' or authority.appeal_opened_at is null then
            raise exception 'challenge_final_qualifiers_lifecycle_invalid' using errcode = '23514';
          end if;
          if clock_timestamp() < authority.appeal_opened_at + (authority.appeal_window_ms * interval '1 millisecond') then
            raise exception 'challenge_appeal_window_not_elapsed' using errcode = '23514';
          end if;
          if exists (
            select 1 from challenge_appeals appeal
            left join challenge_appeal_resolutions resolution on resolution.appeal_id = appeal.appeal_id
            where appeal.challenge_id = new.challenge_id and resolution.appeal_id is null
          ) then
            raise exception 'challenge_appeals_unresolved' using errcode = '23514';
          end if;
          if exists (
            select 1 from challenge_submissions submission
            where submission.challenge_id = new.challenge_id
              and submission.is_final = true
              and not exists (
                select 1 from challenge_qualifications qualification
                where qualification.challenge_id = new.challenge_id
                  and qualification.entry_id = submission.entry_id
                  and qualification.submission_id = submission.submission_id
              )
          ) then
            raise exception 'challenge_first_pass_qualification_incomplete' using errcode = '23514';
          end if;

          with first_pass as (
            select distinct on (qualification.entry_id)
              qualification.entry_id, qualification.qualification_id, qualification.result
            from challenge_qualifications qualification
            join challenge_submissions submission on submission.submission_id = qualification.submission_id
            where qualification.challenge_id = new.challenge_id
              and submission.is_final = true
              and qualification.terms_digest = authority.current_terms_digest
            order by qualification.entry_id, qualification.created_at, qualification.qualification_id
          ), effective as (
            select first_pass.entry_id,
                   coalesce(revised.result, first_pass.result) as result
            from first_pass
            left join challenge_appeals appeal
              on appeal.challenge_id = new.challenge_id and appeal.entry_id = first_pass.entry_id
            left join challenge_appeal_resolutions resolution on resolution.appeal_id = appeal.appeal_id
            left join challenge_qualifications revised
              on revised.qualification_id = resolution.effective_qualification_id
          )
          select coalesce(jsonb_agg(entry_id::text order by entry_id::text) filter (where result = 'QUALIFIED'), '[]'::jsonb)
          into expected_qualifiers
          from effective;

          if new.decision_json <> jsonb_build_object('final_qualifier_ids', expected_qualifiers) then
            raise exception 'challenge_final_qualifiers_authority_mismatch' using errcode = '23514';
          end if;
          if exists (select 1 from challenge_decisions where challenge_id = new.challenge_id and decision_type = 'FINAL_QUALIFIERS') then
            raise exception 'challenge_final_qualifiers_already_recorded' using errcode = '23514';
          end if;

        elsif new.decision_type = 'SELECTION' then
          if authority.status <> 'SELECTION' then
            raise exception 'challenge_selection_lifecycle_invalid' using errcode = '23514';
          end if;
          if clock_timestamp() >= authority.review_deadline then
            raise exception 'challenge_selection_window_elapsed' using errcode = '23514';
          end if;
          selected_entry := new.decision_json ->> 'selected_entry_id';
          select decision_json -> 'final_qualifier_ids' into stored_qualifiers
          from challenge_decisions
          where challenge_id = new.challenge_id and decision_type = 'FINAL_QUALIFIERS'
          order by created_at desc, decision_id desc limit 1;
          if selected_entry is null or stored_qualifiers is null or not (stored_qualifiers ? selected_entry) then
            raise exception 'challenge_selection_not_final_qualifier' using errcode = '23514';
          end if;
          if exists (select 1 from challenge_decisions where challenge_id = new.challenge_id and decision_type = 'SELECTION') then
            raise exception 'challenge_selection_already_recorded' using errcode = '23514';
          end if;

        elsif new.decision_type = 'DEFAULT_RESOLUTION' then
          if authority.status <> 'SELECTION' then
            raise exception 'challenge_default_resolution_lifecycle_invalid' using errcode = '23514';
          end if;
          if clock_timestamp() < authority.review_deadline then
            raise exception 'challenge_review_deadline_not_reached' using errcode = '23514';
          end if;
          if exists (select 1 from challenge_decisions where challenge_id = new.challenge_id and decision_type = 'SELECTION') then
            raise exception 'challenge_valid_selection_already_exists' using errcode = '23514';
          end if;
          if exists (select 1 from challenge_decisions where challenge_id = new.challenge_id and decision_type = 'DEFAULT_RESOLUTION') then
            raise exception 'challenge_default_resolution_already_recorded' using errcode = '23514';
          end if;

        elsif new.decision_type = 'SETTLEMENT_INTENT' then
          intent_type := new.decision_json ->> 'type';
          if authority.status = 'NOT_ACTIVATED' then
            if intent_type <> 'REFUND_PRE_BUILD' then raise exception 'challenge_settlement_path_invalid' using errcode = '23514'; end if;
          elsif authority.status = 'FINAL_QUALIFIERS' then
            select decision_json -> 'final_qualifier_ids' into stored_qualifiers
            from challenge_decisions
            where challenge_id = new.challenge_id and decision_type = 'FINAL_QUALIFIERS'
            order by created_at desc, decision_id desc limit 1;
            if intent_type <> 'REFUND_NO_QUALIFIER' or stored_qualifiers <> '[]'::jsonb then
              raise exception 'challenge_settlement_path_invalid' using errcode = '23514';
            end if;
          elsif authority.status = 'SELECTION' then
            if intent_type <> 'WINNER_PAYOUT' then
              raise exception 'challenge_settlement_path_invalid' using errcode = '23514';
            end if;
            select decision_json ->> 'selected_entry_id' into selected_entry
            from challenge_decisions
            where challenge_id = new.challenge_id and decision_type = 'SELECTION'
            order by created_at desc, decision_id desc limit 1;
            if selected_entry is null or new.decision_json ->> 'winner_entry_id' <> selected_entry then
              raise exception 'challenge_selection_required' using errcode = '23514';
            end if;
          elsif authority.status = 'DEFAULT_RESOLUTION' then
            if intent_type not in ('WINNER_PAYOUT','DEFAULT_DISTRIBUTION','REFUND_NO_QUALIFIER') then
              raise exception 'challenge_settlement_path_invalid' using errcode = '23514';
            end if;
          else
            raise exception 'challenge_settlement_intent_lifecycle_invalid' using errcode = '23514';
          end if;
          if exists (select 1 from challenge_decisions where challenge_id = new.challenge_id and decision_type = 'SETTLEMENT_INTENT') then
            raise exception 'challenge_settlement_intent_already_recorded' using errcode = '23514';
          end if;

        elsif new.decision_type = 'SETTLEMENT_EXECUTION_FACT' then
          if authority.status <> 'SETTLEMENT_PENDING' then
            raise exception 'challenge_settlement_execution_lifecycle_invalid' using errcode = '23514';
          end if;
          if not exists (select 1 from challenge_decisions where challenge_id = new.challenge_id and decision_type = 'SETTLEMENT_INTENT') then
            raise exception 'challenge_settlement_intent_required' using errcode = '23514';
          end if;
          if exists (select 1 from challenge_decisions where challenge_id = new.challenge_id and decision_type = 'SETTLEMENT_EXECUTION_FACT') then
            raise exception 'challenge_settlement_execution_already_recorded' using errcode = '23514';
          end if;
        end if;
        return new;
      end;
      $$
    `.execute(db);
    await sql`
      create trigger challenge_decisions_lifecycle_guard
      before insert on challenge_decisions
      for each row execute function stage_c_guard_decision_lifecycle()
    `.execute(db);

    await sql`
      create function stage_c_advance_decision_lifecycle()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.decision_type = 'DEFAULT_RESOLUTION' then
          update challenges set status = 'DEFAULT_RESOLUTION', updated_at = clock_timestamp()
          where challenge_id = new.challenge_id and status = 'SELECTION';
        elsif new.decision_type = 'SETTLEMENT_INTENT' then
          update challenges set status = 'SETTLEMENT_PENDING', updated_at = clock_timestamp()
          where challenge_id = new.challenge_id and status in ('NOT_ACTIVATED','FINAL_QUALIFIERS','SELECTION','DEFAULT_RESOLUTION');
        elsif new.decision_type = 'SETTLEMENT_EXECUTION_FACT' then
          update challenges set status = 'SETTLED', updated_at = clock_timestamp()
          where challenge_id = new.challenge_id and status = 'SETTLEMENT_PENDING';
        end if;
        return new;
      end;
      $$
    `.execute(db);
    await sql`
      create trigger challenge_decisions_lifecycle_advance
      after insert on challenge_decisions
      for each row execute function stage_c_advance_decision_lifecycle()
    `.execute(db);
  },

  async down(db: Kysely<DatabaseSchema>) {
    await sql`drop trigger if exists challenge_decisions_lifecycle_advance on challenge_decisions`.execute(db);
    await sql`drop function if exists stage_c_advance_decision_lifecycle()`.execute(db);
    await sql`drop trigger if exists challenge_decisions_lifecycle_guard on challenge_decisions`.execute(db);
    await sql`drop function if exists stage_c_guard_decision_lifecycle()`.execute(db);
    await sql`drop trigger if exists challenge_appeal_resolutions_lineage_guard on challenge_appeal_resolutions`.execute(db);
    await sql`drop function if exists stage_c_guard_appeal_resolution_lineage()`.execute(db);
    await sql`drop trigger if exists challenge_appeals_lineage_guard on challenge_appeals`.execute(db);
    await sql`drop function if exists stage_c_guard_appeal_lineage()`.execute(db);
    await sql`drop trigger if exists challenge_qualifications_lineage_guard on challenge_qualifications`.execute(db);
    await sql`drop function if exists stage_c_guard_qualification_lineage()`.execute(db);
    await sql`drop trigger if exists challenge_entries_deadline_guard on challenge_entries`.execute(db);
    await sql`drop function if exists stage_c_guard_entry_deadline()`.execute(db);
    await db.schema.dropTable('challenge_appeal_resolutions').execute();
    await db.schema.dropTable('challenge_appeals').execute();
    await sql`alter table challenges drop column appeal_opened_at`.execute(db);
  },
};
