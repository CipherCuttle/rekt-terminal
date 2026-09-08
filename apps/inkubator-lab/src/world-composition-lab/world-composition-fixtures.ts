import type {WorldCompositionScenario, WorldEvent} from './world-composition-types';

const event = (
  id: string,
  kind: WorldEvent['kind'],
  projectId: string,
  projectName: string,
  truthState: WorldEvent['truthState'],
  occurredAt: string,
  recency: string,
  detail: string,
): WorldEvent => ({id, kind, projectId, projectName, truthState, occurredAt, recency, detail});

const normalEvents: WorldEvent[] = [
  event('normal-07', 'EXTERNAL_TEST_RECORDED', 'kernel-garden', 'KERNEL GARDEN', 'OBSERVED', '2026-09-09T13:56:00Z', '04 MIN AGO', 'External test result recorded for the public project projection.'),
  event('normal-06', 'ASSIST_ACCEPTED', 'mudlark', 'MUDLARK', 'OBSERVED', '2026-09-09T13:49:00Z', '11 MIN AGO', 'An accepted assist is now visible in the public activity projection.'),
  event('normal-05', 'HELP_BEACON_OPENED', 'paper-sun', 'PAPER SUN', 'CLAIMED', '2026-09-09T13:42:00Z', '18 MIN AGO', 'A project has publicly claimed that help is needed.'),
  event('normal-04', 'EXTERNAL_TEST_RECORDED', 'tiny-batch', 'TINY BATCH', 'OBSERVED', '2026-09-09T13:31:00Z', '29 MIN AGO', 'External test result recorded for the public project projection.'),
  event('normal-03', 'ASSIST_ACCEPTED', 'kernel-garden', 'KERNEL GARDEN', 'OBSERVED', '2026-09-09T13:18:00Z', '42 MIN AGO', 'An accepted assist is now visible in the public activity projection.'),
  event('normal-02', 'HELP_BEACON_OPENED', 'mudlark', 'MUDLARK', 'CLAIMED', '2026-09-09T12:58:00Z', '01 HR AGO', 'A project has publicly claimed that help is needed.'),
  event('normal-01', 'EXTERNAL_TEST_RECORDED', 'paper-sun', 'PAPER SUN', 'OBSERVED', '2026-09-09T12:41:00Z', '01 HR AGO', 'External test result recorded for the public project projection.'),
];

const quietEvents: WorldEvent[] = [
  event('quiet-02', 'EXTERNAL_TEST_RECORDED', 'kernel-garden', 'KERNEL GARDEN', 'OBSERVED', '2026-09-09T09:16:00Z', '04 HR AGO', 'External test result recorded for the public project projection.'),
  event('quiet-01', 'ASSIST_ACCEPTED', 'paper-sun', 'PAPER SUN', 'OBSERVED', '2026-09-09T07:42:00Z', '06 HR AGO', 'An accepted assist is now visible in the public activity projection.'),
];

const helpNowEvents: WorldEvent[] = [
  event('help-now-07', 'HELP_BEACON_OPENED', 'mudlark', 'MUDLARK', 'CLAIMED', '2026-09-09T14:00:00Z', 'JUST NOW', 'A project has publicly claimed that help is needed.'),
  event('help-now-06', 'EXTERNAL_TEST_RECORDED', 'kernel-garden', 'KERNEL GARDEN', 'OBSERVED', '2026-09-09T13:54:00Z', '06 MIN AGO', 'External test result recorded for the public project projection.'),
  event('help-now-05', 'ASSIST_ACCEPTED', 'paper-sun', 'PAPER SUN', 'OBSERVED', '2026-09-09T13:45:00Z', '15 MIN AGO', 'An accepted assist is now visible in the public activity projection.'),
  event('help-now-04', 'EXTERNAL_TEST_RECORDED', 'tiny-batch', 'TINY BATCH', 'OBSERVED', '2026-09-09T13:36:00Z', '24 MIN AGO', 'External test result recorded for the public project projection.'),
  event('help-now-03', 'ASSIST_ACCEPTED', 'kernel-garden', 'KERNEL GARDEN', 'OBSERVED', '2026-09-09T13:25:00Z', '35 MIN AGO', 'An accepted assist is now visible in the public activity projection.'),
  event('help-now-02', 'HELP_BEACON_OPENED', 'paper-sun', 'PAPER SUN', 'CLAIMED', '2026-09-09T13:07:00Z', '53 MIN AGO', 'A project has publicly claimed that help is needed.'),
  event('help-now-01', 'EXTERNAL_TEST_RECORDED', 'mudlark', 'MUDLARK', 'OBSERVED', '2026-09-09T12:56:00Z', '01 HR AGO', 'External test result recorded for the public project projection.'),
];

const burstKinds: Array<WorldEvent['kind']> = [
  'EXTERNAL_TEST_RECORDED',
  'ASSIST_ACCEPTED',
  'HELP_BEACON_OPENED',
  'EXTERNAL_TEST_RECORDED',
  'ASSIST_ACCEPTED',
  'EXTERNAL_TEST_RECORDED',
  'HELP_BEACON_OPENED',
  'ASSIST_ACCEPTED',
  'EXTERNAL_TEST_RECORDED',
  'EXTERNAL_TEST_RECORDED',
  'ASSIST_ACCEPTED',
  'HELP_BEACON_OPENED',
  'EXTERNAL_TEST_RECORDED',
  'ASSIST_ACCEPTED',
  'EXTERNAL_TEST_RECORDED',
  'HELP_BEACON_OPENED',
];

const burstProjects = ['kernel-garden', 'mudlark', 'paper-sun', 'tiny-batch'];
const burstNames = ['KERNEL GARDEN', 'MUDLARK', 'PAPER SUN', 'TINY BATCH'];
const burstEvents: WorldEvent[] = burstKinds.map((kind, index) => {
  const projectIndex = index % burstProjects.length;
  const minutesAgo = index + 2;
  const isClaimed = kind === 'HELP_BEACON_OPENED';
  return event(
    `burst-${String(16 - index).padStart(2, '0')}`,
    kind,
    burstProjects[projectIndex],
    burstNames[projectIndex],
    isClaimed ? 'CLAIMED' : 'OBSERVED',
    `2026-09-09T13:${String(58 - index).padStart(2, '0')}:00Z`,
    `${minutesAgo} MIN AGO`,
    isClaimed
      ? 'A project has publicly claimed that help is needed.'
      : kind === 'ASSIST_ACCEPTED'
        ? 'An accepted assist is now visible in the public activity projection.'
        : 'External test result recorded for the public project projection.',
  );
});

const allObservedEvents = normalEvents.filter((current) => current.kind !== 'HELP_BEACON_OPENED').map((current) => ({
  ...current,
  truthState: 'OBSERVED' as const,
}));

export const worldCompositionFixtures: Record<WorldCompositionScenario, WorldEvent[]> = {
  normal: normalEvents,
  quiet: quietEvents,
  'help-now': helpNowEvents,
  burst: burstEvents,
  'all-observed': allObservedEvents,
};

export const worldScenarioLabels: Record<WorldCompositionScenario, string> = {
  normal: 'S1 / NORMAL',
  quiet: 'S2 / QUIET',
  'help-now': 'S3 / HELP NOW',
  burst: 'S4 / BURST',
  'all-observed': 'S5 / ALL OBSERVED',
};

export const worldVariantLabels = {
  tape: 'A / SIGNAL TAPE',
  dispatch: 'B / NOW + SIGNAL TAPE',
  receiver: 'C / RECEIVER + SIGNAL TAPE',
} as const;
