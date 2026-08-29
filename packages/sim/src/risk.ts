/**
 * RISK_PLAN_V0 — deterministic account-risk sizing for long spot practice.
 *
 * The product question this answers is not "how large a trade do I want?" but
 * "how much of my account am I willing to lose if this thesis is invalidated?".
 * The frozen causal order is therefore:
 *
 *   market context -> stop / invalidation -> account risk budget -> position size
 *
 * Nothing here ever moves the player's stop to preserve a chosen risk
 * percentage. The stop is an input.
 *
 * ## Arithmetic
 *
 * Every value is `bigint` fixed point. There is no floating-point money
 * arithmetic anywhere in this module, and no `Date.now()` / `Math.random()`.
 *
 * ## Fee and slippage treatment
 *
 * The projection is not an approximation of SPOT_FILL_V0 — it *is* SPOT_FILL_V0,
 * replayed on paper. `projectRoundTrip` reproduces the model's own rounding
 * step for step (participation -> impact -> fill price -> quantity -> executed
 * quote -> fee) for both legs, and then applies the ledger's own realized-PnL
 * composition. A plan's `projectedLossWei` is consequently the exact loss the
 * ledger will record if the planned entry executes against this observation and
 * the stop later fills at its trigger price with comparable depth.
 *
 * Two honest caveats, both surfaced rather than hidden:
 *
 *   - a stop is an instruction, not a guaranteed fill (`SIM_CONTRACT_V0` §10).
 *     A trigger observation below the stop fills worse than the projection.
 *   - depth is taken from the planning observation. Thinner depth at exit
 *     charges more impact than projected.
 *
 * ## No hidden leverage
 *
 * The planned notional is bounded by the account's own free ETH *including the
 * entry fee*, and by the fill model's participation ceiling. A tighter stop
 * therefore produces a larger size only until capital runs out; it can never
 * synthesize notional the account cannot fund.
 */
import { DEFAULT_SPOT_FILL_CONFIG } from './fill-models/spot-fill-v0.js';
import { nextEventSequence, type SimEvent } from './events.js';
import { feeForQuote, minBigInt, mulDiv, participationBps, quantityForQuote, quoteForQuantity } from './math.js';
import { assertUsableObservation } from './observation.js';
import {
  BPS_SCALE,
  RISK_PLAN_MODEL_VERSION,
  SimError,
  bps,
  priceX18,
  quantityAtoms,
  wei,
  type Bps,
  type MarketObservation,
  type PositionState,
  type PriceX18,
  type QuantityAtoms,
  type RiskPlan,
  type SimState,
  type SpotFillConfig,
  type Wei,
} from './types.js';

/* -------------------------------------------------------------------------- */
/* frozen V0 bounds                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Hard ceiling on a single plan's account risk. Above this the request fails
 * closed rather than being clamped, so a mistyped custom percentage is visible
 * instead of silently coerced.
 */
export const RISK_PLAN_MAX_RISK_BPS: Bps = bps(1_000n);

/**
 * Minimum stop distance, in bps of the intended entry. Below this the model's
 * own round-trip cost dominates the stop distance entirely and the resulting
 * size is meaningless, so the calculator refuses rather than returning a number
 * that only looks precise. It also makes a zero or inverted distance
 * unreachable before any division occurs.
 */
export const RISK_PLAN_MIN_STOP_DISTANCE_BPS: Bps = bps(10n);

/** Smallest planned notional treated as executable. 0.0001 ETH. */
export const RISK_PLAN_MIN_NOTIONAL_WEI: Wei = wei(100_000_000_000_000n);

/**
 * How far projected exposure may drift past the frozen budget before Career
 * classifies it as a risk-budget violation. Versioned and tunable; 500 bps of
 * the budget, not of equity.
 */
export const RISK_BUDGET_TOLERANCE_BPS: Bps = bps(500n);

/** Presets the terminal offers: 0.5% / 1% / 2% of account equity. */
export const RISK_PLAN_PRESET_BPS: readonly Bps[] = [bps(50n), bps(100n), bps(200n)];

export const RISK_PLAN_TUNING_VERSION = 'RISK_PLAN_V0_PROVISIONAL';

/** Quote assets `SPOT_FILL_V0` will actually execute, mirrored here. */
const SUPPORTED_PLAN_QUOTE_ASSETS: readonly string[] = ['ETH', 'WETH'];

/* -------------------------------------------------------------------------- */
/* model replay                                                                */
/* -------------------------------------------------------------------------- */

/** Impact bps SPOT_FILL_V0 charges a request of `notionalWei` against `liquidityWei`. */
function modelImpactBps(notionalWei: bigint, liquidityWei: bigint, config: SpotFillConfig): bigint | null {
  if (notionalWei <= 0n || liquidityWei <= 0n) return null;
  const participation = participationBps(wei(notionalWei), wei(liquidityWei));
  if (participation > config.maxParticipationBps) return null;
  const raw = config.baseSlippageBps + participation * config.impactCoefficientBpsPerParticipationBps;
  return raw > config.maxImpactBps ? config.maxImpactBps : raw;
}

/** BUY fill price: reference moved against the taker, rounded up as the model does. */
function buyFillPrice(referenceX18: bigint, impact: bigint): bigint {
  return mulDiv(referenceX18, BPS_SCALE + impact, BPS_SCALE, 'ceil');
}

/** SELL fill price: reference moved against the taker, rounded down as the model does. */
function sellFillPrice(referenceX18: bigint, impact: bigint): bigint {
  return mulDiv(referenceX18, BPS_SCALE - impact, BPS_SCALE, 'floor');
}

export interface RiskRoundTrip {
  requestedNotionalWei: Wei;
  quantityAtoms: QuantityAtoms;
  entryFillPriceX18: PriceX18;
  /** Cost basis the ledger would record. */
  entryCostWei: Wei;
  entryFeeWei: Wei;
  entryImpactBps: Bps;
  stopFillPriceX18: PriceX18;
  exitProceedsWei: Wei;
  exitFeeWei: Wei;
  exitImpactBps: Bps;
  /** Signed realized PnL: negative is a loss. */
  realizedWei: Wei;
  /** Positive magnitude of the loss, or zero if the stop still exits in profit. */
  projectedLossWei: Wei;
}

/**
 * Replay a full entry-and-stop-exit round trip through SPOT_FILL_V0 and the
 * ledger's realized-PnL composition.
 *
 * Returns null when the model itself would refuse the request (participation
 * ceiling, zero quantity, non-positive price) — the caller then fails closed
 * rather than presenting a size the simulator would reject.
 */
export function projectRoundTrip(
  requestedNotionalWei: bigint,
  entryReferenceX18: bigint,
  stopReferenceX18: bigint,
  usableQuoteLiquidityWei: bigint,
  config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG,
): RiskRoundTrip | null {
  if (requestedNotionalWei <= 0n || entryReferenceX18 <= 0n || stopReferenceX18 <= 0n) return null;

  const entryImpact = modelImpactBps(requestedNotionalWei, usableQuoteLiquidityWei, config);
  if (entryImpact === null) return null;
  const entryFill = buyFillPrice(entryReferenceX18, entryImpact);
  if (entryFill <= 0n) return null;
  const quantity = quantityForQuote(wei(requestedNotionalWei), priceX18(entryFill), 'floor');
  if (quantity <= 0n) return null;
  const entryCost = quoteForQuantity(quantity, priceX18(entryFill), 'floor');
  if (entryCost <= 0n) return null;
  const entryFee = feeForQuote(entryCost, config.feeBps, 'floor');

  // The exit leg mirrors `executeSpotAction`'s FULL_CLOSE exactly: the requested
  // quote is the open quantity valued at the observation's reference price,
  // rounded up.
  const exitRequested = quoteForQuantity(quantity, priceX18(stopReferenceX18), 'ceil');
  const exitImpact = modelImpactBps(exitRequested, usableQuoteLiquidityWei, config);
  if (exitImpact === null) return null;
  const stopFill = sellFillPrice(stopReferenceX18, exitImpact);
  if (stopFill <= 0n) return null;
  const proceeds = quoteForQuantity(quantity, priceX18(stopFill), 'floor');
  if (proceeds <= 0n) return null;
  const exitFee = feeForQuote(proceeds, config.feeBps, 'floor');

  const realized = proceeds - entryCost - entryFee - exitFee;
  return {
    requestedNotionalWei: wei(requestedNotionalWei),
    quantityAtoms: quantityAtoms(quantity),
    entryFillPriceX18: priceX18(entryFill),
    entryCostWei: wei(entryCost),
    entryFeeWei: wei(entryFee),
    entryImpactBps: bps(entryImpact),
    stopFillPriceX18: priceX18(stopFill),
    exitProceedsWei: wei(proceeds),
    exitFeeWei: wei(exitFee),
    exitImpactBps: bps(exitImpact),
    realizedWei: wei(realized),
    projectedLossWei: wei(realized < 0n ? -realized : 0n),
  };
}

/* -------------------------------------------------------------------------- */
/* sizing                                                                      */
/* -------------------------------------------------------------------------- */

export type RiskPlanRejectionCode =
  | 'MODEL_INPUT_UNAVAILABLE'
  | 'INVALID_EQUITY'
  | 'INVALID_PRICE'
  | 'STOP_NOT_BELOW_ENTRY'
  | 'STOP_DISTANCE_TOO_SMALL'
  | 'RISK_BUDGET_ZERO'
  | 'RISK_BUDGET_ABOVE_MAX'
  | 'MISSING_LIQUIDITY'
  | 'INSUFFICIENT_CAPITAL'
  | 'UNSUPPORTED_QUOTE'
  | 'SIZE_BELOW_MINIMUM';

export interface RiskPlanInput {
  planId: string;
  instrumentId: string;
  quoteAsset: string;
  equityAtPlanWei: Wei;
  /** Free ETH the entry may consume, fee included. The leverage bound. */
  availableCapitalWei: Wei;
  intendedEntryPriceX18: PriceX18;
  stopPriceX18: PriceX18;
  riskBps: Bps;
  usableQuoteLiquidityWei: Wei;
  /** Simulator/event time. */
  createdAtMs: number;
  observationId: string;
  sourceId: string;
  config?: SpotFillConfig;
}

export type RiskPlanResult =
  | { ok: true; plan: RiskPlan; sizing: RiskRoundTrip }
  | { ok: false; code: RiskPlanRejectionCode; message: string };

function refuse(code: RiskPlanRejectionCode, message: string): RiskPlanResult {
  return { ok: false, code, message };
}

/** Largest notional the fill model's participation ceiling admits. */
function participationCapWei(liquidityWei: bigint, config: SpotFillConfig): bigint {
  return mulDiv(liquidityWei, config.maxParticipationBps, BPS_SCALE, 'floor');
}

/**
 * Largest notional whose full round trip stays inside both the risk budget and
 * the account's own capital.
 *
 * Binary search over integer wei. The loop invariant is that `best` was
 * actually evaluated and passed every constraint, so the returned sizing is
 * verified feasible rather than inferred from a closed form. Where the model's
 * participation impact steps, the search can land up to one impact step below
 * the theoretical maximum; that direction is deliberate — ambiguity is always
 * resolved toward less risk, never more.
 */
function solveNotional(
  budgetWei: bigint,
  entryReferenceX18: bigint,
  stopReferenceX18: bigint,
  liquidityWei: bigint,
  capitalWei: bigint,
  config: SpotFillConfig,
): RiskRoundTrip | null {
  const ceiling = minBigInt(participationCapWei(liquidityWei, config), capitalWei);
  if (ceiling <= 0n) return null;

  const feasible = (notional: bigint): RiskRoundTrip | null => {
    const trip = projectRoundTrip(notional, entryReferenceX18, stopReferenceX18, liquidityWei, config);
    if (!trip) return null;
    // The simulator debits cost basis *and* the entry fee from free ETH, so the
    // affordability test must include the fee or the plan would produce an
    // entry the ledger refuses.
    if (trip.entryCostWei + trip.entryFeeWei > capitalWei) return null;
    if (trip.projectedLossWei > budgetWei) return null;
    return trip;
  };

  let low = 0n;
  let high = ceiling + 1n;
  let best: RiskRoundTrip | null = null;
  while (low + 1n < high) {
    const mid = (low + high) / 2n;
    const trip = feasible(mid);
    if (trip) {
      low = mid;
      best = trip;
    } else {
      high = mid;
    }
  }
  return best;
}

/**
 * Derive the position size that risks approximately, and never more than, the
 * selected share of account equity if the stop fills at its trigger price.
 */
export function planRiskSizedEntry(input: RiskPlanInput): RiskPlanResult {
  const config = input.config ?? DEFAULT_SPOT_FILL_CONFIG;

  if (!input.planId || !input.instrumentId || !input.quoteAsset || !input.observationId || !input.sourceId) {
    return refuse('MODEL_INPUT_UNAVAILABLE', 'a risk plan requires plan, instrument, observation, and source identity');
  }
  if (!Number.isSafeInteger(input.createdAtMs) || input.createdAtMs < 0) {
    return refuse('MODEL_INPUT_UNAVAILABLE', 'a risk plan must be stamped with simulator event time');
  }
  // SPOT_FILL_V0 only executes ETH/WETH-quoted pairs. Sizing a plan the
  // simulator could never fill would freeze a budget onto the ledger for a
  // trade that cannot happen, so the same gate applies here.
  if (!SUPPORTED_PLAN_QUOTE_ASSETS.includes(input.quoteAsset.toUpperCase())) {
    return refuse('UNSUPPORTED_QUOTE', 'spot risk planning requires an ETH or WETH quote');
  }
  if (input.equityAtPlanWei <= 0n) {
    return refuse('INVALID_EQUITY', 'a risk budget cannot be derived from non-positive account equity');
  }
  if (input.intendedEntryPriceX18 <= 0n || input.stopPriceX18 <= 0n) {
    return refuse('INVALID_PRICE', 'entry and stop prices must both be positive');
  }
  if (input.stopPriceX18 >= input.intendedEntryPriceX18) {
    return refuse('STOP_NOT_BELOW_ENTRY', 'a long protective stop must sit strictly below the intended entry price');
  }

  const stopDistanceBps = mulDiv(
    input.intendedEntryPriceX18 - input.stopPriceX18,
    BPS_SCALE,
    input.intendedEntryPriceX18,
    'floor',
  );
  if (stopDistanceBps < RISK_PLAN_MIN_STOP_DISTANCE_BPS) {
    return refuse('STOP_DISTANCE_TOO_SMALL', 'the stop is too close to the entry for a meaningful size at this model cost');
  }
  if (input.riskBps <= 0n) {
    return refuse('RISK_BUDGET_ZERO', 'a zero account-risk budget authorizes no position');
  }
  if (input.riskBps > RISK_PLAN_MAX_RISK_BPS) {
    return refuse('RISK_BUDGET_ABOVE_MAX', `account risk above ${RISK_PLAN_MAX_RISK_BPS} bps is not authorized in V0`);
  }
  if (input.usableQuoteLiquidityWei <= 0n) {
    return refuse('MISSING_LIQUIDITY', 'usable ETH-denominated depth is required to size a position');
  }
  if (input.availableCapitalWei <= 0n) {
    return refuse('INSUFFICIENT_CAPITAL', 'no free ETH is available to fund an entry');
  }

  const budgetWei = mulDiv(input.equityAtPlanWei, input.riskBps, BPS_SCALE, 'floor');
  if (budgetWei <= 0n) {
    return refuse('RISK_BUDGET_ZERO', 'the selected account risk rounds down to zero at this equity');
  }

  const sizing = solveNotional(
    budgetWei,
    input.intendedEntryPriceX18,
    input.stopPriceX18,
    input.usableQuoteLiquidityWei,
    input.availableCapitalWei,
    config,
  );
  if (!sizing || sizing.requestedNotionalWei < RISK_PLAN_MIN_NOTIONAL_WEI) {
    return refuse('SIZE_BELOW_MINIMUM', 'no executable position size satisfies this risk budget at the current depth and free ETH');
  }

  const plan: RiskPlan = {
    planId: input.planId,
    instrumentId: input.instrumentId,
    quoteAsset: input.quoteAsset.toUpperCase(),
    equityAtPlanWei: wei(input.equityAtPlanWei),
    intendedEntryPriceX18: priceX18(input.intendedEntryPriceX18),
    stopPriceX18: priceX18(input.stopPriceX18),
    maxLossWei: wei(budgetWei),
    maxLossBpsOfEquity: bps(input.riskBps),
    plannedNotionalWei: sizing.requestedNotionalWei,
    plannedQuantityAtoms: sizing.quantityAtoms,
    plannedEntryFillPriceX18: sizing.entryFillPriceX18,
    plannedStopFillPriceX18: sizing.stopFillPriceX18,
    projectedLossWei: sizing.projectedLossWei,
    stopDistanceBps: bps(stopDistanceBps),
    createdAtMs: input.createdAtMs,
    observationId: input.observationId,
    sourceId: input.sourceId,
    usableQuoteLiquidityWei: wei(input.usableQuoteLiquidityWei),
    fillModelVersion: config.modelVersion,
    modelVersion: RISK_PLAN_MODEL_VERSION,
    provenance: 'DERIVED',
  };
  return { ok: true, plan, sizing };
}

/* -------------------------------------------------------------------------- */
/* live projection                                                             */
/* -------------------------------------------------------------------------- */

export interface StopExitProjection {
  stopPriceX18: PriceX18;
  stopFillPriceX18: PriceX18;
  quantityAtoms: QuantityAtoms;
  proceedsWei: Wei;
  feeWei: Wei;
  impactBps: Bps;
  /** Signed realized PnL the ledger would record. Negative is a loss. */
  realizedWei: Wei;
  /** Positive magnitude of the loss, or zero if the stop exits in profit. */
  lossWei: Wei;
  /**
   * False when the position has outgrown the fill model's participation
   * ceiling, so `SPOT_FILL_V0` would refuse this exit outright.
   *
   * The projection is still produced, priced at the model's maximum impact, and
   * is then a *lower bound* on the real cost of unwinding: a stop the model will
   * not fill cannot cost less than one it barely fills. Returning nothing here
   * was worse than returning a bound — an unpriceable exit used to read as
   * "no breach detected", which let a position grow past its budget while the
   * closed trade still claimed compliance.
   */
  exitExecutable: boolean;
}

/**
 * Price an existing position's exit at a given stop trigger price, using the
 * ledger's own realized-PnL composition over the position's recorded cost basis
 * and unallocated entry fees. Read-only: no event, no state change.
 */
export function projectStopExit(
  position: PositionState,
  stopPriceX18: bigint,
  usableQuoteLiquidityWei: bigint,
  config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG,
): StopExitProjection | null {
  if (stopPriceX18 <= 0n || position.openQuantityAtoms <= 0n || usableQuoteLiquidityWei <= 0n) return null;
  const quantity = position.openQuantityAtoms;
  const requested = quoteForQuantity(quantityAtoms(quantity), priceX18(stopPriceX18), 'ceil');
  const modelled = modelImpactBps(requested, usableQuoteLiquidityWei, config);
  // Past the participation ceiling the model refuses the order. Price the exit
  // at the model's worst admissible impact instead of declining to answer, and
  // say so: a bound the caller can act on beats silence that reads as safety.
  const exitExecutable = modelled !== null;
  const impact = modelled ?? config.maxImpactBps;
  const stopFill = sellFillPrice(stopPriceX18, impact);
  if (stopFill <= 0n) return null;
  const proceeds = quoteForQuantity(quantityAtoms(quantity), priceX18(stopFill), 'floor');
  if (proceeds <= 0n) return null;
  const fee = feeForQuote(proceeds, config.feeBps, 'floor');
  const realized = proceeds - position.costBasisWei - position.remainingEntryFeesWei - fee;
  return {
    stopPriceX18: priceX18(stopPriceX18),
    stopFillPriceX18: priceX18(stopFill),
    quantityAtoms: quantityAtoms(quantity),
    proceedsWei: wei(proceeds),
    feeWei: wei(fee),
    impactBps: bps(impact),
    realizedWei: wei(realized),
    lossWei: wei(realized < 0n ? -realized : 0n),
    exitExecutable,
  };
}

/**
 * Project the open position's exit at its *active stop's trigger price*.
 *
 * This is the number the terminal shows as "IF STOP FILLS". It is deliberately
 * priced at the stop, not at the current market: an exit priced at a mark far
 * above the stop is not the answer to "what does my invalidation cost me".
 */
export function projectActiveStopExit(
  state: SimState,
  observation: MarketObservation,
  eventTimeMs: number,
  config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG,
): StopExitProjection | null {
  const { position, activeStop } = state;
  if (!position || !activeStop || activeStop.cycleId !== position.cycleId) return null;
  try {
    assertUsableObservation(observation, eventTimeMs, config, state.evidencePolicy);
  } catch {
    return null;
  }
  if (
    observation.instrumentId !== position.instrumentId
    || observation.quoteAsset.toUpperCase() !== position.quoteAsset.toUpperCase()
  ) {
    return null;
  }
  return projectStopExit(position, activeStop.stopPriceX18, observation.usableQuoteLiquidityWei, config);
}

export type RiskProjectionStatus =
  | 'NO_PLAN'
  | 'PLANNED_FLAT'
  | 'UNPROTECTED'
  | 'WITHIN_BUDGET'
  | 'OVER_BUDGET'
  | 'UNAVAILABLE';

export interface RiskProjection {
  status: RiskProjectionStatus;
  plan: RiskPlan | null;
  /** Positive magnitude of the projected loss if the active stop fills at trigger. */
  projectedLossWei: Wei;
  /** The plan's frozen budget. */
  budgetWei: Wei;
  /** Budget plus the versioned tolerance. Exceeding this is a violation. */
  toleranceLimitWei: Wei;
  /** How far projected loss exceeds the budget, zero when inside it. */
  overBudgetWei: Wei;
  stopPriceX18: PriceX18 | null;
  /**
   * False when the model would refuse an exit of this size at this depth, so
   * `projectedLossWei` is a lower bound rather than the modelled outcome.
   */
  exitExecutable: boolean;
  /** Latched: the cycle already recorded a budget breach. */
  breached: boolean;
  /**
   * Latched: at some point in the cycle the plan's exposure could not be
   * checked against its budget at all (no protective stop, or evidence the
   * model could not price). Compliance can never be claimed for such a cycle.
   */
  unverified: boolean;
  provenance: 'DERIVED';
  modelVersion: typeof RISK_PLAN_MODEL_VERSION;
}

export function riskToleranceLimitWei(budgetWei: bigint): Wei {
  return wei(mulDiv(budgetWei, BPS_SCALE + RISK_BUDGET_TOLERANCE_BPS, BPS_SCALE, 'floor'));
}

/**
 * Compare the position's current projected loss at its stop against the frozen
 * plan budget.
 *
 * Recomputed from live simulator state, so it moves correctly when the stop is
 * tightened or widened, when the position is scaled into, and when it is
 * partially exited — without ever mutating the plan.
 */
export function projectPlannedRisk(
  state: SimState,
  observation: MarketObservation,
  eventTimeMs: number,
  config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG,
): RiskProjection {
  const plan = state.activeRiskPlan;
  const base = {
    plan,
    projectedLossWei: wei(0n),
    budgetWei: plan ? plan.maxLossWei : wei(0n),
    toleranceLimitWei: plan ? riskToleranceLimitWei(plan.maxLossWei) : wei(0n),
    overBudgetWei: wei(0n),
    stopPriceX18: state.activeStop ? priceX18(state.activeStop.stopPriceX18) : null,
    exitExecutable: true,
    breached: state.riskBudgetBreached,
    unverified: !state.riskBudgetVerified,
    provenance: 'DERIVED' as const,
    modelVersion: RISK_PLAN_MODEL_VERSION,
  };
  if (!plan) return { ...base, status: 'NO_PLAN' };
  if (!state.position) return { ...base, status: 'PLANNED_FLAT' };
  if (!state.activeStop) return { ...base, status: 'UNPROTECTED' };

  const projection = projectActiveStopExit(state, observation, eventTimeMs, config);
  if (!projection) return { ...base, status: 'UNAVAILABLE' };

  const overBudget = projection.lossWei > plan.maxLossWei ? projection.lossWei - plan.maxLossWei : 0n;
  const status: RiskProjectionStatus = projection.lossWei > base.toleranceLimitWei ? 'OVER_BUDGET' : 'WITHIN_BUDGET';
  return {
    ...base,
    status,
    projectedLossWei: projection.lossWei,
    overBudgetWei: wei(overBudget),
    stopPriceX18: projection.stopPriceX18,
    exitExecutable: projection.exitExecutable,
  };
}

/* -------------------------------------------------------------------------- */
/* ledger integration                                                          */
/* -------------------------------------------------------------------------- */

export interface RiskPlanIntent {
  planId: string;
  observation: MarketObservation;
  stopPriceX18: bigint;
  riskBps: bigint;
  eventTimeMs: number;
  /** Defaults to the account's free ETH. */
  availableCapitalWei?: Wei;
}

/**
 * Build the RISK_PLAN_SET event for a plan.
 *
 * `buildRiskPlanEvent` is separated from the state transition so callers that
 * only want to *preview* a plan never touch the ledger; the practice store is
 * the only place that commits one.
 */
export function buildRiskPlanEvent(state: SimState, plan: RiskPlan, eventTimeMs: number): SimEvent {
  return {
    type: 'RISK_PLAN_SET',
    eventId: `${plan.planId}:risk-plan`,
    sequence: nextEventSequence(state),
    sessionId: state.sessionId,
    modelVersion: state.modelVersion,
    eventTimeMs,
    plan,
  };
}

/**
 * Record what this action did to the plan's exposure.
 *
 * Two facts can come out of an exposure-changing action, and both are recorded
 * rather than prevented — `CAREER_CONTRACT_V0` §13 is explicit that Practice
 * observes the behaviour instead of blocking it:
 *
 *   - `RISK_BUDGET_BREACHED`: projected loss passed budget plus tolerance.
 *   - `RISK_EXPOSURE_UNVERIFIED`: the exposure could not be checked against the
 *     budget at all, because the position carries no protective stop or the
 *     evidence cannot price one.
 *
 * The second exists because the alternative is worse than useless: treating an
 * uncheckable exposure as "no breach found" let a cycle close claiming a
 * compliance it had never demonstrated.
 */
export function buildRiskExposureEvent(
  state: SimState,
  observation: MarketObservation,
  eventTimeMs: number,
  config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG,
  options: { positionJustOpened?: boolean } = {},
): SimEvent | null {
  if (!state.position || !state.activeRiskPlan) return null;
  const plan = state.activeRiskPlan;
  const projection = projectPlannedRisk(state, observation, eventTimeMs, config);

  const cannotVerifyCompliance =
    projection.status === 'UNPROTECTED'
    || projection.status === 'UNAVAILABLE'
    || (!projection.exitExecutable && projection.status !== 'OVER_BUDGET');

  if (cannotVerifyCompliance) {
    if (!state.riskBudgetVerified) return null;
    // The instant a planned entry fills it is briefly stopless, because the
    // protective stop is the next step of the same user action. Flagging that
    // instant would mark every correctly-planned trade unverified. A cycle that
    // never carries a stop at all is still caught, at close, by TradeSummary.
    if (options.positionJustOpened && projection.status === 'UNPROTECTED') return null;
    return {
      type: 'RISK_EXPOSURE_UNVERIFIED',
      eventId: `${plan.planId}:unverified:${observation.observationId}`,
      sequence: nextEventSequence(state),
      sessionId: state.sessionId,
      modelVersion: state.modelVersion,
      eventTimeMs,
      planId: plan.planId,
      cycleId: state.position.cycleId,
      // A non-executable exit whose lower-bound loss is still inside tolerance
      // is not evidence of compliance; the fill model cannot verify the actual
      // unwind. Reuse the existing UNAVAILABLE reason rather than inventing a
      // new event vocabulary for the same epistemic state.
      reason: projection.status === 'UNPROTECTED' ? 'UNPROTECTED' : 'UNAVAILABLE',
      observationId: observation.observationId,
    };
  }

  if (projection.status !== 'OVER_BUDGET' || state.riskBudgetBreached) return null;
  return {
    type: 'RISK_BUDGET_BREACHED',
    eventId: `${plan.planId}:breach:${observation.observationId}`,
    sequence: nextEventSequence(state),
    sessionId: state.sessionId,
    modelVersion: state.modelVersion,
    eventTimeMs,
    planId: plan.planId,
    cycleId: state.position.cycleId,
    projectedLossWei: projection.projectedLossWei,
    budgetWei: projection.budgetWei,
    toleranceLimitWei: projection.toleranceLimitWei,
    observationId: observation.observationId,
  };
}

/**
 * Validate a RISK_PLAN_SET payload before it enters the append-only log.
 * Anything self-inconsistent is refused rather than stored and later believed.
 */
export function assertRiskPlan(plan: RiskPlan): void {
  if (!plan || typeof plan !== 'object') throw new SimError('RISK_PLAN_INVALID', 'a risk plan payload is required');
  if (!plan.planId || !plan.instrumentId || !plan.observationId || !plan.sourceId) {
    throw new SimError('RISK_PLAN_INVALID', 'a risk plan requires stable plan, instrument, observation, and source identity');
  }
  if (plan.modelVersion !== RISK_PLAN_MODEL_VERSION || plan.provenance !== 'DERIVED') {
    throw new SimError('RISK_PLAN_INVALID', 'a risk plan must declare RISK_PLAN_V0 and DERIVED provenance');
  }
  if (!Number.isSafeInteger(plan.createdAtMs) || plan.createdAtMs < 0) {
    throw new SimError('RISK_PLAN_INVALID', 'a risk plan must carry simulator event time');
  }
  if (plan.equityAtPlanWei <= 0n || plan.maxLossWei <= 0n || plan.maxLossBpsOfEquity <= 0n) {
    throw new SimError('RISK_PLAN_INVALID', 'a risk plan requires positive equity and a positive budget');
  }
  if (plan.maxLossBpsOfEquity > RISK_PLAN_MAX_RISK_BPS) {
    throw new SimError('RISK_PLAN_INVALID', 'a risk plan exceeds the authorized V0 account-risk ceiling');
  }
  if (plan.intendedEntryPriceX18 <= 0n || plan.stopPriceX18 <= 0n || plan.stopPriceX18 >= plan.intendedEntryPriceX18) {
    throw new SimError('RISK_PLAN_INVALID', 'a long risk plan requires a stop strictly below the intended entry');
  }
  if (plan.plannedNotionalWei <= 0n || plan.plannedQuantityAtoms <= 0n) {
    throw new SimError('RISK_PLAN_INVALID', 'a risk plan must size a positive, executable position');
  }
  if (plan.projectedLossWei < 0n || plan.projectedLossWei > plan.maxLossWei) {
    throw new SimError('RISK_PLAN_INVALID', 'a risk plan cannot project a loss beyond its own budget');
  }
}