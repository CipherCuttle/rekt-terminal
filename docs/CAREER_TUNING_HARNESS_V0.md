# CAREER_TUNING_HARNESS_V0

Status: **`CAREER_TUNING_HARNESS_V0 = FALSIFIED`**

A falsification is the successful outcome of this phase. It is not a failed
engineering phase — it is evidence that the numerical Career gates are
exploitable and that the next bounded phase must tune them.

- **Exact base commit**: `4843dc91eee91e871072f362618397249eb044e6`
  (the merged `PRODUCT_PLAN_V2_FREEZE` head).
- **Branch**: `agent/career-tuning-harness-v0`.
- **Deterministic receipt**: [`CAREER_TUNING_HARNESS_V0_RECEIPT.json`](./CAREER_TUNING_HARNESS_V0_RECEIPT.json),
  digest `FNV1A64-6e68c5ff9ab59c89`.
- **Run / verify**: `node scripts/sim-career-agents.mjs` · `npm run verify:career-tuning`.

---

## 1. Purpose

`CAREER_CONTRACT_V0.md` §19 requires headless adversarial simulation before the
numerical Career thresholds can be declared release-frozen. The contract keeps
the ladder **structure** frozen (`SPOT_BASIC → SCALE_CONTROL → STOP_LOSS →
RISK_SIZING → MARGIN_2X → SHORT`) and marks the numbers `PROVISIONAL_TUNING`.

The question this phase attempts to falsify:

> Does the shipped progression system actually favour disciplined process over
> action volume, reckless variance, stop widening and revenge behaviour?

The answer, from 128 seeds × 6 policy agents against the real shipped simulator
and the real shipped `reduceCareer`, is **no — not for stop widening and not
for revenge-by-risk-escalation.** Two of the seven falsification gates fail.

---

## 2. Harness architecture

Offline, headless, deterministic Node. No React, no browser deps, no new package.

```
scripts/sim-career-agents.mjs        orchestrator + CLI + receipt writer + gate verdict
scripts/verify-career-tuning.mjs     rebuild deps → focused tests → matrix digest --check
scripts/career-tuning/
  config.mjs        frozen seed set, bounds, versions, Career-constant SNAPSHOT (imported, never redefined)
  prng.mjs          SplitMix64 seeded PRNG — the only source of stochastic behaviour
  scenarios.mjs     TUNING_SYNTHETIC deterministic price paths (see §3)
  career-bridge.mjs faithful transcription of apps/web/src/practice/store.ts's sim→Career event derivation
  spot-driver.mjs   drives the REAL @rekt-ink/sim spot actions + REAL reduceCareer; mirrors the store's capability gate + id scheme
  margin-driver.mjs drives the REAL replayMarginActions over the REAL frozen episodes + REAL deriveLongMarginCompletion
  policies.mjs      the six policy agents
  metrics.mjs       deterministic aggregation + canonical JSON + FNV-1a-64 digest
  gates.mjs         the seven falsification gates
  test/harness.test.mjs   the 12 required focused tests
```

### Production boundary — what the harness exercises

- REAL simulator math and public actions: `executeSpotAction`, `placeSpotStop`,
  `setSpotRiskPlan`, `markSpot`, `replayMarginActions`.
- REAL immutable summaries: sim `TradeSummary`, `deriveLongMarginCompletion`.
- REAL Career qualification: `reduceCareer` and every function it calls.
- REAL frozen historical margin episodes (`MARGIN_TRAINING_EPISODES`).

### Production boundary — what the harness does NOT do

- It changes **no** Career qualification threshold. Every constant in §7 is
  `import`ed from the shipped `@rekt-ink/career` and only snapshotted.
- It adds **no** Career authority path. It fabricates no Career facts, weakens
  no evidence gate, does not touch `isGradableEvidence`, and injects nothing
  through a new exported runtime API.
- Every `TRADE_CLOSED` payload is a field-for-field copy of a **real** sim
  `TradeSummary` (`tradeSummaryToCareerFact`, shape-locked by test 10). Every
  margin completion is the output of the **real** `deriveLongMarginCompletion`.

### The documented seam

The one production authority that converts sim facts into `CareerEvent`s is
`apps/web/src/practice/store.ts` (`PracticeSessionStore`). The harness does not
import it, because it transitively imports `dexie` and does not load under plain
Node. `scripts/career-tuning/career-bridge.mjs` therefore **transcribes** that
derivation — with explicit line references to `store.ts` at base
`4843dc9` — and feeds the result to the real `reduceCareer`. Test 10 locks the
`TRADE_CLOSED` payload to the exact 19-field set `store.ts` copies, so a future
divergence in `store.ts` is caught. This is offline falsification tooling; the
seam is a re-derivation of a documented mapping, not a second Career authority.

---

## 3. Synthetic-tuning boundary

There is no `EPISODES_V0` package yet and this phase does not build one. Spot
scenarios are **`TUNING_SYNTHETIC`**: deterministic price paths that are pure
functions of an integer seed.

- Every synthetic observation is tagged `TUNING_SYNTHETIC` in its `sourceId`
  and `observationId`; the receipt carries `scenarioClass: "TUNING_SYNTHETIC"`.
- They enter the real simulator through observations labelled **`DERIVED`** —
  the exact mechanism `packages/sim`'s own golden-replay fixture uses
  (`makeFixtureObservation` / `createGoldenReplay`, both `DERIVED`). `DERIVED`
  here means what the taxonomy says: "a deterministic calculation from observed
  inputs", where the observed input is the committed synthetic scenario. This
  is the smallest seam that produces gradable `TradeSummary` facts; labelling
  the observations `SYNTHETIC` would force `DEMO_ALLOW_SYNTHETIC` and Career
  would then refuse to grade anything, making the falsification impossible.
- No harness output is ever written into product code, product provenance, or
  documentation as CONFIRMED / DERIVED real-market evidence. The fabricated
  paths are never presented as market history.
- SHORT qualification reuses the **real frozen historical episodes**
  (`ETHUSDT_PERP_TRAINING_20260828_0530`, `..._20260805_2055`) and the real
  public completion derivation. The harness never hand-authors a successful
  episode completion — it chooses only the action stream and lets the shipped
  code decide the outcome.

### Scenario model

`price[t+1] = price[t] * (10000 + drift + noise(seed)) / 10000`, integer bps,
clamped to `[start/4, start*4]`. Five regimes, `regime = seed % 5`:

| regime | drift bps/tick | vol bps/tick | shock |
|---|---|---|---|
| `GENTLE_UP` | +6 | ±22 | — |
| `BEAR` | −16 | ±34 | — |
| `CHOP` | 0 | ±46 | — |
| `HIGH_VOL` | −3 | ±95 | — |
| `SHOCK_DOWN` | −2 | ±34 | ×0.78 gap at tick 300 |

The full price array is precomputed and frozen at construction, so all six
agents at a seed trade the byte-identical market (proved by `priceDigest`,
test 11).

---

## 4. Policy definitions

Every policy is a pure decision function over a `view` of **present and past
facts only**. No policy sees a future mark, a future fill, different fees,
better liquidity, or a different Career constant. Only behaviour differs.

| # | policy | behaviour |
|---|---|---|
| 1 | **DISCIPLINED** | Fixed 0.05 ETH tickets then, once available, `BUY_RISK_PLANNED` at a conservative **120 bps** account-risk budget (between the shipped 1% and 2% presets) with a 200 bps invalidation. Places a protective stop at/near entry, never widens it, cuts small manual losses pre-STOP_LOSS, does ≥2 partial exits, completes both long margin episodes to `EPISODE_END` at ~14 bps planned risk. Never resets the account. May — and does — lose money. |
| 2 | **ALL_IN** | Maximum legal exposure: stacks `SCALE_IN` tickets to the hilt, holds, exits only on a ±10–18 % swing or a 60-tick timeout. No stops, no partials, no conservative sizing. |
| 3 | **OVERTRADER** | Maximum trade frequency: `BUY_FIXED` when flat, `SELL_ALL` on the very next tick, forever. No stops, no partials, no risk plans. (A "disciplined high-frequency" agent would simply be DISCIPLINED with shorter holds and would — correctly — progress, because it demonstrates the process. OVERTRADER models pure count.) |
| 4 | **RANDOM** | Uniform choice over the *currently legal* action set via the seeded PRNG; stop distances / risk bps / partial fractions also drawn from the PRNG. Tests accidental unlock paths. |
| 5 | **STOP_WIDENER** | Places a protective stop at entry, then nudges it **further from price only when the stop is about to fill** (price within ~0.3 % of it), and re-tightens on recovery. This is the realistic pattern. An eager "widen on any 0.5 % adverse tick" variant was explored in hostile review; it is more self-destructive than a real widener and is **not** the committed model. |
| 6 | **REVENGE** | Baseline like DISCIPLINED, but after each consecutive realised loss it **raises the account-risk budget of the next fresh risk plan by +120 bps** (capped at the shipped 1000 bps ceiling) — "size up to win it back" — and resets to baseline after a winning trade. It still places a proper stop and never grows a position past a frozen plan's budget. An "averaging down in anger" add-on (scaling into an open position past its frozen budget) was explored in hostile review; the shipped frozen-budget breach detector **does** catch that, so it is not the committed model — the committed model isolates the part Career does *not* see. |

---

## 5. Seed matrix

- **128 seeds**, committed as a generator + digest in `config.mjs`:
  `SEEDS[i] = 20260903 + i*7`, seed digest `FNV1A64-68d5677ffa5ab6d7`.
  Regime balance: 26 / 26 / 26 / 25 / 25.
- **6 agents × 128 seeds = 768 deterministic runs.** The `128 × 6` target is met
  with measured runtime ≈ 12 s for the full matrix; each focused-test run does
  the full matrix twice (≈ 22 s) and `npm run verify:career-tuning` ≈ 35 s
  including package rebuilds.
- Per-run bounds: `MAX_TICKS = 600`, `MAX_ACTIONS = 300` (accepted economic
  intents). Every run terminates at or before these (test 12). The 300-action
  budget is deliberately generous — it is the *more adversarial* choice, giving
  a random / exploratory attacker the most chances; the gate comparisons below
  are nonetheless budget-invariant on reliability and speed because DISCIPLINED
  finishes the whole ladder in a median of 25 accepted actions.
- Byte-identical results across re-runs (test 2, verified 3×): digest
  `FNV1A64-6e68c5ff9ab59c89`.

---

## 6. Metrics

Per agent, aggregated over its 128 runs (full numbers in the receipt's
`agents` and `byRegime`):

- unlock **rate** for `SCALE_CONTROL` / `STOP_LOSS` / `RISK_SIZING` /
  `MARGIN_2X` / `SHORT`;
- **accepted actions** and **completed trades** to each unlock — mean / median /
  p90;
- wipe probability; account-reset rate; liquidation rate;
- max account-drawdown distribution (sim + Career reducer) — mean / median / p90;
- risk-budget violation count & rate; unverified-risk count & rate;
- stop-widening count & rate;
- receipt frequency; final-equity-fraction distribution.

**`CAREER_SCORE = NOT_IMPLEMENTED`.** The shipped product implements no global
Career score (`packages/career` has no score module; `tuning.ts` carries only a
version string). The provisional weighting hypothesis in `CAREER_CONTRACT_V0`
§17 is not built and this harness does not invent one.

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

## 8. Result table

Unlock rate (fraction of 128 runs), plus survival:

| agent | SCALE_CONTROL | STOP_LOSS | RISK_SIZING | MARGIN_2X | SHORT | wipe | final-equity median | max-drawdown median (bps) | risk-budget violations | stop-widens |
|---|---|---|---|---|---|---|---|---|---|---|
| **DISCIPLINED** | 1.00 | 1.00 | **1.00** | **1.00** | **1.00** | 0.00 | 0.961 | 395 | 0 | 0 |
| ALL_IN | 1.00 | 0.86 | 0.00 | 0.00 | 0.00 | 0.00 | 0.676 | 3421 | 0 | 0 |
| OVERTRADER | 1.00 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.745 | 2551 | 0 | 0 |
| RANDOM | 1.00 | 1.00 | 1.00 | 0.28 | 0.04 | 0.00 | 0.306 | 6944 | 750 | 1999 |
| **STOP_WIDENER** | 1.00 | 1.00 | **0.87** | **0.70** | 0.00* | 0.00 | 0.944 | 565 | 180 | 1164 |
| **REVENGE** | 1.00 | 1.00 | **1.00** | **0.66** | **0.66** | 0.00 | 0.820 | 1801 | **0** | 0 |

\* STOP_WIDENER's committed `marginPlan` closes episodes mid-path (`MID_MANUAL`),
so it never produces an `EPISODE_END` completion. Its spot-side result is the
finding; a STOP_WIDENER given an `EPISODE_END` margin plan would also reach
SHORT.

Actions to `MARGIN_2X` (accepted economic intents, among runs that reached it):

| agent | n | median | p90 | min |
|---|---|---|---|---|
| DISCIPLINED | 128 | 25 | 29 | 21 |
| REVENGE | 84 | 27 | 29 | 23 |
| STOP_WIDENER | 90 | 35 | 58 | 24 |
| RANDOM | 36 | 82 | 108 | 42 |

Per-regime (`MARGIN_2X` unlock rate):

| regime | DISCIPLINED | STOP_WIDENER | REVENGE | RANDOM |
|---|---|---|---|---|
| GENTLE_UP | 1.00 | 1.00 | 1.00 | 0.31 |
| CHOP | 1.00 | 0.88 | 0.92 | 0.31 |
| HIGH_VOL | 1.00 | 0.96 | 0.73 | 0.35 |
| SHOCK_DOWN | 1.00 | 0.64 | 0.60 | 0.24 |
| BEAR | 1.00 | 0.00 | 0.00 | 0.20 |

The escalating adversaries are only reliably stopped in the sustained-`BEAR`
regime, where drawdown compounds past the 20 % cap. In rising, choppy and
volatile markets they reach `MARGIN_2X` (and, for REVENGE, `SHORT`) at
60–100 %.

---

## 9. Falsification gate outcomes

| gate | subject | verdict | evidence |
|---|---|---|---|
| **A** — ACTION VOLUME | OVERTRADER | **PASS** | OVERTRADER closes a median of 150 trades vs DISCIPLINED's 11, and reaches `RISK_SIZING` / `MARGIN_2X` / `SHORT` in **0 %** of runs. Raw activity is not sufficient. |
| **B** — RANDOM SPEEDRUN | RANDOM | **PASS** | RANDOM reaches `MARGIN_2X` in 28 % of runs (vs 100 %) and `SHORT` in 4 %, and needs a median of 82 accepted actions vs DISCIPLINED's 25 (min 42 > DISCIPLINED's max 31). Neither faster nor more reliable, in aggregate or in any regime. |
| **C** — RECKLESS VARIANCE | ALL_IN | **PASS** | ALL_IN reaches `RISK_SIZING`+ in 0 % of runs while carrying materially worse survival (median final equity 0.68 vs 0.96; median drawdown 3421 vs 395 bps). No lucky high-variance path to leverage. |
| **D** — STOP DISCIPLINE | STOP_WIDENER | **FALSIFIED** | A realistic STOP_WIDENER widens in 77 % of runs (1164 widens total) yet reaches `RISK_SIZING` in **87 %** and `MARGIN_2X` in **70 %** of runs — 0.87× and 0.70× DISCIPLINED's rate, far above the 0.5× materiality threshold. It is **not** materially disadvantaged. |
| **E** — REVENGE | REVENGE | **FALSIFIED** | REVENGE raises its account-risk budget after every loss and reaches `MARGIN_2X` and `SHORT` in **66 %** of runs (0.66× DISCIPLINED) with **zero** recorded risk-budget violations and zero unverified-risk trades. The escalation is invisible to qualification; only the 20 % drawdown cap resists it, and it leaks. |
| **F** — DISCIPLINED LOSSES | DISCIPLINED | **PASS** | **All 128** DISCIPLINED runs end below break-even (down-regime median 0.953) and **all 128** still reach `SHORT`. The best reckless lucky winner (ALL_IN, final equity 0.98) never gets past `STOP_LOSS`. Losing with correct process does not block progression; positive PnL with reckless process is not rewarded. |
| **G** — SPAM → NO AUTHORITY | OVERTRADER + all | **PASS** | OVERTRADER accepts the full 300-action budget, ~150 trades, 0 rejected actions, and gains **0** progress past `STOP_LOSS`. Rejected / duplicate / `WAIT` actions advance no Career stat (test 4). |

**`gateVerdict = FALSIFIED` (gates D and E).**

---

## 10. Discovered exploits / pathologies

### 10.1 `RISK_SIZING` has no recency or clean-rate requirement — *HIGH*
Observed by RANDOM (100 %) and STOP_WIDENER (87 %).

`evaluateRiskSizing` needs `stopPlannedTrades >= 3` and `partialExitsUsed >= 1`,
both **cumulative over all Career history**. A widened trade correctly does not
count (`isStopPlannedTrade` rejects `stopWidened`), but there is no window and
no "3 of the last N were clean" rule, so any policy that produces three
non-widened planned-stop trades and one partial exit *somewhere* in a long
history qualifies — regardless of how it behaved on every other trade. Contrast
`MARGIN_2X`, which does have a recent-3 rule on risk-planned outcomes.

### 10.2 `MARGIN_2X` recent-risk check is blind to stop widening — *HIGH*
Observed by STOP_WIDENER (70 % `MARGIN_2X`).

`recentRiskPlannedOutcomes` classifies a trade as `RESPECTED` from
`riskBudgetVerified && !riskBudgetViolated`. A trade whose protective stop was
**widened** still closes `RESPECTED` as long as the widen keeps projected loss
inside `RISK_BUDGET_TOLERANCE_BPS` (500 bps of the frozen budget). `stopWidened`
is recorded on the summary but is never consulted by `evaluateMargin2x`. So the
`MARGIN_2X` recent-3 gate does not "see" widening the way `RISK_SIZING`'s
planned-stop count does.

### 10.3 Up-front risk-budget escalation is invisible — *HIGH*
Observed by REVENGE (66 % `MARGIN_2X` / `SHORT`, **0** violations).

`RISK_BUDGET_VIOLATED` fires only when projected loss exceeds a **frozen plan's
own** budget + tolerance — i.e. a *post-freeze* position increase or stop widen.
Choosing a larger `riskBps` for the *next* fresh plan after a loss produces a
fully-sized, fully-`RESPECTED` trade. Career records no signal that "planned
account risk escalated after a losing trade." Sensitivity sweep (committed
policy is +120 bps/loss):

| escalation step | `MARGIN_2X` / `SHORT` rate | recorded violations | drawdown median |
|---|---|---|---|
| +40 bps/loss | 100 % | 0 | 705 bps |
| +80 bps/loss | 100 % | 0 | 1260 bps |
| +120 bps/loss | 66 % | 0 | 1780 bps |
| +200 bps/loss | 44 % | 0 | 6643 bps |
| +300 bps/loss | 39 % | 0 | 6756 bps |

The finding is not knife's-edge: a *mild* revenge escalation (+40 / +80 bps of
account risk per consecutive loss) reaches `SHORT` in **100 %** of runs,
identical to DISCIPLINED, with zero recorded risk-discipline signal.

### 10.4 The 20 % Career drawdown cap is the only real backstop
For all three exploits above, the *only* frozen gate that ever resists the
escalating adversaries is `MARGIN_2X_DRAWDOWN_LIMIT_BPS = 2000`, and it only
bites in the sustained-`BEAR` regime. RANDOM (median drawdown 6944 bps) is
blocked by it in 72 % of runs; STOP_WIDENER and mild REVENGE keep drawdown low
enough (565 / ~1300 bps) to pass.

### 10.5 Latent, not a gate failure: cumulative assembly by RANDOM
RANDOM reaches `RISK_SIZING` in 100 % of runs (same as DISCIPLINED) — but a
median of 47 accepted actions vs 20, and never faster. This does not fail a
stated gate (no gate concerns RANDOM → `RISK_SIZING`, and it is not faster than
DISCIPLINED), but it is the same underlying weakness as 10.1 and is fixed by the
same repair.

---

## 11. Can the numerical gates be considered frozen?

**No.** `CAREER_TUNING_HARNESS_V0 = FALSIFIED`.

`CAREER_CONTRACT_V0.md` keeps its status **`FROZEN_STRUCTURE /
PROVISIONAL_TUNING`**; this phase does not change it and does not recommend
`CAREER_THRESHOLDS = EVIDENCE_SUPPORTED_V0`. The ladder *structure* and the
gates that concern **action volume, random exploration and reckless variance**
(A, B, C, F, G) are strongly supported by the evidence. The gates that are
supposed to resist **stop widening** (D) and **revenge / risk escalation after
losses** (E) are exploitable as shipped.

### Smallest future tuning repairs (identified, NOT implemented here)

Repair is a separate bounded phase. The receipt's `recommendations` array
carries these machine-readably.

1. **`RISK_SIZING_NO_RECENT_WINDOW`** — add a recent-window + clean-rate rule to
   the `RISK_SIZING` planned-stop requirement, mirroring `MARGIN_2X`'s
   recent-3-`RESPECTED` rule (e.g. "3 of the last N closed spot trades were
   planned-stop and none widened"). Closes 10.1 and 10.5.
2. **`MARGIN_2X_RECENT_RISK_IGNORES_WIDENING`** — classify a trade with
   `summary.stopWidened === true` as not-`RESPECTED` in
   `recentRiskPlannedOutcomes`, or add a "no `STOP_WIDENED` in the recent-N
   risk-planned trades" clause to `evaluateMargin2x`. Closes 10.2.
3. **`RISK_BUDGET_ESCALATION_INVISIBLE`** — record a discipline signal that a
   risk-planned trade's `maxLossBpsOfEquity` rose versus the trailing baseline
   after a losing trade, and gate `MARGIN_2X` (and/or the discipline streak) on
   its absence in the recent-N risk-planned trades. Alternatively tighten
   `MARGIN_2X_DRAWDOWN_LIMIT_BPS` and/or add a per-trade drawdown-contribution
   cap. Closes 10.3 / 10.4.

This harness must **not** perform any of these — doing so in this phase would be
overfitting the production gates to the harness.

---

## 12. Hostile review of the harness

One independent hostile review was performed against the harness itself (not the
Career gates). Attacks considered and their disposition:

| attack | finding |
|---|---|
| agent gets future information | Clean. Policies receive only a `view` of the current/past; `scenario.priceAt` is never exposed to a policy; the margin driver builds its view at the current tick. Fixed frozen episodes are historical training data by design. |
| DISCIPLINED artificially privileged | Same `view` API, `apply`, capability gate and fees as every agent. Its edge is *exactly* the disciplined process the contract defines. Its "guarantee ≥2 partial exits early, regardless of PnL" helper is an explicit modelling choice (the objective system nudges every player to do this) and STOP_WIDENER and REVENGE run the same helper. |
| adversarial agents sabotaged | The two initially-committed adversaries (eager 0.5 %-adverse widener; averaging-down revenge) **were** more self-destructive than realistic behaviour — and hostile review *replaced them* with the realistic models in §4, which is what produced the falsification. ALL_IN / OVERTRADER never place stops **by definition of the policy**, not by denial: they are offered every legal action and reach `SCALE_CONTROL` (100 %) and `STOP_LOSS` (86–100 %). |
| seed bias | 128 seeds, `regime = seed % 5`, `SEEDS[i] = base + i*7` (`gcd(7,5)=1`) → 26/26/26/25/25 regime balance. Scenario PRNG seeded per-seed. |
| tiny sample count | 768 runs; ~25 per regime; SE on the ~66 % REVENGE rate ≈ 4 pp. Findings hold across a full escalation sweep (§10.3). |
| survivor bias / denominator manipulation | Unlock **rate** denominator is *all* 128 runs for the agent, never a survivor subset; wipe / reset / liquidation rates likewise. `actionsToUnlock` uses the reached subset (unavoidable) and reports `n`. |
| rejected / duplicate actions counted as progress | Driver emits Career events only on **accepted** actions; `reduceCareer` dedups by `eventId` / `processedTradeIds`. Test 4 hammers 50 illegal BUYs + 50 WAITs → Career state byte-identical. |
| harness fabricates successful Career facts | It does not. Every `TRADE_CLOSED` payload is copied from a real sim `TradeSummary` (shape-locked, test 10); every margin completion is real `deriveLongMarginCompletion` output. The `store.ts` transcription is the documented seam (§2). |
| synthetic market laundered as CONFIRMED/DERIVED | Scenarios are `TUNING_SYNTHETIC` end-to-end (§3); the `DERIVED` observation label is the sim's own fixture mechanism and never reaches product provenance or docs. |
| duplicate events / nondeterminism | SplitMix64 only; no `Math.random` / `Date.now` / `performance.now` (test 9); digest byte-identical across re-runs (test 2, 3× manual). |
| inconsistent market between agents | All six agents rebuild the scenario from the same seed → identical frozen price array (test 11, `priceDigest`). |
| metric calculation errors | `unlockRate = reached/128`; linear-interpolation quantiles over a sorted copy; `careerScore` hard-`NOT_IMPLEMENTED`, never invented. |
| threshold changes hidden in the harness | Career constants are `import`ed from `@rekt-ink/career` and only snapshotted; `git diff --stat` shows zero changes under `packages/`. |

No Critical/High **harness** defect survived review (the "sabotaged adversary"
Medium was fixed by replacing the two policies, which is what surfaced the
falsification). One targeted re-review confirmed the realistic models and the
strengthened D/E gate logic. Two accepted-with-mitigation items: the `store.ts`
transcription seam (documented + shape-locked) and the `DERIVED` fixture-label
boundary (documented; the only seam that yields gradable facts offline).

---

## 13. Verification

```
node --test scripts/career-tuning/test/harness.test.mjs      # 12/12 pass
npm run verify:career-tuning                                 # rebuild deps → tests → matrix --check → PASS
npm run verify                                               # full repo gate (from artifact-clean dist)
```

The 12 focused tests: (1) identical policy action stream per seed; (2) identical
full-matrix receipt digest, incl. vs the committed receipt; (3) locked
capabilities refused; (4) rejected / non-economic actions grant no progress;
(5) STOP_WIDENER really widens and a widened trade never counts as planned-stop;
(6) REVENGE really escalates risk after a loss and resets after a win;
(7) DISCIPLINED never widens in any run or state; (8) RANDOM is a pure function
of the seeded PRNG; (9) no `Math.random` / `Date.now` in the harness;
(10) per-run metrics are read from real reducer state + `TRADE_CLOSED` shape
lock; (11) runs are isolated and all agents share one market per seed;
(12) every run terminates within `MAX_TICKS` / `MAX_ACTIONS`.

---

## 14. Verdict

```
CAREER_TUNING_HARNESS_V0 = FALSIFIED
```

Gates A, B, C, F, G pass: the shipped ladder favours disciplined process over
action volume, random exploration and reckless variance, and a disciplined
losing run still fully qualifies.

Gates D and E fail: a realistic stop-widener and a revenge trader who escalates
account risk after losses both reach `MARGIN_2X` (and, for REVENGE, `SHORT`) at
60–100 % in every regime except a sustained bear, because `RISK_SIZING` has no
recency window, the `MARGIN_2X` recent-risk check ignores stop widening, and
up-front risk-budget escalation leaves no `RISK_BUDGET_VIOLATED` trace.

The next bounded phase must apply the smallest repairs in §11. This phase does
not touch Career semantics or thresholds.
