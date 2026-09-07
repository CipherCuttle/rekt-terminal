import {componentSchemas, openapiDocument} from './contract.js';

// Phase 6C is an additive contract extension over the frozen API authority file.
// The base Ship Receipt schema remains inkubator.ship-receipt/1.0; this extension
// versions only the public shareable Artifact/Project Ship projection.
const schemas = componentSchemas as unknown as Record<string, any>;

schemas.ShipArtifactPrivateView = {
  type: 'object', additionalProperties: false, required: ['title', 'url'],
  properties: {
    title: {type: 'string'},
    url: {type: 'string', format: 'uri'},
    demo_url: {type: 'string', format: 'uri'},
    source_url: {type: 'string', format: 'uri'},
  },
};

schemas.ShipArtifactPublicView = {
  type: 'object', additionalProperties: false, required: ['title', 'url'],
  properties: {
    title: {type: 'string'},
    url: {type: 'string', format: 'uri'},
    demo_url: {type: 'string', format: 'uri'},
  },
};

schemas.ShipArtifactBuilderView = {
  type: 'object', additionalProperties: false, required: ['player_id', 'display_name', 'role'],
  properties: {
    player_id: {$ref: '#/components/schemas/PlayerId'},
    display_name: {type: 'string'},
    role: {type: 'string', enum: ['OWNER', 'PARTY']},
  },
};

schemas.ShipAssistAttributionView = {
  type: 'object', additionalProperties: false, required: ['assist_id', 'player_id', 'display_name', 'accepted_at', 'source_state'],
  properties: {
    assist_id: {type: 'string', format: 'uuid'},
    player_id: {$ref: '#/components/schemas/PlayerId'},
    display_name: {type: 'string'},
    accepted_at: {type: 'string', format: 'date-time'},
    source_state: {type: 'string', const: 'ACCEPTED'},
  },
};

schemas.ShipArtifactEvidenceView = {
  type: 'object', additionalProperties: false, required: ['verifier_observation_id', 'acceptance_review_id'],
  properties: {
    verifier_observation_id: {type: 'string', format: 'uuid'},
    acceptance_review_id: {type: 'string', format: 'uuid'},
  },
};

schemas.AcceptedShipArtifactView = {
  type: 'object', additionalProperties: false,
  required: ['schema_version', 'receipt_id', 'receipt_schema_version', 'submission_id', 'mission_id', 'project_id', 'owner_player_id', 'acceptance_rule_version', 'artifact', 'builders', 'assists', 'evidence', 'truth_state', 'shipped_at'],
  properties: {
    schema_version: {type: 'string', const: 'ship.artifact.public.v1'},
    receipt_id: {type: 'string', format: 'uuid'},
    receipt_schema_version: {type: 'string', const: 'inkubator.ship-receipt/1.0'},
    submission_id: {type: 'string', format: 'uuid'},
    mission_id: {$ref: '#/components/schemas/MissionId'},
    project_id: {$ref: '#/components/schemas/ProjectId'},
    owner_player_id: {$ref: '#/components/schemas/PlayerId'},
    round_id: {$ref: '#/components/schemas/RoundId'},
    acceptance_rule_version: {type: 'string', const: 'ship.acceptance.v1'},
    artifact: {$ref: '#/components/schemas/ShipArtifactPublicView'},
    builders: {type: 'array', items: {$ref: '#/components/schemas/ShipArtifactBuilderView'}},
    assists: {type: 'array', items: {$ref: '#/components/schemas/ShipAssistAttributionView'}},
    evidence: {$ref: '#/components/schemas/ShipArtifactEvidenceView'},
    truth_state: {type: 'string', const: 'PROVEN'},
    shipped_at: {type: 'string', format: 'date-time'},
  },
};

schemas.ShipSubmissionPrivateView = {
  type: 'object', additionalProperties: false,
  required: ['schema_version', 'submission_id', 'mission_id', 'project_id', 'artifact', 'state', 'submitted_at'],
  properties: {
    schema_version: {type: 'string', const: 'ship.submission.private.v1'},
    submission_id: {type: 'string', format: 'uuid'},
    mission_id: {$ref: '#/components/schemas/MissionId'},
    project_id: {$ref: '#/components/schemas/ProjectId'},
    artifact: {$ref: '#/components/schemas/ShipArtifactPrivateView'},
    state: {type: 'string', enum: ['SUBMITTED', 'OBSERVED', 'ATTENTION', 'ACCEPTED', 'REJECTED']},
    submitted_at: {type: 'string', format: 'date-time'},
    verifier_observation: {$ref: '#/components/schemas/ShipVerifierObservationView'},
  },
};

schemas.ShipSubmissionPublicView = {
  type: 'object', additionalProperties: false,
  required: ['schema_version', 'submission_id', 'mission_id', 'project_id', 'artifact', 'state', 'submitted_at'],
  properties: {
    schema_version: {type: 'string', const: 'ship.submission.public.v2'},
    submission_id: {type: 'string', format: 'uuid'},
    mission_id: {$ref: '#/components/schemas/MissionId'},
    project_id: {$ref: '#/components/schemas/ProjectId'},
    artifact: {$ref: '#/components/schemas/ShipArtifactPublicView'},
    state: {type: 'string', enum: ['SUBMITTED', 'OBSERVED', 'ATTENTION', 'PROVEN']},
    submitted_at: {type: 'string', format: 'date-time'},
    verifier_observation: {$ref: '#/components/schemas/ShipVerifierObservationView'},
    accepted_ship: {$ref: '#/components/schemas/AcceptedShipArtifactView'},
  },
};

schemas.ProjectShipStateView = {
  type: 'object', additionalProperties: false, required: ['schema_version', 'project_id'],
  properties: {
    schema_version: {type: 'string', const: 'project.ship.public.v2'},
    project_id: {$ref: '#/components/schemas/ProjectId'},
    latest_submission: {$ref: '#/components/schemas/ShipSubmissionPublicView'},
  },
};

const paths = openapiDocument.paths as unknown as Record<string, any>;
paths['/v1/missions/{missionId}/ship-submissions'].post.responses['201'].content['application/json'].schema = {$ref: '#/components/schemas/ShipSubmissionPrivateView'};
paths['/v1/projects/{projectId}/ship'].get.responses['200'].description = 'Privacy-safe public Ship state with immutable accepted Artifact attribution when PROVEN';
