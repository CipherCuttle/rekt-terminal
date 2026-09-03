import { getMissionDefinition, missionSequenceIndex } from './missions.js';
import { verifyMissionReceipt } from './evaluate.js';
import {
  LEARNING_STATE_VERSION,
  MISSION_IDS,
  type LearningAction,
  type LearningStateV0,
  type MissionId,
  type MissionReceiptV0,
} from './types.js';

export class LearningStateValidationError extends RangeError {}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

export function createInitialLearningState(): LearningStateV0 {
  return freeze({ stateVersion: LEARNING_STATE_VERSION, completed: [], attempts: [], currentMissionId: null });
}

export function nextMissionId(state: Pick<LearningStateV0, 'completed'>): MissionId | null {
  const completed = new Set(state.completed.map((entry) => entry.missionId));
  return MISSION_IDS.find((id) => !completed.has(id)) ?? null;
}

export function canStartMission(state: LearningStateV0, id: MissionId): boolean {
  const next = nextMissionId(state);
  return next === id || state.completed.some((entry) => entry.missionId === id);
}

function assertReceipt(receipt: MissionReceiptV0): void {
  const definition = getMissionDefinition(receipt.missionId);
  if (receipt.missionVersion !== definition.version) throw new LearningStateValidationError('receipt mission version is not supported');
  if (receipt.scenario.kind !== 'SYNTHETIC' || receipt.scenario.provenance !== 'SYNTHETIC' || receipt.scenario.environment !== 'DEMO') throw new LearningStateValidationError('V0 learning receipts must preserve synthetic training provenance');
  if (receipt.scenarioDigest.length === 0) throw new LearningStateValidationError('receipt has no scenario identity');
  if (!Number.isSafeInteger(receipt.completedAtSimMs) || receipt.completedAtSimMs < 0) throw new LearningStateValidationError('receipt has an invalid simulator time');
  if (receipt.learnerInput.kind !== receipt.missionId || receipt.relevantFacts.kind !== receipt.missionId) throw new LearningStateValidationError('receipt mission identity is inconsistent');
  if (!verifyMissionReceipt(receipt)) throw new LearningStateValidationError('receipt identity or evaluator version is invalid');
}

export function reduceLearningState(state: LearningStateV0, action: LearningAction): LearningStateV0 {
  const base = parseLearningState(state);
  if (action.type === 'MISSION_STARTED') {
    if (!canStartMission(base, action.missionId)) throw new LearningStateValidationError(`mission ${action.missionId} is not available yet`);
    return freeze({ ...base, currentMissionId: action.missionId });
  }
  assertReceipt(action.receipt);
  if (!base.completed.some((entry) => entry.missionId === action.receipt.missionId) && !canStartMission(base, action.receipt.missionId)) {
    throw new LearningStateValidationError(`mission ${action.receipt.missionId} is not available yet`);
  }
  const attempts = [...base.attempts, action.receipt];
  const alreadyCompleted = base.completed.some((entry) => entry.missionId === action.receipt.missionId);
  const completed = action.receipt.verdict === 'PASS' && !alreadyCompleted
    ? [...base.completed, { missionId: action.receipt.missionId, missionVersion: action.receipt.missionVersion, receiptId: action.receipt.receiptId }]
    : [...base.completed];
  if (completed.some((entry, index) => index > 0 && missionSequenceIndex(entry.missionId) < missionSequenceIndex(completed[index - 1].missionId))) throw new LearningStateValidationError('completed missions must remain sequential');
  return freeze({ ...base, attempts, completed, currentMissionId: nextMissionId({ completed }) });
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new LearningStateValidationError('learning save must be an object');
  return value as Record<string, unknown>;
}

export function parseLearningState(input: unknown): LearningStateV0 {
  const value = record(input);
  if (value.stateVersion !== LEARNING_STATE_VERSION) throw new LearningStateValidationError('unknown learning state version');
  if (!Array.isArray(value.completed) || !Array.isArray(value.attempts)) throw new LearningStateValidationError('learning save has invalid collections');
  const completed = value.completed.map((entry) => {
    const item = record(entry);
    if (typeof item.missionId !== 'string' || !MISSION_IDS.includes(item.missionId as MissionId) || item.missionVersion !== 1 || typeof item.receiptId !== 'string') throw new LearningStateValidationError('learning completion is invalid');
    return { missionId: item.missionId as MissionId, missionVersion: 1 as const, receiptId: item.receiptId };
  });
  const ids = new Set<MissionId>();
  for (const entry of completed) {
    if (ids.has(entry.missionId)) throw new LearningStateValidationError('learning completion is duplicated');
    ids.add(entry.missionId);
  }
  if (completed.some((entry, index) => index > 0 && missionSequenceIndex(entry.missionId) !== missionSequenceIndex(completed[index - 1].missionId) + 1)) throw new LearningStateValidationError('learning completion order is invalid');
  const attempts = value.attempts.map((entry) => {
    const receipt = entry as MissionReceiptV0;
    assertReceipt(receipt);
    return receipt;
  });
  const currentMissionId = value.currentMissionId === null ? null : value.currentMissionId;
  if (currentMissionId !== null && (typeof currentMissionId !== 'string' || !MISSION_IDS.includes(currentMissionId as MissionId))) throw new LearningStateValidationError('current learning mission is invalid');
  const expected = nextMissionId({ completed });
  if (currentMissionId !== null && currentMissionId !== expected && !completed.some((entry) => entry.missionId === currentMissionId)) throw new LearningStateValidationError('current learning mission is inconsistent');
  return freeze({ stateVersion: LEARNING_STATE_VERSION, completed, attempts, currentMissionId: currentMissionId as MissionId | null });
}
