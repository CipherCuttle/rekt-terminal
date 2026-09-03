import { describe, expect, it } from 'vitest';
import { MISSION_DEFINITIONS, createInitialLearningState, type ExecutionFactsV0, type ExecutionMissionEvidenceV0, type MissionLearnerInput, type StopFactsV0, type StopMissionEvidenceV0 } from '@rekt-ink/learning';
import { createMemoryPracticeStorage, restorePracticeSave } from '../practice/persistence';
import { PracticeSessionStore } from '../practice/store';

const START = 1_800_000_000_000;
const mdPass: MissionLearnerInput = {
  kind: 'MD-01',
  classifications: { 'aggregator-mark': 'DERIVED', 'simulator-fill': 'DERIVED', 'demo-observation': 'SYNTHETIC', 'aged-observation': 'STALE' },
  freshnessAnswer: 'STALE',
};

describe('learning vertical slice web seam', () => {
  it('routes a mission attempt through the domain evaluator and leaves simulator/Career state unchanged', () => {
    const store = new PracticeSessionStore({ now: () => START, storage: createMemoryPracticeStorage() });
    const beforeSimEvents = store.getSnapshot().sim.events.length;
    const beforeCareer = store.getSnapshot().career;
    expect(store.startMission('MD-01')).toBe(true);
    const receipt = store.submitMission(mdPass);
    expect(receipt?.verdict).toBe('PASS');
    expect(store.getSnapshot().sim.events.length).toBe(beforeSimEvents);
    expect(store.getSnapshot().career).toEqual(beforeCareer);
    expect(store.getSnapshot().learning?.completed).toHaveLength(1);
    expect(store.getSnapshot().learning?.completed[0].missionId).toBe('MD-01');
  });

  it('cannot submit before the mission is started and a failed attempt grants no completion', () => {
    const store = new PracticeSessionStore({ now: () => START, storage: createMemoryPracticeStorage() });
    expect(store.submitMission(mdPass)).toBeNull();
    expect(store.startMission('MD-01')).toBe(true);
    const failed = store.submitMission({ ...mdPass, freshnessAnswer: 'FRESH' });
    expect(failed?.verdict).toBe('FAIL');
    expect(store.getSnapshot().learning?.completed).toEqual([]);
    expect(store.getSnapshot().learning?.attempts).toHaveLength(1);
  });

  it('mechanical grading uses accepted ephemeral simulator evidence, not caller booleans or static facts', () => {
    const store = new PracticeSessionStore({ now: () => START, storage: createMemoryPracticeStorage() });
    expect(store.startMission('MD-01')).toBe(true);
    expect(store.submitMission(mdPass)?.verdict).toBe('PASS');
    const mdReceiptId = store.getSnapshot().learning?.pendingDebriefReceiptId;
    expect(mdReceiptId).toBeTruthy();
    expect(store.acknowledgeMissionDebrief()).toBe(true);
    expect(store.startMission('EX-01')).toBe(true);

    // The rejected close remains in the learning simulator event stream.
    store.recordLearningAction('EX-01', 'EX_EXIT');
    const failed = store.submitMission({ kind: 'EX-01', markAnswer: 'MARK_IS_OBSERVATION', feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT' });
    const failedFacts = failed!.relevantFacts as ExecutionFactsV0;
    const failedEvidence = failed!.simulatorEvidence as ExecutionMissionEvidenceV0;
    expect(failed?.verdict).toBe('FAIL');
    expect(failedFacts.entryAccepted).toBe(false);
    expect(failedFacts.exitAccepted).toBe(false);
    expect(failedEvidence.rejectedActionReasons.some((reason) => reason.includes('NO_OPEN_POSITION'))).toBe(true);

    store.recordLearningAction('EX-01', 'EX_ENTRY');
    const stillFailed = store.submitMission({ kind: 'EX-01', markAnswer: 'MARK_IS_OBSERVATION', feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT' });
    const stillFailedFacts = stillFailed!.relevantFacts as ExecutionFactsV0;
    expect(stillFailed?.verdict).toBe('FAIL');
    expect(stillFailedFacts.entryAccepted).toBe(true);
    expect(stillFailedFacts.exitAccepted).toBe(false);

    store.recordLearningAction('EX-01', 'EX_EXIT');
    const passed = store.submitMission({ kind: 'EX-01', markAnswer: 'MARK_IS_OBSERVATION', feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT' });
    const passedFacts = passed!.relevantFacts as ExecutionFactsV0;
    const passedEvidence = passed!.simulatorEvidence as ExecutionMissionEvidenceV0;
    expect(passed?.verdict).toBe('PASS');
    expect(passedFacts.entryFillPriceX18).toBe(passedEvidence.entryFillPriceX18);
    expect(passedFacts.exitFeeWei).toBe(passedEvidence.exitFeeWei);
    expect(store.getSnapshot().sim.events.length).toBe(1);
    expect(store.getSnapshot().career.stats.closedSpotTrades).toBe(0);
  });

  it('keeps a successful debrief visible, persists it, and advances once on acknowledgement', async () => {
    const storage = createMemoryPracticeStorage();
    const store = new PracticeSessionStore({ now: () => START, storage });
    expect(store.startMission('MD-01')).toBe(true);
    const receipt = store.submitMission(mdPass);
    expect(receipt?.verdict).toBe('PASS');
    expect(store.getSnapshot().learning?.currentMissionId).toBe('MD-01');
    expect(store.getSnapshot().learning?.pendingDebriefReceiptId).toBe(receipt?.receiptId);
    await store.persistNow();

    const restored = restorePracticeSave(await storage.load());
    expect(restored.learning.currentMissionId).toBe('MD-01');
    expect(restored.learning.pendingDebriefReceiptId).toBe(receipt?.receiptId);
    expect(store.acknowledgeMissionDebrief()).toBe(true);
    expect(store.getSnapshot().learning?.currentMissionId).toBe('EX-01');
    expect(store.getSnapshot().learning?.pendingDebriefReceiptId).toBeNull();
    expect(store.acknowledgeMissionDebrief()).toBe(false);
  });

  it('keeps rejected ST-01 actions in the simulator history while allowing a later valid sequence', () => {
    const store = new PracticeSessionStore({ now: () => START, storage: createMemoryPracticeStorage() });
    expect(store.startMission('MD-01')).toBe(true);
    expect(store.submitMission(mdPass)?.verdict).toBe('PASS');
    expect(store.acknowledgeMissionDebrief()).toBe(true);
    expect(store.startMission('EX-01')).toBe(true);
    store.recordLearningAction('EX-01', 'EX_ENTRY');
    store.recordLearningAction('EX-01', 'EX_EXIT');
    expect(store.submitMission({ kind: 'EX-01', markAnswer: 'MARK_IS_OBSERVATION', feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT' })?.verdict).toBe('PASS');
    expect(store.acknowledgeMissionDebrief()).toBe(true);
    expect(store.startMission('LQ-01')).toBe(true);
    expect(store.submitMission({ kind: 'LQ-01', deepDecision: 'SEND', thinDecision: 'DECLINE', modelAnswer: 'SPOT_FILL_V0_MODEL' })?.verdict).toBe('PASS');
    expect(store.acknowledgeMissionDebrief()).toBe(true);
    expect(store.startMission('ST-01')).toBe(true);

    store.recordLearningAction('ST-01', 'ST_PLACE_STOP');
    const rejected = store.submitMission({ kind: 'ST-01', acknowledgement: 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL', allowedWidening: 'NEVER_WIDEN', allowedExit: 'ALLOW_PLANNED_EXIT' });
    expect(rejected?.verdict).toBe('FAIL');
    expect((rejected?.relevantFacts as StopFactsV0).stopPlacementAccepted).toBe(false);
    expect(rejected?.simulatorEvidence?.rejectedActionReasons.some((reason) => reason.includes('NO_OPEN_POSITION'))).toBe(true);

    store.recordLearningAction('ST-01', 'ST_ENTRY');
    store.recordLearningAction('ST-01', 'ST_PLACE_STOP');
    store.recordLearningAction('ST-01', 'ST_ALLOW_EXIT');
    const passed = store.submitMission({ kind: 'ST-01', acknowledgement: 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL', allowedWidening: 'NEVER_WIDEN', allowedExit: 'ALLOW_PLANNED_EXIT' });
    const facts = passed?.relevantFacts as StopFactsV0;
    const evidence = passed?.simulatorEvidence as StopMissionEvidenceV0;
    expect(passed?.verdict).toBe('PASS');
    expect(facts.entryAccepted).toBe(true);
    expect(facts.stopPlacementAccepted).toBe(true);
    expect(facts.stopTriggered).toBe(true);
    expect(facts.exitCompleted).toBe(true);
    expect(facts.actualFillPriceX18).toBe(evidence.actualFillPriceX18);
  });

  it('persists versioned learning progress independently and resets malformed learning only', async () => {
    const storage = createMemoryPracticeStorage();
    const store = new PracticeSessionStore({ now: () => START, storage });
    store.startMission('MD-01');
    store.submitMission(mdPass);
    await store.persistNow();
    const saved = await storage.load() as Record<string, unknown>;
    const restored = restorePracticeSave(saved);
    expect(restored.learning.completed[0].missionId).toBe('MD-01');

    const malformed = { ...saved, learning: { stateVersion: 'LEARNING_STATE_V99', completed: [], attempts: [], currentMissionId: 'MD-01' } };
    const reset = restorePracticeSave(malformed);
    expect(reset.learning.completed).toEqual(createInitialLearningState().completed);
    expect(reset.learningReset).toBe(true);
    expect(reset.sim.events.length).toBe(restored.sim.events.length);
  });

  it('exposes only the frozen five-mission contract to the UI seam', () => {
    expect(Object.keys(MISSION_DEFINITIONS)).toEqual(['MD-01', 'EX-01', 'LQ-01', 'ST-01', 'RS-01']);
  });
});
