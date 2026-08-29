# RISK_SIZING_V0

Status: `IMPLEMENTED / BOUNDED`

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

## Deferred

- Re-planning an already-open position (`RISK_PLAN_POSITION_OPEN`). A plan is
  defined before exposure exists; retro-fitting a budget to a held position
  would make the budget meaningless.
- R-multiple in trade review, `RISK OFFICER` receipt, and the discipline streak.
  `riskPlansCreated` / `riskBudgetsRespected` are recorded for them.
- Headless adversarial tuning (`CAREER_CONTRACT_V0` §19). All thresholds here
  are `PROVISIONAL`.

## Stop condition

Stop when acceptance tests pass and evidence is written. Do not begin
`MARGIN_2X`.
