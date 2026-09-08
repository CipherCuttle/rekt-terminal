/* GENERATED FROM apps/inkubator-api/src/contract.ts. DO NOT EDIT. */
export interface Error {
  error: string;
}

export interface DevSessionRequest {
  display_name: string;
}

export type PlayerId = string;

export type ProjectId = string;

export type MissionId = string;

export type RoundId = string;

export type RequestId = string;

export type MissionState = "DRAFT" | "DECLARED" | "BUILDING" | "BLOCKED" | "SHIP_READY" | "SUBMITTED" | "SHIPPED" | "CLOSED_NOT_SHIPPED" | "ARCHIVED";

export type MissionGateKey = "FOUNDATION" | "CORE_EXPERIENCE" | "QUALITY_TESTING" | "SHIPABILITY";

export type MissionGateState = "UNKNOWN" | "CLAIMED" | "ACTIVE" | "OBSERVED" | "PROVEN" | "ATTENTION" | "BLOCKED" | "STALE" | "FAILED";

export type ParticipantMissionGateState = "UNKNOWN" | "CLAIMED" | "ACTIVE" | "ATTENTION" | "BLOCKED" | "STALE" | "FAILED";

export interface PublicPlayer {
  schema_version: "player.public.v2";
  player_id: PlayerId;
  display_name: string;
  skills_needed: string[];
  can_help_with: string[];
}

export interface PrivatePlayer {
  schema_version: "player.private.v1";
  player_id: PlayerId;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface SessionView {
  schema_version: "session.private.v1";
  player: PrivatePlayer;
  expires_at: string;
}

export interface PlayerProfileView {
  schema_version: "player.profile.v2";
  player_id: PlayerId;
  bio?: string;
  character_name?: string;
  character_archetype?: string;
  skills_needed: string[];
  can_help_with: string[];
}

export interface PlayerProfileUpdateRequest {
  request_id: RequestId;
  bio?: string | null;
  character_name?: string | null;
  character_archetype?: string | null;
  skills_needed?: string[];
  can_help_with?: string[];
}

export interface SocialMutationRequest {
  request_id: RequestId;
}

export interface HelpBeaconCreateRequest {
  request_id: RequestId;
  summary: string;
  skills_needed?: string[];
}

export interface AssistOfferCreateRequest {
  request_id: RequestId;
  message: string;
}

export interface PlayerFollowView {
  schema_version: "player.follow.v1";
  follower_player_id: PlayerId;
  followed_player_id: PlayerId;
  active: boolean;
}

export interface ProjectWatchView {
  schema_version: "project.watch.v1";
  player_id: PlayerId;
  project_id: ProjectId;
  active: boolean;
}

export interface HelpBeaconView {
  schema_version: "help_beacon.public.v1";
  beacon_id: string;
  project_id: ProjectId;
  summary: string;
  skills_needed: string[];
  state: "OPEN" | "CLOSED";
}

export interface AssistView {
  schema_version: "assist.private.v1";
  assist_id: string;
  beacon_id: string;
  project_id: ProjectId;
  offered_by_player_id: PlayerId;
  message: string;
  state: "OFFERED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
}

export interface PartyMemberView {
  player_id: PlayerId;
  display_name: string;
  role: "ASSIST";
}

export interface ProjectHelpLoopView {
  schema_version: "project.help_loop.public.v1";
  project_id: ProjectId;
  owner: PublicPlayer;
  open_help_beacon?: HelpBeaconView;
  party_members: PartyMemberView[];
}

export interface ProjectDiscoveryView {
  schema_version: "project.discovery.v1";
  project: PublicProject;
  owner: PublicPlayer;
  open_help_beacon?: HelpBeaconView;
}

export type PublicPlayerList = PublicPlayer[];

export type ProjectDiscoveryList = ProjectDiscoveryView[];

export interface ProjectCommentCreateRequest {
  request_id: RequestId;
  body: string;
  parent_comment_id?: string | null;
}

export interface ProjectDiscussionSettingRequest {
  request_id: RequestId;
  locked: boolean;
}

export interface ProjectCommentAuthorView {
  player_id: PlayerId;
  display_name: string;
}

export interface ProjectCommentView {
  schema_version: "project.comment.public.v1";
  comment_id: string;
  project_id: ProjectId;
  author: ProjectCommentAuthorView;
  parent_comment_id?: string;
  state: "ACTIVE" | "DELETED" | "REMOVED";
  body?: string;
  useful_count: number;
  created_at: string;
}

export interface ProjectCommentsView {
  schema_version: "project.comments.public.v1";
  project_id: ProjectId;
  locked: boolean;
  comments: ProjectCommentView[];
}

export interface ProjectCommentReactionView {
  schema_version: "project.comment.reaction.v1";
  comment_id: string;
  player_id: PlayerId;
  reaction: "USEFUL";
  active: boolean;
}

export interface ProjectCommentDeleteView {
  schema_version: "project.comment.delete.v1";
  comment_id: string;
  state: "DELETED";
}

export interface ProjectDiscussionSettingView {
  schema_version: "project.discussion.setting.v1";
  project_id: ProjectId;
  locked: boolean;
}

export interface WorldSignalView {
  schema_version: "world.signal.public.v1";
  signal_id: string;
  kind: "HELP_BEACON_OPENED" | "ASSIST_ACCEPTED" | "EXTERNAL_TEST_RECORDED";
  project_id: ProjectId;
  project_name: string;
  truth_state: "CLAIMED" | "OBSERVED";
  occurred_at: string;
}

export type WorldSignalList = WorldSignalView[];

export interface PlayerBlockView {
  schema_version: "player.block.v1";
  blocker_player_id: PlayerId;
  blocked_player_id: PlayerId;
  active: boolean;
}

export interface ContentReportCreateRequest {
  request_id: RequestId;
  reason: "SPAM" | "ABUSE" | "PRIVACY" | "OTHER";
  detail?: string | null;
}

export interface ContentReportView {
  schema_version: "content.report.private.v1";
  report_id: string;
  comment_id: string;
  reason: "SPAM" | "ABUSE" | "PRIVACY" | "OTHER";
  state: "OPEN";
}

export interface ExternalTestRequestCreateRequest {
  request_id: RequestId;
  prompt: string;
}

export interface ExternalTestRequestView {
  schema_version: "external_test.request.public.v1";
  test_request_id: string;
  project_id: ProjectId;
  prompt: string;
  state: "OPEN" | "COMPLETED" | "CLOSED";
}

export interface ExternalTestResultCreateRequest {
  request_id: RequestId;
  outcome: "PASS" | "ISSUE_FOUND" | "BLOCKED";
  summary: string;
}

export interface ExternalTestResultView {
  schema_version: "external_test.result.public.v1";
  test_result_id: string;
  test_request_id: string;
  project_id: ProjectId;
  tester: ProjectCommentAuthorView;
  outcome: "PASS" | "ISSUE_FOUND" | "BLOCKED";
  summary: string;
  observed_at: string;
}

export interface ProjectExternalTestsView {
  schema_version: "project.external_tests.public.v1";
  project_id: ProjectId;
  requests: ExternalTestRequestView[];
  results: ExternalTestResultView[];
}

export interface ShipSubmissionCreateRequest {
  request_id: RequestId;
  title: string;
  url: string;
  demo_url?: string;
  source_url?: string;
}

export interface ShipArtifactView {
  title: string;
  url: string;
  demo_url?: string;
  source_url?: string;
}

export interface ShipVerifierObservationView {
  schema_version: "ship.verifier_observation.public.v1";
  outcome: "PASS" | "FAILED" | "UNAVAILABLE";
  reason_code: string;
  http_status?: number;
  duration_ms: number;
  redirects: number;
  observed_at: string;
}

export interface ShipSubmissionView {
  schema_version: "ship.submission.private.v1" | "ship.submission.public.v1";
  submission_id: string;
  mission_id: MissionId;
  project_id: ProjectId;
  artifact: ShipArtifactView;
  state: "SUBMITTED" | "OBSERVED" | "ATTENTION";
  submitted_at: string;
  verifier_observation?: ShipVerifierObservationView;
}

export interface ProjectShipStateView {
  schema_version: "project.ship.public.v2";
  project_id: ProjectId;
  latest_submission?: ShipSubmissionPublicView;
}

export interface RoundView {
  schema_version: "round.private.v1";
  round_id: RoundId;
  code: string;
  title: string;
  constraint: string;
  state: "OPEN" | "CLOSED" | "ARCHIVED";
  joined: boolean;
}

export type RoundList = RoundView[];

export interface GitHubInstallView {
  schema_version: "github.install.v1";
  install_url: string;
  expires_at: string;
}

export interface DevelopmentProjectRequest {
  name: string;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
}

export interface ProjectGitHubRepositoryLinkRequest {
  repository_id: string;
}

export interface PublicProject {
  schema_version: "project.public.v2";
  project_id: ProjectId;
  name: string;
  mission_id: MissionId;
  mission_state: MissionState;
  source_connected: boolean;
  source_visibility: "NONE" | "PUBLIC" | "PRIVATE";
  observation_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
}

export interface PrivateProject {
  schema_version: "project.private.v2";
  project_id: ProjectId;
  owner_player_id: PlayerId;
  name: string;
  mission_id: MissionId;
  mission_state: MissionState;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  source_connected: boolean;
  source_visibility: "NONE" | "PUBLIC" | "PRIVATE";
  observation_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
  repository_id?: string;
  repository_full_name?: string;
  repository_private?: boolean;
  repository_active?: boolean;
  last_delivery_id?: string;
  last_ref?: string;
  last_before?: string;
  last_after?: string;
}

export interface MissionCreateRequest {
  request_id: RequestId;
  round_id: RoundId;
  project_name: string;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  stack_labels?: string[];
}

export interface MissionUpdateRequest {
  request_id: RequestId;
  state?: "DECLARED" | "BUILDING" | "BLOCKED" | "SHIP_READY" | "CLOSED_NOT_SHIPPED";
  current_focus?: string;
  next_move?: string;
  blocker?: string | null;
  stack_labels?: string[];
}

export interface MissionGateUpdateRequest {
  request_id: RequestId;
  state: ParticipantMissionGateState;
}

export interface CommandProject {
  project_id: ProjectId;
  name: string;
  source_connected: boolean;
  source_visibility: "NONE" | "PUBLIC" | "PRIVATE";
  observation_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
}

export interface CommandMission {
  mission_id: MissionId;
  state: MissionState;
  goal: string;
  ship_condition: string;
  current_focus: string;
  next_move: string;
  blocker?: string;
  progress_model_version: "mission.progress.v1";
  stack_labels: string[];
  stack_source: "UNKNOWN" | "PLAYER_CONFIRMED";
}

export interface CommandRound {
  round_id: RoundId;
  code: string;
  title: string;
  constraint: string;
  state: "OPEN" | "CLOSED" | "ARCHIVED";
}

export interface MissionGateView {
  key: MissionGateKey;
  label: string;
  state: MissionGateState;
  position: number;
}

export interface CommandEvidenceObservation {
  observation_id: string;
  kind: "PUSH" | "PULL_REQUEST" | "WORKFLOW" | "DEPLOYMENT" | "MANIFEST";
  outcome: "OBSERVED" | "SUCCEEDED" | "FAILED" | "IN_PROGRESS" | "UNKNOWN";
  observed_at: string;
}

export interface CommandGitHubEvidence {
  rule_version: "github-evidence.v1";
  source_state: "AVAILABLE" | "UNAVAILABLE";
  signal_state: "UNKNOWN" | "ACTIVE" | "OBSERVED" | "STALE" | "FAILED";
  stale_after_ms: number;
  invalid_observation_count: number;
  reason_code: "source_unavailable_no_evidence" | "source_unavailable_cached_evidence_not_current" | "no_valid_observation" | "latest_observation_stale" | "latest_observation_current";
  observed_stacks: ("JAVASCRIPT_TYPESCRIPT" | "PYTHON" | "RUST" | "GO" | "JVM" | "RUBY" | "PHP" | "DOTNET" | "CONTAINER")[];
  latest_observation?: CommandEvidenceObservation;
}

export interface CommandDaemonAdvisory {
  rule_version: "daemon-advisory.v1";
  authority: "ADVISORY_ONLY";
  what_changed: string;
  likely_blocker?: string;
  scope_damage_warning?: string;
  proposed_next_move: string;
}

export interface CommandView {
  schema_version: "command.private.v2";
  project: CommandProject;
  mission: CommandMission;
  round?: CommandRound;
  gates: MissionGateView[];
  github_evidence: CommandGitHubEvidence;
  daemon: CommandDaemonAdvisory;
}

export interface ShipArtifactPrivateView {
  title: string;
  url: string;
  demo_url?: string;
  source_url?: string;
}

export interface ShipArtifactPublicView {
  title: string;
  url: string;
  demo_url?: string;
}

export interface ShipArtifactBuilderView {
  player_id: PlayerId;
  display_name: string;
  role: "OWNER" | "PARTY";
}

export interface ShipAssistAttributionView {
  assist_id: string;
  player_id: PlayerId;
  display_name: string;
  accepted_at: string;
  source_state: "ACCEPTED";
}

export interface ShipArtifactEvidenceView {
  verifier_observation_id: string;
  acceptance_review_id: string;
}

export interface AcceptedShipArtifactView {
  schema_version: "ship.artifact.public.v1";
  receipt_id: string;
  receipt_schema_version: "inkubator.ship-receipt/1.0";
  submission_id: string;
  mission_id: MissionId;
  project_id: ProjectId;
  owner_player_id: PlayerId;
  round_id?: RoundId;
  acceptance_rule_version: "ship.acceptance.v1";
  artifact: ShipArtifactPublicView;
  builders: ShipArtifactBuilderView[];
  assists: ShipAssistAttributionView[];
  evidence: ShipArtifactEvidenceView;
  truth_state: "PROVEN";
  shipped_at: string;
}

export interface ShipSubmissionPrivateView {
  schema_version: "ship.submission.private.v1";
  submission_id: string;
  mission_id: MissionId;
  project_id: ProjectId;
  artifact: ShipArtifactPrivateView;
  state: "SUBMITTED" | "OBSERVED" | "ATTENTION" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  submitted_at: string;
  verifier_observation?: ShipVerifierObservationView;
}

export interface ShipSubmissionPublicView {
  schema_version: "ship.submission.public.v2";
  submission_id: string;
  mission_id: MissionId;
  project_id: ProjectId;
  artifact: ShipArtifactPublicView;
  state: "SUBMITTED" | "OBSERVED" | "ATTENTION" | "PROVEN";
  submitted_at: string;
  verifier_observation?: ShipVerifierObservationView;
  accepted_ship?: AcceptedShipArtifactView;
}

export interface ReputationPlayerView {
  player_id: PlayerId;
  display_name: string;
}

export interface CheevoEvidenceView {
  source_type: "RECEIPT" | "ASSIST" | "TEST_RESULT" | "MISSION";
  source_id: string;
}

export interface CheevoView {
  key: "FIRST_BLOOD" | "WORKING_URL_OR_GTFO" | "REPEAT_OFFENDER" | "ACTUALLY_HELPFUL" | "PARTY_UP" | "CREW_CHIEF" | "SHIPMATE" | "TOUCH_GRASS" | "TEST_PILOT" | "UNREKT";
  label: string;
  description: string;
  rule_version: "cheevo.rules.v1";
  truth_state: "PROVEN";
  earned_at: string;
  evidence: CheevoEvidenceView;
}

export interface ReputationMetricsView {
  ships: number;
  shipped_assists: number;
  shipped_projects_assisted: number;
  collaborative_ships: number;
  tested_shipped_projects: number;
}

export interface PlayerReputationView {
  schema_version: "player.reputation.public.v1";
  rule_version: "reputation.rules.v1";
  player: ReputationPlayerView;
  metrics: ReputationMetricsView;
  cheevos: CheevoView[];
}

export interface BoardRowView {
  rank: number;
  player_id: PlayerId;
  display_name: string;
  metric_count: number;
}

export interface ContextualBoardView {
  key: "SHIPPERS" | "ASSISTS" | "COLLABORATION";
  label: string;
  metric: "accepted_ships" | "distinct_shipped_projects_assisted" | "collaborative_ships";
  rows: BoardRowView[];
}

export interface WorldBoardsView {
  schema_version: "world.boards.public.v1";
  rule_version: "boards.rules.v1";
  boards: ContextualBoardView[];
}

export interface PlayerHistoryEntryView {
  entry_id: string;
  kind: "SHIP_ACCEPTED" | "ASSIST_ACCEPTED" | "EXTERNAL_TEST_RECORDED" | "CHEEVO_AWARDED" | "MISSION_BLOCKED" | "MISSION_RECOVERED" | "MISSION_CLOSED_NOT_SHIPPED";
  truth_state: "CLAIMED" | "OBSERVED" | "PROVEN";
  occurred_at: string;
  project_id?: ProjectId;
  project_name?: string;
  mission_id?: MissionId;
  receipt_id?: string;
  artifact_title?: string;
  role?: "OWNER" | "PARTY";
  assist_id?: string;
  test_result_id?: string;
  outcome?: "PASS" | "ISSUE_FOUND" | "BLOCKED";
  cheevo_award_id?: string;
  cheevo_key?: string;
}

export interface PlayerHistoryView {
  schema_version: "player.history.private.v1";
  player_id: PlayerId;
  entries: PlayerHistoryEntryView[];
}

export type DevkitScope = "player:read" | "project:read" | "mission:read" | "claim:write" | "update:write" | "beacon:write" | "assist:write" | "ship:prepare";

export type DevkitCredentialClass = "CLI" | "MCP" | "AUTOMATION";

export interface DevkitTokenIssueRequest {
  request_id: RequestId;
  credential_class: DevkitCredentialClass;
  label: string;
  scopes: DevkitScope[];
  expires_in_seconds: number;
}

export interface DevkitTokenIssuedView {
  schema_version: "devkit.token.issued.v1";
  token_id: string;
  credential_class: DevkitCredentialClass;
  label: string;
  scopes: DevkitScope[];
  token: string;
  expires_at: string;
}

export interface DevkitTokenSummaryView {
  schema_version: "devkit.token.summary.v1";
  token_id: string;
  credential_class: DevkitCredentialClass;
  label: string;
  scopes: DevkitScope[];
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export type DevkitTokenList = DevkitTokenSummaryView[];

export interface DevkitTokenRevokedView {
  schema_version: "devkit.token.revoked.v1";
  token_id: string;
  revoked_at: string;
}

export interface DevkitMissionUpdateRequest {
  request_id: RequestId;
  current_focus?: string;
  next_move?: string;
  blocker?: string | null;
  stack_labels?: string[];
}

export interface DevkitClaimRequest {
  request_id: RequestId;
  state: ParticipantMissionGateState;
}

export interface DevkitActivityEventView {
  event_type: string;
  occurred_at: string;
}

export interface DevkitActivityView {
  schema_version: "devkit.activity.v1";
  project_id: ProjectId;
  events: DevkitActivityEventView[];
}

export interface DevkitHelpBeaconList {
  schema_version: "devkit.help_beacons.v1";
  project_id: ProjectId;
  beacons: HelpBeaconView[];
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class InkubatorApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'InkubatorApiError';
  }
}

export class InkubatorApiClient {
  constructor(
    private readonly baseUrl = '',
    private readonly fetchImpl: FetchLike = fetch,
    private readonly accessToken?: string,
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    if (this.accessToken) headers.set('authorization', 'Bearer ' + this.accessToken);
    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {error?: unknown} | null;
      const message = typeof body?.error === 'string' ? body.error : `request_failed_${response.status}`;
      throw new InkubatorApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  createDevSession(body: DevSessionRequest): Promise<SessionView> {
    return this.request<SessionView>("/v1/dev/session", {method: 'POST', body: JSON.stringify(body)});
  }

  deleteSession(): Promise<void> {
    return this.request<void>("/v1/session", {method: 'DELETE'});
  }

  getMe(): Promise<PrivatePlayer> {
    return this.request<PrivatePlayer>("/v1/me", {method: 'GET'});
  }

  getMyProfile(): Promise<PlayerProfileView> {
    return this.request<PlayerProfileView>("/v1/me/profile", {method: 'GET'});
  }

  updateMyProfile(body: PlayerProfileUpdateRequest): Promise<PlayerProfileView> {
    return this.request<PlayerProfileView>("/v1/me/profile", {method: 'PATCH', body: JSON.stringify(body)});
  }

  getMyCommand(): Promise<CommandView> {
    return this.request<CommandView>("/v1/me/command", {method: 'GET'});
  }

  getMyHistory(): Promise<PlayerHistoryView> {
    return this.request<PlayerHistoryView>("/v1/me/history", {method: 'GET'});
  }

  getPublicPlayer(playerId: PlayerId): Promise<PublicPlayer> {
    return this.request<PublicPlayer>(`/v1/players/${encodeURIComponent(playerId)}`, {method: 'GET'});
  }

  getPlayerReputation(playerId: PlayerId): Promise<PlayerReputationView> {
    return this.request<PlayerReputationView>(`/v1/players/${encodeURIComponent(playerId)}/reputation`, {method: 'GET'});
  }

  getPrivatePlayer(playerId: PlayerId): Promise<PrivatePlayer> {
    return this.request<PrivatePlayer>(`/v1/players/${encodeURIComponent(playerId)}/private`, {method: 'GET'});
  }

  submitShip(missionId: MissionId, body: ShipSubmissionCreateRequest): Promise<ShipSubmissionPrivateView> {
    return this.request<ShipSubmissionPrivateView>(`/v1/missions/${encodeURIComponent(missionId)}/ship-submissions`, {method: 'POST', body: JSON.stringify(body)});
  }

  getProjectShipState(projectId: ProjectId): Promise<ProjectShipStateView> {
    return this.request<ProjectShipStateView>(`/v1/projects/${encodeURIComponent(projectId)}/ship`, {method: 'GET'});
  }

  getShipReceipt(receiptId: string): Promise<AcceptedShipArtifactView> {
    return this.request<AcceptedShipArtifactView>(`/v1/ship-receipts/${encodeURIComponent(receiptId)}`, {method: 'GET'});
  }

  listRounds(): Promise<RoundList> {
    return this.request<RoundList>("/v1/rounds", {method: 'GET'});
  }

  joinRound(roundId: RoundId): Promise<RoundView> {
    return this.request<RoundView>(`/v1/rounds/${encodeURIComponent(roundId)}/join`, {method: 'POST'});
  }

  createMission(body: MissionCreateRequest): Promise<CommandView> {
    return this.request<CommandView>("/v1/missions", {method: 'POST', body: JSON.stringify(body)});
  }

  updateMission(missionId: MissionId, body: MissionUpdateRequest): Promise<CommandView> {
    return this.request<CommandView>(`/v1/missions/${encodeURIComponent(missionId)}`, {method: 'PATCH', body: JSON.stringify(body)});
  }

  updateMissionGate(missionId: MissionId, gateKey: MissionGateKey, body: MissionGateUpdateRequest): Promise<CommandView> {
    return this.request<CommandView>(`/v1/missions/${encodeURIComponent(missionId)}/gates/${encodeURIComponent(gateKey)}`, {method: 'PATCH', body: JSON.stringify(body)});
  }

  createDevelopmentProject(body: DevelopmentProjectRequest): Promise<PrivateProject> {
    return this.request<PrivateProject>("/v1/development/projects", {method: 'POST', body: JSON.stringify(body)});
  }

  getPublicProject(projectId: ProjectId): Promise<PublicProject> {
    return this.request<PublicProject>(`/v1/projects/${encodeURIComponent(projectId)}`, {method: 'GET'});
  }

  getPrivateProject(projectId: ProjectId): Promise<PrivateProject> {
    return this.request<PrivateProject>(`/v1/projects/${encodeURIComponent(projectId)}/private`, {method: 'GET'});
  }

  linkProjectGitHubRepository(projectId: ProjectId, body: ProjectGitHubRepositoryLinkRequest): Promise<PrivateProject> {
    return this.request<PrivateProject>(`/v1/projects/${encodeURIComponent(projectId)}/github-repositories`, {method: 'POST', body: JSON.stringify(body)});
  }

  createGitHubInstall(): Promise<GitHubInstallView> {
    return this.request<GitHubInstallView>("/v1/github/install", {method: 'POST'});
  }

  discoverPlayers(): Promise<PublicPlayerList> {
    return this.request<PublicPlayerList>("/v1/discover/players", {method: 'GET'});
  }

  discoverProjects(): Promise<ProjectDiscoveryList> {
    return this.request<ProjectDiscoveryList>("/v1/discover/projects", {method: 'GET'});
  }

  followPlayer(playerId: PlayerId, body: SocialMutationRequest): Promise<PlayerFollowView> {
    return this.request<PlayerFollowView>(`/v1/players/${encodeURIComponent(playerId)}/follow`, {method: 'POST', body: JSON.stringify(body)});
  }

  watchProject(projectId: ProjectId, body: SocialMutationRequest): Promise<ProjectWatchView> {
    return this.request<ProjectWatchView>(`/v1/projects/${encodeURIComponent(projectId)}/watch`, {method: 'POST', body: JSON.stringify(body)});
  }

  createHelpBeacon(projectId: ProjectId, body: HelpBeaconCreateRequest): Promise<HelpBeaconView> {
    return this.request<HelpBeaconView>(`/v1/projects/${encodeURIComponent(projectId)}/help-beacons`, {method: 'POST', body: JSON.stringify(body)});
  }

  closeHelpBeacon(beaconId: string, body: SocialMutationRequest): Promise<HelpBeaconView> {
    return this.request<HelpBeaconView>(`/v1/help-beacons/${encodeURIComponent(beaconId)}/close`, {method: 'POST', body: JSON.stringify(body)});
  }

  offerAssist(beaconId: string, body: AssistOfferCreateRequest): Promise<AssistView> {
    return this.request<AssistView>(`/v1/help-beacons/${encodeURIComponent(beaconId)}/assists`, {method: 'POST', body: JSON.stringify(body)});
  }

  acceptAssist(assistId: string, body: SocialMutationRequest): Promise<AssistView> {
    return this.request<AssistView>(`/v1/assists/${encodeURIComponent(assistId)}/accept`, {method: 'POST', body: JSON.stringify(body)});
  }

  getProjectHelpLoop(projectId: ProjectId): Promise<ProjectHelpLoopView> {
    return this.request<ProjectHelpLoopView>(`/v1/projects/${encodeURIComponent(projectId)}/help-loop`, {method: 'GET'});
  }

  listProjectComments(projectId: ProjectId): Promise<ProjectCommentsView> {
    return this.request<ProjectCommentsView>(`/v1/projects/${encodeURIComponent(projectId)}/comments`, {method: 'GET'});
  }

  createProjectComment(projectId: ProjectId, body: ProjectCommentCreateRequest): Promise<ProjectCommentView> {
    return this.request<ProjectCommentView>(`/v1/projects/${encodeURIComponent(projectId)}/comments`, {method: 'POST', body: JSON.stringify(body)});
  }

  reactUsefulToComment(commentId: string, body: SocialMutationRequest): Promise<ProjectCommentReactionView> {
    return this.request<ProjectCommentReactionView>(`/v1/comments/${encodeURIComponent(commentId)}/reactions/useful`, {method: 'POST', body: JSON.stringify(body)});
  }

  deleteOwnProjectComment(commentId: string, body: SocialMutationRequest): Promise<ProjectCommentDeleteView> {
    return this.request<ProjectCommentDeleteView>(`/v1/comments/${encodeURIComponent(commentId)}`, {method: 'DELETE', body: JSON.stringify(body)});
  }

  setProjectDiscussionLock(projectId: ProjectId, body: ProjectDiscussionSettingRequest): Promise<ProjectDiscussionSettingView> {
    return this.request<ProjectDiscussionSettingView>(`/v1/projects/${encodeURIComponent(projectId)}/discussion`, {method: 'PATCH', body: JSON.stringify(body)});
  }

  listWorldSignals(): Promise<WorldSignalList> {
    return this.request<WorldSignalList>("/v1/world/signals", {method: 'GET'});
  }

  blockPlayer(playerId: PlayerId, body: SocialMutationRequest): Promise<PlayerBlockView> {
    return this.request<PlayerBlockView>(`/v1/players/${encodeURIComponent(playerId)}/block`, {method: 'POST', body: JSON.stringify(body)});
  }

  unblockPlayer(playerId: PlayerId, body: SocialMutationRequest): Promise<PlayerBlockView> {
    return this.request<PlayerBlockView>(`/v1/players/${encodeURIComponent(playerId)}/block`, {method: 'DELETE', body: JSON.stringify(body)});
  }

  reportProjectComment(commentId: string, body: ContentReportCreateRequest): Promise<ContentReportView> {
    return this.request<ContentReportView>(`/v1/comments/${encodeURIComponent(commentId)}/report`, {method: 'POST', body: JSON.stringify(body)});
  }

  createExternalTestRequest(projectId: ProjectId, body: ExternalTestRequestCreateRequest): Promise<ExternalTestRequestView> {
    return this.request<ExternalTestRequestView>(`/v1/projects/${encodeURIComponent(projectId)}/tester-requests`, {method: 'POST', body: JSON.stringify(body)});
  }

  recordExternalTestResult(testRequestId: string, body: ExternalTestResultCreateRequest): Promise<ExternalTestResultView> {
    return this.request<ExternalTestResultView>(`/v1/tester-requests/${encodeURIComponent(testRequestId)}/results`, {method: 'POST', body: JSON.stringify(body)});
  }

  getProjectExternalTests(projectId: ProjectId): Promise<ProjectExternalTestsView> {
    return this.request<ProjectExternalTestsView>(`/v1/projects/${encodeURIComponent(projectId)}/external-tests`, {method: 'GET'});
  }

  issueDevkitToken(body: DevkitTokenIssueRequest): Promise<DevkitTokenIssuedView> {
    return this.request<DevkitTokenIssuedView>("/v1/devkit/tokens", {method: 'POST', body: JSON.stringify(body)});
  }

  listDevkitTokens(): Promise<DevkitTokenList> {
    return this.request<DevkitTokenList>("/v1/devkit/tokens", {method: 'GET'});
  }

  revokeDevkitToken(tokenId: string): Promise<DevkitTokenRevokedView> {
    return this.request<DevkitTokenRevokedView>(`/v1/devkit/tokens/${encodeURIComponent(tokenId)}/revoke`, {method: 'POST'});
  }

  getDevkitMe(): Promise<PrivatePlayer> {
    return this.request<PrivatePlayer>("/v1/devkit/me", {method: 'GET'});
  }

  getDevkitPlayerProfile(): Promise<PlayerProfileView> {
    return this.request<PlayerProfileView>("/v1/devkit/player/profile", {method: 'GET'});
  }

  getDevkitCurrentMission(): Promise<CommandView> {
    return this.request<CommandView>("/v1/devkit/mission/current", {method: 'GET'});
  }

  updateDevkitCurrentMission(body: DevkitMissionUpdateRequest): Promise<CommandView> {
    return this.request<CommandView>("/v1/devkit/mission/current", {method: 'PATCH', body: JSON.stringify(body)});
  }

  claimDevkitMilestone(gateKey: MissionGateKey, body: DevkitClaimRequest): Promise<CommandView> {
    return this.request<CommandView>(`/v1/devkit/mission/current/claims/${encodeURIComponent(gateKey)}`, {method: 'POST', body: JSON.stringify(body)});
  }

  getDevkitCurrentProject(): Promise<CommandProject> {
    return this.request<CommandProject>("/v1/devkit/project/current", {method: 'GET'});
  }

  listDevkitHelpBeacons(): Promise<DevkitHelpBeaconList> {
    return this.request<DevkitHelpBeaconList>("/v1/devkit/project/current/help-beacons", {method: 'GET'});
  }

  createDevkitHelpBeacon(body: HelpBeaconCreateRequest): Promise<HelpBeaconView> {
    return this.request<HelpBeaconView>("/v1/devkit/project/current/help-beacons", {method: 'POST', body: JSON.stringify(body)});
  }

  offerDevkitAssist(beaconId: string, body: AssistOfferCreateRequest): Promise<AssistView> {
    return this.request<AssistView>(`/v1/devkit/help-beacons/${encodeURIComponent(beaconId)}/assists`, {method: 'POST', body: JSON.stringify(body)});
  }

  getDevkitActivity(): Promise<DevkitActivityView> {
    return this.request<DevkitActivityView>("/v1/devkit/project/current/activity", {method: 'GET'});
  }

  prepareDevkitShip(body: ShipSubmissionCreateRequest): Promise<ShipSubmissionPrivateView> {
    return this.request<ShipSubmissionPrivateView>("/v1/devkit/mission/current/ship", {method: 'POST', body: JSON.stringify(body)});
  }
}
