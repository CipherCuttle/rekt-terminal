export type WorldCompositionVariant = 'tape' | 'dispatch' | 'receiver';

export type WorldCompositionScenario = 'normal' | 'quiet' | 'help-now' | 'burst' | 'all-observed';

export type WorldTruthState = 'CLAIMED' | 'OBSERVED';

export type WorldEventKind =
  | 'HELP_BEACON_OPENED'
  | 'ASSIST_ACCEPTED'
  | 'EXTERNAL_TEST_RECORDED';

export type WorldEvent = {
  id: string;
  kind: WorldEventKind;
  projectId: string;
  projectName: string;
  truthState: WorldTruthState;
  occurredAt: string;
  recency: string;
  detail: string;
};
