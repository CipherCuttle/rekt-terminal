import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_DEFINITIONS,
  MISSION_IDS,
  createInitialLearningState,
  createMissionFacts,
  debriefForReceipt,
  evaluateMissionAttempt,
  missionUsesPnlForPass,
  missionReceiptId,
  nextMissionId,
  parseLearningState,
  reduceLearningState,
} from '../dist/index.js';
import { EPISODE_LOAD_POLICY_V0, ETHUSDT_PERP_EPISODE_20260828_0530, loadEpisode } from '../../episodes/dist/index.js';

const AT = 1_800_000_000_000;

function input(id, overrides = {}) {
  const defaults = {
    'MD-01': { kind: 'MD-01', classifications: { 'aggregator-mark': 'DERIVED', 'simulator-fill': 'DERIVED', 'demo-observation': 'SYNTHETIC', 'aged-observation': 'STALE' }, freshnessAnswer: 'STALE' },
    'EX-01': { kind: 'EX-01', entered: true, markAnswer: 'MARK_IS_OBSERVATION', feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT', closed: true },
    'LQ-01': { kind: 'LQ-01', deepDecision: 'SEND', thinDecision: 'DECLINE', modelAnswer: 'SPOT_FILL_V0_MODEL' },
    'ST-01': { kind: 'ST-01', entered: true, stopPlaced: true, acknowledgement: 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL', allowedWidening: 'NEVER_WIDEN', allowedExit: 'ALLOW_PLANNED_EXIT' },
    'RS-01': { kind: 'RS-01', selectedPositionSizeAtoms: createMissionFacts('RS-01').narrowStop.positionSizeAtoms, widthAnswer: 'WIDER_STOP_SMALLER_SIZE', modelAnswer: 'RISK_PLAN_V0' },
  };
  return { ...defaults[id], ...overrides };
}

function evaluate(id, overrides = {}, completedAtSimMs = AT) {
  return evaluateMissionAttempt({ missionId: id, missionVersion: 1, learnerInput: input(id, overrides), completedAtSimMs });
}

test('the vertical slice has exactly five immutable, versioned mission definitions', () => {
  assert.deepEqual(MISSION_IDS, ['MD-01', 'EX-01', 'LQ-01', 'ST-01', 'RS-01']);
  assert.equal(Object.keys(MISSION_DEFINITIONS).length, 5);
  for (const id of MISSION_IDS) {
    assert.equal(MISSION_DEFINITIONS[id].version, 1);
    assert.equal(Object.isFrozen(MISSION_DEFINITIONS[id]), true);
    assert.equal(Object.isFrozen(MISSION_DEFINITIONS[id].scenario), true);
  }
  assert.equal(missionUsesPnlForPass('EX-01'), false);
});

test('MD-01 grades canonical labels and stale evidence fail-closed', () => {
  assert.equal(evaluate('MD-01').receipt.verdict, 'PASS');
  assert.match(evaluate('MD-01', { classifications: { 'aggregator-mark': 'CONFIRMED', 'simulator-fill': 'DERIVED', 'demo-observation': 'SYNTHETIC', 'aged-observation': 'STALE' } }).receipt.reasonCodes.join(','), /MD_CLASSIFICATION_MISMATCH:aggregator-mark/);
  assert.equal(evaluate('MD-01', { freshnessAnswer: 'FRESH' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('MD-01', { classifications: { 'aggregator-mark': 'DERIVED', 'simulator-fill': 'DERIVED', 'demo-observation': 'CONFIRMED', 'aged-observation': 'STALE' } }).receipt.verdict, 'FAIL');
});

test('EX-01 uses production SPOT_FILL_V0 facts and ignores PnL sign for knowledge', () => {
  const result = evaluate('EX-01');
  assert.equal(result.receipt.verdict, 'PASS');
  assert.equal(result.facts.modelVersion, 'SPOT_FILL_V0');
  assert.notEqual(result.facts.markPriceX18, result.facts.entryFillPriceX18);
  assert.notEqual(result.facts.unrealizedPnlBeforeCloseWei, result.facts.realizedPnlWei);
  assert.notEqual(result.facts.entryFeeWei, '0');
  assert.notEqual(result.facts.exitFeeWei, '0');
  assert.equal(evaluate('EX-01', { markAnswer: 'MARK_IS_FILL' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('EX-01', { feeAnswer: 'FEES_DO_NOT_MATTER' }).receipt.verdict, 'FAIL');
  assert.deepEqual(evaluate('EX-01').receipt.reasonCodes, evaluate('EX-01').receipt.reasonCodes);
});

test('LQ-01 rewards a valid refusal or resize, never raw action count', () => {
  assert.equal(evaluate('LQ-01').receipt.verdict, 'PASS');
  assert.equal(evaluate('LQ-01', { thinDecision: 'SEND' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('LQ-01', { thinDecision: 'RESIZE', resizedQuoteWei: '250000000000000000' }).receipt.verdict, 'PASS');
  assert.equal(evaluate('LQ-01', { thinDecision: 'RESIZE', resizedQuoteWei: '250000000000000000', deepDecision: 'DECLINE' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('LQ-01', { thinDecision: 'SEND', extraActions: 999 }).receipt.verdict, 'FAIL');
});

test('ST-01 passes disciplined stop process even though the fixed drill loses', () => {
  const result = evaluate('ST-01');
  assert.equal(result.receipt.verdict, 'PASS');
  assert.equal(result.facts.stopWidened, false);
  assert.equal(BigInt(result.facts.realizedPnlWei) < 0n, true);
  assert.equal(evaluate('ST-01', { allowedWidening: 'WIDEN_IF_LOSING' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('ST-01', { acknowledgement: 'STOP_GUARANTEES_FILL' }).receipt.verdict, 'FAIL');
  assert.notEqual(result.facts.triggerPriceX18, result.facts.actualFillPriceX18);
});

test('RS-01 uses the production risk calculator and sizes down for a wider stop', () => {
  const facts = createMissionFacts('RS-01');
  assert.equal(facts.narrowStop.modelVersion, 'RISK_PLAN_V0');
  assert.equal(BigInt(facts.widerStop.positionSizeAtoms) < BigInt(facts.narrowStop.positionSizeAtoms), true);
  assert.equal(evaluate('RS-01').receipt.verdict, 'PASS');
  assert.equal(evaluate('RS-01', { selectedPositionSizeAtoms: (BigInt(facts.narrowStop.positionSizeAtoms) + 1n).toString() }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('RS-01', { widthAnswer: 'WIDER_STOP_SAME_SIZE' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('RS-01', { modelAnswer: 'SIMPLE_UNCHECKED_FORMULA' }).receipt.verdict, 'FAIL');
});

test('same inputs produce the same receipt and a mission version/time change changes identity', () => {
  const first = evaluate('MD-01').receipt;
  const second = evaluate('MD-01').receipt;
  assert.deepEqual(first, second);
  assert.notEqual(first.receiptId, evaluate('MD-01', {}, AT + 1).receipt.receiptId);
});

test('receipt identity includes mission version and episode cursors withhold future samples', () => {
  const { receipt: first } = evaluate('MD-01');
  const { receiptId: _id, ...versionTwo } = first;
  const versionChanged = { ...versionTwo, missionVersion: 2 };
  // The identity function is intentionally independent of the evaluator's
  // current definition table so historical versioned receipts remain addressable.
  assert.notEqual(first.receiptId, missionReceiptId(versionChanged));

  const loaded = loadEpisode(ETHUSDT_PERP_EPISODE_20260828_0530, EPISODE_LOAD_POLICY_V0);
  const cursor = loaded.start('REPLAY');
  assert.equal(cursor.availableSamples.length, 1);
  assert.equal(cursor.availableSamples.some((sample) => sample.sampleId === 'close'), false);
  const advanced = cursor.advance();
  assert.equal(advanced.availableSamples.length, 2);
  assert.equal(advanced.availableSamples.some((sample) => sample.sampleId === 'close'), false);
});

test('failed attempts do not complete, corrected retries do, and old receipts remain interpretable', () => {
  let state = createInitialLearningState();
  const failed = evaluate('MD-01', { freshnessAnswer: 'FRESH' }).receipt;
  state = reduceLearningState(state, { type: 'MISSION_ATTEMPT_RECORDED', receipt: failed });
  assert.deepEqual(state.completed, []);
  const passed = evaluate('MD-01').receipt;
  state = reduceLearningState(state, { type: 'MISSION_ATTEMPT_RECORDED', receipt: passed });
  assert.equal(nextMissionId(state), 'EX-01');
  const exFailed = evaluate('EX-01', { closed: false }).receipt;
  state = reduceLearningState(state, { type: 'MISSION_ATTEMPT_RECORDED', receipt: exFailed });
  assert.equal(state.completed.length, 1);
  assert.equal(state.attempts[0].receiptId, failed.receiptId);
  assert.equal(state.attempts[2].receiptId, exFailed.receiptId);
  assert.equal(parseLearningState(JSON.parse(JSON.stringify(state))).attempts.length, 3);
});

test('future or malformed learning saves fail closed without accepting a synthetic replay label', () => {
  assert.throws(() => parseLearningState({ stateVersion: 'LEARNING_STATE_V9', completed: [], attempts: [], currentMissionId: 'MD-01' }));
  const receipt = evaluate('MD-01').receipt;
  const bad = JSON.parse(JSON.stringify({ ...createInitialLearningState(), attempts: [receipt], currentMissionId: 'MD-01' }));
  bad.attempts[0].scenario = { kind: 'EPISODE', scenarioId: 'fake', label: 'RECORDED EPISODE', provenance: 'EPISODE', episode: { episodeId: 'x', episodeVersion: 'V0', episodeDigest: 'SHA-256:' + '0'.repeat(64) } };
  assert.throws(() => parseLearningState(bad));
});

test('debrief is deterministic and separates scenario, learner process, and verdict', () => {
  const sections = debriefForReceipt(evaluate('EX-01').receipt);
  assert.deepEqual(sections.map((section) => section.title), ['WHAT THE SCENARIO DID', 'WHAT YOU DID', 'WHY THIS MISSION PASSED']);
  assert.equal(sections[0].facts.some((fact) => fact.label === 'MARK'), true);
});

test('independent fact bundles do not share mutable mission state', () => {
  const one = createMissionFacts('MD-01');
  const two = createMissionFacts('MD-01');
  assert.notEqual(one, two);
  assert.equal(Object.isFrozen(one), true);
  assert.equal(Object.isFrozen(two), true);
  assert.equal(one.items[0].expected, two.items[0].expected);
});
