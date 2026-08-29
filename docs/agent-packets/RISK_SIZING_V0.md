# RISK_SIZING_V0

Status: `IMPLEMENTED / HOSTILE_REVIEW_REPAIRED / BOUNDED`

## Identity

- Phase: `RISK_SIZING_V0`
- Canonical base SHA: `1609796e1f718dd45f55003aa5fc763e668857be`
- Objective: move the player from "how large a trade do I want?" to "how much of
  my account am I willing to lose if my thesis is invalidated?", by making
  position size a deterministic *output* of stop distance and an account-risk
  budget.
- Authorized paths: `packages/sim/src/{types,events,ledger,spot,observation,risk,index}.ts`,
  `packages/career/src/*`, `apps/web/src/practice/store.ts`,
  `apps/web/src/terminal/{TradeTicket,RiskTicket,CareerStrip}.tsx`,
  `apps/web/src/screens/CareerScreen.tsx`, `apps/web/src/styles.css`,
  `scripts/verify-source.mjs`, phase tests, and this packet.
- Forbidden paths: market/provider normalization, `MARKET_TRUTH_V1` semantics,
  chart framework, wallet/execution surfaces, any leverage surface.

## Frozen causal order

```text
ENTRY / MARKET CONTEXT
        |
        v
STOP / INVALIDATION
        |
        v
ACCOUNT RISK BUDGET
        |
        v
POSITION SIZE
```

Never the inverse. Nothing in this phase moves a player's stop to preserve a
chosen risk percentage; the stop is an input and the size is the output.

## Domain model — `RISK_PLAN_V0`

`packages/sim/src/risk.ts`. All arithmetic is `bigint` fixed point; no
floating-point money, no `Date.now()`, no `Math.random()`.

```text
budgetWei      = floor(equityAtPlanWei * riskBps / 10_000)
plannedNotional= largest N such that
                   roundTripLoss(N) <= budgetWei
                   AND entryCost(N) + entryFee(N) <= availableCapitalWei
                   AND participation(N) <= config.maxParticipationBps
```

`roundTripLoss` is not an approximation of `SPOT_FILL_V0` — it replays it step
for step (participation -> impact -> fill price -> quantity -> executed quote ->
fee) on both legs and then applies the ledger's own realized-PnL composition. A
plan's `projectedLossWei` is therefore the exact loss the ledger records if the
planned entry executes against the planning observation and the stop later fills
at its trigger price at comparable depth. This is asserted directly by test
`projected maximum loss equals the realized loss when the stop fills at its
trigger`.

`plannedNotionalWei` is found by binary search over integer wei. The loop
invariant is that the returned sizing was actually evaluated and passed every
constraint, so it is verified feasible rather than inferred from a closed form.
Where the model's participation impact steps, the search can land up to one
impact step below the theoretical maximum. That direction is deliberate:
ambiguity always resolves toward less risk.

### Frozen bounds

| Constant | Value | Behaviour |
| --- | --- | --- |
| `RISK_PLAN_MAX_RISK_BPS` | `1_000` (10% of equity) | above it, fail closed — never clamp |
| `RISK_PLAN_MIN_STOP_DISTANCE_BPS` | `10` (0.10% of entry) | below it, `STOP_DISTANCE_TOO_SMALL` |
| `RISK_PLAN_MIN_NOTIONAL_WEI` | `1e14` (0.0001 ETH) | below it, `SIZE_BELOW_MINIMUM` |
| `RISK_BUDGET_TOLERANCE_BPS` | `500` (5% *of the budget*) | beyond it, a violation |
| `RISK_PLAN_PRESET_BPS` | `50 / 100 / 200` | terminal presets, plus CUSTOM |

### Rounding

Every step uses the fill model's own direction: entry fill price `ceil`,
exit fill price `floor`, executed quote `floor`, fee `floor`, quantity `floor`,
budget `floor`. Where the phase adds a direction of its own — the size search —
it rounds down.

### Explicit edge behaviour

- stop == entry, stop > entry, stop <= 0 -> refuse, never divide;
- risk 0, or a budget that rounds to 0 wei -> refuse;
- extremely tight stop -> bounded by free ETH; **no implicit leverage** is
  possible, because `entryCost + entryFee <= availableCapitalWei` is a search
  constraint, not a post-hoc check;
- thin depth -> bounded by the fill model's participation ceiling;
- insufficient bankroll -> refuse rather than size something unexecutable.

## Stop composition

`RISK_SIZING_V0` composes with `STOP_LOSS_V0` rather than building a second risk
model. Stop replacement semantics, `widened` classification and trigger
behaviour are untouched.

Projected loss is recomputed from live simulator state, so it moves correctly
when the stop is tightened or widened, when the position is scaled into, and
when it is partially exited — without ever mutating the frozen plan. When
projected loss passes budget plus tolerance, the simulator appends
`RISK_BUDGET_BREACHED`. Practice never prevents the behaviour
(`CAREER_CONTRACT_V0` §13); it records it. The flag is latched, so tightening a
stop back does not erase the fact that the budget was knowingly breached.

**Repaired defect:** the terminal's "IF STOP FILLS" line previously priced the
exit at the *current mark* rather than at the stop's trigger price, so it read
as a profit whenever price sat above the stop. It now uses
`projectActiveStopExit`, which prices at the stop.

## Career

New frozen events: `RISK_PLAN_CREATED`, `RISK_BUDGET_RESPECTED`,
`RISK_BUDGET_VIOLATED`. All are consumed from recorded simulator summaries;
Career creates no economic event.

Qualification V0 (`CAREER_CONTRACT_V0` §8):

- `STOP_LOSS` unlocked;
- 3 closed trades whose first stop was placed within `STOP_PLAN_WINDOW_MS`
  (60 s of **simulator event time**) of the opening fill and was never widened;
- at least 1 partial exit in Career history.

Grants `CUSTOM_POSITION_SIZE` and `RISK_PERCENT_SIZING`.

No XP path is introduced. Freezing plans, submitting orders, trading notional,
and raw profit grant nothing — proved by `risk-plan and budget events are
recorded as facts and grant no progression`, which fires 400 gradable risk
events and unlocks nothing.

## Persistence

The plan lives in the simulator's append-only log (`RISK_PLAN_SET`,
`RISK_BUDGET_BREACHED`), which the practice save already serialises with the
bigint-safe codec and verifies against a replay digest. **No practice save
version bump is required**: a pre-`RISK_SIZING` save simply contains no risk
events and replays unchanged.

Career save `v2 -> v3` adds the risk statistics and qualification. The migration
back-credits nothing: a pre-phase save carries no evidence about stop timing,
widening, or plans, so every new counter starts at zero and the unlock is earned
from facts recorded after the migration. Skills already earned are never
revoked.

## Provenance

A plan and every projection are `DERIVED / RISK_PLAN_V0`, labelled in place in
the terminal. `MARKET_TRUTH_V1` is untouched; no observation is relabelled, and
nothing here can emit `SYNTHETIC` into a live market observation. An
observation Career cannot grade produces no plan and no statistic.

## UI

Integrated into the existing trade ticket, not a new surface. Reads top to
bottom in the causal order: `STOP -> ACCOUNT RISK -> MAX LOSS -> POSITION SIZE`.
Existing typography, seams, mono figures and 44 px touch targets; the preset row
wraps to two rows under 1024 px so targets stay tappable. Invalid plans print
the refusal code and reason and disable the entry rather than coercing an input.
No modal, no tutorial wall.

React holds two inputs — a stop price string and a risk percentage — and renders
what the domain returns. It computes no money. On commit the store recomputes
the plan from simulator state; nothing a component calculated is trusted into
the ledger.

## Hostile review and repairs

One independent hostile review was performed against axes A–J. Axes A
(deterministic arithmetic — 38 400 fuzzed plans, zero over-budget projections,
zero over-funded entries), B (leverage), C (stop direction), F (persistence and
replay) and J (STOP_LOSS regression) came back clean. Repairs made:

**HIGH — an unpriceable stop exit read as compliance.** `projectStopExit`
returned `null` once the position outgrew the fill model's participation
ceiling, so `projectPlannedRisk` reported `UNAVAILABLE`, the breach recorder
treated "could not check" as "no breach", and the closed trade asserted
`riskBudgetViolated: false`. Against a 0.11 ETH pool a single fixed scale-in
closed at 10.5x the frozen budget while Career recorded an affirmative
`RISK_BUDGET_RESPECTED` — the counter behind the MARGIN_2X gate. Two changes:

1. `projectStopExit` now prices such an exit at the model's maximum impact and
   flags `exitExecutable: false`. That figure is a *lower bound* on the cost of
   unwinding, which is enough to detect the breach; the terminal states the
   bound rather than presenting it as the outcome. The reviewer's scenario now
   records `OVER_BUDGET` and `riskBudgetViolated: true`.
2. A cycle whose exposure could not be checked at all — no protective stop, or
   evidence the model cannot price — latches `RISK_EXPOSURE_UNVERIFIED` and
   closes with `riskBudgetVerified: false`. The store then emits **neither**
   compliance fact. "We could not verify" is not "they complied". The instant
   between a planned entry and its stop is exempt, since the stop is the next
   step of the same user action; a cycle that never carries a stop is still
   caught at close.

**MEDIUM — a plan could be frozen for a trade that can never execute.**
`planRiskSizedEntry` did not check the quote asset, so a plan could be written
to the log for a pair `SPOT_FILL_V0` refuses, and the orphaned plan then
attached to the next unrelated cycle and was reported as its risk plan.
`UNSUPPORTED_QUOTE` is now a plan rejection code, and a position opening on an
instrument other than the plan's drops the plan rather than inheriting it.

**MEDIUM — the risk block understated what it was showing.** "IF STOP FILLS" is
now "IF STOP FILLS AT TRIGGER … EST", with `A STOP IS AN INSTRUCTION · A GAP
FILLS WORSE THAN THIS` beside the figure (`SIM_CONTRACT_V0` §10), and MAX LOSS
and POSITION SIZE render `—` rather than an authoritative-looking number when
the domain rejected the plan.

**MEDIUM — the stop price detoured through a JS double.**
`priceX18FromNumber(Number(input))` is replaced by `priceX18FromDecimalString`,
which uses `parseFixed` per `SIM_CONTRACT_V0` §3. Beyond precision this closes an
input hole: `Number('0x10')` is 16, which became a 16 ETH stop. Applied to the
`STOP_LOSS_V0` stop input too, where the same pattern predated this phase.

**LOW** — the budget figure now uses the domain's `mulDiv` floor rather than
arithmetic in the component; an unparseable CUSTOM % no longer leaves the
previous percentage armed behind an empty field; the stop placed by a planned
entry now counts toward `stats.stopUses`; and a migrated save recomputes its
objective instead of showing the line it was saved with. The
`verify-source.mjs` risk guard was broadened to the identifiers actually in use.

One targeted re-review of these repairs followed; no further Critical/High
findings.

## Deferred

- Re-planning an already-open position (`RISK_PLAN_POSITION_OPEN`). A plan is
  defined before exposure exists; retro-fitting a budget to a held position
  would make the budget meaningless.
- R-multiple in trade review, `RISK OFFICER` receipt, and the discipline streak.
  `riskPlansCreated` / `riskBudgetsRespected` are recorded for them.
- Headless adversarial tuning (`CAREER_CONTRACT_V0` §19). All thresholds here
  are `PROVISIONAL`.
- **Gate strength (review finding 7, LOW).** `isStopPlannedTrade` requires only
  a stop inside the window and no widening — there is no minimum hold and no
  requirement that the stop was ever at risk, so three same-tick
  BUY/STOP/SELL loops satisfy it. This is `CAREER_CONTRACT_V0` §8 exactly as
  written, so tightening it is a change to a frozen contract and is not this
  phase's to make. Recorded for the §19 tuning pass, which §22 requires before
  thresholds are release-frozen.
- `stats.riskPlansCreated` counts plans whose entry succeeded, so it can differ
  from the count of `RISK_PLAN_SET` events in the log. Both are facts; neither
  gates anything in V0.

## Stop condition

Stop when acceptance tests pass and evidence is written. Do not begin
`MARGIN_2X`.
