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
    required: ['schema_version', 'player_id', 'display_name'],
    properties: {
      schema_version: {type: 'string', const: 'player.public.v1'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      display_name: {type: 'string'},
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
    required: ['schema_version', 'player_id'],
    properties: {
      schema_version: {type: 'string', const: 'player.profile.v1'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      bio: {type: 'string'},
      character_name: {type: 'string'},
      character_archetype: {type: 'string'},
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
    },
  },
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
      schema_version: {type: 'string', const: 'project.public.v1'},
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
      schema_version: {type: 'string', const: 'project.private.v1'},
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
      observation_state: {type: 'string', enum: ['UNKNOWN', 'OBSERVED']},
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
      observation_state: {type: 'string', enum: ['UNKNOWN', 'OBSERVED']},
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
    required: ['rule_version', 'source_state', 'signal_state', 'stale_after_ms', 'invalid_observation_count', 'reason_code'],
    properties: {
      rule_version: {type: 'string', const: 'github-evidence.v1'},
      source_state: {type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE']},
      signal_state: {type: 'string', enum: ['UNKNOWN', 'ACTIVE', 'OBSERVED', 'STALE', 'FAILED']},
      stale_after_ms: {type: 'integer'},
      invalid_observation_count: {type: 'integer'},
      reason_code: {type: 'string', enum: ['source_unavailable_no_evidence', 'source_unavailable_cached_evidence_not_current', 'no_valid_observation', 'latest_observation_stale', 'latest_observation_current']},
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
