import './contract-phase7.js';
import {randomUUID} from 'node:crypto';
import {sql, type Generated, type Kysely} from 'kysely';
import type {DatabaseSchema} from './database.js';

export const CHEEVO_RULE_VERSION = 'cheevo.rules.v1' as const;
export const REPUTATION_RULE_VERSION = 'reputation.rules.v1' as const;
export const BOARD_RULE_VERSION = 'boards.rules.v1' as const;

export const CHEEVO_DEFINITIONS = [
  {key: 'FIRST_BLOOD', label: 'FIRST BLOOD', description: 'Own the first accepted Ship in a Round.'},
  {key: 'WORKING_URL_OR_GTFO', label: 'WORKING URL OR GTFO', description: 'Own an accepted Ship backed by a canonical receipt.'},
  {key: 'REPEAT_OFFENDER', label: 'REPEAT OFFENDER', description: 'Own two accepted Ships.'},
  {key: 'ACTUALLY_HELPFUL', label: 'ACTUALLY HELPFUL', description: 'Have an accepted Assist preserved in a shipped receipt.'},
  {key: 'PARTY_UP', label: 'PARTY UP', description: 'Ship with another builder in the Ship-time Party snapshot.'},
  {key: 'CREW_CHIEF', label: 'CREW CHIEF', description: 'Ship with at least two distinct Party builders.'},
  {key: 'SHIPMATE', label: 'SHIPMATE', description: 'Contribute accepted Assists to two distinct shipped Projects.'},
  {key: 'TOUCH_GRASS', label: 'TOUCH GRASS', description: 'Ship after receiving an external test observation from another player.'},
  {key: 'TEST_PILOT', label: 'TEST PILOT', description: 'Externally test three distinct Projects that later Ship.'},
  {key: 'UNREKT', label: 'UNREKT', description: 'Recover a Mission that entered BLOCKED and later Ship it.'},
] as const;

export type CheevoKey = typeof CHEEVO_DEFINITIONS[number]['key'];
type CheevoSourceType = 'RECEIPT' | 'ASSIST' | 'TEST_RESULT' | 'MISSION';

interface PlayerCheevoTable {
  award_id: string;
  player_id: string;
  cheevo_key: CheevoKey;
  rule_version: typeof CHEEVO_RULE_VERSION;
  source_type: CheevoSourceType;
  source_id: string;
  earned_at: Date;
  recorded_at: Generated<Date>;
}

interface ShipReceiptTable {
  receipt_id: string;
  submission_id: string;
  mission_id: string;
  project_id: string;
  owner_player_id: string;
  round_id: string | null;
  shipped_at: Date;
  project_boundary_order: string;
}

interface ShipReceiptAttributionTable {
  receipt_id: string;
  player_id: string;
  display_name: string;
  role: 'OWNER' | 'PARTY';
  assist_id: string | null;
  accepted_at: Date | null;
  snapshotted_at: Date;
}

interface ShipReceiptAssistTable {
  receipt_id: string;
  assist_id: string;
  player_id: string;
  display_name: string;
  accepted_at: Date;
  snapshotted_at: Date;
}

interface ExternalTestResultTable {
  test_result_id: string;
  test_request_id: string;
  project_id: string;
  tester_player_id: string;
  creation_request_id: string;
  outcome: 'PASS' | 'ISSUE_FOUND' | 'BLOCKED';
  summary: string;
  observed_at: Date;
  project_boundary_order: string;
}

type ReputationDatabaseSchema = DatabaseSchema & {
  player_cheevos: PlayerCheevoTable;
  ship_receipts: ShipReceiptTable;
  ship_receipt_attributions: ShipReceiptAttributionTable;
  ship_receipt_assists: ShipReceiptAssistTable;
  external_test_results: ExternalTestResultTable;
};

type ReputationDb = Kysely<ReputationDatabaseSchema>;

interface CheevoCandidate {
  cheevo_key: CheevoKey;
  source_type: CheevoSourceType;
  source_id: string;
  earned_at: Date;
}

interface ReputationMetricRow {
  ships: string;
  shipped_assists: string;
  shipped_projects_assisted: string;
  collaborative_ships: string;
  tested_shipped_projects: string;
}

interface BoardSqlRow {
  player_id: string;
  display_name: string;
  metric_count: string;
  rank: string;
}

function reputationDb(db: Kysely<DatabaseSchema>): ReputationDb {
  return db as unknown as ReputationDb;
}

function cheevoDefinition(key: CheevoKey) {
  const definition = CHEEVO_DEFINITIONS.find((item) => item.key === key);
  if (!definition) throw new Error('cheevo_definition_missing');
  return definition;
}

async function eligibleCheevos(db: ReputationDb, playerId: string): Promise<CheevoCandidate[]> {
  const result = await sql<CheevoCandidate>`
    with owned_receipts as (
      select
        receipt_id,
        mission_id,
        project_id,
        round_id,
        shipped_at,
        project_boundary_order,
        row_number() over (order by shipped_at asc, receipt_id asc) as owned_number
      from ship_receipts
      where owner_player_id = ${playerId}::uuid
    ),
    round_firsts as (
      select receipt_id, owner_player_id, round_id, shipped_at,
        row_number() over (partition by round_id order by shipped_at asc, receipt_id asc) as round_number
      from ship_receipts
      where round_id is not null
    ),
    assisted_projects as (
      select
        receipt.project_id,
        min(receipt.shipped_at) as shipped_at,
        (array_agg(assist.assist_id order by receipt.shipped_at asc, assist.accepted_at asc, assist.assist_id asc))[1]::text as source_id
      from ship_receipt_assists assist
      join ship_receipts receipt on receipt.receipt_id = assist.receipt_id
      where assist.player_id = ${playerId}::uuid
      group by receipt.project_id
    ),
    ranked_assisted_projects as (
      select *, row_number() over (order by shipped_at asc, project_id asc) as assisted_number
      from assisted_projects
    ),
    tested_shipped_projects as (
      select
        test.project_id,
        min(receipt.shipped_at) as shipped_at,
        (array_agg(test.test_result_id order by receipt.project_boundary_order asc, test.project_boundary_order asc, test.test_result_id asc))[1]::text as source_id
      from external_test_results test
      join ship_receipts receipt
        on receipt.project_id = test.project_id
       and test.project_boundary_order < receipt.project_boundary_order
      where test.tester_player_id = ${playerId}::uuid
      group by test.project_id
    ),
    ranked_tested_projects as (
      select *, row_number() over (order by shipped_at asc, project_id asc) as tested_number
      from tested_shipped_projects
    )
    (
      select 'FIRST_BLOOD'::text as cheevo_key, 'RECEIPT'::text as source_type,
        receipt_id::text as source_id, shipped_at as earned_at
      from round_firsts
      where owner_player_id = ${playerId}::uuid and round_number = 1
      order by shipped_at asc, receipt_id asc
      limit 1
    )
    union all
    (
      select 'WORKING_URL_OR_GTFO', 'RECEIPT', receipt_id::text, shipped_at
      from owned_receipts where owned_number = 1
    )
    union all
    (
      select 'REPEAT_OFFENDER', 'RECEIPT', receipt_id::text, shipped_at
      from owned_receipts where owned_number = 2
    )
    union all
    (
      select 'ACTUALLY_HELPFUL', 'ASSIST', assist.assist_id::text, receipt.shipped_at
      from ship_receipt_assists assist
      join ship_receipts receipt on receipt.receipt_id = assist.receipt_id
      where assist.player_id = ${playerId}::uuid
      order by receipt.shipped_at asc, assist.accepted_at asc, assist.assist_id asc
      limit 1
    )
    union all
    (
      select 'PARTY_UP', 'RECEIPT', owned.receipt_id::text, owned.shipped_at
      from owned_receipts owned
      where exists (
        select 1 from ship_receipt_attributions attribution
        where attribution.receipt_id = owned.receipt_id and attribution.role = 'PARTY'
      )
      order by owned.shipped_at asc, owned.receipt_id asc
      limit 1
    )
    union all
    (
      select 'CREW_CHIEF', 'RECEIPT', owned.receipt_id::text, owned.shipped_at
      from owned_receipts owned
      where 2 <= (
        select count(distinct attribution.player_id)
        from ship_receipt_attributions attribution
        where attribution.receipt_id = owned.receipt_id and attribution.role = 'PARTY'
      )
      order by owned.shipped_at asc, owned.receipt_id asc
      limit 1
    )
    union all
    (
      select 'SHIPMATE', 'ASSIST', source_id, shipped_at
      from ranked_assisted_projects where assisted_number = 2
    )
    union all
    (
      select 'TOUCH_GRASS', 'RECEIPT', owned.receipt_id::text, owned.shipped_at
      from owned_receipts owned
      where exists (
        select 1
        from external_test_results test
        where test.project_id = owned.project_id
          and test.tester_player_id <> ${playerId}::uuid
          and test.project_boundary_order < owned.project_boundary_order
      )
      order by owned.shipped_at asc, owned.receipt_id asc
      limit 1
    )
    union all
    (
      select 'TEST_PILOT', 'TEST_RESULT', source_id, shipped_at
      from ranked_tested_projects where tested_number = 3
    )
    union all
    (
      select 'UNREKT', 'MISSION', owned.mission_id::text, owned.shipped_at
      from owned_receipts owned
      where exists (
        select 1
        from history_events history
        where history.subject_type = 'mission'
          and history.subject_id = owned.mission_id::text
          and history.event_type = 'mission.updated'
          and history.payload ->> 'state' = 'BLOCKED'
          and history.occurred_at <= owned.shipped_at
      )
      order by owned.shipped_at asc, owned.receipt_id asc
      limit 1
    )
  `.execute(db);

  return result.rows.map((row) => ({
    cheevo_key: row.cheevo_key,
    source_type: row.source_type,
    source_id: row.source_id,
    earned_at: row.earned_at,
  }));
}

export async function reconcilePlayerCheevos(dbInput: Kysely<DatabaseSchema>, playerId: string): Promise<void> {
  const db = reputationDb(dbInput);
  const player = await db.selectFrom('players').select('player_id').where('player_id', '=', playerId).executeTakeFirst();
  if (!player) throw new Error('player_not_found');

  for (const candidate of await eligibleCheevos(db, playerId)) {
    await db.insertInto('player_cheevos').values({
      award_id: randomUUID(),
      player_id: playerId,
      cheevo_key: candidate.cheevo_key,
      rule_version: CHEEVO_RULE_VERSION,
      source_type: candidate.source_type,
      source_id: candidate.source_id,
      earned_at: candidate.earned_at,
    }).onConflict((conflict) => conflict.columns(['player_id', 'cheevo_key', 'rule_version']).doNothing()).execute();
  }
}

export async function reconcileCheevosForAcceptedProject(dbInput: Kysely<DatabaseSchema>, projectId: string): Promise<void> {
  const db = reputationDb(dbInput);
  const affected = await sql<{player_id: string}>`
    select distinct player_id from (
      select receipt.owner_player_id as player_id
      from ship_receipts receipt
      where receipt.project_id = ${projectId}::uuid
      union
      select attribution.player_id
      from ship_receipt_attributions attribution
      join ship_receipts receipt on receipt.receipt_id = attribution.receipt_id
      where receipt.project_id = ${projectId}::uuid
      union
      select assist.player_id
      from ship_receipt_assists assist
      join ship_receipts receipt on receipt.receipt_id = assist.receipt_id
      where receipt.project_id = ${projectId}::uuid
      union
      select test.tester_player_id
      from external_test_results test
      join ship_receipts receipt
        on receipt.project_id = test.project_id
       and test.project_boundary_order < receipt.project_boundary_order
      where receipt.project_id = ${projectId}::uuid
    ) affected_players
  `.execute(db);

  for (const row of affected.rows) await reconcilePlayerCheevos(dbInput, row.player_id);
}

export async function getPlayerReputation(dbInput: Kysely<DatabaseSchema>, playerId: string) {
  const db = reputationDb(dbInput);
  const player = await db.selectFrom('players').select(['player_id', 'display_name']).where('player_id', '=', playerId).executeTakeFirst();
  if (!player) return null;

  const metrics = await sql<ReputationMetricRow>`
    select
      (select count(*)::text from ship_receipts receipt where receipt.owner_player_id = ${playerId}::uuid) as ships,
      (select count(*)::text from ship_receipt_assists assist where assist.player_id = ${playerId}::uuid) as shipped_assists,
      (
        select count(distinct receipt.project_id)::text
        from ship_receipt_assists assist
        join ship_receipts receipt on receipt.receipt_id = assist.receipt_id
        where assist.player_id = ${playerId}::uuid
      ) as shipped_projects_assisted,
      (
        select count(distinct attribution.receipt_id)::text
        from ship_receipt_attributions attribution
        where attribution.player_id = ${playerId}::uuid
          and exists (
            select 1 from ship_receipt_attributions peer
            where peer.receipt_id = attribution.receipt_id and peer.player_id <> attribution.player_id
          )
      ) as collaborative_ships,
      (
        select count(distinct test.project_id)::text
        from external_test_results test
        join ship_receipts receipt
          on receipt.project_id = test.project_id
         and test.project_boundary_order < receipt.project_boundary_order
        where test.tester_player_id = ${playerId}::uuid
      ) as tested_shipped_projects
  `.execute(db);
  const metric = metrics.rows[0];
  if (!metric) throw new Error('reputation_metrics_missing');

  const awards = await db.selectFrom('player_cheevos')
    .select(['cheevo_key', 'source_type', 'source_id', 'earned_at'])
    .where('player_id', '=', playerId)
    .where('rule_version', '=', CHEEVO_RULE_VERSION)
    .orderBy('earned_at', 'asc')
    .orderBy('cheevo_key', 'asc')
    .execute();

  return {
    schema_version: 'player.reputation.public.v1' as const,
    rule_version: REPUTATION_RULE_VERSION,
    player: {player_id: player.player_id, display_name: player.display_name},
    metrics: {
      ships: Number(metric.ships),
      shipped_assists: Number(metric.shipped_assists),
      shipped_projects_assisted: Number(metric.shipped_projects_assisted),
      collaborative_ships: Number(metric.collaborative_ships),
      tested_shipped_projects: Number(metric.tested_shipped_projects),
    },
    cheevos: awards.map((award) => {
      const definition = cheevoDefinition(award.cheevo_key);
      return {
        key: award.cheevo_key,
        label: definition.label,
        description: definition.description,
        rule_version: CHEEVO_RULE_VERSION,
        truth_state: 'PROVEN' as const,
        earned_at: award.earned_at.toISOString(),
        evidence: {source_type: award.source_type, source_id: award.source_id},
      };
    }),
  };
}

async function boardRows(db: ReputationDb, kind: 'SHIPPERS' | 'ASSISTS' | 'COLLABORATION'): Promise<BoardSqlRow[]> {
  if (kind === 'SHIPPERS') {
    return (await sql<BoardSqlRow>`
      with scores as (
        select player.player_id, player.display_name, count(receipt.receipt_id)::bigint as metric_count
        from players player
        join ship_receipts receipt on receipt.owner_player_id = player.player_id
        group by player.player_id, player.display_name
      )
      select player_id, display_name, metric_count::text,
        dense_rank() over (order by metric_count desc)::text as rank
      from scores
      order by metric_count desc, display_name asc, player_id asc
      limit 25
    `.execute(db)).rows;
  }

  if (kind === 'ASSISTS') {
    return (await sql<BoardSqlRow>`
      with scores as (
        select player.player_id, player.display_name, count(distinct receipt.project_id)::bigint as metric_count
        from players player
        join ship_receipt_assists assist on assist.player_id = player.player_id
        join ship_receipts receipt on receipt.receipt_id = assist.receipt_id
        group by player.player_id, player.display_name
      )
      select player_id, display_name, metric_count::text,
        dense_rank() over (order by metric_count desc)::text as rank
      from scores
      order by metric_count desc, display_name asc, player_id asc
      limit 25
    `.execute(db)).rows;
  }

  return (await sql<BoardSqlRow>`
    with scores as (
      select player.player_id, player.display_name, count(distinct attribution.receipt_id)::bigint as metric_count
      from players player
      join ship_receipt_attributions attribution on attribution.player_id = player.player_id
      where exists (
        select 1 from ship_receipt_attributions peer
        where peer.receipt_id = attribution.receipt_id and peer.player_id <> attribution.player_id
      )
      group by player.player_id, player.display_name
    )
    select player_id, display_name, metric_count::text,
      dense_rank() over (order by metric_count desc)::text as rank
    from scores
    order by metric_count desc, display_name asc, player_id asc
    limit 25
  `.execute(db)).rows;
}

export async function getWorldBoards(dbInput: Kysely<DatabaseSchema>) {
  const db = reputationDb(dbInput);
  const [shippers, assists, collaboration] = await Promise.all([
    boardRows(db, 'SHIPPERS'),
    boardRows(db, 'ASSISTS'),
    boardRows(db, 'COLLABORATION'),
  ]);

  const toRows = (rows: BoardSqlRow[]) => rows.map((row) => ({
    rank: Number(row.rank),
    player_id: row.player_id,
    display_name: row.display_name,
    metric_count: Number(row.metric_count),
  }));

  return {
    schema_version: 'world.boards.public.v1' as const,
    rule_version: BOARD_RULE_VERSION,
    boards: [
      {key: 'SHIPPERS' as const, label: 'SHIPPERS', metric: 'accepted_ships' as const, rows: toRows(shippers)},
      {key: 'ASSISTS' as const, label: 'ASSISTS', metric: 'distinct_shipped_projects_assisted' as const, rows: toRows(assists)},
      {key: 'COLLABORATION' as const, label: 'COLLABORATION', metric: 'collaborative_ships' as const, rows: toRows(collaboration)},
    ],
  };
}