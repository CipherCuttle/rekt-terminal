import {Generated, Kysely, sql, type Selectable} from 'kysely';
import {PostgresJSDialect} from 'kysely-postgres-js';
import postgres from 'postgres';

export interface PlayerTable {
  player_id: string;
  display_name: string;
  github_user_id: Generated<string | null>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PlayerProfileTable {
  player_id: string;
  bio: string | null;
  character_name: string | null;
  character_archetype: string | null;
  skills_needed: Generated<unknown>;
  can_help_with: Generated<unknown>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SessionTable {
  session_id: string;
  player_id: string;
  token_hash: string;
  created_at: Generated<Date>;
  expires_at: Date;
  revoked_at: Date | null;
}

export type DevkitCredentialClass = 'CLI' | 'MCP' | 'AUTOMATION';
export interface DevkitTokenTable {
  token_id: string;
  player_id: string;
  creation_request_id: string;
  credential_class: DevkitCredentialClass;
  label: string;
  token_hash: string;
  scopes: unknown;
  created_at: Generated<Date>;
  expires_at: Date;
  revoked_at: Date | null;
  rate_window_started_at: Generated<Date>;
  rate_count: Generated<number>;
  last_used_at: Date | null;
}

export type RoundState = 'OPEN' | 'CLOSED' | 'ARCHIVED';

export interface RoundTable {
  round_id: string;
  schema_version: string;
  code: string;
  title: string;
  constraint_text: string;
  state: RoundState;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface RoundMembershipTable {
  round_id: string;
  player_id: string;
  joined_at: Generated<Date>;
  selected_at: Generated<Date>;
}

export interface ProjectTable {
  project_id: string;
  schema_version: string;
  owner_player_id: string;
  name: string;
  repository_id: string | null;
  observed_stack_labels: Generated<unknown>;
  observed_manifest_fingerprints: Generated<unknown>;
  observed_manifest_ref: Generated<string | null>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type MissionState =
  | 'DRAFT'
  | 'DECLARED'
  | 'BUILDING'
  | 'BLOCKED'
  | 'SHIP_READY'
  | 'SUBMITTED'
  | 'SHIPPED'
  | 'CLOSED_NOT_SHIPPED'
  | 'ARCHIVED';

export type MissionGateState =
  | 'UNKNOWN'
  | 'CLAIMED'
  | 'ACTIVE'
  | 'OBSERVED'
  | 'PROVEN'
  | 'ATTENTION'
  | 'BLOCKED'
  | 'STALE'
  | 'FAILED';

export interface MissionTable {
  mission_id: string;
  schema_version: string;
  creation_request_id: string | null;
  project_id: string;
  owner_player_id: string;
  round_id: string | null;
  goal: string;
  ship_condition: string;
  state: MissionState;
  current_focus: string;
  next_move: string;
  blocker: string | null;
  progress_model_version: string;
  stack_labels: unknown;
  stack_source: 'UNKNOWN' | 'PLAYER_CONFIRMED';
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface MissionGateTable {
  mission_id: string;
  gate_key: 'FOUNDATION' | 'CORE_EXPERIENCE' | 'QUALITY_TESTING' | 'SHIPABILITY';
  label: string;
  signal_state: MissionGateState;
  position: number;
  updated_at: Generated<Date>;
}

export type HistoryEventFamily = 'activity' | 'evidence';

export interface HistoryEventTable {
  history_event_id: string;
  event_family: HistoryEventFamily;
  event_version: string;
  event_type: string;
  dedupe_key: string;
  payload: unknown;
  payload_hash: string;
  actor_player_id: string | null;
  subject_type: string;
  subject_id: string;
  occurred_at: Generated<Date>;
}

export type OutboxJobState = 'pending' | 'running' | 'succeeded' | 'failed';

export interface OutboxJobTable {
  job_id: string;
  job_version: string;
  job_type: string;
  idempotency_key: string;
  payload: unknown;
  payload_hash: string;
  state: Generated<OutboxJobState>;
  attempts: Generated<number>;
  max_attempts: number;
  next_attempt_at: Date;
  locked_at: Date | null;
  lock_token: string | null;
  last_error: string | null;
  created_at: Generated<Date>;
  completed_at: Date | null;
}

export interface PlayerFollowTable {
  follower_player_id: string;
  followed_player_id: string;
  created_at: Generated<Date>;
}

export interface ProjectWatchTable {
  player_id: string;
  project_id: string;
  created_at: Generated<Date>;
}

export type HelpBeaconState = 'OPEN' | 'CLOSED';
export interface HelpBeaconTable {
  beacon_id: string;
  project_id: string;
  owner_player_id: string;
  creation_request_id: string;
  summary: string;
  skills_needed: unknown;
  state: HelpBeaconState;
  opened_at: Generated<Date>;
  closed_at: Date | null;
}

export type AssistOfferState = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export interface AssistOfferTable {
  assist_id: string;
  beacon_id: string;
  project_id: string;
  offered_by_player_id: string;
  creation_request_id: string;
  message: string;
  state: AssistOfferState;
  acceptance_request_id: string | null;
  offered_at: Generated<Date>;
  accepted_at: Date | null;
}

export interface ProjectPartyMemberTable {
  project_id: string;
  player_id: string;
  role: 'ASSIST';
  source_type: 'ASSIST';
  source_id: string;
  joined_at: Generated<Date>;
}

export type ProjectCommentState = 'ACTIVE' | 'DELETED' | 'REMOVED';
export interface ProjectCommentTable {
  comment_id: string;
  project_id: string;
  author_player_id: string;
  parent_comment_id: string | null;
  creation_request_id: string;
  deletion_request_id: string | null;
  body: string;
  state: ProjectCommentState;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface ProjectCommentReactionTable {
  comment_id: string;
  player_id: string;
  reaction: 'USEFUL';
  created_at: Generated<Date>;
}

export interface ProjectDiscussionSettingTable {
  project_id: string;
  locked: Generated<boolean>;
  updated_at: Generated<Date>;
}

export interface PlayerBlockTable {
  blocker_player_id: string;
  blocked_player_id: string;
  created_at: Generated<Date>;
}

export type ContentReportReason = 'SPAM' | 'ABUSE' | 'PRIVACY' | 'OTHER';
export interface ContentReportTable {
  report_id: string;
  reporter_player_id: string;
  comment_id: string;
  creation_request_id: string;
  reason: ContentReportReason;
  detail: string | null;
  state: 'OPEN';
  created_at: Generated<Date>;
}

export type ExternalTestRequestState = 'OPEN' | 'COMPLETED' | 'CLOSED';
export interface ExternalTestRequestTable {
  test_request_id: string;
  project_id: string;
  owner_player_id: string;
  creation_request_id: string;
  prompt: string;
  state: ExternalTestRequestState;
  created_at: Generated<Date>;
  completed_at: Date | null;
}

export type ExternalTestOutcome = 'PASS' | 'ISSUE_FOUND' | 'BLOCKED';
export interface ExternalTestResultTable {
  test_result_id: string;
  test_request_id: string;
  project_id: string;
  tester_player_id: string;
  creation_request_id: string;
  outcome: ExternalTestOutcome;
  summary: string;
  observed_at: Generated<Date>;
}

export type ShipSubmissionState = 'SUBMITTED' | 'OBSERVED' | 'ATTENTION';
export interface ShipSubmissionTable {
  submission_id: string;
  mission_id: string;
  project_id: string;
  owner_player_id: string;
  creation_request_id: string;
  artifact_title: string;
  artifact_url: string;
  demo_url: string | null;
  source_url: string | null;
  state: ShipSubmissionState;
  submitted_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ShipVerifierOutcome = 'PASS' | 'FAILED' | 'UNAVAILABLE';
export interface ShipVerifierObservationTable {
  observation_id: string;
  submission_id: string;
  outcome: ShipVerifierOutcome;
  reason_code: string;
  final_url: string | null;
  http_status: number | null;
  duration_ms: number;
  redirects: number;
  observed_at: Generated<Date>;
}

export interface GitHubSetupStateTable {
  state_hash: string;
  player_id: string;
  created_at: Generated<Date>;
  expires_at: Date;
  consumed_at: Date | null;
}

export type GitHubRepositorySelection = 'all' | 'selected';

export interface GitHubInstallationTable {
  installation_id: string;
  player_id: string;
  github_user_id: string;
  account_id: string;
  account_type: string;
  repository_selection: GitHubRepositorySelection;
  installed_at: Generated<Date>;
  revoked_at: Date | null;
}

export interface GitHubRepositoryTable {
  repository_id: string;
  installation_id: string;
  full_name: string;
  private: boolean;
  active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface GitHubDeliveryTable {
  delivery_id: string;
  event_name: string;
  payload_hash: string;
  installation_id: string | null;
  repository_id: string | null;
  received_at: Generated<Date>;
}

export interface GitHubInstallationTombstoneTable {
  installation_id: string;
  revoked_at: Generated<Date>;
  source_key: string;
}

export interface GitHubRepositoryTombstoneTable {
  repository_id: string;
  installation_id: string;
  removed_at: Generated<Date>;
  source_key: string;
}

export interface GitHubRepositoryAuthorityTable {
  repository_id: string;
  installation_id: string;
  claimed_at: Generated<Date>;
}

export interface DatabaseSchema {
  players: PlayerTable;
  player_profiles: PlayerProfileTable;
  sessions: SessionTable;
  devkit_tokens: DevkitTokenTable;
  rounds: RoundTable;
  round_memberships: RoundMembershipTable;
  projects: ProjectTable;
  missions: MissionTable;
  mission_gates: MissionGateTable;
  history_events: HistoryEventTable;
  outbox_jobs: OutboxJobTable;
  player_follows: PlayerFollowTable;
  project_watches: ProjectWatchTable;
  help_beacons: HelpBeaconTable;
  assist_offers: AssistOfferTable;
  project_party_members: ProjectPartyMemberTable;
  project_comments: ProjectCommentTable;
  project_comment_reactions: ProjectCommentReactionTable;
  project_discussion_settings: ProjectDiscussionSettingTable;
  player_blocks: PlayerBlockTable;
  content_reports: ContentReportTable;
  external_test_requests: ExternalTestRequestTable;
  external_test_results: ExternalTestResultTable;
  ship_submissions: ShipSubmissionTable;
  ship_verifier_observations: ShipVerifierObservationTable;
  github_setup_states: GitHubSetupStateTable;
  github_installations: GitHubInstallationTable;
  github_repositories: GitHubRepositoryTable;
  github_deliveries: GitHubDeliveryTable;
  github_installation_tombstones: GitHubInstallationTombstoneTable;
  github_repository_tombstones: GitHubRepositoryTombstoneTable;
  github_repository_authority: GitHubRepositoryAuthorityTable;
}

export type PlayerRow = Selectable<PlayerTable>;
export type PlayerProfileRow = Selectable<PlayerProfileTable>;
export type RoundRow = Selectable<RoundTable>;
export type ProjectRow = Selectable<ProjectTable>;
export type MissionRow = Selectable<MissionTable>;
export type MissionGateRow = Selectable<MissionGateTable>;
export type HistoryEventRow = Selectable<HistoryEventTable>;
export type OutboxJobRow = Selectable<OutboxJobTable>;
export type GitHubRepositoryRow = Selectable<GitHubRepositoryTable>;
export type InkubatorDatabase = Kysely<DatabaseSchema>;

export function createDatabase(databaseUrl: string): InkubatorDatabase {
  const client = postgres(databaseUrl, {max: 10});
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresJSDialect({postgres: client}),
  });
}

export async function readDatabaseNow(db: Kysely<DatabaseSchema>): Promise<Date> {
  const result = await sql<{now: Date}>`select clock_timestamp() as now`.execute(db);
  const now = result.rows[0]?.now;
  if (!(now instanceof Date)) throw new Error('database_clock_unavailable');
  return now;
}
