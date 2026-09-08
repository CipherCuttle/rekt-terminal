import './contract-phase6c.js';
import {componentSchemas, openapiDocument} from './contract.js';

const schemas = componentSchemas as unknown as Record<string, any>;
const paths = openapiDocument.paths as unknown as Record<string, any>;

schemas.ReputationPlayerView = {
  type: 'object', additionalProperties: false, required: ['player_id', 'display_name'],
  properties: {
    player_id: {$ref: '#/components/schemas/PlayerId'},
    display_name: {type: 'string'},
  },
};

schemas.CheevoEvidenceView = {
  type: 'object', additionalProperties: false, required: ['source_type', 'source_id'],
  properties: {
    source_type: {type: 'string', enum: ['RECEIPT', 'ASSIST', 'TEST_RESULT', 'MISSION']},
    source_id: {type: 'string'},
  },
};

schemas.CheevoView = {
  type: 'object', additionalProperties: false,
  required: ['key', 'label', 'description', 'rule_version', 'truth_state', 'earned_at', 'evidence'],
  properties: {
    key: {type: 'string', enum: [
      'FIRST_BLOOD',
      'WORKING_URL_OR_GTFO',
      'REPEAT_OFFENDER',
      'ACTUALLY_HELPFUL',
      'PARTY_UP',
      'CREW_CHIEF',
      'SHIPMATE',
      'TOUCH_GRASS',
      'TEST_PILOT',
      'UNREKT',
    ]},
    label: {type: 'string'},
    description: {type: 'string'},
    rule_version: {type: 'string', const: 'cheevo.rules.v1'},
    truth_state: {type: 'string', const: 'PROVEN'},
    earned_at: {type: 'string', format: 'date-time'},
    evidence: {$ref: '#/components/schemas/CheevoEvidenceView'},
  },
};

schemas.ReputationMetricsView = {
  type: 'object', additionalProperties: false,
  required: ['ships', 'shipped_assists', 'shipped_projects_assisted', 'collaborative_ships', 'tested_shipped_projects'],
  properties: {
    ships: {type: 'integer', minimum: 0},
    shipped_assists: {type: 'integer', minimum: 0},
    shipped_projects_assisted: {type: 'integer', minimum: 0},
    collaborative_ships: {type: 'integer', minimum: 0},
    tested_shipped_projects: {type: 'integer', minimum: 0},
  },
};

schemas.PlayerReputationView = {
  type: 'object', additionalProperties: false,
  required: ['schema_version', 'rule_version', 'player', 'metrics', 'cheevos'],
  properties: {
    schema_version: {type: 'string', const: 'player.reputation.public.v1'},
    rule_version: {type: 'string', const: 'reputation.rules.v1'},
    player: {$ref: '#/components/schemas/ReputationPlayerView'},
    metrics: {$ref: '#/components/schemas/ReputationMetricsView'},
    cheevos: {type: 'array', items: {$ref: '#/components/schemas/CheevoView'}},
  },
};

schemas.BoardRowView = {
  type: 'object', additionalProperties: false, required: ['rank', 'player_id', 'display_name', 'metric_count'],
  properties: {
    rank: {type: 'integer', minimum: 1},
    player_id: {$ref: '#/components/schemas/PlayerId'},
    display_name: {type: 'string'},
    metric_count: {type: 'integer', minimum: 1},
  },
};

schemas.ContextualBoardView = {
  type: 'object', additionalProperties: false, required: ['key', 'label', 'metric', 'rows'],
  properties: {
    key: {type: 'string', enum: ['SHIPPERS', 'ASSISTS', 'COLLABORATION']},
    label: {type: 'string'},
    metric: {type: 'string', enum: ['accepted_ships', 'distinct_shipped_projects_assisted', 'collaborative_ships']},
    rows: {type: 'array', maxItems: 25, items: {$ref: '#/components/schemas/BoardRowView'}},
  },
};

schemas.WorldBoardsView = {
  type: 'object', additionalProperties: false, required: ['schema_version', 'rule_version', 'boards'],
  properties: {
    schema_version: {type: 'string', const: 'world.boards.public.v1'},
    rule_version: {type: 'string', const: 'boards.rules.v1'},
    boards: {type: 'array', minItems: 3, maxItems: 3, items: {$ref: '#/components/schemas/ContextualBoardView'}},
  },
};

schemas.PlayerHistoryEntryView = {
  type: 'object', additionalProperties: false,
  required: ['entry_id', 'kind', 'truth_state', 'occurred_at'],
  properties: {
    entry_id: {type: 'string'},
    kind: {type: 'string', enum: [
      'SHIP_ACCEPTED',
      'ASSIST_ACCEPTED',
      'EXTERNAL_TEST_RECORDED',
      'CHEEVO_AWARDED',
      'MISSION_BLOCKED',
      'MISSION_RECOVERED',
      'MISSION_CLOSED_NOT_SHIPPED',
    ]},
    truth_state: {type: 'string', enum: ['CLAIMED', 'OBSERVED', 'PROVEN']},
    occurred_at: {type: 'string', format: 'date-time'},
    project_id: {$ref: '#/components/schemas/ProjectId'},
    project_name: {type: 'string'},
    mission_id: {$ref: '#/components/schemas/MissionId'},
    receipt_id: {type: 'string'},
    artifact_title: {type: 'string'},
    role: {type: 'string', enum: ['OWNER', 'PARTY']},
    assist_id: {type: 'string'},
    test_result_id: {type: 'string'},
    outcome: {type: 'string', enum: ['PASS', 'ISSUE_FOUND', 'BLOCKED']},
    cheevo_award_id: {type: 'string'},
    cheevo_key: {type: 'string'},
  },
};

schemas.PlayerHistoryView = {
  type: 'object', additionalProperties: false, required: ['schema_version', 'player_id', 'entries'],
  properties: {
    schema_version: {type: 'string', const: 'player.history.private.v1'},
    player_id: {$ref: '#/components/schemas/PlayerId'},
    entries: {type: 'array', maxItems: 100, items: {$ref: '#/components/schemas/PlayerHistoryEntryView'}},
  },
};

paths['/v1/me/history'] = {
  get: {
    operationId: 'getMyHistory',
    responses: {
      '200': {description: 'Authenticated durable Player history projection over canonical facts', content: {'application/json': {schema: {$ref: '#/components/schemas/PlayerHistoryView'}}}},
      '401': {description: 'Authentication required', content: {'application/json': {schema: {$ref: '#/components/schemas/Error'}}}},
    },
  },
};

paths['/v1/players/{playerId}/reputation'] = {
  get: {
    operationId: 'getPlayerReputation',
    parameters: [{name: 'playerId', in: 'path', required: true, schema: {$ref: '#/components/schemas/PlayerId'}}],
    responses: {
      '200': {description: 'Public multidimensional reputation derived from authoritative history', content: {'application/json': {schema: {$ref: '#/components/schemas/PlayerReputationView'}}}},
      '400': {description: 'Invalid player ID', content: {'application/json': {schema: {$ref: '#/components/schemas/Error'}}}},
      '404': {description: 'Player not found', content: {'application/json': {schema: {$ref: '#/components/schemas/Error'}}}},
    },
  },
};

paths['/v1/world/boards'] = {
  get: {
    operationId: 'getWorldBoards',
    responses: {
      '200': {description: 'Contextual boards over durable Ship and collaboration facts; no universal score', content: {'application/json': {schema: {$ref: '#/components/schemas/WorldBoardsView'}}}},
    },
  },
};
