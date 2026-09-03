import {
  BPS_SCALE,
  DEFAULT_SPOT_FILL_CONFIG,
  createInitialSimState,
  createSessionOpenedEvent,
  createSpotFill,
  executeSpotAction,
  markSpot,
  planRiskSizedEntry,
  placeSpotStop,
  priceX18,
  replayEvents,
  bps,
  wei,
  type MarketObservation,
  type SimState,
} from '@rekt-ink/sim';
import { canonicalEpisodeJson, sha256Hex } from '@rekt-ink/episodes';
import { getMissionDefinition } from './missions.js';
import type {
  ExecutionFactsV0,
  LiquidityCaseV0,
  LiquidityFactsV0,
  MarketTruthFactsV0,
  MissionFacts,
  RiskFactsV0,
  RiskPlanFactsV0,
  StopFactsV0,
} from './types.js';

const SYNTHETIC_START_MS = 1_800_000_000_000;
const INSTRUMENT = 'TRAINING:ETH-WETH-SPOT';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function copyFacts<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function observation(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    observationId: 'learning-training-observation',
    instrumentId: INSTRUMENT,
    quoteAsset: 'WETH',
    referencePriceX18: priceX18(25_000_000_000_000_000n),
    usableQuoteLiquidityWei: wei(10_000_000_000_000_000_000n),
    observedAtMs: SYNTHETIC_START_MS,
    sourceId: 'REKT_LEARNING_SYNTHETIC_FIXTURE_V0',
    provenance: 'SYNTHETIC',
    ...overrides,
  };
}

function opened(sessionId: string): SimState {
  const initial = createInitialSimState({ sessionId, startedAtMs: SYNTHETIC_START_MS, evidencePolicy: 'DEMO_ALLOW_SYNTHETIC' });
  return replayEvents([createSessionOpenedEvent(initial, SYNTHETIC_START_MS)], initial);
}

function assertAccepted<T extends { accepted: boolean; state: SimState }>(result: T, label: string): SimState {
  if (!result.accepted) throw new Error(`${label} training scenario failed`);
  return result.state;
}

function executionFacts(): ExecutionFactsV0 {
  let state = opened('learning-ex-01');
  const entry = observation({ observationId: 'ex-entry', observedAtMs: SYNTHETIC_START_MS });
  state = assertAccepted(executeSpotAction(state, { type: 'BUY', intentId: 'ex-entry-intent', fillId: 'ex-entry-fill', eventTimeMs: SYNTHETIC_START_MS, observation: entry, quoteNotionalWei: wei(50_000_000_000_000_000n), config: DEFAULT_SPOT_FILL_CONFIG }), 'EX entry');
  const mark = observation({ observationId: 'ex-mark', observedAtMs: SYNTHETIC_START_MS + 1_000, referencePriceX18: priceX18(26_000_000_000_000_000n) });
  const marked = markSpot(state, mark, SYNTHETIC_START_MS + 1_000, DEFAULT_SPOT_FILL_CONFIG);
  state = assertAccepted(marked, 'EX mark');
  const exit = observation({ observationId: 'ex-exit', observedAtMs: SYNTHETIC_START_MS + 2_000, referencePriceX18: priceX18(24_000_000_000_000_000n), usableQuoteLiquidityWei: wei(5_000_000_000_000_000_000n) });
  state = assertAccepted(executeSpotAction(state, { type: 'FULL_CLOSE', intentId: 'ex-exit-intent', fillId: 'ex-exit-fill', eventTimeMs: SYNTHETIC_START_MS + 2_000, observation: exit, config: DEFAULT_SPOT_FILL_CONFIG }), 'EX close');
  const fills = state.events.filter((event): event is Extract<typeof event, { type: 'FILL_APPLIED' }> => event.type === 'FILL_APPLIED').map((event) => event.fill);
  const summary = state.tradeSummaries[0];
  if (!summary || fills.length !== 2) throw new Error('EX training scenario did not produce the expected production summary');
  return {
    // These are immutable pedagogical reference facts only. Learner action
    // success is derived separately from the attempt's simulator state.
    kind: 'EX-01', scenarioId: getMissionDefinition('EX-01').scenario.scenarioId, provenance: 'SYNTHETIC', modelVersion: 'SPOT_FILL_V0', entryAccepted: false, exitAccepted: false,
    referencePriceX18: entry.referencePriceX18.toString(), markPriceX18: mark.referencePriceX18.toString(), entryFillPriceX18: fills[0].fillPriceX18.toString(), exitFillPriceX18: fills[1].fillPriceX18.toString(),
    entryImpactBps: fills[0].impactBps.toString(), exitImpactBps: fills[1].impactBps.toString(), entryFeeWei: fills[0].feeQuoteWei.toString(), exitFeeWei: fills[1].feeQuoteWei.toString(),
    unrealizedPnlBeforeCloseWei: marked.state.account.unrealizedPnlWei.toString(), realizedPnlWei: summary.realizedPnlWei.toString(),
  };
}

function liquidityCase(requestedQuoteWei: bigint, liquidityWei: bigint): LiquidityCaseV0 {
  const input = observation({ observationId: `lq-${liquidityWei}`, usableQuoteLiquidityWei: wei(liquidityWei) });
  const participation = (requestedQuoteWei * BPS_SCALE) / liquidityWei;
  try {
    const fill = createSpotFill({ fillId: `lq-fill-${liquidityWei}`, intentId: `lq-intent-${liquidityWei}`, side: 'BUY', observation: input, requestedQuoteWei: wei(requestedQuoteWei), executedAtMs: SYNTHETIC_START_MS, config: DEFAULT_SPOT_FILL_CONFIG, evidencePolicy: 'DEMO_ALLOW_SYNTHETIC' });
    return { requestedQuoteWei: requestedQuoteWei.toString(), referencePriceX18: input.referencePriceX18.toString(), liquidityWei: liquidityWei.toString(), participationBps: participation.toString(), modeledImpactBps: fill.impactBps.toString(), accepted: true, rejectionCode: null };
  } catch (error) {
    return { requestedQuoteWei: requestedQuoteWei.toString(), referencePriceX18: input.referencePriceX18.toString(), liquidityWei: liquidityWei.toString(), participationBps: participation.toString(), modeledImpactBps: null, accepted: false, rejectionCode: error instanceof Error && 'code' in error ? String((error as Error & { code?: string }).code) : 'MODEL_INPUT_UNAVAILABLE' };
  }
}

function liquidityFacts(): LiquidityFactsV0 {
  return {
    kind: 'LQ-01', scenarioId: getMissionDefinition('LQ-01').scenario.scenarioId, provenance: 'SYNTHETIC', modelVersion: 'SPOT_FILL_V0',
    deep: liquidityCase(500_000_000_000_000_000n, 10_000_000_000_000_000_000n),
    thin: liquidityCase(500_000_000_000_000_000n, 500_000_000_000_000_000n),
  };
}

function stopFacts(): StopFactsV0 {
  let state = opened('learning-st-01');
  const entry = observation({ observationId: 'st-entry' });
  state = assertAccepted(executeSpotAction(state, { type: 'BUY', intentId: 'st-entry-intent', fillId: 'st-entry-fill', eventTimeMs: SYNTHETIC_START_MS, observation: entry, quoteNotionalWei: wei(50_000_000_000_000_000n), config: DEFAULT_SPOT_FILL_CONFIG }), 'ST entry');
  const plan = priceX18(24_500_000_000_000_000n);
  const stop = placeSpotStop(state, { stopId: 'st-stop', stopPriceX18: plan, observation: observation({ observationId: 'st-plan', observedAtMs: SYNTHETIC_START_MS + 1_000 }), eventTimeMs: SYNTHETIC_START_MS + 1_000 }, DEFAULT_SPOT_FILL_CONFIG);
  state = assertAccepted(stop, 'ST stop');
  const triggered = markSpot(state, observation({ observationId: 'st-trigger', observedAtMs: SYNTHETIC_START_MS + 2_000, referencePriceX18: priceX18(24_000_000_000_000_000n), usableQuoteLiquidityWei: wei(2_000_000_000_000_000_000n) }), SYNTHETIC_START_MS + 2_000, DEFAULT_SPOT_FILL_CONFIG);
  state = assertAccepted(triggered, 'ST exit');
  const summary = state.tradeSummaries[0];
  const fills = state.events.filter((event): event is Extract<typeof event, { type: 'FILL_APPLIED' }> => event.type === 'FILL_APPLIED').map((event) => event.fill);
  if (!summary || fills.length !== 2) throw new Error('ST training scenario did not produce the expected production summary');
  return { kind: 'ST-01', scenarioId: getMissionDefinition('ST-01').scenario.scenarioId, provenance: 'SYNTHETIC', modelVersion: 'SPOT_FILL_V0', entryAccepted: false, stopPlacementAccepted: false, stopTriggered: false, stopWidened: false, exitCompleted: false, planPriceX18: plan.toString(), triggerPriceX18: '24000000000000000', actualFillPriceX18: fills[1].fillPriceX18.toString(), impactBps: fills[1].impactBps.toString(), feesWei: (fills[0].feeQuoteWei + fills[1].feeQuoteWei).toString(), realizedPnlWei: summary.realizedPnlWei.toString() };
}

function riskPlan(stopPriceX18: bigint, planId: string): RiskPlanFactsV0 {
  const result = planRiskSizedEntry({ planId, instrumentId: INSTRUMENT, quoteAsset: 'WETH', equityAtPlanWei: wei(500_000_000_000_000_000n), availableCapitalWei: wei(500_000_000_000_000_000n), intendedEntryPriceX18: priceX18(25_000_000_000_000_000n), stopPriceX18: priceX18(stopPriceX18), riskBps: bps(100n), usableQuoteLiquidityWei: wei(10_000_000_000_000_000_000n), createdAtMs: SYNTHETIC_START_MS, observationId: 'rs-observation', sourceId: 'REKT_LEARNING_SYNTHETIC_FIXTURE_V0', config: DEFAULT_SPOT_FILL_CONFIG });
  if (!result.ok) throw new Error(`RS training plan failed: ${result.code}`);
  return { planId, accepted: true, equityAtPlanWei: result.plan.equityAtPlanWei.toString(), riskBudgetWei: result.plan.maxLossWei.toString(), stopPriceX18: result.plan.stopPriceX18.toString(), stopDistanceBps: result.plan.stopDistanceBps.toString(), positionSizeAtoms: result.plan.plannedQuantityAtoms.toString(), plannedNotionalWei: result.plan.plannedNotionalWei.toString(), projectedStopLossWei: result.plan.projectedLossWei.toString(), fillModelVersion: result.plan.fillModelVersion, modelVersion: result.plan.modelVersion };
}

function riskFacts(): RiskFactsV0 {
  return { kind: 'RS-01', scenarioId: getMissionDefinition('RS-01').scenario.scenarioId, provenance: 'SYNTHETIC', quoteAsset: 'WETH', narrowStop: riskPlan(24_000_000_000_000_000n, 'rs-narrow'), widerStop: riskPlan(23_000_000_000_000_000n, 'rs-wide') };
}

const MARKET_TRUTH_FACTS: MarketTruthFactsV0 = {
  kind: 'MD-01',
  items: [
    { itemId: 'chain-receipt', expected: 'CONFIRMED', publishedBy: 'chain receipt / transaction evidence', rektDerived: 'REKT displays the provider evidence without strengthening it', evidencePath: 'source receipt', workedExample: true },
    { itemId: 'aggregator-mark', expected: 'DERIVED', publishedBy: 'pool/aggregator observation', rektDerived: 'REKT derives a mark from the observation and freshness policy', evidencePath: 'provider observation → REKT mark', workedExample: false },
    { itemId: 'simulator-fill', expected: 'DERIVED', publishedBy: 'REKT simulator', rektDerived: 'SPOT_FILL_V0 derives a fill from reference, liquidity, impact and fees', evidencePath: 'observation → model fill', workedExample: false },
    { itemId: 'demo-observation', expected: 'SYNTHETIC', publishedBy: 'local DEMO fixture', rektDerived: 'REKT labels the training value synthetic', evidencePath: 'fixture', workedExample: false },
    { itemId: 'aged-observation', expected: 'STALE', publishedBy: 'previous observation timestamp', rektDerived: 'REKT fails closed when freshness expires', evidencePath: 'observation → freshness gate', workedExample: false },
  ],
  freshnessExpected: 'STALE',
};

export function createMissionFacts(id: import('./types.js').MissionId): MissionFacts {
  if (id === 'MD-01') return copyFacts(MARKET_TRUTH_FACTS);
  if (id === 'EX-01') return copyFacts(executionFacts());
  if (id === 'LQ-01') return copyFacts(liquidityFacts());
  if (id === 'ST-01') return copyFacts(stopFacts());
  return copyFacts(riskFacts());
}

/** Stable identity for a scenario/facts bundle; no wall clock or entropy. */
export function scenarioDigest(facts: MissionFacts): string {
  return `SHA-256:${sha256Hex(canonicalEpisodeJson(facts))}`;
}
