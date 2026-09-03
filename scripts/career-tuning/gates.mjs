/**
 * CAREER_TUNING_HARNESS_V0 — falsification gates.
 *
 * ## The frozen criterion (PROJECT_PLAN_V2 §6.1) — verbatim
 *
 *   > Reckless / high-frequency / high-variance agents must not reach
 *   > RISK_SIZING, MARGIN_2X, or SHORT faster than DISCIPLINED behavior in
 *   > expectation. A disciplined losing run must not be graded as worse process
 *   > than a reckless lucky winning run.
 *
 * That is the whole acceptance test. This module invents NO materiality
 * threshold. The earlier committed harness declared D / E failures against an
 * unauthorised "0.5x DISCIPLINED unlock rate" bar — removed (FINDING 2).
 *
 * ## Primary metric — BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK
 *
 * For each policy and skill, over the SAME full committed seed set: mean of
 * (accepted actions at unlock) with non-unlock counted as `MAX_ACTIONS + 1`
 * (`config.NON_UNLOCK_ACTION_VALUE`). It folds unlock probability and unlock
 * speed into one survivor-bias-free number. An adversary falsifies the speed
 * criterion for a skill ONLY IF its bounded-expected value is strictly LOWER
 * than DISCIPLINED's. Unlock rate and conditional median are reported as
 * descriptive context, never as the gate.
 *
 * A gate that fails is a successful outcome of this phase for the criterion it
 * tests. This module never changes a Career threshold; it only measures the
 * shipped ones (via the `TUNING_ANALYSIS_ONLY` evaluator).
 */
import { LATE_UNLOCK_SKILLS } from './config.mjs';

const LATE_SKILLS = LATE_UNLOCK_SKILLS;

function pickRates(agent, skills) {
  return Object.fromEntries(skills.map((skill) => [skill, agent.unlockRate[skill]]));
}
function pickBea(agent, skills) {
  return Object.fromEntries(skills.map((skill) => [skill, agent.boundedExpectedActionsToUnlock[skill]]));
}
function pickCondMedian(agent, skills) {
  return Object.fromEntries(skills.map((skill) => [skill, agent.conditionalMedianActionsToUnlock[skill]]));
}
function round(value) {
  return value === null || value === undefined ? null : Math.round(value * 10000) / 10000;
}
function median(numbers) {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The core comparison. Returns the skills (if any) on which `challenger` is
 * FASTER IN EXPECTATION than `disciplined` — i.e. strictly lower bounded
 * expected actions-to-unlock. A non-empty list falsifies the frozen speed
 * criterion for this adversary.
 */
function fasterInExpectation(challenger, disciplined, skills) {
  const offenders = [];
  for (const skill of skills) {
    const c = challenger.boundedExpectedActionsToUnlock[skill];
    const d = disciplined.boundedExpectedActionsToUnlock[skill];
    if (c === null || d === null) continue;
    if (c < d) offenders.push({ skill, challenger: c, disciplined: d });
  }
  return offenders;
}

/** Descriptive-only observation record for D / E behaviour that looks
 *  undesirable but does NOT falsify the frozen criterion. */
function observation(text) {
  return { classification: 'OBSERVATION / FUTURE DESIGN-TUNING RISK', note: text };
}

function speedGate(name, challenger, disciplined, skills, extraDetail = {}) {
  const speedOffenders = fasterInExpectation(challenger, disciplined, skills);
  return {
    name,
    pass: speedOffenders.length === 0,
    detail: {
      primaryMetric: 'BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK',
      challengerBoundedExpectedActions: pickBea(challenger, skills),
      disciplinedBoundedExpectedActions: pickBea(disciplined, skills),
      speedOffenders,
      descriptiveUnlockRate: pickRates(challenger, skills),
      descriptiveDisciplinedUnlockRate: pickRates(disciplined, skills),
      descriptiveConditionalMedianActions: pickCondMedian(challenger, skills),
      ...extraDetail,
    },
  };
}

/**
 * @param agents         per-policy aggregates over the MAIN 128-seed matrix
 * @param comparator     { disciplined, recklessWinners, recklessAgents, seedCount }
 *                       aggregates over the PRE-DECLARED Gate F MELT_UP matrix
 */
export function evaluateGates(agents, comparator) {
  const disciplined = agents.DISCIPLINED;
  const overtrader = agents.OVERTRADER;
  const random = agents.RANDOM;
  const allIn = agents.ALL_IN;
  const widener = agents.STOP_WIDENER;
  const revenge = agents.REVENGE;

  const gates = {};

  /* GATE A — action volume (OVERTRADER) */
  gates.A = speedGate('ACTION_VOLUME', overtrader, disciplined, LATE_SKILLS, {
    overtraderTradesClosedMedian: overtrader.tradesClosed.median,
    disciplinedTradesClosedMedian: disciplined.tradesClosed.median,
  });

  /* GATE B — random speedrun (RANDOM) */
  gates.B = speedGate('RANDOM_SPEEDRUN', random, disciplined, LATE_SKILLS);

  /* GATE C — reckless variance (ALL_IN) */
  {
    const g = speedGate('RECKLESS_VARIANCE', allIn, disciplined, LATE_SKILLS, {
      allInWipeProbability: allIn.wipeProbability,
      disciplinedWipeProbability: disciplined.wipeProbability,
      allInFinalEquityFracMedian: allIn.finalEquityFrac.median,
      disciplinedFinalEquityFracMedian: disciplined.finalEquityFrac.median,
      allInMaxDrawdownBpsMedian: allIn.maxAccountDrawdownBps.median,
      disciplinedMaxDrawdownBpsMedian: disciplined.maxAccountDrawdownBps.median,
    });
    gates.C = g;
  }

  /* GATE D — stop discipline (STOP_WIDENER)
   *
   * Frozen test: does STOP_WIDENER reach RISK_SIZING / MARGIN_2X / SHORT FASTER
   * IN EXPECTATION than DISCIPLINED? If not, it does not falsify the criterion —
   * even though it often reaches late skills, which is a real FUTURE TUNING RISK
   * (RISK_SIZING has no recent-window; the MARGIN_2X recent-risk check ignores
   * `stopWidened`). Those are recorded as OBSERVATIONS, not a failed gate. */
  {
    const g = speedGate('STOP_DISCIPLINE', widener, disciplined, LATE_SKILLS, {
      stopWideningTotal: widener.stopWideningTotal,
      stopWideningRate: widener.stopWideningRate,
    });
    g.observations = [];
    if (widener.unlockRate.RISK_SIZING > 0.5) {
      g.observations.push(observation(
        `STOP_WIDENER still reaches RISK_SIZING in ${(widener.unlockRate.RISK_SIZING * 100).toFixed(0)}% of runs `
        + `(vs DISCIPLINED ${(disciplined.unlockRate.RISK_SIZING * 100).toFixed(0)}%) because the RISK_SIZING planned-stop `
        + `count is cumulative with no recent/clean-rate window. It is SLOWER in expectation `
        + `(${widener.boundedExpectedActionsToUnlock.RISK_SIZING} vs ${disciplined.boundedExpectedActionsToUnlock.RISK_SIZING} actions), so this is not a §6.1 falsification.`));
    }
    if (widener.unlockRate.MARGIN_2X > 0) {
      g.observations.push(observation(
        `A widen that stays inside RISK_BUDGET_TOLERANCE_BPS still closes RESPECTED, and evaluateMargin2x never `
        + `consults summary.stopWidened, so STOP_WIDENER reaches MARGIN_2X in ${(widener.unlockRate.MARGIN_2X * 100).toFixed(0)}% `
        + `of runs — but at ${widener.boundedExpectedActionsToUnlock.MARGIN_2X} bounded-expected actions vs DISCIPLINED's `
        + `${disciplined.boundedExpectedActionsToUnlock.MARGIN_2X}. Slower, not faster.`));
    }
    gates.D = g;
  }

  /* GATE E — revenge (REVENGE)
   *
   * Frozen test: does raising the account-risk budget after each loss let
   * REVENGE reach the late gates FASTER IN EXPECTATION than DISCIPLINED? If not,
   * it does not falsify §6.1. The fact that up-front budget escalation leaves no
   * RISK_BUDGET_VIOLATED trace is a real FUTURE TUNING RISK, recorded as an
   * OBSERVATION. */
  {
    const g = speedGate('REVENGE', revenge, disciplined, LATE_SKILLS, {
      revengeRiskBudgetViolationTotal: revenge.riskBudgetViolationTotal,
      revengeUnverifiedRiskTotal: revenge.unverifiedRiskTotal,
      revengeMaxDrawdownBpsMedian: revenge.maxAccountDrawdownBps.median,
      disciplinedMaxDrawdownBpsMedian: disciplined.maxAccountDrawdownBps.median,
    });
    g.observations = [];
    if (revenge.unlockRate.MARGIN_2X > 0.15 && revenge.riskBudgetViolationTotal === 0) {
      g.observations.push(observation(
        `REVENGE raises its next-plan account-risk budget after every loss and still reaches MARGIN_2X/SHORT in `
        + `~${(revenge.unlockRate.MARGIN_2X * 100).toFixed(0)}% of runs with ${revenge.riskBudgetViolationTotal} recorded `
        + `risk-budget violations, because RISK_BUDGET_VIOLATED only fires on a post-freeze breach of a plan's own budget. `
        + `But its bounded-expected actions to MARGIN_2X (${revenge.boundedExpectedActionsToUnlock.MARGIN_2X}) and SHORT `
        + `(${revenge.boundedExpectedActionsToUnlock.SHORT}) are both HIGHER than DISCIPLINED's `
        + `(${disciplined.boundedExpectedActionsToUnlock.MARGIN_2X} / ${disciplined.boundedExpectedActionsToUnlock.SHORT}). `
        + `Slower in expectation — not a §6.1 falsification, a tuning risk for the drawdown cap.`));
    }
    gates.E = g;
  }

  /* GATE F — disciplined losing process vs reckless lucky winning process
   *
   * Requires an ACTUAL reckless profitable comparator (FINDING 3). The
   * pre-declared MELT_UP comparator matrix supplies it. Without a reckless
   * winner the gate is UNTESTED — never PASS. */
  {
    const downRegimes = ['BEAR', 'SHOCK_DOWN', 'HIGH_VOL'];
    const downRecords = disciplined._records.filter((record) => downRegimes.includes(record.regimeId));
    const disciplinedLosersProgressed = disciplined._records.filter(
      (record) => record.finalEquityFrac < 1 && record.reached.MARGIN_2X,
    );
    const downMargin2xRate = downRecords.length
      ? downRecords.filter((record) => record.reached.MARGIN_2X).length / downRecords.length
      : 0;
    const downMedianEquity = median(downRecords.map((record) => record.finalEquityFrac));

    const winners = comparator ? comparator.recklessWinners : [];
    const winnerReachedLate = winners.filter(
      (record) => record.reached.RISK_SIZING || record.reached.MARGIN_2X || record.reached.SHORT,
    );
    const winnerFasterThanDisciplined = winners.filter((record) => {
      for (const skill of LATE_SKILLS) {
        if (!record.reached[skill] || !record.unlocks[skill]) continue;
        const d = disciplined.boundedExpectedActionsToUnlock[skill];
        if (d !== null && record.unlocks[skill].actions < d) return true;
      }
      return false;
    });

    const disciplinedProcessOk = disciplinedLosersProgressed.length > 0
      && downMargin2xRate >= 0.8 && downMedianEquity !== null && downMedianEquity < 1;
    const comparatorExercised = winners.length > 0;
    const positivePnlBoughtNoProgress = winnerReachedLate.length === 0 && winnerFasterThanDisciplined.length === 0;

    let status;
    let pass;
    if (!comparatorExercised) {
      status = 'UNTESTED';
      pass = false;
    } else {
      status = disciplinedProcessOk && positivePnlBoughtNoProgress ? 'PASS' : 'FAIL';
      pass = status === 'PASS';
    }

    gates.F = {
      name: 'DISCIPLINED_LOSS_VS_RECKLESS_WINNER',
      pass,
      status,
      detail: {
        comparatorRegime: 'MELT_UP',
        comparatorSeedCount: comparator ? comparator.seedCount : 0,
        comparatorPolicies: comparator ? comparator.recklessAgents : [],
        recklessLuckyWinnerRuns: winners.length,
        recklessLuckyWinnerExamples: winners.slice(0, 5).map((record) => ({
          agent: record.agent,
          seed: record.seed,
          finalEquityFrac: Math.round(record.finalEquityFrac * 10000) / 10000,
          maxAccountDrawdownBps: record.maxAccountDrawdownBps,
          reached: record.reached,
        })),
        recklessWinnersReachingRiskSizingOrLater: winnerReachedLate.length,
        recklessWinnersFasterThanDisciplined: winnerFasterThanDisciplined.length,
        disciplinedDownRegimeRuns: downRecords.length,
        disciplinedDownRegimeMargin2xUnlockRate: round(downMargin2xRate),
        disciplinedDownRegimeMedianFinalEquityFrac: round(downMedianEquity),
        disciplinedLosingRunsThatReachedMargin2x: disciplinedLosersProgressed.length,
        disciplinedProcessOk,
        positivePnlBoughtNoProgress,
      },
    };
  }

  /* GATE G — spam does not create authority (OVERTRADER + all volume agents) */
  {
    const volumeAgents = ['OVERTRADER', 'ALL_IN', 'RANDOM'];
    const offenders = [];
    for (const id of volumeAgents) {
      for (const skill of LATE_SKILLS) {
        if (fasterInExpectation(agents[id], disciplined, [skill]).length > 0) offenders.push(`${id}:${skill}`);
      }
    }
    gates.G = {
      name: 'SPAM_NO_AUTHORITY',
      pass: overtrader.unlockRate.RISK_SIZING === 0
        && overtrader.unlockRate.MARGIN_2X === 0
        && overtrader.unlockRate.SHORT === 0
        && offenders.length === 0,
      detail: {
        overtraderActionsAcceptedMedian: overtrader.actionsAccepted.median,
        overtraderActionsRejectedMedian: overtrader.actionsRejected.median,
        overtraderTradesClosedMedian: overtrader.tradesClosed.median,
        overtraderLateUnlockRate: pickRates(overtrader, LATE_SKILLS),
        speedOffenders: offenders,
      },
    };
  }

  const failing = Object.entries(gates).filter(([, gate]) => !gate.pass).map(([key]) => key);
  const gateFUntested = gates.F.status === 'UNTESTED';
  let verdict;
  if (gateFUntested) verdict = 'HARNESS_EVIDENCE_INCOMPLETE';
  else if (failing.length === 0) verdict = 'PASS';
  else verdict = 'FALSIFIED';

  return { gates, failing, verdict };
}
