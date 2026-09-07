export const componentSchemas = {
  Error: {
    type: 'object',
    additionalProperties: false,
    required: ['error'],
    properties: {error: {type: 'string'}},
  },
  DevSessionRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['display_name'],
    properties: {display_name: {type: 'string', minLength: 1, maxLength: 80}},
  },
  PlayerId: {
    type: 'string',
    format: 'uuid',
  },
  ProjectId: {
    type: 'string',
    format: 'uuid',
  },
  MissionId: {
    type: 'string',
    format: 'uuid',
  },
  RoundId: {
    type: 'string',
    format: 'uuid',
  },
  RequestId: {
    type: 'string',
    format: 'uuid',
  },
  MissionState: {
    type: 'string',
    enum: ['DRAFT', 'DECLARED', 'BUILDING', 'BLOCKED', 'SHIP_READY', 'SUBMITTED', 'SHIPPED', 'CLOSED_NOT_SHIPPED', 'ARCHIVED'],
  },
  MissionGateKey: {
    type: 'string',
    enum: ['FOUNDATION', 'CORE_EXPERIENCE', 'QUALITY_TESTING', 'SHIPABILITY'],
  },
  MissionGateState: {
    type: 'string',
    enum: ['UNKNOWN', 'CLAIMED', 'ACTIVE', 'OBSERVED', 'PROVEN', 'ATTENTION', 'BLOCKED', 'STALE', 'FAILED'],
  },
  ParticipantMissionGateState: {
    type: 'string',
    enum: ['UNKNOWN', 'CLAIMED', 'ACTIVE', 'ATTENTION', 'BLOCKED', 'STALE', 'FAILED'],
  },
  PublicPlayer: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'display_name', 'skills_needed', 'can_help_with'],
    properties: {
      schema_version: {type: 'string', const: 'player.public.v2'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      display_name: {type: 'string'},
      skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', maxLength: 40}},
      can_help_with: {type: 'array', maxItems: 8, items: {type: 'string', maxLength: 40}},
    },
  },
  PrivatePlayer: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'display_name', 'created_at', 'updated_at'],
    properties: {
      schema_version: {type: 'string', const: 'player.private.v1'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      display_name: {type: 'string'},
      created_at: {type: 'string', format: 'date-time'},
      updated_at: {type: 'string', format: 'date-time'},
    },
  },
  SessionView: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player', 'expires_at'],
    properties: {
      schema_version: {type: 'string', const: 'session.private.v1'},
      player: {$ref: '#/components/schemas/PrivatePlayer'},
      expires_at: {type: 'string', format: 'date-time'},
    },
  },
  PlayerProfileView: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'skills_needed', 'can_help_with'],
    properties: {
      schema_version: {type: 'string', const: 'player.profile.v2'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      bio: {type: 'string'},
      character_name: {type: 'string'},
      character_archetype: {type: 'string'},
      skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
      can_help_with: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
    },
  },
  PlayerProfileUpdateRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['request_id'],
    minProperties: 2,
    properties: {
      request_id: {$ref: '#/components/schemas/RequestId'},
      bio: {type: ['string', 'null'], maxLength: 280},
      character_name: {type: ['string', 'null'], maxLength: 80},
      character_archetype: {type: ['string', 'null'], maxLength: 80},
      skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
      can_help_with: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
    },
  },
  SocialMutationRequest: {
    type: 'object', additionalProperties: false, required: ['request_id'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}},
  },
  HelpBeaconCreateRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'summary'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, summary: {type: 'string', minLength: 1, maxLength: 240}, skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}}},
  },
  AssistOfferCreateRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'message'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, message: {type: 'string', minLength: 1, maxLength: 240}},
  },
  PlayerFollowView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'follower_player_id', 'followed_player_id', 'active'],
    properties: {schema_version: {type: 'string', const: 'player.follow.v1'}, follower_player_id: {$ref: '#/components/schemas/PlayerId'}, followed_player_id: {$ref: '#/components/schemas/PlayerId'}, active: {type: 'boolean'}},
  },
  ProjectWatchView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'player_id', 'project_id', 'active'],
    properties: {schema_version: {type: 'string', const: 'project.watch.v1'}, player_id: {$ref: '#/components/schemas/PlayerId'}, project_id: {$ref: '#/components/schemas/ProjectId'}, active: {type: 'boolean'}},
  },
  HelpBeaconView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'beacon_id', 'project_id', 'summary', 'skills_needed', 'state'],
    properties: {schema_version: {type: 'string', const: 'help_beacon.public.v1'}, beacon_id: {type: 'string', format: 'uuid'}, project_id: {$ref: '#/components/schemas/ProjectId'}, summary: {type: 'string'}, skills_needed: {type: 'array', items: {type: 'string'}}, state: {type: 'string', enum: ['OPEN', 'CLOSED']}},
  },
  AssistView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'assist_id', 'beacon_id', 'project_id', 'offered_by_player_id', 'message', 'state'],
    properties: {schema_version: {type: 'string', const: 'assist.private.v1'}, assist_id: {type: 'string', format: 'uuid'}, beacon_id: {type: 'string', format: 'uuid'}, project_id: {$ref: '#/components/schemas/ProjectId'}, offered_by_player_id: {$ref: '#/components/schemas/PlayerId'}, message: {type: 'string'}, state: {type: 'string', enum: ['OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED']}},
  },
  PartyMemberView: {
    type: 'object', additionalProperties: false, required: ['player_id', 'display_name', 'role'],
    properties: {player_id: {$ref: '#/components/schemas/PlayerId'}, display_name: {type: 'string'}, role: {type: 'string', const: 'ASSIST'}},
  },
  ProjectHelpLoopView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'project_id', 'owner', 'party_members'],
    properties: {schema_version: {type: 'string', const: 'project.help_loop.public.v1'}, project_id: {$ref: '#/components/schemas/ProjectId'}, owner: {$ref: '#/components/schemas/PublicPlayer'}, open_help_beacon: {$ref: '#/components/schemas/HelpBeaconView'}, party_members: {type: 'array', items: {$ref: '#/components/schemas/PartyMemberView'}}},
  },
  ProjectDiscoveryView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'project', 'owner'],
    properties: {schema_version: {type: 'string', const: 'project.discovery.v1'}, project: {$ref: '#/components/schemas/PublicProject'}, owner: {$ref: '#/components/schemas/PublicPlayer'}, open_help_beacon: {$ref: '#/components/schemas/HelpBeaconView'}},
  },
  PublicPlayerList: {type: 'array', items: {$ref: '#/components/schemas/PublicPlayer'}},
  ProjectDiscoveryList: {type: 'array', items: {$ref: '#/components/schemas/ProjectDiscoveryView'}},
  ProjectCommentCreateRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'body'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, body: {type: 'string', minLength: 1, maxLength: 1000}, parent_comment_id: {type: ['string', 'null'], format: 'uuid'}},
  },
  ProjectDiscussionSettingRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'locked'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, locked: {type: 'boolean'}},
  },
  ProjectCommentAuthorView: {
    type: 'object', additionalProperties: false, required: ['player_id', 'display_name'],
    properties: {player_id: {$ref: '#/components/schemas/PlayerId'}, display_name: {type: 'string'}},
  },
  ProjectCommentView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'comment_id', 'project_id', 'author', 'state', 'useful_count', 'created_at'],
    properties: {schema_version: {type: 'string', const: 'project.comment.public.v1'}, comment_id: {type: 'string', format: 'uuid'}, project_id: {$ref: '#/components/schemas/ProjectId'}, author: {$ref: '#/components/schemas/ProjectCommentAuthorView'}, parent_comment_id: {type: 'string', format: 'uuid'}, state: {type: 'string', enum: ['ACTIVE', 'DELETED', 'REMOVED']}, body: {type: 'string'}, useful_count: {type: 'integer', minimum: 0}, created_at: {type: 'string', format: 'date-time'}},
  },
  ProjectCommentsView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'project_id', 'locked', 'comments'],
    properties: {schema_version: {type: 'string', const: 'project.comments.public.v1'}, project_id: {$ref: '#/components/schemas/ProjectId'}, locked: {type: 'boolean'}, comments: {type: 'array', maxItems: 200, items: {$ref: '#/components/schemas/ProjectCommentView'}}},
  },
  ProjectCommentReactionView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'comment_id', 'player_id', 'reaction', 'active'],
    properties: {schema_version: {type: 'string', const: 'project.comment.reaction.v1'}, comment_id: {type: 'string', format: 'uuid'}, player_id: {$ref: '#/components/schemas/PlayerId'}, reaction: {type: 'string', const: 'USEFUL'}, active: {type: 'boolean'}},
  },
  ProjectCommentDeleteView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'comment_id', 'state'],
    properties: {schema_version: {type: 'string', const: 'project.comment.delete.v1'}, comment_id: {type: 'string', format: 'uuid'}, state: {type: 'string', const: 'DELETED'}},
  },
  ProjectDiscussionSettingView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'project_id', 'locked'],
    properties: {schema_version: {type: 'string', const: 'project.discussion.setting.v1'}, project_id: {$ref: '#/components/schemas/ProjectId'}, locked: {type: 'boolean'}},
  },
  WorldSignalView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'signal_id', 'kind', 'project_id', 'project_name', 'truth_state', 'occurred_at'],
    properties: {schema_version: {type: 'string', const: 'world.signal.public.v1'}, signal_id: {type: 'string', format: 'uuid'}, kind: {type: 'string', enum: ['HELP_BEACON_OPENED', 'ASSIST_ACCEPTED', 'EXTERNAL_TEST_RECORDED']}, project_id: {$ref: '#/components/schemas/ProjectId'}, project_name: {type: 'string'}, truth_state: {type: 'string', enum: ['CLAIMED', 'OBSERVED']}, occurred_at: {type: 'string', format: 'date-time'}},
  },
  WorldSignalList: {type: 'array', maxItems: 50, items: {$ref: '#/components/schemas/WorldSignalView'}},
  PlayerBlockView:{type:'object',additionalProperties:false,required:['schema_version','blocker_player_id','blocked_player_id','active'],properties:{schema_version:{type:'string',const:'player.block.v1'},blocker_player_id:{$ref:'#/components/schemas/PlayerId'},blocked_player_id:{$ref:'#/components/schemas/PlayerId'},active:{type:'boolean'}}},
  ContentReportCreateRequest:{type:'object',additionalProperties:false,required:['request_id','reason'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},reason:{type:'string',enum:['SPAM','ABUSE','PRIVACY','OTHER']},detail:{type:['string','null'],maxLength:500}}},
  ContentReportView:{type:'object',additionalProperties:false,required:['schema_version','report_id','comment_id','reason','state'],properties:{schema_version:{type:'string',const:'content.report.private.v1'},report_id:{type:'string',format:'uuid'},comment_id:{type:'string',format:'uuid'},reason:{type:'string',enum:['SPAM','ABUSE','PRIVACY','OTHER']},state:{type:'string',const:'OPEN'}}},
  ExternalTestRequestCreateRequest:{type:'object',additionalProperties:false,required:['request_id','prompt'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},prompt:{type:'string',minLength:1,maxLength:500}}},
  ExternalTestRequestView:{type:'object',additionalProperties:false,required:['schema_version','test_request_id','project_id','prompt','state'],properties:{schema_version:{type:'string',const:'external_test.request.public.v1'},test_request_id:{type:'string',format:'uuid'},project_id:{$ref:'#/components/schemas/ProjectId'},prompt:{type:'string'},state:{type:'string',enum:['OPEN','COMPLETED','CLOSED']}}},
  ExternalTestResultCreateRequest:{type:'object',additionalProperties:false,required:['request_id','outcome','summary'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},outcome:{type:'string',enum:['PASS','ISSUE_FOUND','BLOCKED']},summary:{type:'string',minLength:1,maxLength:500}}},
  ExternalTestResultView:{type:'object',additionalProperties:false,required:['schema_version','test_result_id','test_request_id','project_id','tester','outcome','summary','observed_at'],properties:{schema_version:{type:'string',const:'external_test.result.public.v1'},test_result_id:{type:'string',format:'uuid'},test_request_id:{type:'string',format:'uuid'},project_id:{$ref:'#/components/schemas/ProjectId'},tester:{$ref:'#/components/schemas/ProjectCommentAuthorView'},outcome:{type:'string',enum:['PASS','ISSUE_FOUND','BLOCKED']},summary:{type:'string'},observed_at:{type:'string',format:'date-time'}}},
  ProjectExternalTestsView:{type:'object',additionalProperties:false,required:['schema_version','project_id','requests','results'],properties:{schema_version:{type:'string',const:'project.external_tests.public.v1'},project_id:{$ref:'#/components/schemas/ProjectId'},requests:{type:'array',items:{$ref:'#/components/schemas/ExternalTestRequestView'}},results:{type:'array',items:{$ref:'#/components/schemas/ExternalTestResultView'}}}},
  RoundView: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'round_id', 'code', 'title', 'constraint', 'state', 'joined'],
    properties: {
      schema_version: {type: 'string', const: 'round.private.v1'},
      round_id: {$ref: '#/components/schemas/RoundId'},
      code: {type: 'string'},
      title: {type: 'string'},
      constraint: {type: 'string'},
      state: {type: 'string', enum: ['OPEN', 'CLOSED', 'ARCHIVED']},
      joined: {type: 'boolean'},
    },
  },
  RoundList: {
    type: 'array',
    items: {$ref: '#/components/schemas/RoundView'},
  },
  GitHubInstallView: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'install_url', 'expires_at'],
    properties: {
      schema_version: {type: 'string', const: 'github.install.v1'},
      install_url: {type: 'string', format: 'uri'},
      expires_at: {type: 'string', format: 'date-time'},
    },
  },
  DevelopmentProjectRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'goal', 'ship_condition', 'current_focus', 'next_move'],
    properties: {
      name: {type: 'string', minLength: 1, maxLength: 120},
      goal: {type: 'string', minLength: 1, maxLength: 240},
      ship_condition: {type: 'string', minLength: 1, maxLength: 240},
      current_focus: {type: 'string', minLength: 1, maxLength: 240},
      next_move: {type: 'string', minLength: 1, maxLength: 240},
    },
  },
  ProjectGitHubRepositoryLinkRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['repository_id'],
    properties: {repository_id: {type: 'string', pattern: '^[1-9][0-9]*$'}},
  },
  PublicProject: {
    type: 'object',
    additionalProperties: false,
    required: [
      'schema_version',
      'project_id',
      'name',
      'mission_id',
      'mission_state',
      'source_connected',
      'source_visibility',
      'observation_state',
    ],
    properties: {
      schema_version: {type: 'string', const: 'project.public.v2'},
      project_id: {$ref: '#/components/schemas/ProjectId'},
      name: {type: 'string'},
      mission_id: {$ref: '#/components/schemas/MissionId'},
      mission_state: {$ref: '#/components/schemas/MissionState'},
      source_connected: {type: 'boolean'},
      source_visibility: {type: 'string', enum: ['NONE', 'PUBLIC', 'PRIVATE']},
      observation_state: {type: 'string', enum: ['UNKNOWN', 'ACTIVE', 'OBSERVED', 'STALE', 'FAILED']},
    },
  },
  PrivateProject: {
    type: 'object',
    additionalProperties: false,
    required: [
      'schema_version',
      'project_id',
      'owner_player_id',
      'name',
      'mission_id',
      'mission_state',
      'goal',
      'ship_condition',
      'current_focus',
      'next_move',
      'source_connected',
      'source_visibility',
      'observation_state',
    ],
    properties: {
      schema_version: {type: 'string', const: 'project.private.v2'},
      project_id: {$ref: '#/components/schemas/ProjectId'},
      owner_player_id: {$ref: '#/components/schemas/PlayerId'},
      name: {type: 'string'},
      mission_id: {$ref: '#/components/schemas/MissionId'},
      mission_state: {$ref: '#/components/schemas/MissionState'},
      goal: {type: 'string'},
      ship_condition: {type: 'string'},
      current_focus: {type: 'string'},
      next_move: {type: 'string'},
      source_connected: {type: 'boolean'},
      source_visibility: {type: 'string', enum: ['NONE', 'PUBLIC', 'PRIVATE']},
      observation_state: {type: 'string', enum: ['UNKNOWN', 'ACTIVE', 'OBSERVED', 'STALE', 'FAILED']},
      repository_id: {type: 'string'},
      repository_full_name: {type: 'string'},
      repository_private: {type: 'boolean'},
      repository_active: {type: 'boolean'},
      last_delivery_id: {type: 'string'},
      last_ref: {type: 'string'},
      last_before: {type: 'string'},
      last_after: {type: 'string'},
    },
  },
  MissionCreateRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['request_id', 'round_id', 'project_name', 'goal', 'ship_condition', 'current_focus', 'next_move'],
    properties: {
      request_id: {$ref: '#/components/schemas/RequestId'},
      round_id: {$ref: '#/components/schemas/RoundId'},
      project_name: {type: 'string', minLength: 1, maxLength: 120},
      goal: {type: 'string', minLength: 1, maxLength: 240},
      ship_condition: {type: 'string', minLength: 1, maxLength: 240},
      current_focus: {type: 'string', minLength: 1, maxLength: 240},
      next_move: {type: 'string', minLength: 1, maxLength: 240},
      stack_labels: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
    },
  },
  MissionUpdateRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['request_id'],
    minProperties: 2,
    properties: {
      request_id: {$ref: '#/components/schemas/RequestId'},
      state: {type: 'string', enum: ['DECLARED', 'BUILDING', 'BLOCKED', 'SHIP_READY', 'CLOSED_NOT_SHIPPED']},
      current_focus: {type: 'string', minLength: 1, maxLength: 240},
      next_move: {type: 'string', minLength: 1, maxLength: 240},
      blocker: {type: ['string', 'null'], maxLength: 240},
      stack_labels: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
    },
  },
  MissionGateUpdateRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['request_id', 'state'],
    properties: {
      request_id: {$ref: '#/components/schemas/RequestId'},
      state: {$ref: '#/components/schemas/ParticipantMissionGateState'},
    },
  },
  CommandProject: {
    type: 'object',
    additionalProperties: false,
    required: ['project_id', 'name', 'source_connected', 'source_visibility', 'observation_state'],
    properties: {
      project_id: {$ref: '#/components/schemas/ProjectId'},
      name: {type: 'string'},
      source_connected: {type: 'boolean'},
      source_visibility: {type: 'string', enum: ['NONE', 'PUBLIC', 'PRIVATE']},
      observation_state: {type: 'string', enum: ['UNKNOWN', 'ACTIVE', 'OBSERVED', 'STALE', 'FAILED']},
    },
  },
  CommandMission: {
    type: 'object',
    additionalProperties: false,
    required: ['mission_id', 'state', 'goal', 'ship_condition', 'current_focus', 'next_move', 'progress_model_version', 'stack_labels', 'stack_source'],
    properties: {
      mission_id: {$ref: '#/components/schemas/MissionId'},
      state: {$ref: '#/components/schemas/MissionState'},
      goal: {type: 'string'},
      ship_condition: {type: 'string'},
      current_focus: {type: 'string'},
      next_move: {type: 'string'},
      blocker: {type: 'string'},
      progress_model_version: {type: 'string', const: 'mission.progress.v1'},
      stack_labels: {type: 'array', items: {type: 'string'}},
      stack_source: {type: 'string', enum: ['UNKNOWN', 'PLAYER_CONFIRMED']},
    },
  },
  CommandRound: {
    type: 'object',
    additionalProperties: false,
    required: ['round_id', 'code', 'title', 'constraint', 'state'],
    properties: {
      round_id: {$ref: '#/components/schemas/RoundId'},
      code: {type: 'string'},
      title: {type: 'string'},
      constraint: {type: 'string'},
      state: {type: 'string', enum: ['OPEN', 'CLOSED', 'ARCHIVED']},
    },
  },
  MissionGateView: {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'label', 'state', 'position'],
    properties: {
      key: {$ref: '#/components/schemas/MissionGateKey'},
      label: {type: 'string'},
      state: {$ref: '#/components/schemas/MissionGateState'},
      position: {type: 'integer'},
    },
  },
  CommandEvidenceObservation: {
    type: 'object',
    additionalProperties: false,
    required: ['observation_id', 'kind', 'outcome', 'observed_at'],
    properties: {
      observation_id: {type: 'string'},
      kind: {type: 'string', enum: ['PUSH', 'PULL_REQUEST', 'WORKFLOW', 'DEPLOYMENT', 'MANIFEST']},
      outcome: {type: 'string', enum: ['OBSERVED', 'SUCCEEDED', 'FAILED', 'IN_PROGRESS', 'UNKNOWN']},
      observed_at: {type: 'string', format: 'date-time'},
    },
  },
  CommandGitHubEvidence: {
    type: 'object',
    additionalProperties: false,
    required: ['rule_version', 'source_state', 'signal_state', 'stale_after_ms', 'invalid_observation_count', 'reason_code', 'observed_stacks'],
    properties: {
      rule_version: {type: 'string', const: 'github-evidence.v1'},
      source_state: {type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE']},
      signal_state: {type: 'string', enum: ['UNKNOWN', 'ACTIVE', 'OBSERVED', 'STALE', 'FAILED']},
      stale_after_ms: {type: 'integer'},
      invalid_observation_count: {type: 'integer'},
      reason_code: {type: 'string', enum: ['source_unavailable_no_evidence', 'source_unavailable_cached_evidence_not_current', 'no_valid_observation', 'latest_observation_stale', 'latest_observation_current']},
      observed_stacks: {type: 'array', maxItems: 9, items: {type: 'string', enum: ['JAVASCRIPT_TYPESCRIPT', 'PYTHON', 'RUST', 'GO', 'JVM', 'RUBY', 'PHP', 'DOTNET', 'CONTAINER']}},
      latest_observation: {$ref: '#/components/schemas/CommandEvidenceObservation'},
    },
  },
  CommandDaemonAdvisory: {
    type: 'object',
    additionalProperties: false,
    required: ['rule_version', 'authority', 'what_changed', 'proposed_next_move'],
    properties: {
      rule_version: {type: 'string', const: 'daemon-advisory.v1'},
      authority: {type: 'string', const: 'ADVISORY_ONLY'},
      what_changed: {type: 'string'},
      likely_blocker: {type: 'string'},
      scope_damage_warning: {type: 'string'},
      proposed_next_move: {type: 'string'},
    },
  },
  CommandView: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'project', 'mission', 'gates', 'github_evidence', 'daemon'],
    properties: {
      schema_version: {type: 'string', const: 'command.private.v2'},
      project: {$ref: '#/components/schemas/CommandProject'},
      mission: {$ref: '#/components/schemas/CommandMission'},
      round: {$ref: '#/components/schemas/CommandRound'},
      gates: {type: 'array', items: {$ref: '#/components/schemas/MissionGateView'}},
      github_evidence: {$ref: '#/components/schemas/CommandGitHubEvidence'},
      daemon: {$ref: '#/components/schemas/CommandDaemonAdvisory'},
    },
  },
};

const ref = (name: keyof typeof componentSchemas) => ({$ref: `#/components/schemas/${name}`});
const errorResponse = (description: string) => ({
  description,
  content: {'application/json': {schema: ref('Error')}},
});

export const openapiDocument = {
  openapi: '3.1.0',
  info: {title: 'REKT INK(CUBATOR) API', version: '0.1.0'},
  components: {
    securitySchemes: {
      sessionCookie: {type: 'apiKey', in: 'cookie', name: '__Host-rekt_session'},
    },
    schemas: componentSchemas,
  },
  paths: {
    '/health': {
      get: {
        operationId: 'getHealth',
        responses: {'200': {description: 'Service health'}},
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApi',
        responses: {'200': {description: 'OpenAPI 3.1 contract'}},
      },
    },
    '/v1/dev/session': {
      post: {
        operationId: 'createDevSession',
        'x-development-only': true,
        requestBody: {required: true, content: {'application/json': {schema: ref('DevSessionRequest')}}},
        responses: {
          '201': {description: 'Development session created', content: {'application/json': {schema: ref('SessionView')}}},
          '403': errorResponse('Origin denied'),
        },
      },
    },
    '/v1/session': {
      delete: {
        operationId: 'deleteSession',
        security: [{sessionCookie: []}],
        responses: {
          '204': {description: 'Session revoked'},
          '403': errorResponse('Origin denied'),
        },
      },
    },
    '/v1/me': {
      get: {
        operationId: 'getMe',
        security: [{sessionCookie: []}],
        responses: {
          '200': {description: 'Authenticated Player', content: {'application/json': {schema: ref('PrivatePlayer')}}},
          '401': errorResponse('Authentication required'),
        },
      },
    },
    '/v1/me/profile': {
      get: {
        operationId: 'getMyProfile',
        security: [{sessionCookie: []}],
        responses: {
          '200': {description: 'Authenticated Player profile', content: {'application/json': {schema: ref('PlayerProfileView')}}},
          '401': errorResponse('Authentication required'),
        },
      },
      patch: {
        operationId: 'updateMyProfile',
        security: [{sessionCookie: []}],
        requestBody: {required: true, content: {'application/json': {schema: ref('PlayerProfileUpdateRequest')}}},
        responses: {
          '200': {description: 'Updated Player profile', content: {'application/json': {schema: ref('PlayerProfileView')}}},
          '400': errorResponse('Invalid profile mutation'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Origin denied'),
          '409': errorResponse('Idempotency conflict'),
        },
      },
    },
    '/v1/me/command': {
      get: {
        operationId: 'getMyCommand',
        security: [{sessionCookie: []}],
        responses: {
          '200': {description: 'Current canonical Command Center state', content: {'application/json': {schema: ref('CommandView')}}},
          '401': errorResponse('Authentication required'),
          '404': errorResponse('No active Mission'),
        },
      },
    },
    '/v1/players/{playerId}': {
      get: {
        operationId: 'getPublicPlayer',
        parameters: [{name: 'playerId', in: 'path', required: true, schema: ref('PlayerId')}],
        responses: {
          '200': {description: 'Explicit public projection', content: {'application/json': {schema: ref('PublicPlayer')}}},
          '400': errorResponse('Invalid Player ID'),
          '404': errorResponse('Player not found'),
        },
      },
    },
    '/v1/players/{playerId}/private': {
      get: {
        operationId: 'getPrivatePlayer',
        security: [{sessionCookie: []}],
        parameters: [{name: 'playerId', in: 'path', required: true, schema: ref('PlayerId')}],
        responses: {
          '200': {description: 'Owner-only private projection', content: {'application/json': {schema: ref('PrivatePlayer')}}},
          '400': errorResponse('Invalid Player ID'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Authorization denied'),
          '404': errorResponse('Player not found'),
        },
      },
    },
    '/v1/discover/players': {get: {operationId: 'discoverPlayers', responses: {'200': {description: 'Public Player discovery', content: {'application/json': {schema: ref('PublicPlayerList')}}}}}},
    '/v1/discover/projects': {get: {operationId: 'discoverProjects', responses: {'200': {description: 'Public Project discovery', content: {'application/json': {schema: ref('ProjectDiscoveryList')}}}}}},
    '/v1/players/{playerId}/follow': {post: {operationId: 'followPlayer', security: [{sessionCookie: []}], parameters: [{name: 'playerId', in: 'path', required: true, schema: ref('PlayerId')}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Player followed', content: {'application/json': {schema: ref('PlayerFollowView')}}}, '400': errorResponse('Invalid mutation'), '401': errorResponse('Authentication required'), '403': errorResponse('Forbidden'), '404': errorResponse('Player not found')}}},
    '/v1/projects/{projectId}/watch': {post: {operationId: 'watchProject', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Project watched', content: {'application/json': {schema: ref('ProjectWatchView')}}}, '400': errorResponse('Invalid mutation'), '401': errorResponse('Authentication required'), '404': errorResponse('Project not found')}}},
    '/v1/projects/{projectId}/help-beacons': {post: {operationId: 'createHelpBeacon', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('HelpBeaconCreateRequest')}}}, responses: {'201': {description: 'Help Beacon opened', content: {'application/json': {schema: ref('HelpBeaconView')}}}, '400': errorResponse('Invalid Beacon'), '401': errorResponse('Authentication required'), '403': errorResponse('Owner required'), '404': errorResponse('Project not found'), '409': errorResponse('Beacon conflict')}}},
    '/v1/help-beacons/{beaconId}/close': {post: {operationId: 'closeHelpBeacon', security: [{sessionCookie: []}], parameters: [{name: 'beaconId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Project owner closes Help Beacon', content: {'application/json': {schema: ref('HelpBeaconView')}}}, '400': errorResponse('Invalid Beacon'), '401': errorResponse('Authentication required'), '403': errorResponse('Project owner required'), '404': errorResponse('Beacon not found')}}},
    '/v1/help-beacons/{beaconId}/assists': {post: {operationId: 'offerAssist', security: [{sessionCookie: []}], parameters: [{name: 'beaconId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('AssistOfferCreateRequest')}}}, responses: {'201': {description: 'Assist offered', content: {'application/json': {schema: ref('AssistView')}}}, '400': errorResponse('Invalid Assist'), '401': errorResponse('Authentication required'), '403': errorResponse('Self-assist forbidden'), '404': errorResponse('Beacon not found'), '409': errorResponse('Assist conflict')}}},
    '/v1/assists/{assistId}/accept': {post: {operationId: 'acceptAssist', security: [{sessionCookie: []}], parameters: [{name: 'assistId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Assist accepted and Party membership recorded', content: {'application/json': {schema: ref('AssistView')}}}, '400': errorResponse('Invalid Assist'), '401': errorResponse('Authentication required'), '403': errorResponse('Project owner required'), '404': errorResponse('Assist not found'), '409': errorResponse('Assist state conflict')}}},
    '/v1/projects/{projectId}/help-loop': {get: {operationId: 'getProjectHelpLoop', parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], responses: {'200': {description: 'Public Help/Party context', content: {'application/json': {schema: ref('ProjectHelpLoopView')}}}, '400': errorResponse('Invalid Project ID'), '404': errorResponse('Project not found')}}},
    '/v1/projects/{projectId}/comments': {
      get: {operationId: 'listProjectComments', parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], responses: {'200': {description: 'Project-context discussion', content: {'application/json': {schema: ref('ProjectCommentsView')}}}, '404': errorResponse('Project not found')}},
      post: {operationId: 'createProjectComment', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('ProjectCommentCreateRequest')}}}, responses: {'201': {description: 'Claimed Project comment', content: {'application/json': {schema: ref('ProjectCommentView')}}}, '400': errorResponse('Invalid comment'), '401': errorResponse('Authentication required'), '409': errorResponse('Discussion or idempotency conflict')}},
    },
    '/v1/comments/{commentId}/reactions/useful': {
      post: {operationId: 'reactUsefulToComment', security: [{sessionCookie: []}], parameters: [{name: 'commentId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Semantic useful reaction', content: {'application/json': {schema: ref('ProjectCommentReactionView')}}}, '401': errorResponse('Authentication required'), '404': errorResponse('Comment not found'), '409': errorResponse('Comment/discussion unavailable')}},
    },
    '/v1/comments/{commentId}': {
      delete: {operationId: 'deleteOwnProjectComment', security: [{sessionCookie: []}], parameters: [{name: 'commentId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Author soft-deleted comment', content: {'application/json': {schema: ref('ProjectCommentDeleteView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Author only'), '404': errorResponse('Comment not found')}},
    },
    '/v1/projects/{projectId}/discussion': {
      patch: {operationId: 'setProjectDiscussionLock', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('ProjectDiscussionSettingRequest')}}}, responses: {'200': {description: 'Owner discussion setting', content: {'application/json': {schema: ref('ProjectDiscussionSettingView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Project owner only'), '404': errorResponse('Project not found')}},
    },
    '/v1/world/signals': {
      get: {operationId: 'listWorldSignals', responses: {'200': {description: 'Deterministic meaningful World Signals', content: {'application/json': {schema: ref('WorldSignalList')}}}}},
    },
    '/v1/players/{playerId}/block':{post:{operationId:'blockPlayer',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('SocialMutationRequest')}}},responses:{'200':{description:'Block social interaction',content:{'application/json':{schema:ref('PlayerBlockView')}}},'403':errorResponse('Self block denied'),'404':errorResponse('Player not found')}},delete:{operationId:'unblockPlayer',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('SocialMutationRequest')}}},responses:{'200':{description:'Remove block',content:{'application/json':{schema:ref('PlayerBlockView')}}}}}},
    '/v1/comments/{commentId}/report':{post:{operationId:'reportProjectComment',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('ContentReportCreateRequest')}}},responses:{'201':{description:'Private moderation report receipt',content:{'application/json':{schema:ref('ContentReportView')}}},'404':errorResponse('Comment not found')}}},
    '/v1/projects/{projectId}/tester-requests':{post:{operationId:'createExternalTestRequest',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('ExternalTestRequestCreateRequest')}}},responses:{'201':{description:'Project owner requests external test',content:{'application/json':{schema:ref('ExternalTestRequestView')}}},'403':errorResponse('Project owner only'),'409':errorResponse('Open tester request already exists')}}},
    '/v1/tester-requests/{testRequestId}/results':{post:{operationId:'recordExternalTestResult',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('ExternalTestResultCreateRequest')}}},responses:{'201':{description:'Bounded external human observation',content:{'application/json':{schema:ref('ExternalTestResultView')}}},'403':errorResponse('Owner/self/block denied'),'409':errorResponse('Tester request unavailable')}}},
    '/v1/projects/{projectId}/external-tests':{get:{operationId:'getProjectExternalTests',responses:{'200':{description:'Public bounded tester state',content:{'application/json':{schema:ref('ProjectExternalTestsView')}}},'404':errorResponse('Project not found')}}},
    '/v1/rounds': {
      get: {
        operationId: 'listRounds',
        security: [{sessionCookie: []}],
        responses: {
          '200': {description: 'Available Rounds with Player membership state', content: {'application/json': {schema: ref('RoundList')}}},
          '401': errorResponse('Authentication required'),
        },
      },
    },
    '/v1/rounds/{roundId}/join': {
      post: {
        operationId: 'joinRound',
        security: [{sessionCookie: []}],
        parameters: [{name: 'roundId', in: 'path', required: true, schema: ref('RoundId')}],
        responses: {
          '200': {description: 'Round joined/selected', content: {'application/json': {schema: ref('RoundView')}}},
          '400': errorResponse('Invalid or closed Round'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Origin denied'),
          '404': errorResponse('Round not found'),
        },
      },
    },
    '/v1/missions': {
      post: {
        operationId: 'createMission',
        security: [{sessionCookie: []}],
        requestBody: {required: true, content: {'application/json': {schema: ref('MissionCreateRequest')}}},
        responses: {
          '201': {description: 'Project/Mission declared and Command state returned', content: {'application/json': {schema: ref('CommandView')}}},
          '400': errorResponse('Invalid Mission declaration'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Origin denied'),
          '409': errorResponse('Idempotency conflict'),
        },
      },
    },
    '/v1/missions/{missionId}': {
      patch: {
        operationId: 'updateMission',
        security: [{sessionCookie: []}],
        parameters: [{name: 'missionId', in: 'path', required: true, schema: ref('MissionId')}],
        requestBody: {required: true, content: {'application/json': {schema: ref('MissionUpdateRequest')}}},
        responses: {
          '200': {description: 'Mission current state updated', content: {'application/json': {schema: ref('CommandView')}}},
          '400': errorResponse('Invalid Mission mutation'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Authorization denied'),
          '404': errorResponse('Mission not found'),
          '409': errorResponse('Idempotency or transition conflict'),
        },
      },
    },
    '/v1/missions/{missionId}/gates/{gateKey}': {
      patch: {
        operationId: 'updateMissionGate',
        security: [{sessionCookie: []}],
        parameters: [
          {name: 'missionId', in: 'path', required: true, schema: ref('MissionId')},
          {name: 'gateKey', in: 'path', required: true, schema: ref('MissionGateKey')},
        ],
        requestBody: {required: true, content: {'application/json': {schema: ref('MissionGateUpdateRequest')}}},
        responses: {
          '200': {description: 'Participant-controlled Mission gate state updated', content: {'application/json': {schema: ref('CommandView')}}},
          '400': errorResponse('Invalid gate mutation'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Authorization or truth-ceiling denied'),
          '404': errorResponse('Mission/gate not found'),
          '409': errorResponse('Idempotency conflict'),
        },
      },
    },
    '/v1/development/projects': {
      post: {
        operationId: 'createDevelopmentProject',
        'x-development-only': true,
        security: [{sessionCookie: []}],
        requestBody: {required: true, content: {'application/json': {schema: ref('DevelopmentProjectRequest')}}},
        responses: {
          '201': {description: 'Minimal Phase-1 development Project/Mission created', content: {'application/json': {schema: ref('PrivateProject')}}},
          '400': errorResponse('Invalid development Project'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Origin denied'),
        },
      },
    },
    '/v1/projects/{projectId}': {
      get: {
        operationId: 'getPublicProject',
        parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}],
        responses: {
          '200': {description: 'Safe public Project projection', content: {'application/json': {schema: ref('PublicProject')}}},
          '400': errorResponse('Invalid Project ID'),
          '404': errorResponse('Project not found'),
        },
      },
    },
    '/v1/projects/{projectId}/private': {
      get: {
        operationId: 'getPrivateProject',
        security: [{sessionCookie: []}],
        parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}],
        responses: {
          '200': {description: 'Owner-only private Project projection', content: {'application/json': {schema: ref('PrivateProject')}}},
          '400': errorResponse('Invalid Project ID'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Authorization denied'),
          '404': errorResponse('Project not found'),
        },
      },
    },
    '/v1/projects/{projectId}/github-repositories': {
      post: {
        operationId: 'linkProjectGitHubRepository',
        security: [{sessionCookie: []}],
        parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}],
        requestBody: {required: true, content: {'application/json': {schema: ref('ProjectGitHubRepositoryLinkRequest')}}},
        responses: {
          '200': {description: 'GitHub repository linked to Project', content: {'application/json': {schema: ref('PrivateProject')}}},
          '400': errorResponse('Invalid Project/repository'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Authorization or repository denied'),
          '404': errorResponse('Project not found'),
          '409': errorResponse('Repository link conflict'),
        },
      },
    },
    '/v1/github/install': {
      post: {
        operationId: 'createGitHubInstall',
        'x-requires-github-config': true,
        security: [{sessionCookie: []}],
        responses: {
          '201': {description: 'One-time GitHub App installation URL', content: {'application/json': {schema: ref('GitHubInstallView')}}},
          '401': errorResponse('Authentication required'),
          '403': errorResponse('Origin denied'),
        },
      },
    },
  },
};
