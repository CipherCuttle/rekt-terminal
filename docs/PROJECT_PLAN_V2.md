# Project Plan V2 — REKT Terminal

`STATUS: CAPABILITY_LADDER_V0 CLOSED THROUGH SHORT / MARKET_TRUTH_V1 SHIPPED / LIVE_PROVIDER_SMOKE_V0 PASS / MOBILE_PWA_V0 CLOSED / CAREER_TUNING_HARNESS_V0 PASS / EPISODES_V0 IMPLEMENTED / CAREER_THRESHOLDS = PROVISIONAL / LEARNING_ARCHITECTURE NEXT`

Canonical forward-looking product plan. Supersedes `PROJECT_PLAN_V1.md` as the
active roadmap. V1 is retained unchanged below its banner as historical
provenance for the original 10-stack architecture decisions and Phase 0–6 plan.

This is a **docs/architecture reconciliation**. It authorizes no implementation.
It changes no simulator, Career, market, web, PWA, margin, or SHORT source.

---

## 0. Why V2 exists

`PROJECT_PLAN_V1.md` froze the product direction correctly but its status line
and phase plan drifted. V1 still declared:

```text
MARKET_TRUTH_V1_CLOSED / RISK_SIZING_V0_IMPLEMENTED / NEXT: MARGIN_2X (unauthorized)
```

while `MARGIN_2X_V0`, `SHORT_V0`, and `MOBILE_PWA_V0` have all since been merged
to `main`. V1 also framed the product as teaching purely through:

```text
observe -> trade -> manage -> consequence -> feedback -> unlock
```

"not through a large tutorial curriculum."

That framing is only half right. REKT should still reject tutorial walls. But
**consequence alone is not pedagogy.** A player can lose money many times and
learn nothing transferable. V2 keeps the anti-tutorial stance and adds a
deliberate, deterministic learning layer on top of the machinery already built.

---

## 1. Verified current state

Verified against `origin/main` at commit
`9634858ddbe8cbb2ef4d4120e30c12dd7a4f3bfd` (143 commits, PRs #1–#11 merged).

### Shipped and closed

| Capability / phase | Status | Primary evidence |
| --- | --- | --- |
| Phase 0 deterministic spot simulator | Shipped | `a930ced`; `packages/sim/src/{spot,ledger,position,account,math,replay}.ts` |
| `MVP_TERMINAL_LOOP_V0` (spot practice terminal) | Shipped | `19f9297`; PR #3 `b226808`; `apps/web/src/terminal/*` |
| Career recoverability r1 | Shipped | PR #1 `fb79957`; `3d4b585` |
| `SCALE_CONTROL` | Shipped (no standalone closure doc) | `packages/career/src/{skills,qualification,reducer}.ts`; `SCALE_IN` / `PARTIAL_EXIT` capabilities |
| `STOP_LOSS` (phase-2) | Shipped | PR #2 `17f4537`; `41d768d`, `917f205`; `STOP_MARKET` capability; `stopUsed` / `stopWidened` ledger fields |
| `MARKET_TRUTH_V1` | Shipped (no standalone closure doc) | PR #4 `b729c31`; `57f664d`; README reconcile `5fea9be`; `apps/api/test/market-truth.test.mjs`, `apps/web/src/test/market-truth.test.ts` |
| Market-truth canonicalization | Shipped | PR #5 `b7f5924`; `91db7e3` |
| `VERCEL_DEMO_V0` | Deployment-only | PR #6 `207d66b`; `docs/VERCEL_DEMO_V0.md` |
| `CHART_INTERACTION_V1` | Shipped | PR #7 `2b3d640`; `docs/agent-packets/CHART_INTERACTION_V1.md` |
| `LIVE_PROVIDER_SMOKE_V0` | `CLOSED / PASS` | PR #9 `c8cfa3f`; `docs/LIVE_PROVIDER_SMOKE_V0.md` + `docs/LIVE_PROVIDER_SMOKE_V0_RECEIPT.json` |
| `RISK_SIZING_V0` | `IMPLEMENTED / HOSTILE_REVIEW_REPAIRED / BOUNDED` | `31d3cba`, `525d60c`; PR #11 `ebcaa1a`; `packages/sim/src/risk.ts`; `docs/agent-packets/RISK_SIZING_V0.md` |
| `MARGIN_2X_V0` | `CLOSED_PASS` | through `275d59b`; `docs/MARGIN_2X_V0.md`; `packages/sim/src/margin/{margin-v0,episode-v0,public-v0}.ts` |
| `SHORT_V0` | `CLOSED_PASS` | through `b6af37f`; `docs/SHORT_V0.md`; `packages/sim/src/margin/{short-v0,completion-v0}.ts` |
| `MOBILE_PWA_V0` | `CLOSED` (commit-declared; no standalone closure doc) | `9634858` "feat(pwa): close MOBILE_PWA_V0"; `scripts/verify-pwa.mjs`; `apps/web/src/pwa.tsx`, `apps/web/src/test/pwa.test.tsx` |

### Implemented CAPABILITY ladder (from `packages/career/src/skills.ts`)

```text
SPOT_BASIC       -> SPOT_MARKET_BUY_FIXED, SPOT_SELL_ALL
SCALE_CONTROL    -> SCALE_IN, PARTIAL_EXIT
STOP_LOSS        -> STOP_MARKET
RISK_SIZING      -> CUSTOM_POSITION_SIZE, RISK_PERCENT_SIZING
MARGIN_2X        -> PERP_LONG_2X
SHORT            -> PERP_SHORT_2X
```

### Package tree today

```text
packages/core     (replay.mjs only)
packages/sim      (spot + risk + margin/short + provenance/observation)
packages/career   (reducer, qualification, objective, skills, receipts, migrations; save version 5)
```

### Confirmed gaps (verified absent on `main`)

- No `packages/learning`, `packages/market-analysis`, `packages/episodes`.
- No `scripts/sim-career-agents.mjs` (or equivalent). The headless adversarial
  tuning harness required by `CAREER_CONTRACT_V0.md` §19 does **not** exist.
  `CAREER_CONTRACT_V0.md` still carries `PROVISIONAL_TUNING`.
- No general historical-episode contract. Margin training uses two bespoke
  frozen episodes in `packages/sim/src/margin/episode-v0.ts`
  (`ETHUSDT_PERP_20260828_0530_OHLC_PATH_V0`,
  `ETHUSDT_PERP_20260805_2055_OHLC_PATH_V0`), not a reusable framework.
- `MarketEnvironment` in code is `LIVE | DEMO` only
  (`apps/web/src/practice/store.ts`). There is no `REPLAY` or `EXAM`
  environment.
- No dedicated closure receipts for `MARKET_TRUTH_V1` or `MOBILE_PWA_V0`
  (both are real in code, commits, and CI gates, but lack a `docs/*_V0.md`
  receipt). Minor documentation debt; not blocking.

### Verdict on current state

The trading machinery is done for the MVP arc. REKT can already simulate spot,
scaling, stops, risk-derived sizing, 2x isolated long, and 2x isolated short
deterministically, with transparent fills, fees, funding, and liquidation, and
with a process-gated capability ladder. What it cannot yet do is **prove the
player learned anything that transfers.**

---

## 2. Product thesis V2 (frozen)

> REKT Terminal is a deliberate-practice trading environment built on real
> market observations, transparent deterministic simulation, progressive
> capability access, and deterministic learning missions. Its purpose is to
> improve decision-making under uncertainty — not to train users to predict
> candles or maximize trading frequency.

Preserved core fantasy:

> Start with 0.5 ETH. Survive. Earn the dangerous controls.

What V2 makes explicit: **earning controls is only one of two progression
axes.** Surviving and unlocking the dangerous controls proves mechanical
discipline. It does not, by itself, prove understanding. V2 adds a second axis
for understanding, and eventually gates the most dangerous future capabilities
on both.

REKT does **not** claim to teach edge, alpha, or market prediction. It teaches
epistemics (what is true), execution reality (what a fill costs), risk process
(invalidation → account risk → size), and the behavior of leverage. Directional
skill is out of scope and is never graded.

---

## 3. Two progression axes (architectural direction frozen; state NOT implemented)

### 3.1 CAPABILITY — what the player is allowed to do

The implemented ladder (`SPOT_BASIC → SCALE_CONTROL → STOP_LOSS → RISK_SIZING →
MARGIN_2X → SHORT`) is the CAPABILITY axis. It is process-gated per
`CAREER_CONTRACT_V0.md` and stays that way. Capabilities are earned by
demonstrated behavior on the simulator.

### 3.2 MASTERY — what the player has demonstrated they understand

A separate dimension. Mastery is earned by passing deterministic learning
missions and, for advancement, by demonstrating the same understanding on
**unseen** market episodes (see §5, §7, §9).

Proposed initial mastery concepts (names not frozen; the axis is):

- `MARKET_TRUTH` — CONFIRMED / DERIVED / SYNTHETIC / STALE / UNAVAILABLE
- `POSITION_AND_PNL` — mark vs fill, fees, realized vs unrealized
- `LIQUIDITY_AND_EXECUTION` — participation, modeled impact, choosing not to trade
- `STOP_DISCIPLINE` — invalidation, trigger vs fill, not widening
- `ACCOUNT_RISK` — risk budget as a fraction of equity
- `POSITION_SIZING` — size as an output of stop distance and account risk
- `LEVERAGE` — how leverage changes loss geometry
- `LIQUIDATION` — why the liquidation price is where it is
- `LONG_SHORT` — directional inversion, funding sign, short liquidation geometry
- later: `TREND`, `VOLATILITY`, `INDICATOR_CONTEXT`

### 3.3 The gate rule (frozen direction)

No dangerous **future** capability (beyond the currently shipped ladder) may be
unlocked by mechanical Career behavior alone. Future dangerous capabilities
(`>2x`, advanced orders, etc.) must eventually require **both** demonstrated
behavior (CAPABILITY) **and** relevant mastery evidence (MASTERY) on unseen
episodes.

The currently shipped ladder through `SHORT` is not retroactively re-gated by
this rule. It stays as `CAREER_CONTRACT_V0.md` defines it.

Mastery state, mastery events, and mission facts are **not implemented** in this
phase. Only the architectural direction is frozen here.

---

## 4. Learning principles (frozen invariants)

1. PnL does not prove knowledge.
2. A disciplined losing trade may be good process.
3. A reckless profitable trade may be bad process.
4. Mission PASS is deterministic.
5. An LLM cannot determine mission PASS, Career progression, PnL, indicator
   values, liquidation, or market truth. Ever.
6. Learning state cannot alter simulator economics. The learning layer reads
   simulator/Career facts; it never writes economic state.
7. No XP for clicks, trading frequency, time in app, or notional.
8. Correct inaction may be rewarded. "I chose not to send this order, and here
   is why" is a passable answer.
9. Technical indicators are taught as information transformations and context,
   never as universal buy/sell signals.
10. Transfer must eventually be tested on unseen real market episodes, not only
    on the episodes used for guided practice.

These extend, and do not replace, the frozen domain invariants in
`PROJECT_PLAN_V1.md` §4 and `SIM_CONTRACT_V0.md` §1.

---

## 5. Environment model (long-term; `REPLAY` / `EXAM` NOT implemented)

Environment and provenance are **different dimensions**. Provenance
(`CONFIRMED` / `DERIVED` / `SYNTHETIC` / `STALE` / `UNAVAILABLE`, per
`SIM_CONTRACT_V0.md` §15) labels an individual value. Environment describes the
session's data regime. Do **not** invent an `EPISODE` provenance value.

### LIVE

Real current market evidence. No known future. Practice process against current
markets. Fail closed when evidence is unusable (`STALE` / `UNAVAILABLE`). This
exists today (`MarketEnvironment = 'LIVE'`).

### REPLAY (future)

A recorded historical real-market episode. Future marks withheld behind an
advance cursor. Retry allowed. Used for guided deliberate practice and mission
scenarios. The current bespoke margin training desk is a **proto-REPLAY**: it
already withholds future OHLC and replays deterministically, but it is not
modeled as an environment and does not use a general episode contract.

### EXAM (future)

A previously unseen recorded historical episode. Future withheld. Guidance
minimized. Used to produce transfer/mastery evidence. A player must not have
practiced the exact `episodeId` before it counts as EXAM evidence.

### DEMO

Synthetic fixtures. Every value clearly `SYNTHETIC` where synthetic. For
development and showcase only. Cannot produce normal Career or mastery
qualification. This exists today (`MarketEnvironment = 'DEMO'`,
`DEMO_ALLOW_SYNTHETIC` evidence policy). The offline PWA shell must never let
cached DEMO or stale data masquerade as LIVE — a boundary `MOBILE_PWA_V0`
already enforces by not caching `/v1/*` or `/health`.

---

## 6. Roadmap V2 (replaces V1 §11 Phase 3–6 forward plan)

Ordered. Each item is a bounded phase with its own packet and closure receipt.
**Do not add leverage beyond 2x, advanced order types, exchange-specific
models, or an LLM coach until §6.6 preconditions are met.**

### 6.1 NEXT 1 — `CAREER_TUNING_HARNESS_V0`

Overdue. Required by `CAREER_CONTRACT_V0.md` §19 before numerical gates can be
declared release-frozen.

Implement the headless policy agents:

- `DISCIPLINED` — modest size, cuts losses, does not widen stops, low turnover
- `ALL_IN` — maximum allowed exposure whenever possible
- `OVERTRADER` — actions at maximum practical frequency
- `RANDOM` — random entries/exits within unlocked capabilities
- `STOP_WIDENER` — repeatedly moves the stop away when losing
- `REVENGE` — increases risk after a loss

Measure per agent: actions/trades to each unlock, wipe probability, max
drawdown, liquidation rate, qualification rate, receipt frequency.

Acceptance (falsification gate):

> Reckless / high-frequency / high-variance agents must not reach `RISK_SIZING`,
> `MARGIN_2X`, or `SHORT` faster than `DISCIPLINED` behavior in expectation.
> A disciplined losing run must not be graded as worse process than a reckless
> lucky winning run.

Until this passes: `CAREER_THRESHOLDS = PROVISIONAL`. See §8.

Target artifact: `scripts/sim-career-agents.mjs` (name per `CAREER_CONTRACT_V0.md` §19),
or a `packages/*` equivalent that the closure receipt names explicitly.

### 6.2 IMPLEMENTED — `EPISODES_V0`

Generalize the historical-training concept into an immutable episode contract.

Episode manifest freezes at minimum:

- `episodeId`, `instrumentId`, source venue, public source reference
- timeframe, start/end time, sub-time anchors
- provenance of every sample (`CONFIRMED` / `DERIVED`)
- explicit intrabar path rule when source is OHLC-only (today: `OHLC_PATH_V0`,
  `OPEN -> LOW -> HIGH -> CLOSE`); marks labeled `DERIVED`
- market-data model version and fill/margin model versions
- immutable content digest
- future-withholding advance cursor
- regime / liquidity / volatility metadata (for exam selection and to prevent
  mastery being granted from a single unrepresentative episode)
- optional funding digest (immutable ordered series, per `SIM_CONTRACT_V0.md` §12)

Structural distinctions the contract must encode:

```text
DEMO   = invented / synthetic
REPLAY = recorded real history, future withheld, retry allowed
EXAM   = unseen recorded real history, future withheld, guidance minimized
```

Implemented in `packages/episodes`. The two existing margin episodes in
`packages/sim/src/margin/episode-v0.ts` consume the verified immutable source
artifacts through a compatibility adapter. Their frozen values, digests,
intrabar order, and `MARGIN_2X_V0` / `SHORT_V0` qualification behavior remain
unchanged. This phase does not implement curriculum or learning UI.

### 6.3 NEXT 3 — `LEARNING_VERTICAL_SLICE_V0`

Exactly **five** missions. No more, until the slice is proven with users. All
grading deterministic. No LLM anywhere in the PASS path. PnL never determines
whether the learner understood the lesson.

| ID | Title | Teaches | Mechanics reused |
| --- | --- | --- | --- |
| `MD-01` | WHAT IS TRUE? | `CONFIRMED` / `DERIVED` / `SYNTHETIC` / `STALE` | `MARKET_TRUTH_V1`, `packages/sim/src/provenance.ts` |
| `EX-01` | WHERE DID MY MONEY GO? | mark vs fill, fees, realized vs unrealized | `SPOT_FILL_V0`, `packages/sim` ledger/position |
| `LQ-01` | SHOULD I SEND THIS ORDER? | liquidity, participation, modeled impact, choosing not to trade | `SPOT_FILL_V0` participation/impact model, fail-closed reason codes |
| `ST-01` | TAKE THE LOSS | invalidation, stop trigger vs fill, no stop widening | `STOP_MARKET`, `stopWidened` fact |
| `RS-01` | SIZE COMES LAST | account risk + stop distance → position size | `packages/sim/src/risk.ts` |

Mission structure (frozen direction):

- A mission runs against a `REPLAY` episode or a frozen simulator scenario.
- The learner takes actions and/or answers deterministic prompts
  (multiple-choice or numeric-with-tolerance derived from simulator facts).
- PASS is a pure function of simulator/Career facts and the learner's recorded
  choices. Same inputs → same result.
- Debrief is a deterministic template populated from facts, not free prose.
- Missions surface in-place, one primary objective at a time (per
  `CAREER_CONTRACT_V0.md` §12, §20). No blocking tutorial wall. No separate
  menu tree on mobile.

Acceptance:

> A new user can complete all five missions without reading a wall of text, and
> at the end can answer, in the product's own checks: what is trustworthy, why a
> fill differs from the mark, when not to trade, what invalidation means, and how
> size follows from risk. Passing is deterministic and independent of PnL.

### 6.4 NEXT 4 — `MARKET_ANALYSIS_V0`

Only after §6.3 works and has user evidence.

One deterministic engine: `SMA`, `EMA`, Bollinger Bands, volume, realized
volatility. Fixed-point where it feeds any graded check; float is acceptable
only for pure display.

Taught as information transformations, for each tool:

- what it measures
- what it does **not** measure / what it discards
- lag
- parameter sensitivity
- failure modes
- regime dependence
- transaction costs where relevant

Never taught: `price > SMA = BUY`, `upper band = SHORT`, or any universal
indicator rule. Indicators never feed Career progression or simulator
economics.

### 6.5 NEXT 5 — `TRANSFER_EXAM_V0`

Unseen historical `EXAM` episodes. Prefer performance across multiple scenarios
(e.g. 2 of 3) with variation in instrument, regime, liquidity, and timeframe —
not one lucky pass.

Grade: evidence interpretation, plan, invalidation, risk, execution, process
discipline. The rubric is transparent and shown to the learner (deterministic
breakdown, per `CAREER_CONTRACT_V0.md` §16 — no opaque AI score).

Do **not** grade: directional prediction, whether the next candle was called
correctly, or raw PnL.

Mastery concepts advance on EXAM evidence, not on REPLAY practice alone.

### 6.6 LATER (gated)

Only after the learning architecture exists and has survived user testing:

- `>2x` leverage
- advanced order types
- exchange-specific liquidation models
- a constrained LLM coach (explanation/paraphrase layer only — see §10)
- ranked / server-authoritative mode

Still deferred with no near-term date:

- real execution
- wallet signing / broadcast
- cross / portfolio margin
- high leverage (`>3x`)
- free-form AI signals

---

## 7. Headless tuning status

`scripts/sim-career-agents.mjs` **has been implemented** (phase
`CAREER_TUNING_HARNESS_V0`, base `4843dc91eee91e871072f362618397249eb044e6`,
report `docs/CAREER_TUNING_HARNESS_V0.md`, receipt
`docs/CAREER_TUNING_HARNESS_V0_RECEIPT.json`). 128 seeds × 6 policy agents were
run against the real simulator, plus a pre-declared 24-seed × 5-policy Gate F
comparator matrix.

Result: **`CAREER_TUNING_HARNESS_V0 = PASS`** (after a targeted methodology
repair of the measuring instrument — see the report §2a; the instrument, not the
system, was changed). Every §6.1 falsification criterion was actually exercised
and none was falsified: under `BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK` no reckless /
high-frequency / high-variance / stop-widening / revenge-escalating agent
reaches `RISK_SIZING` / `MARGIN_2X` / `SHORT` faster in expectation than
`DISCIPLINED`, and a real reckless lucky winner (`ALL_IN` on the pre-declared
melt-up regime, +18–20 % equity) never progresses past `SCALE_CONTROL` while a
disciplined losing run fully qualifies. The harness still records real
numeric-tuning risks (`RISK_SIZING` has no recency window; `evaluateMargin2x`
ignores `stopWidened`; up-front risk-budget escalation leaves no
`RISK_BUDGET_VIOLATED` trace) as `FUTURE DESIGN-TUNING RISK` observations, not
falsifications.

Therefore:

```text
CAREER_THRESHOLDS = PROVISIONAL
```

All numeric gates in `packages/career/src/qualification.ts`
(`SCALE_CONTROL_TRADE_TARGET`, `STOP_LOSS_TRADE_TARGET`,
`MARGIN_2X_DRAWDOWN_LIMIT_BPS`, `SHORT_PLANNED_RISK_LIMIT_BPS`, etc.) and the
`CAREER_CONTRACT_V0.md` `TUNABLE` values remain provisional. `CAREER_TUNING_HARNESS_V0`
changed none of them (`git diff --stat <base> -- packages/` is empty). The §6.1
acceptance criterion now passes, but promoting this to
`CAREER_THRESHOLDS = FROZEN` is a separate governance decision that must also
weigh the `FUTURE DESIGN-TUNING RISK` observations in the harness report (§10);
that decision is **not** taken by the harness phase.

---

## 8. Remaining contract impact map (future work)

`CAREER_CONTRACT_V0.md` remains unchanged by this phase. `SIM_CONTRACT_V0.md`
§13 records the implemented episode substrate; the following are anticipated
future edits, to be made by the phase that implements each item — not now.

### `CAREER_CONTRACT_V0.md` — future additions

- **Mastery axis**: a `MasteryState` distinct from `unlockedSkills` /
  `unlockedCapabilities`; a `MasteryConceptId` union; mastery events
  (`MISSION_PASSED`, `MISSION_FAILED`, `EXAM_ATTEMPTED`, `EXAM_PASSED`,
  `MASTERY_CONCEPT_ADVANCED`) sourced only from deterministic mission/exam facts.
- **Gate rule for future dangerous capabilities**: `>2x` and later capabilities
  require both a process gate and a mastery gate on EXAM evidence. The shipped
  ladder through `SHORT` is explicitly grandfathered.
- **Reward targets**: fold §11 (fun/game direction) into the contract's
  no-XP / reward section — freeze the good/bad reward lists.
- **Tuning status**: once `CAREER_TUNING_HARNESS_V0` passes, flip
  `PROVISIONAL_TUNING` → `FROZEN_TUNING` and record the harness receipt.

### `SIM_CONTRACT_V0.md` — future additions

- **Episode contract**: `SIM_CONTRACT_V0.md` §13 now records the implemented
  `EPISODES_V0` schema, digest, provenance, and withholding boundaries.
- **Environment boundaries**: name `LIVE` / `REPLAY` / `EXAM` / `DEMO`
  explicitly and state that environment is orthogonal to the §15 provenance
  taxonomy.
- **Deterministic learning authority**: a subsection stating the learning layer
  is a pure reader of simulator `TradeSummary` / event facts and Career facts,
  may never mutate economic state, and that mission grading is a pure function.
- **Mission facts**: define the immutable fact shape a mission/exam emits for
  Career to consume (analogous to `TradeSummary` in §16).
- **Transfer/exam evidence**: define what an `EXAM` result records and the
  "unseen `episodeId`" requirement.

---

## 9. Anti-hallucination / AI direction (frozen)

V1 learning does **not** require an LLM. The initial learning layer uses only:

- reviewed, source-backed knowledge content
- deterministic hints
- deterministic mission state
- deterministic debrief templates populated from facts
- glossary / context cards

If an LLM coach is added later (§6.6), it is an **explanation and paraphrase
layer only**. It must never be:

- economic authority (balances, PnL, fees, funding, fills)
- market authority (prices, provenance, freshness)
- grading authority (mission PASS, exam result, trade grade)
- progression authority (capability unlocks, mastery advancement)
- indicator authority (indicator values, thresholds)
- liquidation authority (liquidation price, trigger)

Its output must be visibly labeled as generated, must be non-blocking, and must
be reconstructable from the same deterministic facts the rest of the product
uses. If the LLM is unavailable, every graded and economic path must work
unchanged.

---

## 10. Fun / game direction (frozen)

The game layer stays. What it rewards is frozen.

**Good reward targets:**

- capability unlock
- process receipts (risk plan honored, stop not widened, controlled loss taken)
- correct refusal to trade
- stop discipline
- risk-budget discipline
- surviving an unseen (`EXAM`) scenario
- mastery advancement
- cosmetic terminal unlocks

**Bad reward/progression targets when used alone:**

- raw number of trades
- trading frequency / rapid turnover
- daily login / session streak
- time in app
- rapid clicks
- raw PnL
- overtrading
- amount of leverage used

> Minimum trade/sample counts may remain necessary qualification conditions when
> combined with substantive process criteria. They must never be sufficient by
> themselves, and merely increasing trading frequency must not accelerate
> progression.

This does not disturb the grandfathered shipped ladder (§8): existing Career
qualifications legitimately use a minimum completed-trade count as one necessary
gate alongside process evidence.

The intended pull for another run is:

> "I understand this better now."

not:

> "I need three more trades for XP."

---

## 11. Red team review

V2 was reviewed from ten adversarial lenses before freezing. Corrections were
folded into the sections above; the material ones:

1. **Professional trader** — Risk: implying REKT teaches profitable trading.
   Correction: §2 states explicitly that edge/alpha/prediction are out of scope
   and never graded; REKT teaches epistemics, execution cost, risk process, and
   leverage behavior only.
2. **Quant** — Risk: mastery earned by overfitting to a tiny episode library.
   Correction: §6.2 requires regime/liquidity/volatility metadata on episode
   manifests; §6.5 requires multi-episode EXAM passes across varied regimes;
   §3.2 mastery cannot be granted from a single episode.
3. **Beginner** — Risk: the learning layer becomes the tutorial wall V1 rejected.
   Correction: §6.3 missions are in-place, one objective at a time, deterministic
   prompts, deterministic debrief; no blocking wall; glossary/context cards
   instead of prose dumps.
4. **Gambling-prone user** — Risk: trade frequency or volume alone sneaks back
   in as progress. Correction: §10 freezes the bad-reward list — raw trade count
   and trading frequency are never *sufficient by themselves* to grant
   progression, score, or mastery, though a disciplined process gate may still
   require a minimum sample alongside behavioral evidence; §3.3 keeps future
   dangerous capability behind process + mastery; mastery is not buyable with
   volume.
5. **Market microstructure engineer** — Risk: OHLC-only episodes can't ground
   intrabar stop/liquidation grading. Correction: §6.2 makes an explicit
   intrabar path rule (`OHLC_PATH_V0` today) a mandatory manifest field and
   labels those marks `DERIVED`; consistent with `SIM_CONTRACT_V0.md` §10.
6. **Education researcher** — Risk: passing training scenarios is mistaken for
   learning. Correction: §3 separates CAPABILITY from MASTERY; §6.5 advances
   mastery only on unseen EXAM evidence; §6.5 rubric is transparent, not an
   opaque score.
7. **LLM epistemics engineer** — Risk: an LLM leaks into an authority path.
   Correction: invariant §4.5 plus the full §9 authority exclusion list;
   graded and economic paths must run unchanged with the LLM absent.
8. **Mobile user** — Risk: missions add menus and break the thumb dock.
   Correction: §6.3 requires in-place disclosure per `CAREER_CONTRACT_V0.md` §20,
   no separate menu tree; §5 forbids the offline shell caching mission answers
   or letting stale/DEMO data read as LIVE.
9. **Game designer** — Risk: the learning layer feels like homework. Correction:
   §10 keeps cosmetic unlocks and brief unlock presentation; the reward is
   understanding, and correct inaction (§4.8) is celebrated, not penalized.
10. **Product / scope manager** — Risk: five missions balloon; NEXT 4/5 start
    early. Correction: §6.3 fixes the count at exactly five; §6.4 is explicitly
    gated behind §6.3 shipping with user evidence; §6.6 defers `>2x`, advanced
    orders, and the LLM coach with named preconditions.

No lens produced a change that requires implementation in this phase. All
corrections are documentation/architecture only.

---

## 12. What this phase does NOT do

- No simulator, Career, market, web, PWA, margin, or SHORT source changes.
- No `packages/learning`, `packages/market-analysis`, or `packages/episodes`.
- No tuning harness.
- No indicator engine.
- No leverage beyond 2x.
- No edits to `CAREER_CONTRACT_V0.md` or `SIM_CONTRACT_V0.md` (their future
  edits are enumerated in §8 for the phases that will make them).
- No change to any numeric qualification threshold.

The only changes committed with this plan: `docs/PROJECT_PLAN_V2.md` (this
file) and a supersession banner at the top of `docs/PROJECT_PLAN_V1.md`
pointing here and correcting its stale status token.

---

## 13. Current bounded phase status

```text
CAREER_TUNING_HARNESS_V0 = PASS
EPISODES_V0 = IMPLEMENTED
NEXT = LEARNING_VERTICAL_SLICE_V0
```

Do not begin `LEARNING_VERTICAL_SLICE_V0` in the EPISODES_V0 implementation
closure.

Do not add more leverage yet.
