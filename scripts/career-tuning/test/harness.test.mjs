/**
 * CAREER_TUNING_HARNESS_V0 — focused harness tests.
 *
 * Run: node --test scripts/career-tuning/test/harness.test.mjs
 * Requires @rekt-ink/sim and @rekt-ink/career to be built (dist present).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runOne } from '../harness.mjs';
import { runMatrix } from '../../sim-career-agents.mjs';
import { POLICIES, POLICY_BY_ID } from '../policies.mjs';
import { SpotCareerRun } from '../spot-driver.mjs';
import { buildScenario } from '../scenarios.mjs';
import { makePrng, deriveSeed } from '../prng.mjs';
import { tradeSummaryToCareerFact } from '../career-bridge.mjs';
import { MAX_ACTIONS, MAX_TICKS, SEEDS, START_MS } from '../config.mjs';

const HARNESS_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOT = path.resolve(HARNESS_DIR, '..', '..');
const RECEIPT_PATH = path.join(ROOT, 'docs', 'CAREER_TUNING_HARNESS_V0_RECEIPT.json');

// One shared matrix for the aggregate-shape assertions.
const MATRIX = runMatrix();

/* 1 — same seed produces an identical policy action stream ------------------ */
test('same seed produces a byte-identical policy action stream', () => {
  for (const id of ['DISCIPLINED', 'RANDOM', 'REVENGE', 'STOP_WIDENER']) {
    const a = runOne(POLICY_BY_ID[id], SEEDS[0], { trace: true }).actionLog;
    const b = runOne(POLICY_BY_ID[id], SEEDS[0], { trace: true }).actionLog;
    assert.deepEqual(a, b, `${id} action stream drifted`);
    assert.ok(a.length > 0);
  }
});

/* 2 — same full matrix produces an identical receipt digest ---------------- */
test('same full matrix produces an identical receipt digest', () => {
  const second = runMatrix();
  assert.equal(second.receipt.deterministicArtifactDigest, MATRIX.receipt.deterministicArtifactDigest);
  const committed = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
  assert.equal(
    MATRIX.receipt.deterministicArtifactDigest,
    committed.deterministicArtifactDigest,
    'committed receipt digest is stale — regenerate with `node scripts/sim-career-agents.mjs --write`',
  );
});

/* 3 — agents cannot use locked capabilities -------------------------------- */
test('a fresh run refuses every capability the shipped Career has not unlocked', () => {
  const run = new SpotCareerRun({ sessionId: 'lock-test', startedAtMs: START_MS });
  const scenario = buildScenario(SEEDS[0]);
  const obs = scenario.observationAt(0);
  const before = JSON.stringify(run.career);

  assert.deepEqual(run.legalActionKinds().sort(), ['BUY_FIXED', 'WAIT']);

  for (const locked of ['PLACE_STOP', 'SCALE_IN', 'PARTIAL_CLOSE', 'BUY_RISK_PLANNED']) {
    const result = run.apply({ kind: locked, stopPriceX18: obs.referencePriceX18 / 2n, riskBps: 100n, percent: 25 }, obs, START_MS);
    assert.equal(result.accepted, false, `${locked} should be refused`);
    assert.match(result.reason, /CAPABILITY_LOCKED|NO_OPEN_POSITION|RISK_PLAN_POSITION_OPEN/);
  }
  assert.equal(JSON.stringify(run.career), before, 'a locked-capability attempt mutated Career state');
});

/* 4 — duplicate / rejected / non-economic actions do not count as progress - */
test('rejected and non-economic actions grant no Career progress', () => {
  const run = new SpotCareerRun({ sessionId: 'reject-test', startedAtMs: START_MS });
  const scenario = buildScenario(SEEDS[0]);

  // open one position, then hammer illegal BUYs and WAITs
  run.apply({ kind: 'BUY_FIXED' }, scenario.observationAt(0), scenario.eventTimeAt(0));
  const careerAfterOpen = JSON.stringify(run.career);
  const rejectedBefore = run.rejectedActions;
  for (let i = 1; i <= 50; i += 1) {
    run.apply({ kind: 'BUY_FIXED' }, scenario.observationAt(i), scenario.eventTimeAt(i)); // POSITION_ALREADY_OPEN
    run.apply({ kind: 'WAIT' }, scenario.observationAt(i), scenario.eventTimeAt(i));
  }
  assert.ok(run.rejectedActions >= rejectedBefore + 50, 'illegal BUYs were not counted as rejected');
  assert.equal(JSON.stringify(run.career), careerAfterOpen, 'rejected / WAIT actions advanced Career state');
  assert.equal(run.career.stats.closedSpotTrades, 0);
  assert.equal(run.career.stats.stopPlannedTrades, 0);
});

/* 5 — STOP_WIDENER really widens when legally possible -------------------- */
test('STOP_WIDENER widens a real stop, and a widened trade never counts as a planned-stop trade', () => {
  const widenerRuns = MATRIX.records.filter((record) => record.agent === 'STOP_WIDENER');
  const withWiden = widenerRuns.filter((record) => record.stopWidenCount > 0);
  assert.ok(withWiden.length >= 20, 'STOP_WIDENER barely widened across the matrix');
  // A widened trade's summary carries stopWidened === true, so `isStopPlannedTrade`
  // rejects it: every run that widened has strictly fewer planned-stop trades
  // than closed spot trades.
  for (const record of withWiden) {
    assert.ok(
      record.careerStopPlannedTrades < record.careerClosedSpotTrades,
      `seed ${record.seed}: widened trades still counted as planned-stop trades`,
    );
  }
  // FALSIFICATION FINDING (Gate D): a realistic widener is NOT materially
  // blocked — a widen that stays inside the risk-budget tolerance still closes
  // RESPECTED, and the planned-stop count is cumulative with no recent window,
  // so STOP_WIDENER still reaches MARGIN_2X in a large fraction of runs. This
  // assertion documents that finding; do not "fix" it by tuning Career here.
  const widenerMargin2x = widenerRuns.filter((record) => record.reached.MARGIN_2X).length / widenerRuns.length;
  assert.ok(widenerMargin2x > 0.5, `expected the Gate D falsification (STOP_WIDENER MARGIN_2X rate high); got ${widenerMargin2x}`);
  assert.equal(MATRIX.gateResult.gates.D.pass, false, 'Gate D should be FALSIFIED by the realistic widener');
});

/* 6 — REVENGE really increases attempted risk after losses --------------- */
test('REVENGE escalates attempted account risk after a realised loss and resets after recovery', () => {
  const revenge = POLICY_BY_ID.REVENGE;
  const baseView = {
    positionOpen: false,
    currentPriceX18: 25_000_000_000_000_000n,
    has: (capability) => capability === 'RISK_PERCENT_SIZING' || capability === 'CUSTOM_POSITION_SIZE',
    legalKinds: ['WAIT', 'BUY_RISK_PLANNED'],
    memo: {},
    trade: {},
  };
  const riskAt = (escalation) => {
    const view = { ...baseView, memo: { escalation } };
    return revenge.decideSpot(makePrng(1n), view).riskBps;
  };
  assert.equal(riskAt(0), 60n);
  assert.ok(riskAt(1) > riskAt(0));
  assert.ok(riskAt(2) > riskAt(1));
  assert.ok(riskAt(3) >= riskAt(2));

  const memo = { escalation: 0 };
  revenge.onTradeClosed(memo, { realizedPnlWei: -5n });
  assert.equal(memo.escalation, 1);
  revenge.onTradeClosed(memo, { realizedPnlWei: -5n });
  assert.equal(memo.escalation, 2);
  revenge.onTradeClosed(memo, { realizedPnlWei: 5n });
  assert.equal(memo.escalation, 0, 'a winning trade must reset escalation');

  // FALSIFICATION FINDING (Gate E): raising the account-risk budget of the NEXT
  // fresh plan after a loss is a fully-RESPECTED trade — the shipped
  // RISK_BUDGET_VIOLATED signal only fires on a post-freeze breach of a plan's
  // own budget. So REVENGE carries ~zero recorded violations yet still reaches
  // the late gates. Do not "fix" this by tuning Career here.
  const revengeRuns = MATRIX.records.filter((record) => record.agent === 'REVENGE');
  const revengeViolations = revengeRuns.reduce((sum, record) => sum + record.riskBudgetViolations, 0);
  const revengeMargin2x = revengeRuns.filter((record) => record.reached.MARGIN_2X).length / revengeRuns.length;
  assert.equal(revengeViolations, 0, 'budget-escalation REVENGE should record no risk-budget violations');
  assert.ok(revengeMargin2x > 0.15, `expected the Gate E falsification (viable REVENGE path to MARGIN_2X); got ${revengeMargin2x}`);
  assert.equal(MATRIX.gateResult.gates.E.pass, false, 'Gate E should be FALSIFIED by budget-escalation REVENGE');
});

/* 7 — DISCIPLINED never intentionally widens ---------------------------- */
test('DISCIPLINED never widens a stop, in any run or any state', () => {
  const disciplinedRuns = MATRIX.records.filter((record) => record.agent === 'DISCIPLINED');
  assert.equal(disciplinedRuns.length, SEEDS.length);
  for (const record of disciplinedRuns) {
    assert.equal(record.stopWidenCount, 0, `DISCIPLINED widened on seed ${record.seed}`);
  }
  // In an explicitly losing state with an active stop it holds or exits — never PLACE_STOP.
  const decision = POLICY_BY_ID.DISCIPLINED.decideSpot(makePrng(1n), {
    positionOpen: true, hasActiveStop: true, positionQtyAtoms: 10n,
    priceVsEntryFrac: -0.04, ticksInPosition: 5, partialExitsUsed: 2,
    currentPriceX18: 25_000_000_000_000_000n, entryPriceX18: 25_000_000_000_000_000n,
    has: () => true, trade: {}, memo: {},
  });
  assert.ok(decision === null || decision.kind === 'SELL_ALL');
});

/* 8 — RANDOM uses the seeded PRNG only -------------------------------- */
test('RANDOM is a pure function of the seeded PRNG stream', () => {
  const view = {
    positionOpen: true, positionQtyAtoms: 10n, hasActiveStop: false,
    currentPriceX18: 25_000_000_000_000_000n,
    legalKinds: ['WAIT', 'SELL_ALL', 'SCALE_IN', 'PARTIAL_CLOSE', 'PLACE_STOP'],
    has: () => true, trade: {}, memo: {},
  };
  const seed = deriveSeed(SEEDS[3], 'RANDOM:probe');
  const rng1 = makePrng(seed);
  const rng2 = makePrng(seed);
  const streamA = [];
  const streamB = [];
  for (let i = 0; i < 60; i += 1) {
    streamA.push(serialiseAction(POLICY_BY_ID.RANDOM.decideSpot(rng1, view)));
    streamB.push(serialiseAction(POLICY_BY_ID.RANDOM.decideSpot(rng2, view)));
  }
  assert.deepEqual(streamA, streamB, 'two PRNGs from the same seed disagreed — hidden entropy');
  assert.ok(new Set(streamA.map((entry) => (entry ? entry.kind : 'WAIT'))).size >= 3, 'RANDOM never varied its choice');
  // A different seed must produce a different stream.
  const rng3 = makePrng(deriveSeed(SEEDS[4], 'RANDOM:probe'));
  const streamC = Array.from({ length: 60 }, () => serialiseAction(POLICY_BY_ID.RANDOM.decideSpot(rng3, view)));
  assert.notDeepEqual(streamC, streamA);
});

/* 9 — no Math.random / Date.now anywhere in harness decision logic ---- */
test('the harness contains no Math.random and no Date.now', () => {
  const files = [
    ...fs.readdirSync(HARNESS_DIR).filter((name) => name.endsWith('.mjs')).map((name) => path.join(HARNESS_DIR, name)),
    path.join(ROOT, 'scripts', 'sim-career-agents.mjs'),
    path.join(ROOT, 'scripts', 'verify-career-tuning.mjs'),
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(/Math\s*\.\s*random\s*\(/.test(source), false, `${path.basename(file)} uses Math.random`);
    assert.equal(/Date\s*\.\s*now\s*\(/.test(source), false, `${path.basename(file)} uses Date.now`);
    assert.equal(/\bperformance\s*\.\s*now\s*\(/.test(source), false, `${path.basename(file)} uses performance.now`);
  }
});

/* 10 — metrics count real simulator / Career facts, not UI intentions -- */
test('per-run metrics are read from real Career reducer state', () => {
  for (const record of MATRIX.records) {
    // trades counted == the shipped reducer's own closed-spot-trade count
    assert.equal(record.tradesClosed, record.careerClosedSpotTrades, `seed ${record.seed} ${record.agent}`);
    // an unlock is recorded iff the shipped reducer actually unlocked the skill
    for (const [skill, reached] of Object.entries(record.reached)) {
      assert.equal(reached, record.finalSkills.includes(skill));
      if (reached) assert.ok(record.unlocks[skill] && Number.isInteger(record.unlocks[skill].trades));
    }
    // structural minimums the shipped gates require
    if (record.reached.SCALE_CONTROL) assert.ok(record.unlocks.SCALE_CONTROL.trades >= 3);
    if (record.reached.STOP_LOSS) assert.ok(record.unlocks.STOP_LOSS.trades >= 5);
    if (record.reached.MARGIN_2X) {
      assert.ok(record.unlocks.MARGIN_2X.trades >= 8);
      assert.ok(record.careerStopPlannedTrades >= 3);
      assert.ok(record.careerRiskPlannedTrades >= 3);
      assert.ok(record.careerPartialExits >= 2);
      assert.ok(record.careerMaxAccountDrawdownBps !== null && record.careerMaxAccountDrawdownBps <= 2000);
    }
    if (record.reached.SHORT) assert.ok(record.careerQualifyingLongEpisodes >= 2);
  }
  // bridge payload shape is exactly what apps/web/src/practice/store.ts copies
  const keys = Object.keys(tradeSummaryToCareerFact({
    tradeId: 't', sessionId: 's', mode: 'SPOT', realizedPnlWei: 0n, accountEquityAtCloseWei: 0n,
    lossBpsOfThenCurrentEquity: 0n, accountEquityAtOpenWei: 0n, maxDrawdownBpsAtClose: 0n,
    exitReason: 'MANUAL', stopUsed: false, partialExitUsed: false, liquidated: false, openedAtMs: 0,
    firstStopPlacedAtMs: null, stopWidened: false, riskPlan: null, riskBudgetViolated: false,
    riskBudgetVerified: true, evidenceProvenance: 'DERIVED',
  })).sort();
  assert.deepEqual(keys, [
    'accountEquityAtCloseWei', 'accountEquityAtOpenWei', 'evidenceProvenance', 'exitReason',
    'firstStopPlacedAtMs', 'liquidated', 'lossBpsOfThenCurrentEquity', 'maxDrawdownBpsAtClose', 'mode',
    'openedAtMs', 'partialExitUsed', 'realizedPnlWei', 'riskBudgetVerified', 'riskBudgetViolated',
    'riskPlanned', 'sessionId', 'stopUsed', 'stopWidened', 'tradeId',
  ]);
});

/* 11 — one agent's run cannot mutate another run's state -------------- */
test('runs are isolated: an interleaved run does not perturb a repeated run', () => {
  const first = runOne(POLICY_BY_ID.DISCIPLINED, SEEDS[5]);
  runOne(POLICY_BY_ID.REVENGE, SEEDS[5]);
  runOne(POLICY_BY_ID.ALL_IN, SEEDS[5]);
  const repeat = runOne(POLICY_BY_ID.DISCIPLINED, SEEDS[5]);
  assert.deepEqual(repeat, first);

  const s1 = buildScenario(SEEDS[5]);
  const s2 = buildScenario(SEEDS[5]);
  assert.equal(Object.isFrozen(s1), true);
  assert.equal(s1.priceDigest(), s2.priceDigest());
  // all six agents in the real matrix see the identical price path per seed
  for (const seed of SEEDS.slice(0, 8)) {
    const digests = new Set(MATRIX.records.filter((record) => record.seed === seed).map((record) => record.priceDigest));
    assert.equal(digests.size, 1, `seed ${seed} exposed different markets to different agents`);
  }
});

/* 12 — bounds terminate every run --------------------------------- */
test('every run terminates within the committed bounds', () => {
  for (const record of MATRIX.records) {
    assert.ok(record.ticksUsed <= MAX_TICKS, `seed ${record.seed} ${record.agent} exceeded MAX_TICKS`);
    assert.ok(record.actionsAccepted <= MAX_ACTIONS, `seed ${record.seed} ${record.agent} exceeded MAX_ACTIONS`);
  }
  // a pathological policy that only ever attempts an illegal action still halts
  const pathological = {
    id: 'PATHOLOGICAL', version: 'test',
    decideSpot: () => ({ kind: 'BUY_FIXED' }), // illegal the instant a position is open
    marginPlan: () => null,
  };
  const record = runOne(pathological, SEEDS[0]);
  assert.ok(record.ticksUsed <= MAX_TICKS);
  assert.ok(record.actionsAccepted <= MAX_ACTIONS);
});

/* helpers ------------------------------------------------------------ */
function serialiseAction(action) {
  if (!action) return null;
  return {
    kind: action.kind,
    riskBps: action.riskBps !== undefined ? action.riskBps.toString() : null,
    stopPriceX18: action.stopPriceX18 !== undefined ? action.stopPriceX18.toString() : null,
    percent: action.percent ?? null,
  };
}
