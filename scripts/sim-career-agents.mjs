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
import { POLICIES } from './career-tuning/policies.mjs';
import { aggregateAgent, aggregateByRegime, digestOf } from './career-tuning/metrics.mjs';
import { evaluateGates } from './career-tuning/gates.mjs';
import {
  BASE_COMMIT,
  CAREER_CONSTANTS,
  HARNESS_VERSION,
  MAX_ACTIONS,
  MAX_TICKS,
  POLICY_SET_VERSION,
  SCENARIO_MODEL_VERSION,
  SEEDS,
  SEED_BASE,
  SEED_COUNT,
  SIM_MODEL_VERSIONS,
  TRACKED_SKILLS,
} from './career-tuning/config.mjs';

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
    careerMaxAccountDrawdownBps: record.careerMaxAccountDrawdownBps,
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

  const gateResult = evaluateGates(agentAggregates);
  const byRegime = {};
  for (const policy of POLICIES) {
    byRegime[policy.id] = aggregateByRegime(records.filter((record) => record.agent === policy.id));
  }

  const thresholdVerdict = gateResult.verdict === 'PASS'
    ? 'EVIDENCE_SUPPORTED_V0'
    : 'FALSIFIED';

  // Smallest future tuning repairs implied by the results. This phase does NOT
  // implement any of them — repair is a separate bounded phase.
  const random = agentAggregates.RANDOM;
  const disciplined = agentAggregates.DISCIPLINED;
  const widener = agentAggregates.STOP_WIDENER;
  const revenge = agentAggregates.REVENGE;
  const recommendations = [];
  if (random.unlockRate.RISK_SIZING >= 0.5 || widener.unlockRate.RISK_SIZING > 0.5 * disciplined.unlockRate.RISK_SIZING) {
    recommendations.push({
      id: 'RISK_SIZING_NO_RECENT_WINDOW',
      severity: 'HIGH',
      observedBy: ['RANDOM', 'STOP_WIDENER'],
      finding: `RISK_SIZING counts 3 planned-stop trades + 1 partial exit cumulatively over all history, with no recency and no clean-rate requirement. RANDOM assembles it in ${(random.unlockRate.RISK_SIZING * 100).toFixed(0)}% of runs and a realistic STOP_WIDENER in ${(widener.unlockRate.RISK_SIZING * 100).toFixed(0)}%.`,
      smallestRepairCandidate: 'Add a recent-window + clean-rate rule to the RISK_SIZING planned-stop requirement, mirroring MARGIN_2X’s recent-3-RESPECTED rule (e.g. "3 of the last N closed spot trades were planned-stop and none widened").',
    });
  }
  if (widener.unlockRate.MARGIN_2X > 0) {
    recommendations.push({
      id: 'MARGIN_2X_RECENT_RISK_IGNORES_WIDENING',
      severity: 'HIGH',
      observedBy: ['STOP_WIDENER'],
      finding: `A risk-planned trade whose protective stop was WIDENED still closes RESPECTED (and counts toward MARGIN_2X’s recent-3) whenever the widen stays inside the RISK_BUDGET_TOLERANCE_BPS band. STOP_WIDENER reaches MARGIN_2X in ${(widener.unlockRate.MARGIN_2X * 100).toFixed(0)}% of runs despite widening in most of them.`,
      smallestRepairCandidate: 'Make recentRiskPlannedOutcomes classify a trade with summary.stopWidened === true as not-RESPECTED (or add a "no STOP_WIDENED in the recent-N risk-planned trades" clause to evaluateMargin2x).',
    });
  }
  if (revenge.unlockRate.MARGIN_2X > 0.15 && revenge.riskBudgetViolationTotal === 0) {
    recommendations.push({
      id: 'RISK_BUDGET_ESCALATION_INVISIBLE',
      severity: 'HIGH',
      observedBy: ['REVENGE'],
      finding: `RISK_BUDGET_VIOLATED fires only when projected loss exceeds a FROZEN plan’s own budget + tolerance (i.e. a post-freeze position/stop change). Raising the account-risk budget of the NEXT fresh plan after a loss is a fully-RESPECTED trade. REVENGE escalates its budget after every loss and reaches MARGIN_2X in ${(revenge.unlockRate.MARGIN_2X * 100).toFixed(0)}% / SHORT in ${(revenge.unlockRate.SHORT * 100).toFixed(0)}% of runs with ${revenge.riskBudgetViolationTotal} recorded risk-budget violations; only the 20% Career drawdown cap resists it, and it leaks.`,
      smallestRepairCandidate: 'Record a discipline signal that a risk-planned trade’s maxLossBpsOfEquity increased versus the trailing baseline after a losing trade, and gate MARGIN_2X (and/or the discipline streak) on its absence in the recent-N risk-planned trades. Alternatively tighten MARGIN_2X_DRAWDOWN_LIMIT_BPS and/or add a per-trade drawdown-contribution cap.',
    });
  }

  const receiptBody = {
    harnessVersion: HARNESS_VERSION,
    baseCommit: BASE_COMMIT,
    policySetVersion: POLICY_SET_VERSION,
    scenarioModelVersion: SCENARIO_MODEL_VERSION,
    scenarioClass: 'TUNING_SYNTHETIC',
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
    agents: stripInternal(agentAggregates),
    byRegime,
    falsificationGates: gateResult.gates,
    failingGates: gateResult.failing,
    gateVerdict: gateResult.verdict,
    thresholdVerdict,
    recommendations,
    perRun: records.map(compactRun),
  };

  const digest = digestOf(receiptBody);
  return { records, agentAggregates, gateResult, receipt: { ...receiptBody, deterministicArtifactDigest: digest } };
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

  console.log('\nfalsification gates:');
  for (const [key, gate] of Object.entries(gateResult.gates)) {
    console.log(`  GATE ${key} ${gate.name.padEnd(20)} ${gate.pass ? 'PASS' : 'FAIL'}`);
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
  const { perRun, ...rest } = receipt;
  const head = JSON.stringify(rest, null, 2);
  const rows = perRun.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  return `${head.slice(0, -2)},\n  "perRun": [\n${rows}\n  ]\n}\n`;
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
