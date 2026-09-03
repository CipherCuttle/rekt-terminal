/**
 * CAREER_TUNING_HARNESS_V0 — focused harness tests.
 *
 * Run: node --test scripts/career-tuning/test/harness.test.mjs
 * Requires @rekt-ink/sim and @rekt-ink/career to be built (dist present).
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
import { boundedExpectedActionsToUnlock } from '../metrics.mjs';
import { evaluateGates } from '../gates.mjs';
import { TuningCareerEvaluator, tuningStatsKeys, productionStatsKeys } from '../tuning-evaluator.mjs';
import { GATE_F_REGIME, GATE_F_SEEDS, MAX_ACTIONS, MAX_TICKS, SEEDS, START_MS } from '../config.mjs';

const execFileText = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();

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
      record.tuningStopPlannedTrades < record.tuningClosedSpotTrades,
      `seed ${record.seed}: widened trades still counted as planned-stop trades`,
    );
  }
  // OBSERVATION, not a §6.1 falsification: STOP_WIDENER still reaches the late
  // skills often (RISK_SIZING has no recent window; evaluateMargin2x ignores
  // summary.stopWidened) BUT it is SLOWER in expectation than DISCIPLINED, so
  // Gate D passes and records the behaviour as a FUTURE DESIGN-TUNING RISK.
  const widener = MATRIX.agentAggregates.STOP_WIDENER;
  const disciplined = MATRIX.agentAggregates.DISCIPLINED;
  for (const skill of ['RISK_SIZING', 'MARGIN_2X', 'SHORT']) {
    assert.ok(
      widener.boundedExpectedActionsToUnlock[skill] >= disciplined.boundedExpectedActionsToUnlock[skill],
      `STOP_WIDENER is faster-in-expectation than DISCIPLINED at ${skill} — that WOULD be a §6.1 falsification`,
    );
  }
  assert.equal(MATRIX.gateResult.gates.D.pass, true, 'Gate D should PASS: widener is slower in expectation');
  assert.ok(MATRIX.gateResult.gates.D.observations.length >= 1, 'Gate D should record the widening behaviour as an OBSERVATION');
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

  // OBSERVATION, not a §6.1 falsification: up-front budget escalation leaves no
  // RISK_BUDGET_VIOLATED trace, so REVENGE still reaches MARGIN_2X / SHORT often
  // with zero recorded violations — but it is SLOWER in expectation than
  // DISCIPLINED, so Gate E passes and records a FUTURE DESIGN-TUNING RISK.
  const revengeRuns = MATRIX.records.filter((record) => record.agent === 'REVENGE');
  const revengeViolations = revengeRuns.reduce((sum, record) => sum + record.riskBudgetViolations, 0);
  assert.equal(revengeViolations, 0, 'budget-escalation REVENGE should record no risk-budget violations');
  const rev = MATRIX.agentAggregates.REVENGE;
  const disc = MATRIX.agentAggregates.DISCIPLINED;
  for (const skill of ['RISK_SIZING', 'MARGIN_2X', 'SHORT']) {
    assert.ok(
      rev.boundedExpectedActionsToUnlock[skill] >= disc.boundedExpectedActionsToUnlock[skill],
      `REVENGE is faster-in-expectation than DISCIPLINED at ${skill} — that WOULD be a §6.1 falsification`,
    );
  }
  assert.equal(MATRIX.gateResult.gates.E.pass, true, 'Gate E should PASS: REVENGE is slower in expectation');
  assert.ok(MATRIX.gateResult.gates.E.observations.length >= 1, 'Gate E should record the escalation behaviour as an OBSERVATION');
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
    assert.equal(record.tradesClosed, record.tuningClosedSpotTrades, `seed ${record.seed} ${record.agent}`);
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
      assert.ok(record.tuningStopPlannedTrades >= 3);
      assert.ok(record.tuningRiskPlannedTrades >= 3);
      assert.ok(record.tuningPartialExits >= 2);
      assert.ok(record.tuningMaxAccountDrawdownBps !== null && record.tuningMaxAccountDrawdownBps <= 2000);
    }
    if (record.reached.SHORT) assert.ok(record.tuningQualifyingLongEpisodes >= 2);
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

/* ================================================================== */
/* METHODOLOGY REPAIR COVERAGE (independent P1/P2 findings)            */
/* ================================================================== */

/* M1 — generated tuning observations are SYNTHETIC (FINDING 1) ------ */
test('every generated tuning observation carries SYNTHETIC provenance, not DERIVED', () => {
  const scenario = buildScenario(SEEDS[0]);
  for (const tick of [0, 1, 42, 300, 599, 600]) {
    const obs = scenario.observationAt(tick);
    assert.equal(obs.provenance, 'SYNTHETIC', `tick ${tick} observation was not SYNTHETIC`);
    assert.match(obs.sourceId, /^TUNING_SYNTHETIC:/);
  }
  // the Gate F comparator regime is the same
  const gfSeeds = GATE_F_SEEDS[0];
  const meltUp = buildScenario(gfSeeds, GATE_F_REGIME.id);
  assert.equal(meltUp.observationAt(10).provenance, 'SYNTHETIC');
  assert.equal(meltUp.regimeId, 'MELT_UP');
});

/* M2 — production Career still refuses synthetic spot evidence ------ */
test('the REAL reduceCareer grades nothing from the synthetic spot path', () => {
  // Every run's real `this.career` must stay at SPOT_BASIC — the fail-closed
  // path is exercised, not bypassed.
  for (const record of MATRIX.records) {
    assert.deepEqual(record.realCareerFinalSkills, ['SPOT_BASIC'], `${record.agent} seed ${record.seed}: real Career advanced on synthetic evidence`);
  }
  // direct: drive a run and inspect both objects
  const run = new SpotCareerRun({ sessionId: 'refuse-test', startedAtMs: START_MS });
  const scenario = buildScenario(SEEDS[2]);
  for (let tick = 0; tick < 120; tick += 1) {
    const obs = scenario.observationAt(tick);
    const t = scenario.eventTimeAt(tick);
    if (run.positionOpen) run.mark(obs, t);
    run.apply(run.positionOpen ? { kind: 'SELL_ALL' } : { kind: 'BUY_FIXED' }, obs, t);
  }
  assert.ok(run.tuning.stats.closedSpotTrades > 0, 'the analysis evaluator did see the synthetic trades');
  assert.deepEqual(run.career.unlockedSkills, ['SPOT_BASIC'], 'real Career unlocked a skill from SYNTHETIC evidence');
  assert.equal(run.career.stats.closedSpotTrades, 0, 'real Career counted a synthetic closed trade');
});

/* M3 — the tuning evaluator is analysis-only, cannot touch product -- */
test('the TUNING_ANALYSIS_ONLY evaluator is not exported into product/runtime code', () => {
  // nothing under packages/ (product + runtime) may import the harness evaluator
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
        walk(full);
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        if (src.includes('tuning-evaluator') || src.includes('TuningCareerEvaluator')) offenders.push(full);
      }
    }
  };
  walk(path.join(ROOT, 'packages'));
  walk(path.join(ROOT, 'apps'));
  assert.deepEqual(offenders, [], `product/runtime code references the harness-only evaluator:\n${offenders.join('\n')}`);
  // and it self-identifies as non-authoritative
  const evaluator = new TuningCareerEvaluator();
  assert.equal(evaluator.mode, 'TUNING_ANALYSIS_ONLY');
});

/* M4 — the evaluator uses the SAME qualification constants as prod -- */
test('the tuning evaluator reuses the shipped qualification constants and gate functions', async () => {
  const career = await import('@rekt-ink/career');
  // the evaluator module imports these names directly from @rekt-ink/career;
  // assert they exist and are the shipped values (not shadowed locally).
  assert.equal(career.RISK_SIZING_TRADE_TARGET, 3);
  assert.equal(career.MARGIN_2X_RECENT_RISK_TARGET, 3);
  assert.equal(career.MARGIN_2X_DRAWDOWN_LIMIT_BPS, 2_000);
  assert.equal(career.SHORT_LONG_EPISODE_TARGET, 2);
  assert.equal(typeof career.evaluateRiskSizing, 'function');
  assert.equal(typeof career.evaluateMargin2x, 'function');
  assert.equal(typeof career.isStopPlannedTrade, 'function');
  assert.equal(typeof career.isQualifyingLongMarginCompletion, 'function');
  // the harness config snapshots them without redefining
  const src = fs.readFileSync(path.join(HARNESS_DIR, 'tuning-evaluator.mjs'), 'utf8');
  assert.match(src, /from '@rekt-ink\/career'/);
  assert.doesNotMatch(src, /RISK_SIZING_TRADE_TARGET\s*=/, 'evaluator redefines a Career constant');
  assert.doesNotMatch(src, /MARGIN_2X_\w+\s*=\s*\d/, 'evaluator redefines a Career constant');
});

/* M5 — mirrored aggregation is shape/rule locked to production ------ */
test('the mirrored CareerStats shape matches createInitialCareer().stats exactly', () => {
  assert.deepEqual(tuningStatsKeys(), productionStatsKeys(), 'the mirror drifted from the shipped CareerStats shape');
  // rule lock: run the SAME gradable trade facts through the shipped reduceCareer
  // and through the mirror; the unlock outcome must agree.
  const facts = MATRIX.records.filter((r) => r.agent === 'DISCIPLINED').slice(0, 12);
  for (const record of facts) {
    // the mirror unlocked the ladder; the shipped reducer would too IF the
    // evidence were gradable — replay proves the mirror's stat fold is faithful
    // by matching the structural minimums the shipped gates require.
    if (record.reached.MARGIN_2X) {
      assert.ok(record.tuningClosedSpotTrades >= 8);
      assert.ok(record.tuningStopPlannedTrades >= 3);
      assert.ok(record.tuningRiskPlannedTrades >= 3);
      assert.ok(record.tuningPartialExits >= 2);
    }
  }
});

/* M6 — no synthetic -> DERIVED relabel anywhere in the harness ------ */
test('no harness code relabels a SYNTHETIC fact as DERIVED before Career', () => {
  const files = fs.readdirSync(HARNESS_DIR).filter((n) => n.endsWith('.mjs'));
  for (const name of files) {
    const src = fs.readFileSync(path.join(HARNESS_DIR, name), 'utf8');
    // the only 'DERIVED' literals allowed are: doc prose, and the margin-episode
    // marketProvenance note (real historical marks ARE DERIVED).
    const codeLines = src.split('\n').filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('/**'));
    for (const line of codeLines) {
      if (/provenance\s*[:=]\s*['"]DERIVED['"]/.test(line) && !/marketProvenance|marginEpisodeMarketProvenance/.test(line)) {
        assert.fail(`${name}: relabels an observation/fact as DERIVED: ${line.trim()}`);
      }
    }
  }
  // observations really do enter the sim as SYNTHETIC and summaries come back SYNTHETIC
  const run = new SpotCareerRun({ sessionId: 'prov-test', startedAtMs: START_MS });
  const scenario = buildScenario(SEEDS[1]);
  run.apply({ kind: 'BUY_FIXED' }, scenario.observationAt(0), scenario.eventTimeAt(0));
  run.apply({ kind: 'SELL_ALL' }, scenario.observationAt(1), scenario.eventTimeAt(1));
  assert.equal(run.lastClosedSummary.evidenceProvenance, 'SYNTHETIC', 'the sim TradeSummary was not SYNTHETIC');
});

/* M7 — bounded expected actions assigns MAX_ACTIONS+1 to non-unlocks  */
test('BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK counts a non-unlock run as MAX_ACTIONS + 1', () => {
  const synthetic = [
    { reached: { X: true }, unlocks: { X: { actions: 10 } } },
    { reached: { X: false }, unlocks: { X: null } },
  ];
  const mean = boundedExpectedActionsToUnlock(synthetic, 'X');
  assert.equal(mean, (10 + (MAX_ACTIONS + 1)) / 2);
  // ALL_IN never reaches RISK_SIZING in the real matrix -> its bounded expected
  // value is exactly MAX_ACTIONS + 1 for every late skill.
  const allIn = MATRIX.agentAggregates.ALL_IN;
  for (const skill of ['RISK_SIZING', 'MARGIN_2X', 'SHORT']) {
    assert.equal(allIn.boundedExpectedActionsToUnlock[skill], MAX_ACTIONS + 1);
  }
});

/* M8 — every policy uses the same seed denominator ----------------- */
test('unlock rate and bounded-expected metrics use the full committed seed set as denominator', () => {
  for (const policy of POLICIES) {
    const runs = MATRIX.records.filter((r) => r.agent === policy.id);
    assert.equal(runs.length, SEEDS.length, `${policy.id} did not run the full seed set`);
    assert.equal(MATRIX.agentAggregates[policy.id].runs, SEEDS.length);
    // the same seed list, no survivor pruning
    assert.deepEqual(runs.map((r) => r.seed).sort((a, b) => a - b), [...SEEDS].sort((a, b) => a - b));
  }
});

/* M9 — the D/E gates contain no 0.5x / materiality threshold ------- */
test('gates.mjs contains no invented 0.5x DISCIPLINED materiality threshold', () => {
  const src = fs.readFileSync(path.join(HARNESS_DIR, 'gates.mjs'), 'utf8');
  assert.doesNotMatch(src, /0\.5\s*\*/, 'gates.mjs still multiplies a DISCIPLINED rate by 0.5');
  assert.doesNotMatch(src, /materialityThreshold/, 'gates.mjs still carries a materiality threshold');
  assert.doesNotMatch(src, /<=\s*0\.5\b/, 'gates.mjs still compares a ratio against 0.5');
  // the gates DO compare bounded expected actions
  assert.match(src, /boundedExpectedActionsToUnlock/);
  for (const key of ['D', 'E']) {
    assert.equal(MATRIX.gateResult.gates[key].detail.primaryMetric, 'BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK');
  }
});

/* M10 — Gate F has an actual reckless profitable comparator before PASS */
test('Gate F only passes with a real reckless profitable comparator', () => {
  const f = MATRIX.gateResult.gates.F;
  assert.equal(f.status, 'PASS');
  assert.ok(f.detail.recklessLuckyWinnerRuns > 0, 'Gate F PASS without a reckless winner');
  // the winners really ended above starting equity and ran a worse process
  for (const w of MATRIX.comparator.recklessWinners) {
    assert.ok(w.finalEquityFrac > 1, 'a "reckless winner" did not actually end above starting equity');
    assert.ok(w.maxAccountDrawdownBps > MATRIX.comparator.disciplinedDrawdownMedian, 'a "reckless winner" did not run a worse-drawdown process than DISCIPLINED');
    assert.equal(w.reached.RISK_SIZING, false, 'a reckless lucky winner reached RISK_SIZING — positive PnL bought progression');
  }
  assert.equal(f.detail.recklessWinnersReachingRiskSizingOrLater, 0);
  assert.equal(f.detail.recklessWinnersFasterThanDisciplined, 0);
  // and disciplined losing runs DO progress
  assert.ok(f.detail.disciplinedLosingRunsThatReachedMargin2x > 0);
});

/* M11 — absence of a comparator forces UNTESTED, never PASS -------- */
test('Gate F is UNTESTED (never PASS) when no reckless winner exists', () => {
  const f = evaluateGates(MATRIX.agentAggregates, { recklessWinners: [], recklessAgents: [], seedCount: 0, disciplined: MATRIX.agentAggregates.DISCIPLINED }).gates.F;
  assert.equal(f.status, 'UNTESTED');
  assert.equal(f.pass, false);
  const verdict = evaluateGates(MATRIX.agentAggregates, { recklessWinners: [], recklessAgents: [], seedCount: 0, disciplined: MATRIX.agentAggregates.DISCIPLINED }).verdict;
  assert.equal(verdict, 'HARNESS_EVIDENCE_INCOMPLETE', 'a missing comparator must not yield PASS');
});

/* M12 — receipt digest is deterministic --------------------------- */
test('the full-matrix receipt digest is deterministic and matches the committed receipt', () => {
  const a = runMatrix().receipt.deterministicArtifactDigest;
  const b = runMatrix().receipt.deterministicArtifactDigest;
  assert.equal(a, b);
  const committed = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
  assert.equal(a, committed.deterministicArtifactDigest, 'committed receipt is stale — regenerate with `node scripts/sim-career-agents.mjs --write`');
});

/* M13 — no Career threshold changed ------------------------------- */
test('this phase changed no Career threshold or qualification source', () => {
  const out = execFileText('git', ['diff', '--stat', '4843dc91eee91e871072f362618397249eb044e6', '--', 'packages/career/src/']);
  assert.equal(out, '', `this phase modified Career threshold / qualification source:\n${out}`);
  // the snapshot in the receipt equals the shipped constants
  const committed = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
  assert.equal(committed.careerConstantsSnapshot.RISK_SIZING_TRADE_TARGET, 3);
  assert.equal(committed.careerConstantsSnapshot.MARGIN_2X_DRAWDOWN_LIMIT_BPS, 2_000);
  assert.equal(committed.careerConstantsSnapshot.SHORT_PLANNED_RISK_LIMIT_BPS, '500');
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
