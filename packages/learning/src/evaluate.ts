import { canonicalEpisodeJson, sha256Hex } from '@rekt-ink/episodes';
import { getMissionDefinition } from './missions.js';
import { createMissionFacts, scenarioDigest } from './scenarios.js';
import { deriveMissionSimulatorEvidence } from './evidence.js';
import {
  LEARNING_EVALUATOR_VERSION,
  MISSION_RECEIPT_VERSION,
  type ExecutionFactsV0,
  type ExecutionMissionEvidenceV0,
  type LiquidityLearnerInput,
  type MarketTruthLearnerInput,
  type MissionAttemptV0,
  type MissionFacts,
  type MissionId,
  type MissionLearnerInput,
  type MissionReceiptV0,
  type MissionVerdict,
  type RiskLearnerInput,
  type StopLearnerInput,
  type StopFactsV0,
  type StopMissionEvidenceV0,
} from './types.js';

export interface EvaluationResult {
  readonly receipt: MissionReceiptV0;
  readonly facts: MissionFacts;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function assertSimTime(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new RangeError('completedAtSimMs must be a non-negative safe integer');
}

function evaluateMarketTruth(input: MarketTruthLearnerInput, facts: Extract<MissionFacts, { kind: 'MD-01' }>, failures: string[]): void {
  for (const item of facts.items.filter((entry) => !entry.workedExample)) {
    if (input.classifications[item.itemId] !== item.expected) failures.push(`MD_CLASSIFICATION_MISMATCH:${item.itemId}`);
  }
  if (input.freshnessAnswer !== facts.freshnessExpected) failures.push('MD_STALE_NOT_FAIL_CLOSED');
}

function evaluateExecution(input: Extract<MissionLearnerInput, { kind: 'EX-01' }>, facts: ExecutionFactsV0, failures: string[]): void {
  // Action facts are derived from the production simulator state. PnL is
  // intentionally not consulted: the lesson grades the learner's distinctions.
  if (!facts.entryAccepted) failures.push('EX_ENTRY_NOT_RECORDED');
  if (input.markAnswer !== 'MARK_IS_OBSERVATION' || facts.markPriceX18 === 'UNAVAILABLE' || facts.entryFillPriceX18 === 'UNAVAILABLE' || facts.markPriceX18 === facts.entryFillPriceX18) failures.push('EX_MARK_FILL_NOT_DISTINGUISHED');
  if (input.feeAnswer !== 'FEES_AND_EXECUTION_CHANGE_RESULT' || facts.entryFeeWei === 'UNAVAILABLE' || facts.exitFeeWei === 'UNAVAILABLE' || facts.entryFeeWei === '0' || facts.exitFeeWei === '0') failures.push('EX_FEES_NOT_DISTINGUISHED');
  if (!facts.exitAccepted) failures.push('EX_EXIT_NOT_RECORDED');
}

function evaluateLiquidity(input: LiquidityLearnerInput, facts: Extract<MissionFacts, { kind: 'LQ-01' }>, failures: string[]): void {
  if (!facts.deep.accepted || input.deepDecision !== 'SEND') failures.push('LQ_DEEP_DECISION_INVALID');
  const thinSafe = input.thinDecision === 'DECLINE' || (input.thinDecision === 'RESIZE' && isSafeResize(input, facts));
  if (facts.thin.accepted || !thinSafe) failures.push('LQ_THIN_DECISION_UNSAFE');
  if (input.modelAnswer !== 'SPOT_FILL_V0_MODEL') failures.push('LQ_MODEL_LABEL_MISSING');
}

function isSafeResize(input: LiquidityLearnerInput, facts: Extract<MissionFacts, { kind: 'LQ-01' }>): boolean {
  if (!input.resizedQuoteWei) return false;
  try {
    const resized = BigInt(input.resizedQuoteWei);
    const requested = BigInt(facts.thin.requestedQuoteWei);
    if (resized <= 0n || resized >= requested) return false;
    // Reaching a valid fill is the production-valid constraint. The fixture's
    // thin depth intentionally makes the original request exceed 50% depth.
    return resized * 10_000n <= BigInt(facts.thin.liquidityWei) * 5_000n;
  } catch {
    return false;
  }
}

function evaluateStop(input: StopLearnerInput, facts: Extract<MissionFacts, { kind: 'ST-01' }>, failures: string[]): void {
  if (!facts.entryAccepted) failures.push('ST_ENTRY_NOT_RECORDED');
  if (!facts.stopPlacementAccepted) failures.push('ST_STOP_NOT_PLACED');
  if (input.acknowledgement !== 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL') failures.push('ST_TRIGGER_FILL_CONFUSED');
  if (input.allowedWidening !== 'NEVER_WIDEN' || facts.stopWidened) failures.push('ST_STOP_WIDENED');
  if (input.allowedExit !== 'ALLOW_PLANNED_EXIT' || !facts.stopTriggered || !facts.exitCompleted) failures.push('ST_PLANNED_EXIT_NOT_COMPLETED');
}

function executionFactsWithEvidence(base: ExecutionFactsV0, evidence: ExecutionMissionEvidenceV0): ExecutionFactsV0 {
  const value = (candidate: string | undefined): string => candidate ?? 'UNAVAILABLE';
  return {
    ...base,
    modelVersion: evidence.modelVersion as ExecutionFactsV0['modelVersion'],
    entryAccepted: evidence.entryAccepted,
    exitAccepted: evidence.exitAccepted,
    referencePriceX18: value(evidence.entryReferencePriceX18),
    markPriceX18: value(evidence.markPriceX18),
    entryFillPriceX18: value(evidence.entryFillPriceX18),
    exitFillPriceX18: value(evidence.exitFillPriceX18),
    entryImpactBps: value(evidence.entryImpactBps),
    exitImpactBps: value(evidence.exitImpactBps),
    entryFeeWei: value(evidence.entryFeeWei),
    exitFeeWei: value(evidence.exitFeeWei),
    unrealizedPnlBeforeCloseWei: value(evidence.unrealizedPnlBeforeCloseWei),
    realizedPnlWei: value(evidence.realizedPnlWei),
  };
}

function stopFactsWithEvidence(base: StopFactsV0, evidence: StopMissionEvidenceV0): StopFactsV0 {
  const value = (candidate: string | undefined): string => candidate ?? 'UNAVAILABLE';
  return {
    ...base,
    modelVersion: evidence.modelVersion as StopFactsV0['modelVersion'],
    entryAccepted: evidence.entryAccepted,
    stopPlacementAccepted: evidence.stopPlacementAccepted,
    stopTriggered: evidence.stopTriggered,
    stopWidened: evidence.stopWidened,
    exitCompleted: evidence.exitCompleted,
    planPriceX18: value(evidence.planPriceX18),
    triggerPriceX18: value(evidence.triggerPriceX18),
    actualFillPriceX18: value(evidence.actualFillPriceX18),
    impactBps: value(evidence.impactBps),
    feesWei: value(evidence.feesWei),
    realizedPnlWei: value(evidence.realizedPnlWei),
  };
}

function evaluateRisk(input: RiskLearnerInput, facts: Extract<MissionFacts, { kind: 'RS-01' }>, failures: string[]): void {
  if (!facts.narrowStop.accepted || facts.narrowStop.modelVersion !== 'RISK_PLAN_V0' || facts.narrowStop.fillModelVersion !== 'SPOT_FILL_V0') failures.push('RS_CANONICAL_PLAN_INVALID');
  if (input.modelAnswer !== 'RISK_PLAN_V0') failures.push('RS_PRODUCTION_MODEL_NOT_ACKNOWLEDGED');
  try {
    const selected = BigInt(input.selectedPositionSizeAtoms);
    const allowed = BigInt(facts.narrowStop.positionSizeAtoms);
    if (selected <= 0n || selected > allowed) failures.push('RS_SIZE_EXCEEDS_RISK_BUDGET');
  } catch {
    failures.push('RS_SIZE_INVALID');
  }
  if (input.widthAnswer !== 'WIDER_STOP_SMALLER_SIZE' || BigInt(facts.widerStop.positionSizeAtoms) >= BigInt(facts.narrowStop.positionSizeAtoms)) failures.push('RS_STOP_WIDTH_RELATIONSHIP_WRONG');
}

function receiptMaterial(receipt: Omit<MissionReceiptV0, 'receiptId'>): unknown {
  return receipt;
}

export function missionReceiptId(receipt: Omit<MissionReceiptV0, 'receiptId'>): string {
  return `SHA-256:${sha256Hex(canonicalEpisodeJson(receiptMaterial(receipt)))}`;
}

export function evaluateMissionAttempt(attempt: MissionAttemptV0): EvaluationResult {
  const definition = getMissionDefinition(attempt.missionId);
  assertSimTime(attempt.completedAtSimMs);
  if (attempt.missionVersion !== definition.version) throw new RangeError(`mission ${attempt.missionId} requires version ${definition.version}`);
  if (attempt.learnerInput.kind !== attempt.missionId) throw new RangeError('learner input does not match the mission');
  if (attempt.episode !== undefined) throw new RangeError('V0 mission scenarios are synthetic; an episode identity is not valid for this mission');

  const scenarioFacts = createMissionFacts(attempt.missionId);
  const simulatorEvidence = attempt.missionId === 'EX-01' || attempt.missionId === 'ST-01'
    ? deriveMissionSimulatorEvidence(attempt.missionId, attempt.simulatorState)
    : undefined;
  const facts = deepFreeze(
    attempt.missionId === 'EX-01'
      ? executionFactsWithEvidence(scenarioFacts as ExecutionFactsV0, simulatorEvidence as ExecutionMissionEvidenceV0)
      : attempt.missionId === 'ST-01'
        ? stopFactsWithEvidence(scenarioFacts as StopFactsV0, simulatorEvidence as StopMissionEvidenceV0)
        : scenarioFacts,
  );
  const failures: string[] = [];
  if (attempt.missionId === 'MD-01') evaluateMarketTruth(attempt.learnerInput as MarketTruthLearnerInput, facts as Extract<MissionFacts, { kind: 'MD-01' }>, failures);
  if (attempt.missionId === 'EX-01') evaluateExecution(attempt.learnerInput as Extract<MissionLearnerInput, { kind: 'EX-01' }>, facts as ExecutionFactsV0, failures);
  if (attempt.missionId === 'LQ-01') evaluateLiquidity(attempt.learnerInput as LiquidityLearnerInput, facts as Extract<MissionFacts, { kind: 'LQ-01' }>, failures);
  if (attempt.missionId === 'ST-01') evaluateStop(attempt.learnerInput as StopLearnerInput, facts as Extract<MissionFacts, { kind: 'ST-01' }>, failures);
  if (attempt.missionId === 'RS-01') evaluateRisk(attempt.learnerInput as RiskLearnerInput, facts as Extract<MissionFacts, { kind: 'RS-01' }>, failures);

  const verdict: MissionVerdict = failures.length === 0 ? 'PASS' : 'FAIL';
  const withoutId: Omit<MissionReceiptV0, 'receiptId'> = {
    receiptVersion: MISSION_RECEIPT_VERSION,
    missionId: attempt.missionId,
    missionVersion: definition.version,
    scenario: definition.scenario,
    scenarioDigest: scenarioDigest(scenarioFacts),
    learnerInput: attempt.learnerInput,
    relevantFacts: facts,
    verdict,
    reasonCodes: verdict === 'PASS' ? ['PASS_ALL_CRITERIA'] : failures,
    completedAtSimMs: attempt.completedAtSimMs,
    evaluatorVersion: LEARNING_EVALUATOR_VERSION,
    ...(simulatorEvidence ? { simulatorEvidence } : {}),
  };
  const receipt: MissionReceiptV0 = deepFreeze({ ...withoutId, receiptId: missionReceiptId(withoutId) });
  return { receipt, facts };
}

export function verifyMissionReceipt(receipt: MissionReceiptV0): boolean {
  if (receipt.receiptVersion !== MISSION_RECEIPT_VERSION || receipt.evaluatorVersion !== LEARNING_EVALUATOR_VERSION) return false;
  const { receiptId: _receiptId, ...withoutId } = receipt;
  return receipt.receiptId === missionReceiptId(withoutId);
}

export function missionUsesPnlForPass(_id: MissionId): false {
  return false;
}
