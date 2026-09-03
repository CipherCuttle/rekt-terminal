/**
 * CAREER_TUNING_HARNESS_V0 — falsification gates.
 *
 * Each gate is evaluated on the deterministic aggregate. A gate that fails is a
 * successful outcome of this phase: it means the frozen numerical Career gates
 * are exploitable and the next bounded phase must tune them. This module never
 * changes a Career threshold; it only measures the shipped ones.
 */

const LATE_SKILLS = ['RISK_SIZING', 'MARGIN_2X', 'SHORT'];

function ratio(part, whole) {
  if (whole === 0) return part === 0 ? 0 : Infinity;
  return part / whole;
}

function notMoreReliable(challenger, disciplined, skills) {
  const offenders = skills.filter((skill) => challenger.unlockRate[skill] > disciplined.unlockRate[skill]);
  return { pass: offenders.length === 0, offenders };
}

function medianActions(agent, skill) {
  const stat = agent.actionsToUnlock[skill];
  return stat && stat.n > 0 ? stat.median : null;
}

export function evaluateGates(agents) {
  const disciplined = agents.DISCIPLINED;
  const overtrader = agents.OVERTRADER;
  const random = agents.RANDOM;
  const allIn = agents.ALL_IN;
  const widener = agents.STOP_WIDENER;
  const revenge = agents.REVENGE;

  const gates = {};

  /* GATE A — action volume */
  {
    const rel = notMoreReliable(overtrader, disciplined, LATE_SKILLS);
    gates.A = {
      name: 'ACTION_VOLUME',
      pass: rel.pass,
      detail: {
        overtraderUnlockRate: pickRates(overtrader, LATE_SKILLS),
        disciplinedUnlockRate: pickRates(disciplined, LATE_SKILLS),
        overtraderTradesClosedMedian: overtrader.tradesClosed.median,
        disciplinedTradesClosedMedian: disciplined.tradesClosed.median,
        offenders: rel.offenders,
      },
    };
  }

  /* GATE B — random speedrun */
  {
    const rel = notMoreReliable(random, disciplined, ['MARGIN_2X', 'SHORT']);
    const speedOffenders = [];
    for (const skill of ['MARGIN_2X', 'SHORT']) {
      const r = medianActions(random, skill);
      const d = medianActions(disciplined, skill);
      if (r !== null && d !== null && r < d) speedOffenders.push(skill);
    }
    gates.B = {
      name: 'RANDOM_SPEEDRUN',
      pass: rel.pass && speedOffenders.length === 0,
      detail: {
        randomUnlockRate: pickRates(random, LATE_SKILLS),
        disciplinedUnlockRate: pickRates(disciplined, LATE_SKILLS),
        randomActionsToMargin2x: random.actionsToUnlock.MARGIN_2X,
        disciplinedActionsToMargin2x: disciplined.actionsToUnlock.MARGIN_2X,
        reliabilityOffenders: rel.offenders,
        speedOffenders,
      },
    };
  }

  /* GATE C — reckless variance */
  {
    const rel = notMoreReliable(allIn, disciplined, LATE_SKILLS);
    const worseSurvival =
      allIn.wipeProbability >= disciplined.wipeProbability
      || allIn.finalEquityFrac.median <= disciplined.finalEquityFrac.median
      || allIn.maxAccountDrawdownBps.median >= disciplined.maxAccountDrawdownBps.median;
    // Falsified only if ALL_IN reaches late capabilities MORE reliably *and* has
    // materially worse process/survival.
    gates.C = {
      name: 'RECKLESS_VARIANCE',
      pass: rel.pass,
      detail: {
        allInUnlockRate: pickRates(allIn, LATE_SKILLS),
        disciplinedUnlockRate: pickRates(disciplined, LATE_SKILLS),
        allInWipeProbability: allIn.wipeProbability,
        disciplinedWipeProbability: disciplined.wipeProbability,
        allInFinalEquityFracMedian: allIn.finalEquityFrac.median,
        disciplinedFinalEquityFracMedian: disciplined.finalEquityFrac.median,
        allInMaxDrawdownBpsMedian: allIn.maxAccountDrawdownBps.median,
        disciplinedMaxDrawdownBpsMedian: disciplined.maxAccountDrawdownBps.median,
        allInHasWorseSurvival: worseSurvival,
        offenders: rel.offenders,
      },
    };
  }

  /* GATE D — stop discipline
   *
   * STOP_WIDENER must be *materially* disadvantaged at RISK_SIZING / MARGIN_2X
   * relative to DISCIPLINED. "Materially" is read as: challenger unlock rate no
   * more than half of DISCIPLINED's on BOTH skills. A widener that still
   * reaches RISK_SIZING at ~2/3 of DISCIPLINED's rate — because widening a stop
   * within the risk-budget tolerance leaves a trade closing RESPECTED, and
   * because the planned-stop count is cumulative with no recent-window — is a
   * falsification. */
  {
    const actuallyWidened = widener.stopWideningTotal > 0;
    const rsRatio = ratio(widener.unlockRate.RISK_SIZING, disciplined.unlockRate.RISK_SIZING);
    const m2Ratio = ratio(widener.unlockRate.MARGIN_2X, disciplined.unlockRate.MARGIN_2X);
    const disadvantaged =
      (disciplined.unlockRate.RISK_SIZING === 0 || rsRatio <= 0.5)
      && (disciplined.unlockRate.MARGIN_2X === 0 || m2Ratio <= 0.5);
    gates.D = {
      name: 'STOP_DISCIPLINE',
      pass: actuallyWidened && disadvantaged,
      detail: {
        stopWideningTotal: widener.stopWideningTotal,
        stopWideningRate: widener.stopWideningRate,
        widenerUnlockRate: pickRates(widener, ['RISK_SIZING', 'MARGIN_2X']),
        disciplinedUnlockRate: pickRates(disciplined, ['RISK_SIZING', 'MARGIN_2X']),
        riskSizingRatio: Number.isFinite(rsRatio) ? Math.round(rsRatio * 1000) / 1000 : 'INF',
        margin2xRatio: Number.isFinite(m2Ratio) ? Math.round(m2Ratio * 1000) / 1000 : 'INF',
        materialityThreshold: 0.5,
      },
    };
  }

  /* GATE E — revenge
   *
   * REVENGE escalates its account-risk budget after each realised loss. For the
   * gate to hold, that escalation must EITHER materially block its progression
   * (MARGIN_2X / SHORT rate <= half of DISCIPLINED's) OR remain visible to
   * qualification as recorded risk-budget violations / unverified exposure. A
   * revenge policy that reaches the late gates at DISCIPLINED-comparable rates
   * with zero recorded risk-budget violations — because choosing a larger frozen
   * budget up front is not a "breach" of that frozen budget — is a
   * falsification: the escalation is invisible and only the 20% drawdown cap,
   * which leaks, stands between it and leverage. */
  {
    const m2Ratio = ratio(revenge.unlockRate.MARGIN_2X, disciplined.unlockRate.MARGIN_2X);
    const shRatio = ratio(revenge.unlockRate.SHORT, disciplined.unlockRate.SHORT);
    const materiallyBlocked =
      (disciplined.unlockRate.MARGIN_2X === 0 || m2Ratio <= 0.5)
      && (disciplined.unlockRate.SHORT === 0 || shRatio <= 0.5);
    const escalationTraced = revenge.riskBudgetViolationTotal > 0 || revenge.unverifiedRiskTotal > 0;
    const speedOffenders = [];
    for (const skill of ['MARGIN_2X', 'SHORT']) {
      const r = medianActions(revenge, skill);
      const d = medianActions(disciplined, skill);
      if (r !== null && d !== null && r < d) speedOffenders.push(skill);
    }
    gates.E = {
      name: 'REVENGE',
      pass: (materiallyBlocked || escalationTraced) && speedOffenders.length === 0,
      detail: {
        revengeUnlockRate: pickRates(revenge, LATE_SKILLS),
        disciplinedUnlockRate: pickRates(disciplined, LATE_SKILLS),
        margin2xRatio: Number.isFinite(m2Ratio) ? Math.round(m2Ratio * 1000) / 1000 : 'INF',
        shortRatio: Number.isFinite(shRatio) ? Math.round(shRatio * 1000) / 1000 : 'INF',
        materiallyBlocked,
        revengeRiskBudgetViolationTotal: revenge.riskBudgetViolationTotal,
        revengeUnverifiedRiskTotal: revenge.unverifiedRiskTotal,
        escalationTracedToQualification: escalationTraced,
        revengeMaxDrawdownBpsMedian: revenge.maxAccountDrawdownBps.median,
        disciplinedMaxDrawdownBpsMedian: disciplined.maxAccountDrawdownBps.median,
        speedOffenders,
      },
    };
  }

  /* GATE F — disciplined losses */
  {
    const downRegimes = ['BEAR', 'SHOCK_DOWN', 'HIGH_VOL'];
    const downRecords = disciplined._records.filter((record) => downRegimes.includes(record.regimeId));
    const losingButProgressed = disciplined._records.filter(
      (record) => record.finalEquityFrac < 1 && record.reached.MARGIN_2X,
    );
    const downMargin2xRate = downRecords.length
      ? downRecords.filter((record) => record.reached.MARGIN_2X).length / downRecords.length
      : 0;
    const downMedianEquity = median(downRecords.map((record) => record.finalEquityFrac));
    gates.F = {
      name: 'DISCIPLINED_LOSSES',
      pass: losingButProgressed.length > 0 && downMargin2xRate >= 0.8 && downMedianEquity < 1,
      detail: {
        downRegimeRuns: downRecords.length,
        downRegimeMargin2xUnlockRate: round(downMargin2xRate),
        downRegimeMedianFinalEquityFrac: round(downMedianEquity),
        runsThatLostMoneybutReachedMargin2x: losingButProgressed.length,
      },
    };
  }

  /* GATE G — spam does not create authority */
  {
    const volumeAgents = ['OVERTRADER', 'ALL_IN', 'RANDOM'];
    const offenders = [];
    for (const id of volumeAgents) {
      for (const skill of LATE_SKILLS) {
        if (agents[id].unlockRate[skill] > disciplined.unlockRate[skill]) offenders.push(`${id}:${skill}`);
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
        offenders,
      },
    };
  }

  const failing = Object.entries(gates).filter(([, gate]) => !gate.pass).map(([key]) => key);
  return {
    gates,
    failing,
    verdict: failing.length === 0 ? 'PASS' : 'FALSIFIED',
  };
}

function pickRates(agent, skills) {
  return Object.fromEntries(skills.map((skill) => [skill, agent.unlockRate[skill]]));
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
