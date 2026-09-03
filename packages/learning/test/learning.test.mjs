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
import { DEFAULT_SPOT_FILL_CONFIG, createInitialSimState, createSessionOpenedEvent, executeSpotAction, makeFixtureObservation, markSpot, placeSpotStop, priceX18, replayEvents, wei } from '../../sim/dist/index.js';

const AT = 1_800_000_000_000;

function input(id, overrides = {}) {
  const defaults = {
    'MD-01': { kind: 'MD-01', classifications: { 'aggregator-mark': 'DERIVED', 'simulator-fill': 'DERIVED', 'demo-observation': 'SYNTHETIC', 'aged-observation': 'STALE' }, freshnessAnswer: 'STALE' },
    'EX-01': { kind: 'EX-01', markAnswer: 'MARK_IS_OBSERVATION', feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT' },
    'LQ-01': { kind: 'LQ-01', deepDecision: 'SEND', thinDecision: 'DECLINE', modelAnswer: 'SPOT_FILL_V0_MODEL' },
    'ST-01': { kind: 'ST-01', acknowledgement: 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL', allowedWidening: 'NEVER_WIDEN', allowedExit: 'ALLOW_PLANNED_EXIT' },
    'RS-01': { kind: 'RS-01', selectedPositionSizeAtoms: createMissionFacts('RS-01').narrowStop.positionSizeAtoms, widthAnswer: 'WIDER_STOP_SMALLER_SIZE', modelAnswer: 'RISK_PLAN_V0' },
  };
  return { ...defaults[id], ...overrides };
}

function open(id) {
  const initial = createInitialSimState({ sessionId: `test-${id}`, startedAtMs: AT, evidencePolicy: 'DEMO_ALLOW_SYNTHETIC' });
  return replayEvents([createSessionOpenedEvent(initial, AT)], initial);
}

function observation(id, time, price = 25_000_000_000_000_000n, liquidity = 10_000_000_000_000_000_000n) {
  return makeFixtureObservation({ observationId: `${id}-${time}`, referencePriceX18: priceX18(price), usableQuoteLiquidityWei: wei(liquidity), observedAtMs: time, sourceId: 'REKT_LEARNING_TEST_FIXTURE_V0', provenance: 'SYNTHETIC' });
}

function executionState({ exitFirst = false, close = true } = {}) {
  let state = open('EX-01');
  if (exitFirst) state = executeSpotAction(state, { type: 'FULL_CLOSE', intentId: 'ex-exit-first', fillId: 'ex-exit-first-fill', eventTimeMs: AT, observation: observation('ex-exit-first', AT, 24_000_000_000_000_000n), config: DEFAULT_SPOT_FILL_CONFIG }).state;
  state = executeSpotAction(state, { type: 'BUY', intentId: 'ex-entry', fillId: 'ex-entry-fill', eventTimeMs: AT, observation: observation('ex-entry', AT), quoteNotionalWei: wei(50_000_000_000_000_000n), config: DEFAULT_SPOT_FILL_CONFIG }).state;
  state = markSpot(state, observation('ex-mark', AT + 1_000, 26_000_000_000_000_000n), AT + 1_000, DEFAULT_SPOT_FILL_CONFIG).state;
  if (close) state = executeSpotAction(state, { type: 'FULL_CLOSE', intentId: 'ex-exit', fillId: 'ex-exit-fill', eventTimeMs: AT + 2_000, observation: observation('ex-exit', AT + 2_000, 24_000_000_000_000_000n, 5_000_000_000_000_000_000n), config: DEFAULT_SPOT_FILL_CONFIG }).state;
  return state;
}

function stopState({ stopFirst = false, trigger = true, placeAfterEntry = true } = {}) {
  let state = open('ST-01');
  if (stopFirst) state = placeSpotStop(state, { stopId: 'st-stop-first', stopPriceX18: priceX18(24_500_000_000_000_000n), observation: observation('st-stop-first', AT), eventTimeMs: AT }, DEFAULT_SPOT_FILL_CONFIG).state;
  state = executeSpotAction(state, { type: 'BUY', intentId: 'st-entry', fillId: 'st-entry-fill', eventTimeMs: AT, observation: observation('st-entry', AT), quoteNotionalWei: wei(50_000_000_000_000_000n), config: DEFAULT_SPOT_FILL_CONFIG }).state;
  if (placeAfterEntry) state = placeSpotStop(state, { stopId: 'st-stop', stopPriceX18: priceX18(24_500_000_000_000_000n), observation: observation('st-stop', AT + 1_000), eventTimeMs: AT + 1_000 }, DEFAULT_SPOT_FILL_CONFIG).state;
  if (trigger) state = markSpot(state, observation('st-trigger', AT + 2_000, 24_000_000_000_000_000n, 2_000_000_000_000_000_000n), AT + 2_000, DEFAULT_SPOT_FILL_CONFIG).state;
  return state;
}

function evaluate(id, overrides = {}, simulatorState = undefined, completedAtSimMs = AT) {
  return evaluateMissionAttempt({ missionId: id, missionVersion: 1, learnerInput: input(id, overrides), completedAtSimMs, simulatorState });
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
  const result = evaluate('EX-01', {}, executionState());
  assert.equal(result.receipt.verdict, 'PASS');
  assert.equal(result.facts.modelVersion, 'SPOT_FILL_V0');
  assert.notEqual(result.facts.markPriceX18, result.facts.entryFillPriceX18);
  assert.notEqual(result.facts.unrealizedPnlBeforeCloseWei, result.facts.realizedPnlWei);
  assert.notEqual(result.facts.entryFeeWei, '0');
  assert.notEqual(result.facts.exitFeeWei, '0');
  assert.equal(evaluate('EX-01').receipt.verdict, 'FAIL');
  assert.equal(evaluate('EX-01').facts.modelVersion, 'SPOT_FILL_V0');
  assert.equal(evaluate('EX-01', { markAnswer: 'MARK_IS_FILL' }, executionState()).receipt.verdict, 'FAIL');
  assert.equal(evaluate('EX-01', { feeAnswer: 'FEES_DO_NOT_MATTER' }, executionState()).receipt.verdict, 'FAIL');
  assert.deepEqual(evaluate('EX-01', {}, executionState()).receipt.reasonCodes, evaluate('EX-01', {}, executionState()).receipt.reasonCodes);
});

test('EX-01 cannot launder an EXIT-before-ENTRY or duplicate action into accepted exit evidence', () => {
  const invalidOrder = evaluate('EX-01', {}, executionState({ exitFirst: true, close: false }));
  assert.equal(invalidOrder.receipt.verdict, 'FAIL');
  assert.equal(invalidOrder.receipt.simulatorEvidence.exitAccepted, false);
  assert.equal(invalidOrder.receipt.simulatorEvidence.rejectedActionReasons.some((reason) => reason.includes('NO_OPEN_POSITION')), true);
  const noClose = evaluate('EX-01', {}, executionState({ close: false }));
  assert.equal(noClose.receipt.verdict, 'FAIL');
  assert.equal(noClose.receipt.relevantFacts.exitAccepted, false);
});

test('LQ-01 rewards a valid refusal or resize, never raw action count', () => {
  assert.equal(evaluate('LQ-01').receipt.verdict, 'PASS');
  assert.equal(evaluate('LQ-01', { thinDecision: 'SEND' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('LQ-01', { thinDecision: 'RESIZE', resizedQuoteWei: '250000000000000000' }).receipt.verdict, 'PASS');
  assert.equal(evaluate('LQ-01', { thinDecision: 'RESIZE', resizedQuoteWei: '250000000000000000', deepDecision: 'DECLINE' }).receipt.verdict, 'FAIL');
  assert.equal(evaluate('LQ-01', { thinDecision: 'SEND', extraActions: 999 }).receipt.verdict, 'FAIL');
});

test('ST-01 passes disciplined stop process even though the fixed drill loses', () => {
  const result = evaluate('ST-01', {}, stopState());
  assert.equal(result.receipt.verdict, 'PASS');
  assert.equal(result.facts.stopWidened, false);
  assert.equal(BigInt(result.facts.realizedPnlWei) < 0n, true);
  assert.equal(evaluate('ST-01', { allowedWidening: 'WIDEN_IF_LOSING' }, stopState()).receipt.verdict, 'FAIL');
  assert.equal(evaluate('ST-01', { acknowledgement: 'STOP_GUARANTEES_FILL' }, stopState()).receipt.verdict, 'FAIL');
  assert.notEqual(result.facts.triggerPriceX18, result.facts.actualFillPriceX18);
});

test('ST-01 requires accepted entry, stop, trigger, and exit in that order', () => {
  const stopBeforeEntry = evaluate('ST-01', {}, stopState({ stopFirst: true, trigger: false, placeAfterEntry: false }));
  assert.equal(stopBeforeEntry.receipt.verdict, 'FAIL');
  assert.equal(stopBeforeEntry.receipt.simulatorEvidence.modelVersion, 'SPOT_FILL_V0');
  assert.equal(stopBeforeEntry.receipt.simulatorEvidence.stopPlacementAccepted, false);
  assert.equal(stopBeforeEntry.receipt.simulatorEvidence.rejectedActionReasons.some((reason) => reason.includes('NO_OPEN_POSITION')), true);
  const noTrigger = evaluate('ST-01', {}, stopState({ trigger: false }));
  assert.equal(noTrigger.receipt.verdict, 'FAIL');
  assert.equal(noTrigger.receipt.relevantFacts.stopTriggered, false);
  assert.equal(noTrigger.receipt.relevantFacts.exitCompleted, false);
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
  assert.notEqual(first.receiptId, evaluate('MD-01', {}, undefined, AT + 1).receipt.receiptId);
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
  assert.equal(state.currentMissionId, 'MD-01');
  assert.equal(state.pendingDebriefReceiptId, passed.receiptId);
  assert.throws(() => reduceLearningState(state, { type: 'MISSION_STARTED', missionId: 'EX-01' }));
  state = reduceLearningState(state, { type: 'MISSION_DEBRIEF_ACKNOWLEDGED', receiptId: passed.receiptId });
  assert.equal(nextMissionId(state), 'EX-01');
  assert.equal(state.currentMissionId, 'EX-01');
  const exFailed = evaluate('EX-01', {}, executionState({ close: false })).receipt;
  state = reduceLearningState(state, { type: 'MISSION_ATTEMPT_RECORDED', receipt: exFailed });
  assert.equal(state.completed.length, 1);
  assert.equal(state.attempts[0].receiptId, failed.receiptId);
  assert.equal(state.attempts[2].receiptId, exFailed.receiptId);
  assert.equal(parseLearningState(JSON.parse(JSON.stringify(state))).attempts.length, 3);
});

test('successful debrief acknowledgement advances exactly once, including the final mission', () => {
  let state = createInitialLearningState();
  for (const id of ['MD-01', 'EX-01', 'LQ-01', 'ST-01', 'RS-01']) {
    state = reduceLearningState(state, { type: 'MISSION_STARTED', missionId: id });
    const receipt = evaluate(id, {}, id === 'EX-01' ? executionState() : id === 'ST-01' ? stopState() : undefined).receipt;
    state = reduceLearningState(state, { type: 'MISSION_ATTEMPT_RECORDED', receipt });
    assert.equal(state.currentMissionId, id);
    assert.equal(state.pendingDebriefReceiptId, receipt.receiptId);
    if (id === 'RS-01') {
      const restoredFinal = parseLearningState(JSON.parse(JSON.stringify(state)));
      assert.equal(restoredFinal.currentMissionId, 'RS-01');
      assert.equal(restoredFinal.pendingDebriefReceiptId, receipt.receiptId);
    }
    state = reduceLearningState(state, { type: 'MISSION_DEBRIEF_ACKNOWLEDGED', receiptId: receipt.receiptId });
    assert.equal(state.pendingDebriefReceiptId, null);
  }
  assert.equal(state.currentMissionId, null);
  assert.equal(nextMissionId(state), null);
  assert.throws(() => reduceLearningState(state, { type: 'MISSION_DEBRIEF_ACKNOWLEDGED', receiptId: state.attempts.at(-1).receiptId }));
});

test('pending successful debrief survives parse/restore and static scenario facts cannot pass mechanically', () => {
  let state = createInitialLearningState();
  state = reduceLearningState(state, { type: 'MISSION_STARTED', missionId: 'MD-01' });
  const md = evaluate('MD-01').receipt;
  state = reduceLearningState(state, { type: 'MISSION_ATTEMPT_RECORDED', receipt: md });
  state = reduceLearningState(state, { type: 'MISSION_DEBRIEF_ACKNOWLEDGED', receiptId: md.receiptId });
  state = reduceLearningState(state, { type: 'MISSION_STARTED', missionId: 'EX-01' });
  const receipt = evaluate('EX-01', {}, executionState()).receipt;
  state = reduceLearningState(state, { type: 'MISSION_ATTEMPT_RECORDED', receipt });
  const restored = parseLearningState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.pendingDebriefReceiptId, receipt.receiptId);
  assert.equal(restored.currentMissionId, 'EX-01');
  assert.equal(evaluate('EX-01').receipt.verdict, 'FAIL');
  assert.equal(createMissionFacts('EX-01').entryAccepted, false);
});

test('mechanical receipts reject facts that do not exactly match their simulator evidence', () => {
  const receipt = evaluate('EX-01', {}, executionState()).receipt;
  const { receiptId: _receiptId, ...tamperedMaterial } = receipt;
  const tampered = {
    ...tamperedMaterial,
    relevantFacts: { ...receipt.relevantFacts, entryAccepted: false },
  };
  const tamperedReceipt = { ...tampered, receiptId: missionReceiptId(tampered) };
  assert.throws(
    () => reduceLearningState(createInitialLearningState(), { type: 'MISSION_ATTEMPT_RECORDED', receipt: tamperedReceipt }),
    /do not match simulator evidence/,
  );
});

test('future or malformed learning saves fail closed without accepting a synthetic replay label', () => {
  assert.throws(() => parseLearningState({ stateVersion: 'LEARNING_STATE_V9', completed: [], attempts: [], currentMissionId: 'MD-01' }));
  const receipt = evaluate('MD-01').receipt;
  const bad = JSON.parse(JSON.stringify({ ...createInitialLearningState(), attempts: [receipt], currentMissionId: 'MD-01' }));
  bad.attempts[0].scenario = { kind: 'EPISODE', scenarioId: 'fake', label: 'RECORDED EPISODE', provenance: 'EPISODE', episode: { episodeId: 'x', episodeVersion: 'V0', episodeDigest: 'SHA-256:' + '0'.repeat(64) } };
  assert.throws(() => parseLearningState(bad));
});

test('debrief is deterministic and separates scenario, learner process, and verdict', () => {
  const sections = debriefForReceipt(evaluate('EX-01', {}, executionState()).receipt);
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
