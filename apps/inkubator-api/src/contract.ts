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
      mission_id: {type: 'string', format: 'uuid'},
      mission_state: {type: 'string', const: 'DECLARED'},
      source_connected: {type: 'boolean'},
      source_visibility: {type: 'string', enum: ['NONE', 'PUBLIC', 'PRIVATE']},
      observation_state: {type: 'string', enum: ['UNKNOWN', 'OBSERVED']},
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
      mission_id: {type: 'string', format: 'uuid'},
      mission_state: {type: 'string', const: 'DECLARED'},
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
        'x-development-only': true,
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
        'x-development-only': true,
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
        'x-development-only': true,
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
