import { describe, expect, it } from 'vitest';
import { MISSION_DEFINITIONS, createInitialLearningState, type MissionLearnerInput } from '@rekt-ink/learning';
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
