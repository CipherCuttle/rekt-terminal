import './contract-phase9.js';
import {componentSchemas, openapiDocument} from './contract.js';

const schemas = componentSchemas as unknown as Record<string, any>;
const paths = openapiDocument.paths as unknown as Record<string, any>;
const ref = (name: string) => ({$ref: `#/components/schemas/${name}`});
const errorResponse = (description: string) => ({description, content: {'application/json': {schema: ref('Error')}}});

// Stage F2 adds one narrow mutation authority without reusing historical Ship or generic update scopes.
schemas.DevkitScope = {
  type: 'string',
  enum: ['player:read','project:read','mission:read','claim:write','update:write','beacon:write','assist:write','ship:prepare','challenge:submit'],
};
if (schemas.DevkitTokenIssueRequest?.properties?.scopes) schemas.DevkitTokenIssueRequest.properties.scopes.maxItems = 9;

const immutableSourceReferenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'value'],
  properties: {
    kind: {type: 'string', enum: ['GIT_COMMIT', 'CONTENT_ADDRESS', 'ARCHIVE_DIGEST']},
    value: {type: 'string', minLength: 1, maxLength: 500},
  },
};

const challengeSubmissionRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'request_id', 'submission_id', 'entry_id', 'expected_terms_digest', 'submission_version',
    'immutable_source_reference', 'artifact_digest', 'evidence_references',
  ],
  properties: {
    request_id: {type: 'string', format: 'uuid'},
    submission_id: {type: 'string', format: 'uuid'},
    entry_id: {type: 'string', format: 'uuid'},
    expected_terms_digest: {type: 'string', pattern: '^[0-9a-f]{64}$'},
    submission_version: {type: 'integer', minimum: 1},
    immutable_source_reference: immutableSourceReferenceSchema,
    artifact_digest: {type: 'string', pattern: '^[0-9a-f]{64}$'},
    evidence_references: {type: 'array', maxItems: 100, uniqueItems: true, items: {type: 'string', minLength: 1, maxLength: 500}},
    optional_live_url: {type: 'string', format: 'uri', maxLength: 2000},
    ship_submission_id: {type: 'string', format: 'uuid'},
  },
};

const acceptedSubmissionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schema_version', 'submission_id', 'challenge_id', 'entry_id', 'submission_version',
    'terms_digest', 'manifest_digest', 'accepted_at', 'ship_submission_id',
  ],
  properties: {
    schema_version: {type: 'string', const: 'challenge.submission.accepted.v1'},
    submission_id: {type: 'string', format: 'uuid'},
    challenge_id: {type: 'string', format: 'uuid'},
    entry_id: {type: 'string', format: 'uuid'},
    submission_version: {type: 'string'},
    terms_digest: {type: 'string', pattern: '^[0-9a-f]{64}$'},
    manifest_digest: {type: 'string', pattern: '^[0-9a-f]{64}$'},
    accepted_at: {type: 'string', format: 'date-time'},
    ship_submission_id: {type: ['string', 'null'], format: 'uuid'},
  },
};

paths['/v1/devkit/challenges/{challengeId}/submissions'] = {
  post: {
    operationId: 'submitDevkitChallenge',
    security: [{devkitBearer: []}],
    parameters: [{name: 'challengeId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}],
    requestBody: {required: true, content: {'application/json': {schema: challengeSubmissionRequestSchema}}},
    responses: {
      '201': {description: 'Builder-owned immutable Challenge submission accepted using PostgreSQL time', content: {'application/json': {schema: acceptedSubmissionSchema}}},
      '400': errorResponse('Malformed Challenge submission request'),
      '401': errorResponse('DevKit credential required'),
      '403': errorResponse('challenge:submit scope or Entry ownership required'),
      '404': errorResponse('Challenge or Entry not found'),
      '409': errorResponse('Challenge lifecycle, terms lineage, deadline, idempotency, immutable version, protocol, or Ship lineage conflict'),
      '429': errorResponse('DevKit rate limited'),
    },
  },
};
