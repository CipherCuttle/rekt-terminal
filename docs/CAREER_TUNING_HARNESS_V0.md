# CAREER_TUNING_HARNESS_V0

Status: **`CAREER_TUNING_HARNESS_V0 = PASS`**

Every frozen `PROJECT_PLAN_V2.md` §6.1 falsification criterion was actually
exercised and none was falsified. This is the measuring-instrument phase: it
tunes **nothing** in Career, the simulator, or the plan.

- **Exact base commit**: `4843dc91eee91e871072f362618397249eb044e6`
  (the merged `PRODUCT_PLAN_V2_FREEZE` head).
- **Branch**: `agent/career-tuning-harness-v0`.
- **Deterministic receipt**: [`CAREER_TUNING_HARNESS_V0_RECEIPT.json`](./CAREER_TUNING_HARNESS_V0_RECEIPT.json),
  digest `FNV1A64-a68dac7ec19ec340`, seed digest `FNV1A64-68d5677ffa5ab6d7`.
- **Run / verify**: `node scripts/sim-career-agents.mjs` · `npm run verify:career-tuning`.

> **Methodology repair note.** An independent GitHub review of the first
> committed harness found three P1 methodology defects and one P2
> reproducibility defect. All four are repaired here; §2a records exactly what
> changed and why. The earlier harness reported `FALSIFIED`; that verdict rested
> on (a) synthetic paths laundered into gradable `DERIVED` evidence, (b) an
> unauthorised "0.5× DISCIPLINED unlock rate" materiality bar in gates D/E, and
> (c) a Gate F that never contained a reckless profitable comparator. With the
> instrument corrected the frozen criteria pass.

---

## 1. Purpose

`CAREER_CONTRACT_V0.md` §19 requires headless adversarial simulation before the
numerical Career thresholds can be declared release-frozen. The contract keeps
the ladder **structure** frozen (`SPOT_BASIC → SCALE_CONTROL → STOP_LOSS →
RISK_SIZING → MARGIN_2X → SHORT`) and marks the numbers `PROVISIONAL_TUNING`.

The frozen `PROJECT_PLAN_V2.md` §6.1 acceptance criterion, verbatim:

> Reckless / high-frequency / high-variance agents must not reach `RISK_SIZING`,
> `MARGIN_2X`, or `SHORT` faster than `DISCIPLINED` behavior in expectation.
> A disciplined losing run must not be graded as worse process than a reckless
> lucky winning run.

From 128 seeds × 6 policy agents against the real shipped simulator, plus a
pre-declared 24-seed × 5-policy Gate F comparator matrix, **no adversary reaches
any late skill faster in expectation than `DISCIPLINED`, and a reckless lucky
winner is not graded above a disciplined loser.** The criterion is not
falsified.

The harness still surfaces real, non-falsifying weaknesses in the *numbers*
(§10) — `RISK_SIZING` has no recency window; `evaluateMargin2x` ignores
`stopWidened`; up-front risk-budget escalation leaves no `RISK_BUDGET_VIOLATED`
trace. Those are **`FUTURE DESIGN-TUNING RISK`** observations for a later bounded
phase, not §6.1 falsifications, because every adversary that exhibits them is
still *slower in expectation* than `DISCIPLINED`.

---

## 2. Harness architecture

Offline, headless, deterministic Node. No React, no browser deps, no new package.

```text
scripts/sim-career-agents.mjs        orchestrator + CLI + receipt writer + gate verdict
scripts/verify-career-tuning.mjs     rebuild deps → focused tests → matrix digest --check
scripts/career-tuning/
  config.mjs           frozen seed set, bounds, versions, Career-constant SNAPSHOT (imported, never redefined),
                       evidence policy, Gate F comparator regime, primary-metric definition
  prng.mjs             SplitMix64 seeded PRNG — the only source of stochastic behaviour
  scenarios.mjs        TUNING_SYNTHETIC deterministic price paths, stamped SYNTHETIC (see §3)
  career-bridge.mjs    faithful transcription of apps/web/src/practice/store.ts's sim→Career event derivation
  tuning-evaluator.mjs TUNING_ANALYSIS_ONLY evaluator — the non-authoritative analysis seam (see §2a / §3)
  spot-driver.mjs      drives the REAL @rekt-ink/sim spot actions; feeds BOTH the real reduceCareer and the evaluator
  margin-driver.mjs    drives the REAL replayMarginActions over the REAL frozen episodes + REAL deriveLongMarginCompletion
  policies.mjs         the six policy agents
  metrics.mjs          deterministic aggregation, BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK, canonical JSON + FNV-1a-64 digest
  gates.mjs            the seven falsification gates + Gate F comparator logic
  test/harness.test.mjs   25 focused tests (12 original + 13 methodology-repair)
```

### Production boundary — what the harness exercises

- REAL simulator math and public actions: `executeSpotAction`, `placeSpotStop`,
  `setSpotRiskPlan`, `markSpot`, `replayMarginActions`.
- REAL immutable summaries: sim `TradeSummary`, `deriveLongMarginCompletion`.
- REAL frozen historical margin episodes (`MARGIN_TRAINING_EPISODES`).
- REAL shipped qualification: every `evaluate*` gate function, every constant,
  `isStopPlannedTrade`, `isQualifyingLongMarginCompletion`, `capabilitiesForSkill`,
  imported verbatim from `@rekt-ink/career` (§7).

### Production boundary — what the harness does NOT do

- It changes **no** Career qualification threshold. `git diff --stat <base> --
  packages/` is empty (test 25). Every constant in §7 is `import`ed and only
  snapshotted.
- It adds **no** Career authority path and **weakens no evidence gate**. The
  shipped `isGradableEvidence` is untouched and still refuses `SYNTHETIC`.
- It relabels **no** `SYNTHETIC` fact as `DERIVED` (test M6).

## 2a. What the methodology repair changed

| # | Independent finding | Repair in this phase |
|---|---|---|
| **P1-1** | Synthetic tuning paths entered the `LIVE_ONLY` simulator as `DERIVED`, so production `isGradableEvidence` accepted the resulting trade facts — laundering. | Tuning observations now carry their true `SYNTHETIC` provenance and enter the sim under `DEMO_ALLOW_SYNTHETIC` (`config.TUNING_EVIDENCE_POLICY`). The resulting `TradeSummary` facts carry `evidenceProvenance: 'SYNTHETIC'`; the real `reduceCareer` grades **none** of them and stays at `SPOT_BASIC` (tests M2 + the per-run `realCareerFinalSkills` assertion). Progression is measured by a new harness-local, **non-authoritative** `TUNING_ANALYSIS_ONLY` evaluator (§3). It reuses the shipped pure qualification functions/constants and mirrors only the per-`TRADE_CLOSED` stat fold `reducer.ts` performs, field-for-field with line references, shape-locked against `createInitialCareer().stats` (tests M4 + M5). It is `scripts/`-only and is not imported by any product/runtime code (test M3). |
| **P1-2** | Gates D/E declared falsifications using an invented "≤ 0.5× DISCIPLINED unlock rate" materiality bar not authorised by `PROJECT_PLAN_V2.md`. | The 0.5× bar is deleted (test M9 — `gates.mjs` contains no `0.5 *`, no `materialityThreshold`). Gates A–E now apply one deterministic operationalisation of "faster in expectation": **`BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK`** (§4). An adversary falsifies §6.1 for a skill **iff** its full-seed-set mean is strictly *lower* than `DISCIPLINED`'s — no threshold. Unlock rate and conditional median are reported as descriptive context only. |
| **P1-3** | Gate F proved disciplined *losers* can progress but never contained a reckless *profitable* comparator, yet was reported PASS. | A pre-declared deterministic `MELT_UP` comparator regime (`config.GATE_F_REGIME`, committed before any policy runs) plus a 24-seed × 5-policy comparator matrix. `ALL_IN` ends above starting equity in **all 24** comparator seeds with ~1340 bps drawdown vs `DISCIPLINED`'s ~180, and reaches only `SCALE_CONTROL`. Gate F now compares that reckless winning process against the 128 disciplined *losing* runs. With **no** reckless winner the gate is `UNTESTED` and the verdict is `HARNESS_EVIDENCE_INCOMPLETE`, never PASS (tests M10 + M11). |
| **P2-4** | The report cited exact +40/+80/… revenge-escalation sensitivity numbers not produced by committed code or the receipt. | Removed. The report keeps only results the committed matrix and `npm run verify:career-tuning` reproduce (the single committed `+120 bps/loss` REVENGE policy). |

### The documented transcription seam

The one production authority that converts sim facts into `CareerEvent`s is
`apps/web/src/practice/store.ts` (`PracticeSessionStore`). The harness does not
import it (it transitively pulls in `dexie` and will not load under plain Node).
`career-bridge.mjs` therefore **transcribes** that derivation — with explicit
line references to `store.ts` at base `4843dc9` — and feeds the result to both
the real `reduceCareer` and the `TUNING_ANALYSIS_ONLY` evaluator. Test 10 locks
the `TRADE_CLOSED` payload to the exact 19-field set `store.ts` copies.

---

## 3. Synthetic-tuning / analysis boundary

There is no `EPISODES_V0` package yet and this phase does not build one. Spot
scenarios are **`TUNING_SYNTHETIC`**: deterministic price paths that are pure
functions of an integer seed.

- A deterministic transformation of a committed scenario definition **does not
  make the underlying market observation real.** Every synthetic observation is
  therefore stamped with the canonical `SYNTHETIC` provenance — the taxonomy
  word for "fabricated / demo / simulator-generated market scenario evidence" —
  and tagged `TUNING_SYNTHETIC` in its `sourceId` / `observationId`. It is never
  relabelled `DERIVED`.
- Because they are `SYNTHETIC`, the real simulator accepts them only under a
  session opened with `DEMO_ALLOW_SYNTHETIC` — the explicit synthetic/demo
  evidence policy the simulator already provides for exactly this purpose. The
  resulting sim `TradeSummary` facts carry `evidenceProvenance: 'SYNTHETIC'`.
- The shipped `reduceCareer` / `isGradableEvidence` **refuse** to grade
  `SYNTHETIC` evidence. The harness proves this: every run's real `career`
  object is fed every derived event and stays at `SPOT_BASIC` forever
  (`realCareerFinalSkills === ['SPOT_BASIC']` for all 768 main runs).
- Progression in the harness is scored by **`TUNING_ANALYSIS_ONLY`**
  (`tuning-evaluator.mjs`). It answers exactly one question:

  > Given these simulator-produced synthetic outcomes, how would the current
  > numerical / behavioural qualification rules respond?

  It does **not** claim "production Career would grade this synthetic evidence".
  It reuses the shipped pure `evaluate*` functions + constants verbatim and
  mirrors only the `reduceTradeClosed` stat fold that is not an exported pure
  function, annotated line-for-line and shape-locked in tests.
- **SHORT / margin** qualification reuses the **real frozen historical episodes**
  (`ETHUSDT_PERP_TRAINING_20260828_0530`, `..._20260805_2055`) and the real
  `deriveLongMarginCompletion`. Those episode marks are genuine historical data
  (`marketProvenance: 'DERIVED'`), so the shipped
  `isQualifyingLongMarginCompletion` accepts a completion on its own terms; only
  the ladder-state check (`evaluateShort`, which needs `MARGIN_2X` — itself only
  reached here through the synthetic spot analysis) runs in the evaluator.
- No harness output is ever written into product code, product provenance, or
  documentation as CONFIRMED / DERIVED real-market evidence.

### Scenario model

`price[t+1] = price[t] * (10000 + drift + noise(seed)) / 10000`, integer bps,
clamped to `[start/4, start*4]`. Five main regimes, `regime = seed % 5`:

| regime | drift bps/tick | vol bps/tick | shock |
|---|---|---|---|
| `GENTLE_UP` | +6 | ±22 | — |
| `BEAR` | −16 | ±34 | — |
| `CHOP` | 0 | ±46 | — |
| `HIGH_VOL` | −3 | ±95 | — |
| `SHOCK_DOWN` | −2 | ±34 | ×0.78 gap at tick 300 |

Plus one **pre-declared Gate F comparator regime** (`config.GATE_F_REGIME`, used
only by the comparator matrix):

| regime | drift bps/tick | vol bps/tick | purpose |
|---|---|---|---|
| `MELT_UP` | +30 | ±20 | strong-drift tape where naive max long exposure ends above starting equity but only after large equity swings — the reckless-lucky-winner comparator |

The full price array is precomputed and frozen at construction, so every policy
at a seed trades the byte-identical market (`priceDigest`, test 11).

---

## 4. Primary falsification metric — `BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK`

For each policy and each of `RISK_SIZING` / `MARGIN_2X` / `SHORT`, over the
**same full committed seed set** (never a survivor subset):

```
value(policy, seed, skill) = accepted actions at unlock, if the skill unlocked
                           = MAX_ACTIONS + 1 (= 301), if it never unlocked in the equal budget
metric(policy, skill)      = arithmetic mean of value over all 128 seeds
```

This folds unlock **probability** and unlock **speed** into one number and
cannot be gamed by choosing a survivor denominator. **Lower = faster in
expectation.** An adversary falsifies §6.1 for a skill **iff** its bounded
expected value is strictly *lower* than `DISCIPLINED`'s. There is no materiality
threshold (a `+0.4`-action difference against a `+275`-action difference are
both simply "not lower"). Unlock rate and conditional median (median actions
among runs that unlocked) are reported but never substitute for this metric.

| policy | `RISK_SIZING` | `MARGIN_2X` | `SHORT` |
|---|---|---|---|
| **DISCIPLINED** | **19.86** | **25.13** | **25.13** |
| ALL_IN | 301 | 301 | 301 |
| OVERTRADER | 301 | 301 | 301 |
| RANDOM | 53.88 | 239.98 | 293.17 |
| STOP_WIDENER | 69.73 | 117.05 | 301 |
| REVENGE | 20.27 | 121.17 | 121.17 |

Every adversary value is `≥` `DISCIPLINED`'s on every late skill. No §6.1 speed
falsification exists.

---

## 5. Seed matrix

- **Main matrix — 128 seeds**, committed as a generator + digest in `config.mjs`:
  `SEEDS[i] = 20260903 + i*7`, seed digest `FNV1A64-68d5677ffa5ab6d7`.
  Regime balance 26 / 26 / 26 / 25 / 25. **6 agents × 128 = 768 runs.**
- **Gate F comparator matrix — 24 seeds** (`SEEDS_F[i] = 20260903 + 100003 + i*11`),
  5 policies (`DISCIPLINED`, `ALL_IN`, `OVERTRADER`, `RANDOM`, `REVENGE`), all on
  `MELT_UP`. **120 runs.**
- Per-run bounds `MAX_TICKS = 600`, `MAX_ACTIONS = 300` (accepted economic
  intents). Every run terminates at or before these (test 12).
- Byte-identical results across re-runs: receipt digest
  `FNV1A64-a68dac7ec19ec340` (tests 2 + M12, verified 3×).

---

## 6. Policy definitions

Every policy is a pure decision function over a `view` of **present and past
facts only**. No policy sees a future mark, a future fill, different fees, better
liquidity, or a different Career constant. Only behaviour differs. Full
definitions in `policies.mjs`; unchanged from the first harness except that they
now run against `SYNTHETIC`-labelled observations.

| # | policy | behaviour |
|---|---|---|
| 1 | **DISCIPLINED** | Fixed 0.05 ETH tickets, then `BUY_RISK_PLANNED` at a conservative 120 bps account-risk budget with a 200 bps invalidation. Protective stop at/near entry, never widened; small manual loss cuts pre-STOP_LOSS; ≥2 partial exits; both long margin episodes completed to `EPISODE_END` at ~14 bps planned risk. Never resets the account. **Loses money in every down regime** and still fully qualifies. |
| 2 | **ALL_IN** | Maximum legal exposure: stacks `SCALE_IN` to the hilt, holds, exits only on a ±10–18 % swing or a 60-tick timeout. No stops, no partials, no conservative sizing. |
| 3 | **OVERTRADER** | Maximum trade frequency: `BUY_FIXED` when flat, `SELL_ALL` next tick, forever. |
| 4 | **RANDOM** | Uniform choice over the currently legal action set via the seeded PRNG; stop distances / risk bps / partial fractions also PRNG-drawn. |
| 5 | **STOP_WIDENER** | Places a protective stop at entry, then nudges it further from price only when the stop is about to fill, and re-tightens on recovery — the realistic pattern. |
| 6 | **REVENGE** | Baseline like DISCIPLINED, but after each consecutive realised loss it raises the account-risk budget of the *next fresh* risk plan by +120 bps (capped at the shipped 1000 bps ceiling), resetting after a win. Still places a proper stop and never grows a position past a frozen plan's budget. |

---

## 7. Current Career constants (snapshot — imported, unchanged)

| constant | value |
|---|---|
| `SCALE_CONTROL_TRADE_TARGET` | 3 |
| `SCALE_CONTROL_LOSS_LIMIT_BPS` | 1000 |
| `STOP_LOSS_TRADE_TARGET` | 5 |
| `STOP_LOSS_EQUITY_FLOOR_WEI` | 350000000000000000 (0.35 ETH) |
| `STOP_PLAN_WINDOW_MS` | 60000 |
| `RISK_SIZING_TRADE_TARGET` | 3 |
| `RISK_SIZING_PARTIAL_EXIT_TARGET` | 1 |
| `MARGIN_2X_CLOSED_SPOT_TARGET` | 8 |
| `MARGIN_2X_RISK_PLANNED_TARGET` | 3 |
| `MARGIN_2X_PARTIAL_EXIT_TARGET` | 2 |
| `MARGIN_2X_RECENT_RISK_TARGET` | 3 |
| `MARGIN_2X_DRAWDOWN_LIMIT_BPS` | 2000 |
| `SHORT_LONG_EPISODE_TARGET` | 2 |
| `SHORT_PLANNED_RISK_LIMIT_BPS` | 500 |

Simulator model versions: `SIM_SPOT_V0`, `SPOT_FILL_V0`, `RISK_PLAN_V0`,
`SIM_MARGIN_V0`.

---

## 8. Result table (main matrix, 128 runs per agent)

| agent | SCALE_CONTROL | STOP_LOSS | RISK_SIZING | MARGIN_2X | SHORT | wipe | final-equity median | max-drawdown median (bps) | risk-budget violations | stop-widens |
|---|---|---|---|---|---|---|---|---|---|---|
| **DISCIPLINED** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 0.961 | 395 | 0 | 0 |
| ALL_IN | 1.00 | 0.86 | 0.00 | 0.00 | 0.00 | 0.00 | 0.676 | 3421 | 0 | 0 |
| OVERTRADER | 1.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.745 | 2551 | 0 | 0 |
| RANDOM | 1.00 | 1.00 | 1.00 | 0.28 | 0.04 | 0.00 | 0.306 | 6944 | 750 | 1999 |
| STOP_WIDENER | 1.00 | 1.00 | 0.87 | 0.70 | 0.00 | 0.00 | 0.944 | 565 | 180 | 1164 |
| REVENGE | 1.00 | 1.00 | 1.00 | 0.66 | 0.66 | 0.00 | 0.820 | 1801 | 0 | 0 |

Unlock rate is a **descriptive** figure. The §6.1 verdict is decided by §4.

---

## 9. Falsification gate outcomes

| gate | subject | verdict | evidence |
|---|---|---|---|
| **A** — ACTION VOLUME | OVERTRADER | **PASS** | Bounded expected actions to every late skill = 301 (never unlocks) vs DISCIPLINED 20–25. Not faster in expectation. |
| **B** — RANDOM SPEEDRUN | RANDOM | **PASS** | Bounded expected 53.9 / 240.0 / 293.2 vs 19.9 / 25.1 / 25.1. Slower on every skill. |
| **C** — RECKLESS VARIANCE | ALL_IN | **PASS** | Bounded expected 301 on every late skill; median final equity 0.68 vs 0.96, median drawdown 3421 vs 395 bps. |
| **D** — STOP DISCIPLINE | STOP_WIDENER | **PASS** | Bounded expected 69.7 / 117.1 / 301 vs 19.9 / 25.1 / 25.1 — slower on every skill. It *does* still reach `RISK_SIZING` (87 %) / `MARGIN_2X` (70 %) — recorded as two `FUTURE DESIGN-TUNING RISK` observations (§10.1–10.2), **not** a §6.1 falsification. |
| **E** — REVENGE | REVENGE | **PASS** | Bounded expected 20.3 / 121.2 / 121.2 vs 19.9 / 25.1 / 25.1 — `RISK_SIZING` is +0.4 actions slower, `MARGIN_2X` / `SHORT` ~5× slower. Reaches `MARGIN_2X`/`SHORT` in 66 % with 0 recorded risk-budget violations — recorded as observation §10.3, not a §6.1 falsification. |
| **F** — DISCIPLINED LOSS vs RECKLESS WINNER | DISCIPLINED / comparator | **PASS** | All 128 DISCIPLINED runs end below break-even (down-regime median 0.953) and all 128 still reach `SHORT`. The `MELT_UP` comparator produced **24** reckless lucky winners (`ALL_IN`, +18–20 % equity, ~1340 bps drawdown vs DISCIPLINED's ~180) — every one caps at `SCALE_CONTROL`, none reaches `RISK_SIZING`, none unlocks anything faster than DISCIPLINED. Positive PnL buys no progression. |
| **G** — SPAM → NO AUTHORITY | OVERTRADER + volume agents | **PASS** | OVERTRADER accepts the full 300-action budget, ~150 trades, 0 rejected, and gains 0 progress past `STOP_LOSS`. No volume agent is faster in expectation than DISCIPLINED on any late skill. |

**`gateVerdict = PASS`. `CAREER_TUNING_HARNESS_V0 = PASS`.**

If the comparator matrix ever produces **no** reckless winner, Gate F reports
`UNTESTED` and the harness reports `HARNESS_EVIDENCE_INCOMPLETE` — never PASS
(tests M10 / M11).

---

## 10. Non-falsifying weaknesses in the numbers (`FUTURE DESIGN-TUNING RISK`)

These are recorded in the receipt's `observations` array and on the individual
gate `observations`. They are numeric-tuning risks a later bounded phase should
weigh. **This phase implements none of them** — doing so would overfit the
production gates to the harness.

### 10.1 `RISK_SIZING` has no recency or clean-rate requirement
Observed by RANDOM (100 % unlock) and STOP_WIDENER (87 %). `evaluateRiskSizing`
needs `stopPlannedTrades >= 3` and `partialExitsUsed >= 1`, both cumulative over
all history, with no window and no "N of the last M were clean" rule. A widened
trade correctly does not count, but any policy that produces three non-widened
planned-stop trades and one partial exit *somewhere* qualifies. Both agents are
nonetheless **slower in expectation** than DISCIPLINED (§4), so this is not a
§6.1 falsification. Candidate later repair: mirror `MARGIN_2X`'s recent-3 rule
onto the `RISK_SIZING` planned-stop requirement.

### 10.2 `evaluateMargin2x` recent-risk check is blind to stop widening
Observed by STOP_WIDENER (70 % `MARGIN_2X`). `recentRiskPlannedOutcomes`
classifies `RESPECTED` from `riskBudgetVerified && !riskBudgetViolated`; a trade
whose stop was widened inside `RISK_BUDGET_TOLERANCE_BPS` still closes
`RESPECTED`, and `summary.stopWidened` is never consulted. Slower in expectation
(117 vs 25 bounded-expected actions). Candidate later repair: treat
`stopWidened === true` as not-`RESPECTED` in the recent-N.

### 10.3 Up-front risk-budget escalation is invisible
Observed by REVENGE (66 % `MARGIN_2X`/`SHORT`, **0** recorded violations).
`RISK_BUDGET_VIOLATED` fires only on a *post-freeze* breach of a frozen plan's
own budget; choosing a larger `riskBps` for the *next* fresh plan after a loss
is a fully-`RESPECTED` trade. REVENGE is still ~5× slower to `MARGIN_2X`/`SHORT`
in expectation than DISCIPLINED, and its median drawdown (1801 bps) sits under
the 2000 bps cap. Candidate later repair: record a discipline signal that
`maxLossBpsOfEquity` rose vs the trailing baseline after a losing trade and gate
`MARGIN_2X` on its absence in the recent-N; and/or tighten
`MARGIN_2X_DRAWDOWN_LIMIT_BPS`.

### 10.4 The 20 % Career drawdown cap is the main numeric backstop for escalating adversaries
`MARGIN_2X_DRAWDOWN_LIMIT_BPS = 2000` is the frozen gate that most often stops
RANDOM (median drawdown 6944 bps → `MARGIN_2X` in only 28 % of runs). It is a
blunt instrument; §10.3's per-trade signal would be sharper. Not a §6.1 issue.

---

## 11. Can the numerical gates be considered frozen?

The §6.1 falsification criterion **passes**. `CAREER_CONTRACT_V0.md` keeps its
status **`FROZEN_STRUCTURE / PROVISIONAL_TUNING`** and this phase does not change
it: promoting `CAREER_THRESHOLDS = PROVISIONAL` to `FROZEN` is a governance
decision that must also weigh the §10 tuning risks and is explicitly **not
taken here.** What this phase establishes is that the measuring instrument is
now sound and the frozen acceptance criterion is met by the shipped ladder.

---

## 12. Hostile review of the harness

The first harness had one hostile review; this repair phase had one further
**targeted** hostile re-review scoped to the independent P1/P2 findings:
provenance laundering, analysis-seam authority, mirrored-Career drift, the
bounded expected-time calculation, survivor bias, D/E thresholds, Gate F
comparator validity, unsupported sensitivity claims. Dispositions:

| attack | disposition |
|---|---|
| synthetic market laundered as gradable | **Fixed.** Observations are `SYNTHETIC`; the sim runs under `DEMO_ALLOW_SYNTHETIC`; `TradeSummary.evidenceProvenance === 'SYNTHETIC'`; real `reduceCareer` grades nothing (per-run `realCareerFinalSkills` + tests M2/M6). |
| analysis seam is a second Career authority | Non-authoritative by construction: `scripts/`-only, not imported by product/runtime (test M3), reuses shipped `evaluate*` + constants (M4), mirrors only the `reduceTradeClosed` stat fold with line references, shape-locked to `createInitialCareer().stats` (M5). Named `TUNING_ANALYSIS_ONLY` in the receipt. |
| mirrored Career drift | Shape lock (M5) fails if `CareerStats` keys diverge; the structural-minimum assertions in test 10 fail if the fold miscounts; `evaluate*` are imported, not copied. |
| bounded expected-time miscalculation | `NON_UNLOCK_ACTION_VALUE = MAX_ACTIONS + 1` asserted (M7); ALL_IN/OVERTRADER = 301 exactly on every late skill. |
| survivor bias / denominator manipulation | Every policy's metric denominator is the full 128-seed set (M8); non-unlock is scored, not dropped. |
| unauthorised D/E thresholds | `gates.mjs` has no `0.5 *`, no `materialityThreshold`, no `<= 0.5` (M9). Gates compare bounded expected actions only. |
| Gate F never exercised | Pre-declared `MELT_UP` comparator; 24 real reckless winners; PASS requires them; absence → `UNTESTED` → `HARNESS_EVIDENCE_INCOMPLETE` (M10/M11). |
| unsupported sensitivity numbers | Removed; report cites only the committed `+120 bps/loss` matrix. |
| agent gets future information | Policies receive only a `view` of current/past; `scenario.priceAt` is never exposed to a policy; every comparator policy trades the identical frozen `MELT_UP` array per seed. |
| threshold changes hidden in the harness | `git diff --stat <base> -- packages/` empty (M13); constants imported and only snapshotted. |
| nondeterminism | SplitMix64 only; no `Math.random` / `Date.now` / `performance.now` (test 9); digest byte-identical ×3 (M12). |

No Critical/High **harness** defect survived the targeted re-review.

---

## 13. Verification

```
node --test scripts/career-tuning/test/*.test.mjs     # 25/25 pass
npm run verify:career-tuning                           # rebuild deps → tests → matrix --check → PASS
npm run verify                                         # full repo gate from artifact-clean dist
```

The 25 focused tests: 1–12 the original harness invariants (determinism, locked
capabilities, non-economic actions grant nothing, STOP_WIDENER really widens,
REVENGE really escalates, DISCIPLINED never widens, RANDOM is pure-PRNG, no
ambient entropy, metrics read from real reducer/evaluator state + `TRADE_CLOSED`
shape lock, run isolation + one market per seed, bounds terminate every run);
M1–M13 the methodology repair (SYNTHETIC observations; real Career refuses
synthetic; evaluator is analysis-only; evaluator reuses shipped constants;
mirrored stat shape/rule lock; no `SYNTHETIC`→`DERIVED` relabel; bounded
expected non-unlock = `MAX_ACTIONS + 1`; full-seed denominator; no 0.5× in
gates; Gate F needs a real reckless winner; missing comparator → `UNTESTED` not
PASS; deterministic receipt digest; no Career threshold changed).

---

## 14. Verdict

```
CAREER_TUNING_HARNESS_V0 = PASS
```

Every frozen `PROJECT_PLAN_V2.md` §6.1 falsification criterion was actually
exercised — reckless / high-frequency / high-variance / stop-widening /
revenge-escalating agents against `DISCIPLINED` under
`BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK`, and a disciplined losing process against a
real reckless lucky winning process under Gate F — and none was falsified. The
ladder favours disciplined process over action volume, random exploration,
reckless variance, stop widening and revenge escalation, and a disciplined
losing run still fully qualifies while a reckless lucky winner does not progress.

This phase tunes nothing. The numeric-tuning risks in §10 are inputs to a later
bounded phase and to the eventual `CAREER_THRESHOLDS = FROZEN` governance
decision, which is not taken here.
