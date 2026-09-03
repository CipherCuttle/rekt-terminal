import {
  LEARNING_SCHEMA_VERSION,
  MISSION_IDS,
  type MissionDefinitionV0,
  type MissionId,
} from './types.js';

const definitions: Record<MissionId, MissionDefinitionV0> = {
  'MD-01': {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    id: 'MD-01',
    version: 1,
    title: 'MD-01 — WHAT IS TRUE?',
    objective: 'Classify evidence by the path REKT can justify, then recognize when stale evidence must fail closed.',
    concept: 'MARKET_TRUTH',
    scenario: { kind: 'SYNTHETIC', scenarioId: 'MD-01-PROVENANCE-DRILL-V0', label: 'TRAINING SIMULATION', provenance: 'SYNTHETIC', environment: 'DEMO' },
    guidanceLevel: 'WORKED_EXAMPLE',
    requiredInputs: ['classifications for the four learner items', 'freshness/fail-closed answer'],
    deterministicCriteria: ['CLASSIFICATIONS_CORRECT', 'STALE_FAILS_CLOSED'],
    debriefTemplate: ['what source published', 'what REKT derived', 'why synthetic/stale differs', 'why the UI cannot invent stronger provenance'],
  },
  'EX-01': {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    id: 'EX-01',
    version: 1,
    title: 'EX-01 — WHERE DID MY MONEY GO?',
    objective: 'Enter and close one fixed training trade, then separate a mark from a fill and execution costs from the result.',
    concept: 'POSITION_AND_PNL / EXECUTION',
    scenario: { kind: 'SYNTHETIC', scenarioId: 'EX-01-SPOT-FILL-DRILL-V0', label: 'TRAINING SIMULATION', provenance: 'SYNTHETIC', environment: 'DEMO' },
    guidanceLevel: 'GUIDED',
    requiredInputs: ['enter fixed trade', 'mark-vs-fill answer', 'fee/execution answer', 'close fixed trade'],
    deterministicCriteria: ['ENTRY_RECORDED', 'MARK_NOT_FILL', 'FEES_AFFECT_CLOSE', 'CLOSE_RECORDED'],
    debriefTemplate: ['MARK', 'ENTRY FILL', 'EXIT FILL', 'IMPACT', 'FEES', 'REALIZED RESULT'],
  },
  'LQ-01': {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    id: 'LQ-01',
    version: 1,
    title: 'LQ-01 — SHOULD I SEND THIS ORDER?',
    objective: 'Compare the same requested notional against deep and thin liquidity, and choose when resizing or declining is correct.',
    concept: 'LIQUIDITY_AND_EXECUTION',
    scenario: { kind: 'SYNTHETIC', scenarioId: 'LQ-01-LIQUIDITY-DRILL-V0', label: 'TRAINING SIMULATION', provenance: 'SYNTHETIC', environment: 'DEMO' },
    guidanceLevel: 'WORKED_EXAMPLE',
    requiredInputs: ['deep-liquidity decision', 'thin-liquidity decision', 'model-specific impact acknowledgement'],
    deterministicCriteria: ['DEEP_DECISION_VALID', 'THIN_DECISION_SAFE', 'MODEL_LABEL_ACKNOWLEDGED'],
    debriefTemplate: ['REQUESTED', 'REFERENCE', 'LIQUIDITY', 'PARTICIPATION', 'MODELED IMPACT', 'DECISION'],
  },
  'ST-01': {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    id: 'ST-01',
    version: 1,
    title: 'ST-01 — TAKE THE LOSS',
    objective: 'Place a protective stop, refuse to widen it, and let the planned exit teach trigger versus actual fill.',
    concept: 'STOP_DISCIPLINE',
    scenario: { kind: 'SYNTHETIC', scenarioId: 'ST-01-STOP-DRILL-V0', label: 'TRAINING SIMULATION', provenance: 'SYNTHETIC', environment: 'DEMO' },
    guidanceLevel: 'GUIDED',
    requiredInputs: ['enter', 'place valid stop', 'stop instruction acknowledgement', 'no widening choice', 'allow planned exit'],
    deterministicCriteria: ['ENTRY_RECORDED', 'STOP_PLACED', 'STOP_NOT_WIDENED', 'STOP_ACKNOWLEDGED', 'STOP_EXIT_COMPLETED'],
    debriefTemplate: ['PLAN', 'TRIGGER', 'ACTUAL FILL', 'IMPACT / FEES', 'RESULT', 'PROCESS', 'LESSON'],
  },
  'RS-01': {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    id: 'RS-01',
    version: 1,
    title: 'RS-01 — SIZE COMES LAST',
    objective: 'Use the production risk calculator: account risk and invalidation determine an acceptable position size.',
    concept: 'ACCOUNT_RISK / POSITION_SIZING',
    scenario: { kind: 'SYNTHETIC', scenarioId: 'RS-01-RISK-DRILL-V0', label: 'TRAINING SIMULATION', provenance: 'SYNTHETIC', environment: 'DEMO' },
    guidanceLevel: 'WORKED_EXAMPLE',
    requiredInputs: ['acceptable position size', 'wider-stop comparison', 'production model acknowledgement'],
    deterministicCriteria: ['RISK_PLAN_VALID', 'SIZE_WITHIN_BUDGET', 'WIDER_STOP_SMALLER_SIZE', 'PRODUCTION_MODEL_ACKNOWLEDGED'],
    debriefTemplate: ['ACCOUNT EQUITY', 'RISK BUDGET', 'STOP / INVALIDATION', 'POSITION SIZE', 'PROJECTED STOP LOSS', 'ACTUAL PROCESS RESULT IF EXECUTED'],
  },
};

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

export const MISSION_DEFINITIONS: Readonly<Record<MissionId, MissionDefinitionV0>> = freeze(definitions);

export function getMissionDefinition(id: MissionId): MissionDefinitionV0 {
  if (!MISSION_IDS.includes(id)) throw new RangeError(`unknown learning mission ${id}`);
  return MISSION_DEFINITIONS[id];
}

export function missionSequenceIndex(id: MissionId): number {
  return MISSION_IDS.indexOf(id);
}
