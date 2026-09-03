#!/usr/bin/env node
/**
 * CAREER_TUNING_HARNESS_V0 — headless adversarial Career tuning harness.
 *
 * Purpose: attempt to FALSIFY the shipped, frozen numerical Career gates
 * (SPOT_BASIC -> SCALE_CONTROL -> STOP_LOSS -> RISK_SIZING -> MARGIN_2X ->
 * SHORT) with deterministic adversarial policy agents. It runs entirely offline
 * under Node, drives the REAL shipped simulator math and the REAL shipped Career
 * reducer, changes no Career threshold, and adds no Career authority path.
 *
 * Usage:
 *   node scripts/sim-career-agents.mjs            human summary + gate table
 *   node scripts/sim-career-agents.mjs --json     print the full receipt JSON
 *   node scripts/sim-career-agents.mjs --write    write docs/CAREER_TUNING_HARNESS_V0_RECEIPT.json
 *   node scripts/sim-career-agents.mjs --check    fail if the receipt digest drifted
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runOne } from './career-tuning/harness.mjs';
import { POLICIES, POLICY_BY_ID } from './career-tuning/policies.mjs';
import { aggregateAgent, aggregateByRegime, digestOf } from './career-tuning/metrics.mjs';
import { evaluateGates } from './career-tuning/gates.mjs';
import {
  BASE_COMMIT,
  CAREER_CONSTANTS,
  GATE_F_COMPARATOR_POLICIES,
  GATE_F_REGIME,
  GATE_F_SEEDS,
  HARNESS_VERSION,
  LATE_UNLOCK_SKILLS,
  MAX_ACTIONS,
  MAX_TICKS,
  NON_UNLOCK_ACTION_VALUE,
  POLICY_SET_VERSION,
  PRIMARY_METRIC,
  SCENARIO_MODEL_VERSION,
  SEEDS,
  SEED_BASE,
  SEED_COUNT,
  SIM_MODEL_VERSIONS,
  TRACKED_SKILLS,
  TUNING_EVIDENCE_POLICY,
} from './career-tuning/config.mjs';

// Absolute floor used ONLY to classify the comparator population as "reckless"
// (a run that ends in profit but only after a large equity swing). It is not a
// pass/fail bar on the frozen §6.1 criterion: Gate F's verdict rests on whether
// the selected reckless winners progress farther/faster than DISCIPLINED, which
// they do not for any floor in a wide range — ALL_IN comparator winners sit at
// ~1340 bps drawdown and reach only SCALE_CONTROL.
const GATE_F_DRAWDOWN_FLOOR_BPS = 800;

function medianOf(numbers) {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const RECEIPT_PATH = path.join(ROOT, 'docs', 'CAREER_TUNING_HARNESS_V0_RECEIPT.json');

const SEED_GENERATOR = 'SEEDS[i] = SEED_BASE + i * 7 for i in 0..127';

function seedDigest() {
  return digestOf({ base: SEED_BASE, count: SEED_COUNT, generator: SEED_GENERATOR, seeds: SEEDS });
}

function compactRun(record) {
  return {
    agent: record.agent,
    seed: record.seed,
    regimeId: record.regimeId,
    ticksUsed: record.ticksUsed,
    actionsAccepted: record.actionsAccepted,
    actionsRejected: record.actionsRejected,
    tradesClosed: record.tradesClosed,
    reached: record.reached,
    unlockActions: Object.fromEntries(
      TRACKED_SKILLS.map((skill) => [skill, record.unlocks[skill] ? record.unlocks[skill].actions : null]),
    ),
    unlockTrades: Object.fromEntries(
      TRACKED_SKILLS.map((skill) => [skill, record.unlocks[skill] ? record.unlocks[skill].trades : null]),
    ),
    wiped: record.wiped,
    finalEquityFrac: Math.round(record.finalEquityFrac * 10000) / 10000,
    maxAccountDrawdownBps: record.maxAccountDrawdownBps,
    tuningMaxAccountDrawdownBps: record.tuningMaxAccountDrawdownBps,
    marginAttempts: record.marginAttempts,
    marginLiquidated: record.marginLiquidated,
    riskBudgetViolations: record.riskBudgetViolations,
    unverifiedRiskTrades: record.unverifiedRiskTrades,
    stopWidenCount: record.stopWidenCount,
    accountResets: record.accountResets,
    receiptsAwarded: record.receiptsAwarded,
  };
}

function stripInternal(agentAggregates) {
  const out = {};
  for (const [id, aggregate] of Object.entries(agentAggregates)) {
    const clone = { ...aggregate };
    delete clone._records;
    out[id] = clone;
  }
  return out;
}

/**
 * The pre-declared Gate F comparator matrix (FINDING 3). Every comparator
 * policy trades the byte-identical MELT_UP price path at a seed; the regime is
 * committed in `config.mjs` before any policy runs. A "reckless lucky winner" is
 * a non-DISCIPLINED run that (a) ended above starting equity and (b) ran a
 * materially worse process than DISCIPLINED on that same favourable tape —
 * larger drawdown than the DISCIPLINED comparator median AND above an absolute
 * recklessness floor. Nothing hands a policy future information, special prices,
 * or a set final equity.
 */
function runGateFComparator() {
  const records = [];
  for (const policyId of GATE_F_COMPARATOR_POLICIES) {
    for (const seed of GATE_F_SEEDS) {
      records.push(runOne(POLICY_BY_ID[policyId], seed, { regimeId: GATE_F_REGIME.id }));
    }
  }
  const disciplinedRecords = records.filter((record) => record.agent === 'DISCIPLINED');
  const disciplinedDrawdownMedian = medianOf(disciplinedRecords.map((record) => record.maxAccountDrawdownBps)) ?? 0;
  const recklessWinners = records.filter((record) => record.agent !== 'DISCIPLINED'
    && record.finalEquityFrac > 1
    && record.maxAccountDrawdownBps >= GATE_F_DRAWDOWN_FLOOR_BPS
    && record.maxAccountDrawdownBps > disciplinedDrawdownMedian);
  return {
    records,
    seedCount: GATE_F_SEEDS.length,
    recklessAgents: GATE_F_COMPARATOR_POLICIES.filter((id) => id !== 'DISCIPLINED'),
    disciplined: aggregateAgent(disciplinedRecords),
    disciplinedDrawdownMedian,
    recklessWinners,
  };
}

export function runMatrix() {
  const records = [];
  for (const policy of POLICIES) {
    for (const seed of SEEDS) {
      records.push(runOne(policy, seed));
    }
  }

  const agentAggregates = {};
  for (const policy of POLICIES) {
    agentAggregates[policy.id] = aggregateAgent(records.filter((record) => record.agent === policy.id));
  }

  const comparator = runGateFComparator();
  const gateResult = evaluateGates(agentAggregates, comparator);
  const byRegime = {};
  for (const policy of POLICIES) {
    byRegime[policy.id] = aggregateByRegime(records.filter((record) => record.agent === policy.id));
  }

  // The verdict is derived ONLY from the canonical §6.1 gates (see gates.mjs).
  const thresholdVerdict = gateResult.verdict === 'PASS'
    ? 'EVIDENCE_SUPPORTED_V0'
    : gateResult.verdict; // FALSIFIED | HARNESS_EVIDENCE_INCOMPLETE

  // Non-falsifying facts worth carrying forward for a LATER bounded tuning phase.
  // These are OBSERVATIONS / FUTURE DESIGN-TUNING RISKS, not gate failures: under
  // the frozen BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK metric every adversary is
  // slower in expectation than DISCIPLINED. This phase implements none of them.
  const random = agentAggregates.RANDOM;
  const disciplined = agentAggregates.DISCIPLINED;
  const widener = agentAggregates.STOP_WIDENER;
  const revenge = agentAggregates.REVENGE;
  const observations = [];
  if (widener.unlockRate.RISK_SIZING > 0 || random.unlockRate.RISK_SIZING > 0) {
    observations.push({
      id: 'RISK_SIZING_NO_RECENT_WINDOW',
      classification: 'FUTURE DESIGN-TUNING RISK',
      observedBy: ['RANDOM', 'STOP_WIDENER'],
      finding: `RISK_SIZING counts 3 planned-stop trades + 1 partial exit cumulatively over all history, with no recency and no clean-rate requirement. RANDOM reaches it in ${(random.unlockRate.RISK_SIZING * 100).toFixed(0)}% of runs and a realistic STOP_WIDENER in ${(widener.unlockRate.RISK_SIZING * 100).toFixed(0)}% — but both SLOWER in expectation than DISCIPLINED (bounded-expected actions ${random.boundedExpectedActionsToUnlock.RISK_SIZING} / ${widener.boundedExpectedActionsToUnlock.RISK_SIZING} vs ${disciplined.boundedExpectedActionsToUnlock.RISK_SIZING}). Not a §6.1 falsification.`,
      candidateRepairForALaterPhase: 'Add a recent-window + clean-rate rule to the RISK_SIZING planned-stop requirement, mirroring MARGIN_2X’s recent-3-RESPECTED rule.',
    });
  }
  if (widener.unlockRate.MARGIN_2X > 0) {
    observations.push({
      id: 'MARGIN_2X_RECENT_RISK_IGNORES_WIDENING',
      classification: 'FUTURE DESIGN-TUNING RISK',
      observedBy: ['STOP_WIDENER'],
      finding: `A risk-planned trade whose protective stop was WIDENED still closes RESPECTED (and counts toward MARGIN_2X’s recent-3) whenever the widen stays inside RISK_BUDGET_TOLERANCE_BPS; evaluateMargin2x never consults summary.stopWidened. STOP_WIDENER reaches MARGIN_2X in ${(widener.unlockRate.MARGIN_2X * 100).toFixed(0)}% of runs but at ${widener.boundedExpectedActionsToUnlock.MARGIN_2X} bounded-expected actions vs DISCIPLINED’s ${disciplined.boundedExpectedActionsToUnlock.MARGIN_2X}. Slower, not faster.`,
      candidateRepairForALaterPhase: 'Classify a trade with summary.stopWidened === true as not-RESPECTED in recentRiskPlannedOutcomes, or add a "no STOP_WIDENED in the recent-N risk-planned trades" clause to evaluateMargin2x.',
    });
  }
  if (revenge.unlockRate.MARGIN_2X > 0.15 && revenge.riskBudgetViolationTotal === 0) {
    observations.push({
      id: 'RISK_BUDGET_ESCALATION_INVISIBLE',
      classification: 'FUTURE DESIGN-TUNING RISK',
      observedBy: ['REVENGE'],
      finding: `RISK_BUDGET_VIOLATED fires only on a post-freeze breach of a FROZEN plan’s own budget. Raising the account-risk budget of the NEXT fresh plan after a loss is a fully-RESPECTED trade. REVENGE escalates after every loss and reaches MARGIN_2X in ${(revenge.unlockRate.MARGIN_2X * 100).toFixed(0)}% / SHORT in ${(revenge.unlockRate.SHORT * 100).toFixed(0)}% of runs with ${revenge.riskBudgetViolationTotal} recorded violations — but SLOWER in expectation than DISCIPLINED (MARGIN_2X ${revenge.boundedExpectedActionsToUnlock.MARGIN_2X} vs ${disciplined.boundedExpectedActionsToUnlock.MARGIN_2X}; SHORT ${revenge.boundedExpectedActionsToUnlock.SHORT} vs ${disciplined.boundedExpectedActionsToUnlock.SHORT}). Not a §6.1 falsification; a resilience risk for the 20% drawdown cap.`,
      candidateRepairForALaterPhase: 'Record a discipline signal that a risk-planned trade’s maxLossBpsOfEquity rose vs the trailing baseline after a losing trade, and gate MARGIN_2X on its absence in the recent-N risk-planned trades; and/or tighten MARGIN_2X_DRAWDOWN_LIMIT_BPS.',
    });
  }

  const receiptBody = {
    harnessVersion: HARNESS_VERSION,
    baseCommit: BASE_COMMIT,
    policySetVersion: POLICY_SET_VERSION,
    scenarioModelVersion: SCENARIO_MODEL_VERSION,
    scenarioClass: 'TUNING_SYNTHETIC',
    // FINDING 1: synthetic facts enter the sim honestly labelled SYNTHETIC under
    // DEMO_ALLOW_SYNTHETIC; progression is scored by the non-authoritative
    // TUNING_ANALYSIS_ONLY evaluator, never by a weakened production gate.
    syntheticAnalysisBoundary: {
      spotObservationProvenance: 'SYNTHETIC',
      simulatorEvidencePolicy: TUNING_EVIDENCE_POLICY,
      progressionAuthority: 'TUNING_ANALYSIS_ONLY',
      productionCareerGradesSyntheticSpotEvidence: false,
      syntheticRelabelledToDerived: false,
      marginEpisodeMarketProvenance: 'DERIVED',
      note: 'Answers "how would the current numerical qualification rules respond to these simulator-produced synthetic outcomes" — NOT "production Career would grade this synthetic evidence".',
    },
    primaryFalsificationMetric: {
      metric: PRIMARY_METRIC,
      nonUnlockActionValue: NON_UNLOCK_ACTION_VALUE,
      skills: LATE_UNLOCK_SKILLS,
      rule: 'An adversary falsifies §6.1 for a skill iff its full-seed-set mean bounded-expected actions-to-unlock is strictly LOWER than DISCIPLINED’s. No materiality threshold.',
    },
    careerScore: 'NOT_IMPLEMENTED',
    careerConstantsSnapshot: CAREER_CONSTANTS,
    simulatorModelVersions: SIM_MODEL_VERSIONS,
    seedSet: {
      base: SEED_BASE,
      count: SEED_COUNT,
      generator: SEED_GENERATOR,
      digest: seedDigest(),
    },
    matrix: {
      agents: POLICIES.map((policy) => policy.id),
      policyVersions: Object.fromEntries(POLICIES.map((policy) => [policy.id, policy.version])),
      seedsPerAgent: SEED_COUNT,
      totalRuns: records.length,
      maxTicksPerRun: MAX_TICKS,
      maxActionsPerRun: MAX_ACTIONS,
    },
    gateFComparator: {
      regime: GATE_F_REGIME,
      seeds: GATE_F_SEEDS,
      policies: GATE_F_COMPARATOR_POLICIES,
      totalRuns: comparator.records.length,
      disciplinedDrawdownMedianBps: comparator.disciplinedDrawdownMedian,
      recklessLuckyWinnerRuns: comparator.recklessWinners.length,
      recklessLuckyWinners: comparator.recklessWinners.map(compactRun),
    },
    agents: stripInternal(agentAggregates),
    byRegime,
    falsificationGates: gateResult.gates,
    failingGates: gateResult.failing,
    gateVerdict: gateResult.verdict,
    thresholdVerdict,
    observations,
    perRun: records.map(compactRun),
    gateFComparatorPerRun: comparator.records.map(compactRun),
  };

  const digest = digestOf(receiptBody);
  return { records, agentAggregates, comparator, gateResult, receipt: { ...receiptBody, deterministicArtifactDigest: digest } };
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                         */
/* -------------------------------------------------------------------------- */

function fmtPct(value) {
  return value === null || value === undefined ? '   -  ' : `${(value * 100).toFixed(1).padStart(5)}%`;
}

function printSummary(result) {
  const { agentAggregates, gateResult, receipt } = result;
  console.log(`\n${HARNESS_VERSION}  base=${BASE_COMMIT.slice(0, 12)}  runs=${receipt.matrix.totalRuns}  (${SEED_COUNT} seeds x ${POLICIES.length} agents)`);
  console.log(`scenario=${SCENARIO_MODEL_VERSION} [TUNING_SYNTHETIC]   CAREER_SCORE=NOT_IMPLEMENTED\n`);

  const header = ['agent'.padEnd(12), ...TRACKED_SKILLS.map((s) => s.slice(0, 8).padStart(8)), '  wipe', ' liq', ' eqMed', ' ddMed', ' viol'];
  console.log(header.join(' '));
  for (const policy of POLICIES) {
    const a = agentAggregates[policy.id];
    const row = [
      policy.id.padEnd(12),
      ...TRACKED_SKILLS.map((skill) => fmtPct(a.unlockRate[skill])),
      fmtPct(a.wipeProbability),
      fmtPct(a.liquidationRate),
      String(a.finalEquityFrac.median).padStart(6),
      String(a.maxAccountDrawdownBps.median).padStart(6),
      String(a.riskBudgetViolationTotal).padStart(5),
    ];
    console.log(row.join(' '));
  }

  console.log('\nprimary metric = BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK (non-unlock = MAX_ACTIONS+1); lower = faster in expectation');
  console.log(['agent'.padEnd(12), ...LATE_UNLOCK_SKILLS.map((s) => s.slice(0, 10).padStart(10))].join(' '));
  for (const policy of POLICIES) {
    const a = agentAggregates[policy.id];
    console.log([policy.id.padEnd(12), ...LATE_UNLOCK_SKILLS.map((s) => String(a.boundedExpectedActionsToUnlock[s]).padStart(10))].join(' '));
  }

  console.log(`\ngate F comparator (${receipt.gateFComparator.regime.id}): `
    + `${receipt.gateFComparator.recklessLuckyWinnerRuns} reckless lucky-winner runs `
    + `over ${receipt.gateFComparator.totalRuns} comparator runs`);

  console.log('\nfalsification gates:');
  for (const [key, gate] of Object.entries(gateResult.gates)) {
    const verdict = gate.status ?? (gate.pass ? 'PASS' : 'FAIL');
    console.log(`  GATE ${key} ${gate.name.padEnd(34)} ${verdict}`);
  }
  console.log(`\ngateVerdict = ${gateResult.verdict}`);
  console.log(`thresholdVerdict = ${receipt.thresholdVerdict}`);
  console.log(`deterministicArtifactDigest = ${receipt.deterministicArtifactDigest}`);
  console.log(`\nCAREER_TUNING_HARNESS_V0 = ${gateResult.verdict}`);
}

/**
 * Pretty JSON, but with every `perRun` record collapsed onto a single line so
 * the committed receipt is diff-legible instead of ~30k lines. Formatting does
 * not affect `deterministicArtifactDigest` (computed from the object, not the
 * text) and `--check` re-parses with JSON.parse.
 */
function renderReceipt(receipt) {
  const { perRun, gateFComparatorPerRun, ...rest } = receipt;
  const head = JSON.stringify(rest, null, 2);
  const rows = perRun.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  const comparatorRows = gateFComparatorPerRun.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  return `${head.slice(0, -2)},\n  "perRun": [\n${rows}\n  ],\n  "gateFComparatorPerRun": [\n${comparatorRows}\n  ]\n}\n`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const result = runMatrix();

  if (args.has('--json')) {
    process.stdout.write(renderReceipt(result.receipt));
    return;
  }

  if (args.has('--write')) {
    fs.writeFileSync(RECEIPT_PATH, renderReceipt(result.receipt));
    console.log(`wrote ${path.relative(ROOT, RECEIPT_PATH)}  digest=${result.receipt.deterministicArtifactDigest}`);
    printSummary(result);
    return;
  }

  if (args.has('--check')) {
    if (!fs.existsSync(RECEIPT_PATH)) {
      console.error('CAREER_TUNING_RECEIPT_CHECK=FAIL committed receipt is missing');
      process.exitCode = 1;
      return;
    }
    const committed = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
    const fresh = result.receipt;
    const committedNoDigest = { ...committed };
    delete committedNoDigest.deterministicArtifactDigest;
    const recomputed = digestOf(committedNoDigest);
    if (committed.deterministicArtifactDigest !== recomputed) {
      console.error(`CAREER_TUNING_RECEIPT_CHECK=FAIL committed receipt digest is internally inconsistent (${committed.deterministicArtifactDigest} != ${recomputed})`);
      process.exitCode = 1;
      return;
    }
    if (fresh.deterministicArtifactDigest !== committed.deterministicArtifactDigest) {
      console.error(`CAREER_TUNING_RECEIPT_CHECK=FAIL matrix drifted from committed receipt\n  committed=${committed.deterministicArtifactDigest}\n  fresh    =${fresh.deterministicArtifactDigest}`);
      process.exitCode = 1;
      return;
    }
    console.log(`CAREER_TUNING_RECEIPT_CHECK=PASS digest stable (${fresh.deterministicArtifactDigest})`);
    printSummary(result);
    return;
  }

  printSummary(result);
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
