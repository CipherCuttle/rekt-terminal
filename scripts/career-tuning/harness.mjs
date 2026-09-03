/**
 * CAREER_TUNING_HARNESS_V0 — run loop.
 *
 * `runOne(policy, seed)` plays one bounded career: a single continuous spot
 * simulator session (no account reset) plus, once MARGIN_2X is authorised, a
 * bounded set of long-margin training attempts over the real frozen episodes.
 * Every run terminates at `MAX_TICKS` / `MAX_ACTIONS`, on a wipe, on SHORT, or
 * when nothing further can be unlocked.
 */
import { INITIAL_BANKROLL_WEI, MARGIN_TRAINING_EPISODES } from '@rekt-ink/sim';
import { buildScenario } from './scenarios.mjs';
import { SpotCareerRun } from './spot-driver.mjs';
import { runMarginEpisode } from './margin-driver.mjs';
import { makePrng, deriveSeed } from './prng.mjs';
import { MAX_ACTIONS, MAX_TICKS, START_MS, TRACKED_SKILLS } from './config.mjs';

const MARGIN_ATTEMPTS_PER_EPISODE = 3;
const MARGIN_ATTEMPTS_PER_RUN = 6;

function buildView(run, scenario, tick, memo, trade) {
  const position = run.sim.position;
  const currentPriceX18 = scenario.priceAt(tick);
  let priceVsEntryFrac = 0;
  let entryPriceX18 = null;
  if (position) {
    entryPriceX18 = position.averageEntryPriceX18;
    priceVsEntryFrac = Number(((currentPriceX18 - entryPriceX18) * 1_000_000n) / entryPriceX18) / 1_000_000;
  }
  return {
    tick,
    positionOpen: run.positionOpen,
    positionQtyAtoms: run.positionQtyAtoms,
    hasActiveStop: run.hasActiveStop,
    activeStopPriceX18: run.activeStopPriceX18,
    equityWei: run.equityWei,
    freeEthWei: run.freeEthWei,
    startEquityWei: INITIAL_BANKROLL_WEI,
    currentPriceX18,
    entryPriceX18,
    priceVsEntryFrac,
    ticksInPosition: position ? tick - (trade.openedTick ?? tick) : 0,
    tradesClosed: run.tradesClosed,
    skills: new Set(run.tuning.unlockedSkills),
    has: (capability) => run.hasCapability(capability),
    legalKinds: run.legalActionKinds(),
    stopPlannedTrades: run.tuning.stats.stopPlannedTrades,
    partialExitsUsed: run.tuning.stats.partialExitsUsed,
    riskPlannedTrades: run.tuning.stats.riskPlannedTrades,
    qualifyingScaleTrades: run.tuning.stats.qualifyingScaleTrades,
    manualLossCuts: run.tuning.stats.manualLossCuts,
    memo,
    trade,
  };
}

function recordUnlocks(run, tick, unlocks) {
  for (const skill of TRACKED_SKILLS) {
    if (!unlocks[skill] && run.hasSkill(skill)) {
      unlocks[skill] = { tick, actions: run.acceptedActions, trades: run.tradesClosed };
    }
  }
}

function runMarginPhase(run, runId, policy, scenario, tick, memo) {
  let attemptsUsed = 0;
  const attemptsForEpisode = MARGIN_TRAINING_EPISODES.map(() => 0);
  let liquidated = false;
  while (
    run.hasSkill('MARGIN_2X')
    && !run.hasSkill('SHORT')
    && run.equityWei > 0n
    && attemptsUsed < MARGIN_ATTEMPTS_PER_RUN
  ) {
    const qualifying = new Set(run.tuning.stats.qualifyingLongMarginEpisodeIds);
    let index = MARGIN_TRAINING_EPISODES.findIndex(
      (episode, i) => !qualifying.has(episode.episodeId) && attemptsForEpisode[i] < MARGIN_ATTEMPTS_PER_EPISODE,
    );
    if (index === -1) break;
    const episode = MARGIN_TRAINING_EPISODES[index];
    const marginRng = makePrng(deriveSeed(scenario.seed, `${policy.id}:margin:${episode.episodeId}:${attemptsForEpisode[index]}`));
    const view = buildView(run, scenario, tick, memo, {});
    const plan = policy.marginPlan(marginRng, view, index) ?? {
      marginFractionBps: 300, leverage: 2, useStop: true, entryStopBps: 200, close: 'EPISODE_END', widenOnAdverse: false,
    };
    const result = runMarginEpisode({
      sessionId: `${runId}:margin:${index}:${attemptsForEpisode[index]}`,
      equityWei: run.equityWei,
      episode,
      plan,
    });
    if (result.outcome.liquidated) liquidated = true;
    run.recordLongMarginCompletion(result.completion, episode.episodeId);
    attemptsForEpisode[index] += 1;
    attemptsUsed += 1;
  }
  return { attemptsUsed, liquidated };
}

export function runOne(policy, seed, options = {}) {
  const actionLog = options.trace ? [] : null;
  // `options.regimeId` forces a specific regime (the pre-declared Gate F
  // MELT_UP comparator). Every comparator policy at a seed still gets the
  // byte-identical price path — only the seed selects the regime otherwise.
  const scenario = buildScenario(seed, options.regimeId ?? null);
  const runId = `ct-${policy.id}-${seed}${options.regimeId ? `-${options.regimeId}` : ''}`;
  const run = new SpotCareerRun({ sessionId: runId, startedAtMs: START_MS });
  const spotRng = makePrng(deriveSeed(seed, `${policy.id}:spot`));
  const memo = {};

  const unlocks = Object.fromEntries(TRACKED_SKILLS.map((skill) => [skill, null]));
  let trade = {};
  let prevPositionOpen = false;
  let consecutiveLosses = 0;
  let consecutiveWins = 0;
  let marginAttempts = 0;
  let marginLiquidated = false;
  let marginPhaseDone = false;
  let ticksUsed = 0;

  for (let tick = 0; tick <= MAX_TICKS; tick += 1) {
    ticksUsed = tick;
    if (run.hasSkill('SHORT')) break;
    if (run.acceptedActions >= MAX_ACTIONS) break;

    const observation = scenario.observationAt(tick);
    const eventTimeMs = scenario.eventTimeAt(tick);

    if (run.positionOpen) {
      run.mark(observation, eventTimeMs);
      recordUnlocks(run, tick, unlocks);
    }

    // position open/close transitions from the mark
    if (run.positionOpen && !prevPositionOpen) { trade = { openedTick: tick }; }
    if (!run.positionOpen && prevPositionOpen) {
      const summary = run.lastClosedSummary;
      if (summary) {
        if (summary.realizedPnlWei < 0n) { consecutiveLosses += 1; consecutiveWins = 0; }
        else { consecutiveWins += 1; consecutiveLosses = 0; }
        policy.onTradeClosed?.(memo, summary);
      }
      trade = {};
    }
    prevPositionOpen = run.positionOpen;

    // MARGIN training phase — run once, when MARGIN_2X first becomes available.
    if (run.hasSkill('MARGIN_2X') && !run.hasSkill('SHORT') && !marginPhaseDone) {
      const phase = runMarginPhase(run, runId, policy, scenario, tick, memo);
      marginAttempts += phase.attemptsUsed;
      marginLiquidated = marginLiquidated || phase.liquidated;
      marginPhaseDone = true;
      recordUnlocks(run, tick, unlocks);
      if (!run.hasSkill('SHORT')) break; // nothing further to unlock
    }

    const view = buildView(run, scenario, tick, memo, trade);
    view.consecutiveLosses = consecutiveLosses;
    view.consecutiveWins = consecutiveWins;
    const action = policy.decideSpot(spotRng, view);
    if (actionLog) {
      actionLog.push({
        tick,
        kind: action ? action.kind : 'WAIT',
        riskBps: action && action.riskBps !== undefined ? action.riskBps.toString() : null,
        stopPriceX18: action && action.stopPriceX18 !== undefined ? action.stopPriceX18.toString() : null,
        percent: action && action.percent !== undefined ? action.percent : null,
      });
    }

    if (action && action.kind !== 'WAIT') {
      const wasOpen = run.positionOpen;
      const result = run.apply(action, observation, eventTimeMs);
      recordUnlocks(run, tick, unlocks);

      if (!wasOpen && run.positionOpen) { trade = { openedTick: tick }; prevPositionOpen = true; }
      if (wasOpen && !run.positionOpen) {
        const summary = run.lastClosedSummary;
        if (summary) {
          if (summary.realizedPnlWei < 0n) { consecutiveLosses += 1; consecutiveWins = 0; }
          else { consecutiveWins += 1; consecutiveLosses = 0; }
          policy.onTradeClosed?.(memo, summary);
        }
        trade = {};
        prevPositionOpen = false;
      }
      void result;
    }

    if (run.wiped) break;
  }

  const finalEquityWei = run.equityWei;
  const finalEquityFrac = Number((finalEquityWei * 1_000_000n) / INITIAL_BANKROLL_WEI) / 1_000_000;

  return {
    agent: policy.id,
    policyVersion: policy.version,
    seed,
    regimeId: scenario.regimeId,
    priceDigest: scenario.priceDigest(),
    ticksUsed,
    actionsAccepted: run.acceptedActions,
    actionsRejected: run.rejectedActions,
    tradesClosed: run.tradesClosed,
    unlocks,
    reached: Object.fromEntries(TRACKED_SKILLS.map((skill) => [skill, run.hasSkill(skill)])),
    wiped: run.wiped,
    finalEquityWei: finalEquityWei.toString(),
    finalEquityFrac,
    maxAccountDrawdownBps: Number(run.maxDrawdownBps),
    tuningMaxAccountDrawdownBps: run.tuning.stats.maxAccountDrawdownBps,
    marginAttempts,
    marginLiquidated,
    tuningClosedSpotTrades: run.tuning.stats.closedSpotTrades,
    tuningStopPlannedTrades: run.tuning.stats.stopPlannedTrades,
    tuningPartialExits: run.tuning.stats.partialExitsUsed,
    tuningRiskPlannedTrades: run.tuning.stats.riskPlannedTrades,
    tuningQualifyingLongEpisodes: run.tuning.stats.qualifyingLongMarginEpisodeIds.length,
    riskBudgetViolations: run.tuning.stats.riskBudgetViolations,
    riskBudgetRespected: run.tuning.stats.riskBudgetsRespected,
    violatedRiskTrades: run.violatedRiskTrades,
    respectedRiskTrades: run.respectedRiskTrades,
    unverifiedRiskTrades: run.unverifiedRiskTrades,
    stopWidenCount: run.stopWidenCount,
    accountResets: run.tuning.stats.accountResetsUsed === null ? 'UNKNOWN' : run.tuning.stats.accountResetsUsed,
    receiptsAwarded: Object.values(run.tuning.receipts).reduce((sum, count) => sum + count, 0),
    finalSkills: [...run.tuning.unlockedSkills],
    // The REAL shipped reduceCareer, fed every derived event — must stay at
    // SPOT_BASIC (synthetic spot evidence is not gradable). Fail-closed proof.
    realCareerFinalSkills: [...run.career.unlockedSkills],
    ...(actionLog ? { actionLog } : {}),
  };
}
