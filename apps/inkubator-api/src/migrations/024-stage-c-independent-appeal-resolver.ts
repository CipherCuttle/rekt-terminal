import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const stageCIndependentAppealResolverMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await sql`
      create or replace function stage_c_guard_appeal_resolution_lineage()
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
        if new.resolver_player_id = authority.organizer_player_id
          or exists (
            select 1 from challenge_entries entry
            where entry.challenge_id = appeal_row.challenge_id
              and entry.builder_player_id = new.resolver_player_id
          ) then
          raise exception 'challenge_appeal_resolution_authority_invalid' using errcode = '23514';
        end if;
        if new.effective_qualification_id = appeal_row.qualification_id
          or not exists (
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
  },
  async down(db: Kysely<DatabaseSchema>) {
    await sql`
      create or replace function stage_c_guard_appeal_resolution_lineage()
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
  },
};
