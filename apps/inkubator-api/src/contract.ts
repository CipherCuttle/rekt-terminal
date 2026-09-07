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
