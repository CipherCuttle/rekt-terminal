import './contract-phase8.js';
import {openapiDocument} from './contract.js';

const paths = openapiDocument.paths as unknown as Record<string, any>;
const ref = (name: string) => ({$ref: `#/components/schemas/${name}`});
const errorResponse = (description: string) => ({description, content: {'application/json': {schema: ref('Error')}}});

const capsuleFileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'media_type', 'sha256', 'content'],
  properties: {
    path: {type: 'string', minLength: 1, maxLength: 160},
    media_type: {type: 'string', enum: ['text/markdown', 'application/json']},
    sha256: {type: 'string', pattern: '^[0-9a-f]{64}$'},
    content: {type: 'string'},
  },
};

const builderCapsuleSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schema_version', 'challenge_id', 'entry_id', 'entry_state', 'contract_version',
    'terms_digest', 'submission_deadline', 'files',
  ],
  properties: {
    schema_version: {type: 'string', const: 'builder-capsule.v1'},
    challenge_id: {type: 'string', format: 'uuid'},
    entry_id: {type: 'string', format: 'uuid'},
    entry_state: {type: 'string'},
    contract_version: {type: 'string'},
    terms_digest: {type: 'string', pattern: '^[0-9a-f]{64}$'},
    submission_deadline: {type: 'string', format: 'date-time'},
    files: {type: 'array', minItems: 4, maxItems: 4, items: capsuleFileSchema},
  },
};

paths['/v1/devkit/challenges/{challengeId}/capsule'] = {
  get: {
    operationId: 'getDevkitChallengeCapsule',
    security: [{devkitBearer: []}],
    parameters: [{name: 'challengeId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}],
    responses: {
      '200': {description: 'Builder-owned deterministic capsule for one frozen Challenge; requires project:read compatibility scope', content: {'application/json': {schema: builderCapsuleSchema}}},
      '400': errorResponse('Invalid Challenge ID'),
      '401': errorResponse('DevKit credential required'),
      '403': errorResponse('Scope denied or Challenge entry required'),
      '404': errorResponse('Challenge not found'),
      '409': errorResponse('Challenge contract is not frozen or canonical pointer is invalid'),
      '429': errorResponse('DevKit rate limited'),
    },
  },
};
