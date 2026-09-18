export const INTERPRETATION_JSON_SCHEMA_RESPONSE_FORMAT = Object.freeze({
  type: 'json_schema',
  json_schema: {
    name: 'rekt_inkubator_compiler_interpretation',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        schema_version: {type: 'string', const: 'inkubator.compiler-interpretation/1.0'},
        proposal: {
          type: 'object',
          additionalProperties: false,
          properties: {
            schema_version: {type: 'string', const: 'inkubator.compiler-proposal/1.0'},
            source_intent: {type: 'string', minLength: 1},
            requirements: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  key: {type: 'string', minLength: 1},
                  value: {anyOf: [{type: 'string'}, {type: 'number'}, {type: 'boolean'}, {type: 'null'}]},
                  provenance: {type: 'string', const: 'MODEL_PROPOSAL'}
                },
                required: ['key', 'value', 'provenance']
              }
            },
            knowledge: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  kind: {type: 'string', enum: ['KNOWN', 'ASSUMED', 'UNKNOWN']},
                  key: {type: 'string', minLength: 1},
                  material: {type: 'boolean'},
                  value: {anyOf: [{type: 'string'}, {type: 'number'}, {type: 'boolean'}, {type: 'null'}]},
                  provenance: {type: 'string', const: 'MODEL_PROPOSAL'}
                },
                required: ['kind', 'key', 'material', 'provenance']
              }
            },
            outcome_criteria: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: {type: 'string', minLength: 1},
                  description: {type: 'string', minLength: 1},
                  mandatory: {type: 'boolean'},
                  provenance: {type: 'string', const: 'MODEL_PROPOSAL'}
                },
                required: ['id', 'description', 'mandatory', 'provenance']
              }
            },
            delivery_criteria: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: {type: 'string', minLength: 1},
                  description: {type: 'string', minLength: 1},
                  mandatory: {type: 'boolean'},
                  provenance: {type: 'string', const: 'MODEL_PROPOSAL'}
                },
                required: ['id', 'description', 'mandatory', 'provenance']
              }
            },
            preferences: {
              type: 'object',
              additionalProperties: {
                anyOf: [{type: 'string'}, {type: 'number'}, {type: 'boolean'}, {type: 'null'}]
              }
            }
          },
          required: ['schema_version', 'source_intent', 'requirements', 'knowledge', 'outcome_criteria', 'delivery_criteria', 'preferences']
        },
        explanation: {type: 'string', minLength: 1}
      },
      required: ['schema_version', 'proposal', 'explanation']
    }
  }
});

export function responseFormatForMode(mode) {
  if (mode === undefined || mode === null || mode === 'json_object') return {type: 'json_object'};
  if (mode === 'json_schema') return structuredClone(INTERPRETATION_JSON_SCHEMA_RESPONSE_FORMAT);
  throw new Error(`unsupported benchmark response_format_mode ${mode}`);
}
