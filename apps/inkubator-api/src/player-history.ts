import {type Generated, type Kysely} from 'kysely';
import type {DatabaseSchema, ExternalTestOutcome} from './database.js';

export const PLAYER_HISTORY_SCHEMA_VERSION = 'player.history.private.v1' as const;
const HISTORY_LIMIT = 100;

export type PlayerHistoryKind =
  | 'SHIP_ACCEPTED'
  | 'ASSIST_ACCEPTED'
  | 'EXTERNAL_TEST_RECORDED'
  | 'CHEEVO_AWARDED'
  | 'MISSION_BLOCKED'
  | 'MISSION_RECOVERED'
  | 'MISSION_CLOSED_NOT_SHIPPED';

export type PlayerHistoryTruthState = 'CLAIMED' | 'OBSERVED' | 'PROVEN';

export interface PlayerHistoryEntry {
  entry_id: string;
  kind: PlayerHistoryKind;
  truth_state: PlayerHistoryTruthState;
  occurred_at: string;
  project_id?: string;
  project_name?: string;
  mission_id?: string;
  receipt_id?: string;
  artifact_title?: string;
  role?: 'OWNER' | 'PARTY';
  assist_id?: string;
  test_result_id?: string;
  outcome?: ExternalTestOutcome;
  cheevo_award_id?: string;
  cheevo_key?: string;
}

interface HistoryShipReceiptTable {
  receipt_id: string;
  mission_id: string;
  project_id: string;
  artifact_title: string;
  shipped_at: Generated<Date>;
}

interface HistoryShipReceiptAttributionTable {
  receipt_id: string;
  player_id: string;
  role: 'OWNER' | 'PARTY';
}

interface HistoryPlayerCheevoTable {
  award_id: string;
  player_id: string;
  cheevo_key: string;
  earned_at: Date;
}

type HistoryDatabaseSchema = DatabaseSchema & {
  ship_receipts: HistoryShipReceiptTable;
  ship_receipt_attributions: HistoryShipReceiptAttributionTable;
  player_cheevos: HistoryPlayerCheevoTable;
};

type HistoryDb = Kysely<HistoryDatabaseSchema>;

function historyDb(db: Kysely<DatabaseSchema>): HistoryDb {
  return db as unknown as HistoryDb;
}

function missionState(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const state = (payload as Record<string, unknown>).state;
  return typeof state === 'string' ? state : null;
}

function sortEntries(entries: PlayerHistoryEntry[]): PlayerHistoryEntry[] {
  return entries
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at) || left.entry_id.localeCompare(right.entry_id))
    .slice(0, HISTORY_LIMIT);
}

export async function getPlayerHistory(dbInput: Kysely<DatabaseSchema>, playerId: string) {
  const db = historyDb(dbInput);
  const player = await db.selectFrom('players').select('player_id').where('player_id', '=', playerId).executeTakeFirst();
  if (!player) return null;

  const [ships, assists, tests, awards, missionEvents] = await Promise.all([
    db.selectFrom('ship_receipt_attributions')
      .innerJoin('ship_receipts', 'ship_receipts.receipt_id', 'ship_receipt_attributions.receipt_id')
      .innerJoin('projects', 'projects.project_id', 'ship_receipts.project_id')
      .select([
        'ship_receipts.receipt_id',
        'ship_receipts.mission_id',
        'ship_receipts.project_id',
        'ship_receipts.artifact_title',
        'ship_receipts.shipped_at',
        'ship_receipt_attributions.role',
        'projects.name as project_name',
      ])
      .where('ship_receipt_attributions.player_id', '=', playerId)
      .execute(),
    db.selectFrom('assist_offers')
      .innerJoin('projects', 'projects.project_id', 'assist_offers.project_id')
      .select(['assist_offers.assist_id', 'assist_offers.project_id', 'assist_offers.accepted_at', 'projects.name as project_name'])
      .where('assist_offers.offered_by_player_id', '=', playerId)
      .where('assist_offers.state', '=', 'ACCEPTED')
      .where('assist_offers.accepted_at', 'is not', null)
      .execute(),
    db.selectFrom('external_test_results')
      .innerJoin('projects', 'projects.project_id', 'external_test_results.project_id')
      .select([
        'external_test_results.test_result_id',
        'external_test_results.project_id',
        'external_test_results.outcome',
        'external_test_results.observed_at',
        'projects.name as project_name',
      ])
      .where('external_test_results.tester_player_id', '=', playerId)
      .execute(),
    db.selectFrom('player_cheevos')
      .select(['award_id', 'cheevo_key', 'earned_at'])
      .where('player_id', '=', playerId)
      .execute(),
    db.selectFrom('history_events')
      .innerJoin('missions', 'missions.mission_id', 'history_events.subject_id')
      .innerJoin('projects', 'projects.project_id', 'missions.project_id')
      .select([
        'history_events.history_event_id',
        'history_events.payload',
        'history_events.occurred_at',
        'missions.mission_id',
        'projects.project_id',
        'projects.name as project_name',
      ])
      .where('missions.owner_player_id', '=', playerId)
      .where('history_events.subject_type', '=', 'mission')
      .where('history_events.event_type', '=', 'mission.updated')
      .orderBy('history_events.occurred_at', 'asc')
      .orderBy('history_events.history_event_id', 'asc')
      .execute(),
  ]);

  const entries: PlayerHistoryEntry[] = [];

  for (const ship of ships) {
    entries.push({
      entry_id: `ship:${ship.receipt_id}`,
      kind: 'SHIP_ACCEPTED',
      truth_state: 'PROVEN',
      occurred_at: ship.shipped_at.toISOString(),
      project_id: ship.project_id,
      project_name: ship.project_name,
      mission_id: ship.mission_id,
      receipt_id: ship.receipt_id,
      artifact_title: ship.artifact_title,
      role: ship.role,
    });
  }

  for (const assist of assists) {
    if (!(assist.accepted_at instanceof Date)) continue;
    entries.push({
      entry_id: `assist:${assist.assist_id}`,
      kind: 'ASSIST_ACCEPTED',
      truth_state: 'OBSERVED',
      occurred_at: assist.accepted_at.toISOString(),
      project_id: assist.project_id,
      project_name: assist.project_name,
      assist_id: assist.assist_id,
    });
  }

  for (const result of tests) {
    entries.push({
      entry_id: `test:${result.test_result_id}`,
      kind: 'EXTERNAL_TEST_RECORDED',
      truth_state: 'OBSERVED',
      occurred_at: result.observed_at.toISOString(),
      project_id: result.project_id,
      project_name: result.project_name,
      test_result_id: result.test_result_id,
      outcome: result.outcome,
    });
  }

  for (const award of awards) {
    entries.push({
      entry_id: `cheevo:${award.award_id}`,
      kind: 'CHEEVO_AWARDED',
      truth_state: 'PROVEN',
      occurred_at: award.earned_at.toISOString(),
      cheevo_award_id: award.award_id,
      cheevo_key: award.cheevo_key,
    });
  }

  const blockedMissions = new Set<string>();
  for (const event of missionEvents) {
    const state = missionState(event.payload);
    if (state === 'BLOCKED') {
      blockedMissions.add(event.mission_id);
      entries.push({
        entry_id: `mission-blocked:${event.history_event_id}`,
        kind: 'MISSION_BLOCKED',
        truth_state: 'CLAIMED',
        occurred_at: event.occurred_at.toISOString(),
        project_id: event.project_id,
        project_name: event.project_name,
        mission_id: event.mission_id,
      });
    } else if (state === 'BUILDING' && blockedMissions.has(event.mission_id)) {
      blockedMissions.delete(event.mission_id);
      entries.push({
        entry_id: `mission-recovered:${event.history_event_id}`,
        kind: 'MISSION_RECOVERED',
        truth_state: 'CLAIMED',
        occurred_at: event.occurred_at.toISOString(),
        project_id: event.project_id,
        project_name: event.project_name,
        mission_id: event.mission_id,
      });
    } else if (state === 'CLOSED_NOT_SHIPPED') {
      blockedMissions.delete(event.mission_id);
      entries.push({
        entry_id: `mission-closed:${event.history_event_id}`,
        kind: 'MISSION_CLOSED_NOT_SHIPPED',
        truth_state: 'CLAIMED',
        occurred_at: event.occurred_at.toISOString(),
        project_id: event.project_id,
        project_name: event.project_name,
        mission_id: event.mission_id,
      });
    }
  }

  return {
    schema_version: PLAYER_HISTORY_SCHEMA_VERSION,
    player_id: playerId,
    entries: sortEntries(entries),
  };
}
