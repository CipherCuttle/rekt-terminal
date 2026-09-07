import './contract-phase6c.js';
import {type Generated, type Kysely, type Selectable} from 'kysely';
import type {DatabaseSchema} from './database.js';

export const SHIP_ARTIFACT_PUBLIC_SCHEMA_VERSION = 'ship.artifact.public.v1' as const;

interface ShipReceiptTable {
  receipt_id: string;
  submission_id: string;
  mission_id: string;
  project_id: string;
  owner_player_id: string;
  round_id: string | null;
  schema_version: string;
  acceptance_rule_version: string;
  verifier_observation_id: string;
  acceptance_review_id: string;
  artifact_title: string;
  artifact_url: string;
  demo_url: string | null;
  shipped_at: Generated<Date>;
}

interface ShipReceiptAttributionTable {
  receipt_id: string;
  player_id: string;
  display_name: string;
  role: 'OWNER' | 'PARTY';
  assist_id: string | null;
  accepted_at: Date | null;
  snapshotted_at: Generated<Date>;
}

type ArtifactDatabaseSchema = DatabaseSchema & {
  ship_receipts: ShipReceiptTable;
  ship_receipt_attributions: ShipReceiptAttributionTable;
};

type ArtifactDb = Kysely<ArtifactDatabaseSchema>;

function artifactDb(db: Kysely<DatabaseSchema>): ArtifactDb {
  return db as unknown as ArtifactDb;
}

export type ShipReceiptSnapshotInput = Selectable<ShipReceiptTable>;

export async function snapshotShipAttribution(
  dbInput: Kysely<DatabaseSchema>,
  receipt: ShipReceiptSnapshotInput,
): Promise<void> {
  const db = artifactDb(dbInput);
  const existing = await db.selectFrom('ship_receipt_attributions')
    .select('player_id')
    .where('receipt_id', '=', receipt.receipt_id)
    .execute();
  if (existing.length !== 0) throw new Error('ship_attribution_already_snapshotted');

  const owner = await db.selectFrom('players')
    .select(['player_id', 'display_name'])
    .where('player_id', '=', receipt.owner_player_id)
    .executeTakeFirst();
  if (!owner) throw new Error('ship_attribution_invariant_violation');

  await db.insertInto('ship_receipt_attributions').values({
    receipt_id: receipt.receipt_id,
    player_id: owner.player_id,
    display_name: owner.display_name,
    role: 'OWNER',
    assist_id: null,
    accepted_at: null,
  }).execute();

  const party = await db.selectFrom('project_party_members')
    .selectAll()
    .where('project_id', '=', receipt.project_id)
    .orderBy('joined_at', 'asc')
    .orderBy('player_id', 'asc')
    .execute();

  for (const member of party) {
    if (member.role !== 'ASSIST' || member.source_type !== 'ASSIST') {
      throw new Error('ship_attribution_invariant_violation');
    }
    const assist = await db.selectFrom('assist_offers')
      .select(['assist_id', 'project_id', 'offered_by_player_id', 'state', 'accepted_at'])
      .where('assist_id', '=', member.source_id)
      .executeTakeFirst();
    if (
      !assist ||
      assist.project_id !== receipt.project_id ||
      assist.offered_by_player_id !== member.player_id ||
      assist.state !== 'ACCEPTED' ||
      !(assist.accepted_at instanceof Date)
    ) throw new Error('ship_attribution_invariant_violation');

    const player = await db.selectFrom('players')
      .select(['player_id', 'display_name'])
      .where('player_id', '=', member.player_id)
      .executeTakeFirst();
    if (!player) throw new Error('ship_attribution_invariant_violation');

    await db.insertInto('ship_receipt_attributions').values({
      receipt_id: receipt.receipt_id,
      player_id: player.player_id,
      display_name: player.display_name,
      role: 'PARTY',
      assist_id: assist.assist_id,
      accepted_at: assist.accepted_at,
    }).execute();
  }
}

export async function getAcceptedShipArtifactForSubmission(
  dbInput: Kysely<DatabaseSchema>,
  submissionId: string,
) {
  const db = artifactDb(dbInput);
  const receipt = await db.selectFrom('ship_receipts')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .executeTakeFirst();
  if (!receipt) return null;

  const attributions = await db.selectFrom('ship_receipt_attributions')
    .selectAll()
    .where('receipt_id', '=', receipt.receipt_id)
    .orderBy('role', 'asc')
    .orderBy('snapshotted_at', 'asc')
    .orderBy('player_id', 'asc')
    .execute();

  const builders = attributions.map((row) => ({
    player_id: row.player_id,
    display_name: row.display_name,
    role: row.role,
  }));
  const assists = attributions
    .filter((row) => row.role === 'PARTY' && row.assist_id !== null && row.accepted_at instanceof Date)
    .map((row) => ({
      assist_id: row.assist_id!,
      player_id: row.player_id,
      display_name: row.display_name,
      accepted_at: row.accepted_at!.toISOString(),
      source_state: 'ACCEPTED' as const,
    }));

  return {
    schema_version: SHIP_ARTIFACT_PUBLIC_SCHEMA_VERSION,
    receipt_id: receipt.receipt_id,
    receipt_schema_version: receipt.schema_version,
    submission_id: receipt.submission_id,
    mission_id: receipt.mission_id,
    project_id: receipt.project_id,
    owner_player_id: receipt.owner_player_id,
    ...(receipt.round_id ? {round_id: receipt.round_id} : {}),
    acceptance_rule_version: receipt.acceptance_rule_version,
    artifact: {
      title: receipt.artifact_title,
      url: receipt.artifact_url,
      ...(receipt.demo_url ? {demo_url: receipt.demo_url} : {}),
    },
    builders,
    assists,
    evidence: {
      verifier_observation_id: receipt.verifier_observation_id,
      acceptance_review_id: receipt.acceptance_review_id,
    },
    truth_state: 'PROVEN' as const,
    shipped_at: receipt.shipped_at.toISOString(),
  };
}


export async function getAcceptedShipArtifactByReceiptId(
  dbInput: Kysely<DatabaseSchema>,
  receiptId: string,
) {
  const db = artifactDb(dbInput);
  const receipt = await db.selectFrom('ship_receipts')
    .select('submission_id')
    .where('receipt_id', '=', receiptId)
    .executeTakeFirst();
  if (!receipt) return null;
  return getAcceptedShipArtifactForSubmission(dbInput, receipt.submission_id);
}
