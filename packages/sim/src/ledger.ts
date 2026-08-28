import { createInitialAccount, applyEntryDebit, applyExitCredit, lossBpsOfEquity, markToMarket } from './account.js';
import { nextEventSequence, type SimEvent } from './events.js';
import { addEntry, closePosition, openPosition } from './position.js';
import {
  INITIAL_BANKROLL_WEI,
  SPOT_FILL_MODEL_VERSION,
  SimError,
  bps,
  priceX18,
  wei,
  type AccountState,
  type PositionState,
  type SimState,
  type SpotFill,
  type TradeSummary,
  type Wei,
} from './types.js';

export const SIM_MODEL_VERSION = 'SIM_SPOT_V0';

export interface InitialSimStateInput {
  sessionId?: string;
  startedAtMs?: number;
  modelVersion?: string;
}

export function createInitialSimState(input: InitialSimStateInput = {}): SimState {
  const sessionId = input.sessionId ?? 'spot-session-0';
  const startedAtMs = input.startedAtMs ?? 0;
  if (!sessionId) throw new SimError('INVALID_EVENT', 'session identity is required');
  if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0) throw new SimError('INVALID_TIME', 'session time must be a non-negative safe integer');
  return {
    sessionId,
    modelVersion: input.modelVersion ?? SIM_MODEL_VERSION,
    startedAtMs,
    account: createInitialAccount(),
    position: null,
    markPriceX18: null,
    events: [],
    tradeSummaries: [],
    appliedEventIds: [],
    appliedFillIds: [],
    lastSequence: 0,
    closedCycleCount: 0,
    cycleOpeningEquityWei: null,
    cycleRealizedPnlWei: wei(0n),
    cycleAllocatedEntryFeesWei: wei(0n),
    cycleExitFeesWei: wei(0n),
  };
}

export function createSessionOpenedEvent(state: SimState, eventTimeMs = state.startedAtMs): SimEvent {
  return {
    type: 'SESSION_OPENED',
    eventId: `${state.sessionId}:session-opened`,
    sequence: nextEventSequence(state),
    sessionId: state.sessionId,
    modelVersion: state.modelVersion,
    eventTimeMs,
    initialFreeEthWei: INITIAL_BANKROLL_WEI,
  };
}

function appendEvent(state: SimState, event: SimEvent, account = state.account, position = state.position, markPriceX18 = state.markPriceX18, tradeSummaries = state.tradeSummaries, changes: Partial<SimState> = {}): SimState {
  return {
    ...state,
    ...changes,
    account,
    position,
    markPriceX18,
    tradeSummaries,
    events: [...state.events, event],
    appliedEventIds: [...state.appliedEventIds, event.eventId],
    lastSequence: event.sequence,
  };
}

function validateEvent(state: SimState, event: SimEvent): void {
  if (!event.eventId || !event.sessionId || !event.modelVersion || !Number.isSafeInteger(event.sequence) || event.sequence <= 0 || !Number.isSafeInteger(event.eventTimeMs) || event.eventTimeMs < 0) {
    throw new SimError('INVALID_EVENT', 'economic events require stable identity, sequence, model, and time');
  }
  if (event.sessionId !== state.sessionId) throw new SimError('INVALID_EVENT', 'event belongs to another session');
  if (event.modelVersion !== state.modelVersion) throw new SimError('INVALID_EVENT', 'event model version does not match the session');
  if (event.eventTimeMs < state.startedAtMs) throw new SimError('INVALID_TIME', 'event predates the session');
  if (event.sequence !== state.lastSequence + 1) throw new SimError('OUT_OF_ORDER_EVENT', `expected sequence ${state.lastSequence + 1}, received ${event.sequence}`);
  if (state.events.length > 0 && event.eventTimeMs < state.events[state.events.length - 1].eventTimeMs) {
    throw new SimError('OUT_OF_ORDER_EVENT', 'event time moved backwards');
  }
}

function assertSpotFill(fill: SpotFill): void {
  if (!fill.fillId || !fill.intentId || !fill.instrumentId || !fill.observationId || !fill.sourceId || fill.modelVersion !== SPOT_FILL_MODEL_VERSION) throw new SimError('MODEL_INPUT_UNAVAILABLE', 'spot fills require stable model and source identity');
  if (fill.side !== 'BUY' && fill.side !== 'SELL') throw new SimError('INVALID_EVENT', 'spot fill side is invalid');
  if (fill.quantityAtoms <= 0n || fill.executedQuoteWei <= 0n || fill.fillPriceX18 <= 0n || fill.feeQuoteWei < 0n) {
    throw new SimError('INVALID_QUANTITY', 'fill contains invalid quantity, notional, price, or fee');
  }
}

function makeTradeSummary(state: SimState, position: PositionState, fill: SpotFill, account: AccountState, realizedPnlWei: Wei, entryFeesWei: Wei, exitFeesWei: Wei): TradeSummary {
  const accountAtOpen = state.cycleOpeningEquityWei ?? state.account.equityWei;
  return {
    tradeId: position.cycleId,
    sessionId: state.sessionId,
    instrumentId: position.instrumentId,
    mode: 'SPOT',
    side: 'LONG',
    openedAtMs: position.openedAtMs,
    closedAtMs: fill.executedAtMs,
    entryCount: position.entryCount,
    exitCount: position.exitCount + 1,
    averageEntryPriceX18: priceX18(position.averageEntryPriceX18),
    medianEntryPriceX18: priceX18(position.medianEntryPriceX18),
    realizedPnlWei,
    entryFeesWei,
    exitFeesWei,
    fundingWei: 0n as Wei,
    accountEquityAtOpenWei: wei(accountAtOpen),
    accountEquityAtCloseWei: wei(account.equityWei),
    lossBpsOfThenCurrentEquity: bps(lossBpsOfEquity(realizedPnlWei, accountAtOpen)),
    maxDrawdownBpsAtClose: bps(account.maxDrawdownBps),
    partialExitUsed: position.partialExitUsed,
    stopUsed: false,
    stopWidened: false,
    liquidated: false,
    modelVersions: [SPOT_FILL_MODEL_VERSION],
  };
}

function applyFill(state: SimState, fill: SpotFill): {
  account: AccountState;
  position: PositionState | null;
  markPriceX18: bigint;
  tradeSummaries: readonly TradeSummary[];
  changes: Partial<SimState>;
} {
  assertSpotFill(fill);
  if (state.position && (state.position.instrumentId !== fill.instrumentId || state.position.quoteAsset !== fill.quoteAsset)) {
    throw new SimError('INVALID_EVENT', 'a spot session cannot mix position instruments');
  }

  if (fill.side === 'BUY') {
    const debited = applyEntryDebit(state.account, fill.executedQuoteWei, fill.feeQuoteWei);
    const currentPosition = state.position;
    const opening = currentPosition === null;
    const position = opening
      ? openPosition(`trade-${state.closedCycleCount + 1}`, fill)
      : addEntry(currentPosition, fill);
    const account = markToMarket(debited, position, priceX18(fill.fillPriceX18));
    return {
      account,
      position,
      markPriceX18: fill.fillPriceX18,
      tradeSummaries: state.tradeSummaries,
      changes: opening
        ? {
            cycleOpeningEquityWei: wei(state.account.equityWei),
            cycleRealizedPnlWei: wei(0n),
            cycleAllocatedEntryFeesWei: wei(0n),
            cycleExitFeesWei: wei(0n),
          }
        : {},
    };
  }

  const currentPosition = state.position;
  if (!currentPosition) throw new SimError('NO_OPEN_POSITION', 'cannot sell without an open spot position');
  const allocation = closePosition(currentPosition, fill);
  const realized = wei(fill.executedQuoteWei - allocation.allocatedCostBasisWei - allocation.allocatedEntryFeesWei - fill.feeQuoteWei);
  const credited = applyExitCredit(state.account, fill.executedQuoteWei, fill.feeQuoteWei, realized);
  const nextCycleRealized = wei(state.cycleRealizedPnlWei + realized);
  const nextAllocatedEntryFees = wei(state.cycleAllocatedEntryFeesWei + allocation.allocatedEntryFeesWei);
  const nextExitFees = wei(state.cycleExitFeesWei + fill.feeQuoteWei);
  const account = markToMarket(credited, allocation.remainingPosition, allocation.remainingPosition ? priceX18(fill.fillPriceX18) : null);
  if (!allocation.closed) {
    return {
      account,
      position: allocation.remainingPosition,
      markPriceX18: fill.fillPriceX18,
      tradeSummaries: state.tradeSummaries,
      changes: {
        cycleRealizedPnlWei: nextCycleRealized,
        cycleAllocatedEntryFeesWei: nextAllocatedEntryFees,
        cycleExitFeesWei: nextExitFees,
      },
    };
  }

  const summary = makeTradeSummary(
    state,
    currentPosition,
    fill,
    account,
    nextCycleRealized,
    nextAllocatedEntryFees,
    nextExitFees,
  );
  return {
    account,
    position: null,
    markPriceX18: fill.fillPriceX18,
    tradeSummaries: [...state.tradeSummaries, summary],
    changes: {
      closedCycleCount: state.closedCycleCount + 1,
      cycleOpeningEquityWei: null,
      cycleRealizedPnlWei: wei(0n),
      cycleAllocatedEntryFeesWei: wei(0n),
      cycleExitFeesWei: wei(0n),
    },
  };
}

export function applySimEvent(state: SimState, event: SimEvent): SimState {
  if (state.appliedEventIds.includes(event.eventId)) return state;
  validateEvent(state, event);

  if (event.type === 'SESSION_OPENED') {
    if (state.events.length !== 0 || event.sequence !== 1 || event.initialFreeEthWei !== INITIAL_BANKROLL_WEI) {
      throw new SimError('INVALID_EVENT', 'session must open once with the frozen 0.5 ETH bankroll');
    }
    return appendEvent(state, event);
  }

  if (event.type === 'FILL_APPLIED') {
    if (state.appliedFillIds.includes(event.fill.fillId)) {
      return appendEvent(state, event, state.account, state.position, state.markPriceX18, state.tradeSummaries, {
        appliedFillIds: state.appliedFillIds,
      });
    }
    const result = applyFill(state, event.fill);
    return appendEvent(state, event, result.account, result.position, priceX18(result.markPriceX18), result.tradeSummaries, {
      ...result.changes,
      appliedFillIds: [...state.appliedFillIds, event.fill.fillId],
    });
  }

  if (event.type === 'ACCOUNT_SNAPSHOT') {
    if (event.markPriceX18 !== null && event.markPriceX18 <= 0n) throw new SimError('INVALID_PRICE', 'account snapshot mark must be positive');
    if (event.markPriceX18 === null && state.position !== null) throw new SimError('INVALID_EVENT', 'an open position requires a mark price');
    const mark = event.markPriceX18 === null ? null : priceX18(event.markPriceX18);
    return appendEvent(state, event, markToMarket(state.account, state.position, mark), state.position, mark);
  }

  if (event.type === 'TRADE_SUMMARY_RECORDED') {
    const exists = state.tradeSummaries.some((summary) => summary.tradeId === event.summary.tradeId);
    return appendEvent(state, event, state.account, state.position, state.markPriceX18, exists ? state.tradeSummaries : [...state.tradeSummaries, event.summary]);
  }

  return appendEvent(state, event);
}

export function replayEvents(events: readonly SimEvent[], initial?: SimState): SimState {
  const first = events[0];
  const state = initial ?? createInitialSimState({
    sessionId: first?.sessionId,
    startedAtMs: first?.eventTimeMs,
    modelVersion: first?.modelVersion,
  });
  return events.reduce(applySimEvent, state);
}

export function getAccountSnapshot(state: SimState, markPriceX18 = state.markPriceX18): AccountState {
  return markToMarket(state.account, state.position, markPriceX18);
}

export function equityReconciliation(state: SimState): { accountEquityWei: Wei; reconstructedEquityWei: Wei; differenceWei: Wei } {
  const snapshot = getAccountSnapshot(state);
  const reconstructed = wei(INITIAL_BANKROLL_WEI + snapshot.realizedPnlWei + snapshot.unrealizedPnlWei);
  return {
    accountEquityWei: snapshot.equityWei,
    reconstructedEquityWei: reconstructed,
    differenceWei: wei(snapshot.equityWei - reconstructed),
  };
}
