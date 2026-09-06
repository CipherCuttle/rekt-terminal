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
  PublicPlayer: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'display_name'],
    properties: {
      schema_version: {type: 'string', const: 'player.public.v1'},
      player_id: {type: 'string', format: 'uuid'},
      display_name: {type: 'string'},
    },
  },
  PrivatePlayer: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'display_name', 'created_at', 'updated_at'],
    properties: {
      schema_version: {type: 'string', const: 'player.private.v1'},
      player_id: {type: 'string', format: 'uuid'},
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
};

const ref = (name: keyof typeof componentSchemas) => ({$ref: `#/components/schemas/${name}`});

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
          '403': {description: 'Origin denied', content: {'application/json': {schema: ref('Error')}}},
        },
      },
    },
    '/v1/session': {
      delete: {
        operationId: 'deleteSession',
        security: [{sessionCookie: []}],
        responses: {'204': {description: 'Session revoked'}},
      },
    },
    '/v1/me': {
      get: {
        operationId: 'getMe',
        security: [{sessionCookie: []}],
        responses: {
          '200': {description: 'Authenticated Player', content: {'application/json': {schema: ref('PrivatePlayer')}}},
          '401': {description: 'Authentication required', content: {'application/json': {schema: ref('Error')}}},
        },
      },
    },
    '/v1/players/{playerId}': {
      get: {
        operationId: 'getPublicPlayer',
        parameters: [{name: 'playerId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}],
        responses: {
          '200': {description: 'Explicit public projection', content: {'application/json': {schema: ref('PublicPlayer')}}},
          '404': {description: 'Player not found', content: {'application/json': {schema: ref('Error')}}},
        },
      },
    },
    '/v1/players/{playerId}/private': {
      get: {
        operationId: 'getPrivatePlayer',
        security: [{sessionCookie: []}],
        parameters: [{name: 'playerId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}],
        responses: {
          '200': {description: 'Owner-only private projection', content: {'application/json': {schema: ref('PrivatePlayer')}}},
          '401': {description: 'Authentication required', content: {'application/json': {schema: ref('Error')}}},
          '403': {description: 'Authorization denied', content: {'application/json': {schema: ref('Error')}}},
        },
      },
    },
  },
};
