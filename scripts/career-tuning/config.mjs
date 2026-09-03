/**
 * CAREER_TUNING_HARNESS_V0 — frozen experiment configuration.
 *
 * This file is the committed, versioned definition of the experiment. Changing
 * any value here changes the deterministic receipt digest and must be a
 * deliberate, reviewed act.
 *
 * SCIENTIFIC RULE: this harness does not, and this file must not, change any
 * Career qualification threshold. The Career constants below are *imported from
 * the shipped `@rekt-ink/career` package* and only snapshotted for the receipt;
 * they are never redefined here.
 */
import {
  SCALE_CONTROL_TRADE_TARGET,
  SCALE_CONTROL_LOSS_LIMIT_BPS,
  STOP_LOSS_TRADE_TARGET,
  STOP_LOSS_EQUITY_FLOOR_WEI,
  STOP_PLAN_WINDOW_MS,
  RISK_SIZING_TRADE_TARGET,
  RISK_SIZING_PARTIAL_EXIT_TARGET,
  MARGIN_2X_CLOSED_SPOT_TARGET,
  MARGIN_2X_RISK_PLANNED_TARGET,
  MARGIN_2X_PARTIAL_EXIT_TARGET,
  MARGIN_2X_RECENT_RISK_TARGET,
  MARGIN_2X_DRAWDOWN_LIMIT_BPS,
  SHORT_LONG_EPISODE_TARGET,
  SHORT_PLANNED_RISK_LIMIT_BPS,
  CAREER_SAVE_VERSION,
  CAREER_TUNING_VERSION,
} from '@rekt-ink/career';
import {
  SIM_MODEL_VERSION,
  SPOT_FILL_MODEL_VERSION,
  RISK_PLAN_MODEL_VERSION,
  SIM_MARGIN_MODEL_VERSION,
} from '@rekt-ink/sim';

/** Commit this branch was cut from — the PRODUCT_PLAN_V2_FREEZE merge head. */
export const BASE_COMMIT = '4843dc91eee91e871072f362618397249eb044e6';
export const HARNESS_VERSION = 'CAREER_TUNING_HARNESS_V0';

/** Bump when policy behaviour changes; recorded in the receipt. */
export const POLICY_SET_VERSION = 'CTH_POLICIES_V0';
export const SCENARIO_MODEL_VERSION = 'CTH_TUNING_SYNTHETIC_V0';

/* -------------------------------------------------------------------------- */
/* run matrix                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 128 independent deterministic seeds. Committed as an explicit generator plus a
 * digest (see `SEED_DIGEST` in the receipt) rather than a 128-line literal.
 * `SEED_BASE` is arbitrary and fixed; the offset walk keeps neighbouring seeds
 * in different scenario regimes (regime = seed % 5).
 */
export const SEED_COUNT = 128;
export const SEED_BASE = 20_260_903;
export const SEEDS = Object.freeze(
  Array.from({ length: SEED_COUNT }, (_unused, index) => SEED_BASE + index * 7),
);

/** Hard per-run bounds. Every run terminates at or before these. */
export const MAX_TICKS = 600;
export const MAX_ACTIONS = 300;
export const TICK_MS = 1_000;
export const START_MS = 1_700_000_000_000;

/* -------------------------------------------------------------------------- */
/* synthetic market                                                            */
/* -------------------------------------------------------------------------- */

export const SPOT_INSTRUMENT_ID = 'INK-ETH-SPOT';
export const SPOT_QUOTE_ASSET = 'WETH';
/** TUNING_SYNTHETIC marker carried on every synthetic observation's sourceId. */
export const TUNING_SYNTHETIC_TAG = 'TUNING_SYNTHETIC';

/**
 * FINDING 1 repair. The fabricated tuning paths are `SYNTHETIC` — the canonical
 * taxonomy word for "fabricated / demo / simulator-generated market scenario".
 * They are NOT relabelled `DERIVED`. To run the real simulator on them the
 * session is opened under the explicit synthetic/demo evidence policy; the
 * resulting `TradeSummary` facts then carry `evidenceProvenance: 'SYNTHETIC'`,
 * which the shipped `isGradableEvidence` refuses. Progression in this harness is
 * measured by the harness-local `TUNING_ANALYSIS_ONLY` evaluator, never by a
 * weakened production gate.
 */
export const SYNTHETIC_PROVENANCE = 'SYNTHETIC';
export const TUNING_EVIDENCE_POLICY = 'DEMO_ALLOW_SYNTHETIC';
export const START_PRICE_X18 = 25_000_000_000_000_000n;
export const USABLE_LIQUIDITY_WEI = 10_000_000_000_000_000_000n;

/**
 * Five deterministic regimes. Drift and vol are integer bps applied per tick as
 * `price = price * (10000 + drift + noise) / 10000`. `SHOCK_DOWN` additionally
 * gaps the price down once, partway through, to stress the drawdown / equity
 * floor gates and stop behaviour under a fast adverse move.
 */
export const REGIMES = Object.freeze([
  { id: 'GENTLE_UP', driftBps: 6, volBps: 22, shock: null },
  { id: 'BEAR', driftBps: -16, volBps: 34, shock: null },
  { id: 'CHOP', driftBps: 0, volBps: 46, shock: null },
  { id: 'HIGH_VOL', driftBps: -3, volBps: 95, shock: null },
  { id: 'SHOCK_DOWN', driftBps: -2, volBps: 34, shock: { atTick: 300, factorBps: 7_800 } },
]);

/* -------------------------------------------------------------------------- */
/* Gate F comparator regime — PRE-DECLARED, favourable to reckless exposure     */
/* -------------------------------------------------------------------------- */

/**
 * FINDING 3 repair. Gate F must contrast a DISCIPLINED *losing* process against
 * a RECKLESS *lucky winning* process. The main matrix has no reckless winner
 * (down / choppy regimes), so a dedicated deterministic regime is committed
 * here — a strong-drift melt-up with enough tick noise that naive maximum long
 * exposure ends above starting equity but only after large equity swings (the
 * reckless-process signal). It is declared BEFORE any policy runs; every
 * comparator policy trades the byte-identical `MELT_UP` price path at a seed
 * (no policy gets special prices); the scenario is `TUNING_SYNTHETIC` /
 * `TUNING_ANALYSIS_ONLY` like every other path here. No policy is handed future
 * information and no fill / fee / final equity is set for it. Empirically ALL_IN
 * ends > 1.0x in every comparator seed with ~1300+ bps drawdown vs DISCIPLINED's
 * ~180 bps, and never progresses past STOP_LOSS.
 */
export const GATE_F_REGIME = Object.freeze({ id: 'MELT_UP', driftBps: 30, volBps: 20, shock: null });
export const GATE_F_SEED_COUNT = 24;
export const GATE_F_SEEDS = Object.freeze(
  Array.from({ length: GATE_F_SEED_COUNT }, (_unused, index) => SEED_BASE + 100_003 + index * 11),
);
/** Policies run over the comparator regime. DISCIPLINED is the reference; the
 *  rest are the reckless field a lucky winner may come from. */
export const GATE_F_COMPARATOR_POLICIES = Object.freeze(['DISCIPLINED', 'ALL_IN', 'OVERTRADER', 'RANDOM', 'REVENGE']);

/* -------------------------------------------------------------------------- */
/* primary falsification metric (FINDING 2)                                    */
/* -------------------------------------------------------------------------- */

/**
 * The frozen PROJECT_PLAN_V2 §6.1 criterion is "must not reach RISK_SIZING /
 * MARGIN_2X / SHORT faster than DISCIPLINED behavior in expectation". The
 * deterministic operationalisation is BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK: for
 * each policy/seed, the value is the accepted-action count at unlock, or
 * `MAX_ACTIONS + 1` if the skill never unlocked within the equal run budget.
 * The arithmetic mean over the SAME full seed set is the comparison statistic —
 * it folds unlock probability and unlock speed into one number and cannot be
 * gamed by survivor selection. There is no materiality threshold: an adversary
 * falsifies the criterion only if its mean is strictly LOWER than DISCIPLINED's.
 */
export const NON_UNLOCK_ACTION_VALUE = MAX_ACTIONS + 1;
export const PRIMARY_METRIC = 'BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK';

/* -------------------------------------------------------------------------- */
/* shipped Career constants — SNAPSHOT ONLY, never redefined                    */
/* -------------------------------------------------------------------------- */

export const CAREER_CONSTANTS = Object.freeze({
  SCALE_CONTROL_TRADE_TARGET,
  SCALE_CONTROL_LOSS_LIMIT_BPS,
  STOP_LOSS_TRADE_TARGET,
  STOP_LOSS_EQUITY_FLOOR_WEI: STOP_LOSS_EQUITY_FLOOR_WEI.toString(),
  STOP_PLAN_WINDOW_MS,
  RISK_SIZING_TRADE_TARGET,
  RISK_SIZING_PARTIAL_EXIT_TARGET,
  MARGIN_2X_CLOSED_SPOT_TARGET,
  MARGIN_2X_RISK_PLANNED_TARGET,
  MARGIN_2X_PARTIAL_EXIT_TARGET,
  MARGIN_2X_RECENT_RISK_TARGET,
  MARGIN_2X_DRAWDOWN_LIMIT_BPS,
  SHORT_LONG_EPISODE_TARGET,
  SHORT_PLANNED_RISK_LIMIT_BPS: SHORT_PLANNED_RISK_LIMIT_BPS.toString(),
  CAREER_SAVE_VERSION,
  CAREER_TUNING_VERSION,
});

export const SIM_MODEL_VERSIONS = Object.freeze({
  SIM_MODEL_VERSION,
  SPOT_FILL_MODEL_VERSION,
  RISK_PLAN_MODEL_VERSION,
  SIM_MARGIN_MODEL_VERSION,
});

/** Skills tracked for unlock timing, in ladder order. */
export const TRACKED_SKILLS = Object.freeze([
  'SCALE_CONTROL',
  'STOP_LOSS',
  'RISK_SIZING',
  'MARGIN_2X',
  'SHORT',
]);

/** The three skills named by the frozen PROJECT_PLAN_V2 §6.1 speed criterion. */
export const LATE_UNLOCK_SKILLS = Object.freeze(['RISK_SIZING', 'MARGIN_2X', 'SHORT']);
