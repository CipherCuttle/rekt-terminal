# Career Contract V0

Status: `FROZEN_STRUCTURE / PROVISIONAL_TUNING`

Purpose: define the first progression system for the 0.5 ETH trading career.

The structure and behavioral principles are frozen for implementation. Numerical thresholds marked `TUNABLE` are provisional until headless adversarial simulation is run.

## 1. Career thesis

The player begins with a small, believable bankroll and a deliberately incomplete terminal.

They do not level up by clicking more.

They earn new trading capabilities by demonstrating increasingly important trading behaviors.

Core fantasy:

> Start with 0.5 ETH. Survive. Earn the dangerous controls.

Core progression:

```text
SPOT BASIC
  -> SCALE CONTROL
  -> STOP LOSS
  -> RISK SIZING
  -> MARGIN // 2x ISOLATED
  -> SHORT
  -> 3x [post-MVP candidate]
```

## 2. Career state

Target package:

```text
packages/career/
  src/types.ts
  src/events.ts
  src/reducer.ts
  src/objective.ts
  src/skills.ts
  src/qualification.ts
  src/receipts.ts
  src/tuning.ts
  src/migrations.ts
```

Minimum state:

```ts
type SkillId =
  | 'SPOT_BASIC'
  | 'SCALE_CONTROL'
  | 'STOP_LOSS'
  | 'RISK_SIZING'
  | 'MARGIN_2X'
  | 'SHORT';

type CapabilityId =
  | 'SPOT_MARKET_BUY_FIXED'
  | 'SPOT_SELL_ALL'
  | 'SCALE_IN'
  | 'PARTIAL_EXIT'
  | 'STOP_MARKET'
  | 'CUSTOM_POSITION_SIZE'
  | 'RISK_PERCENT_SIZING'
  | 'PERP_LONG_2X'
  | 'PERP_SHORT_2X';

interface CareerState {
  saveVersion: number;
  careerId: string;
  startedAtMs: number;
  unlockedSkills: SkillId[];
  unlockedCapabilities: CapabilityId[];
  stats: CareerStats;
  qualification: QualificationState;
  receipts: Record<string, number>;
  objective: ObjectiveState;
  effectSeq: number;
  recentEffects: CareerEffect[];
}
```

Career state does not contain live positions, account balances, market prices, or PnL ledgers. Those belong to `packages/sim`.

CareerStats stores immutable aggregates derived from completed simulator summaries.

## 3. Career events

Career reducer consumes explicit facts.

Initial event union:

```text
CAREER_STARTED
TRADE_OPENED
TRADE_CLOSED
SCALE_IN_USED
PARTIAL_EXIT_USED
MANUAL_LOSS_CUT
STOP_PLACED
STOP_REPLACED
STOP_WIDENED
STOP_HIT
RISK_PLAN_CREATED
RISK_BUDGET_RESPECTED
RISK_BUDGET_VIOLATED
ACCOUNT_DRAWDOWN_UPDATED
LIQUIDATED
EPISODE_COMPLETED
SKILL_UNLOCKED
RECEIPT_AWARDED
```

Every economic event originates from simulator receipts/summaries. Career UI cannot invent a completed trade.

## 4. No-XP invariant

V0 has no generic action XP.

Specifically, the following must never grant progress by themselves:

- number of clicks;
- number of orders submitted;
- number of screen visits;
- amount of notional traded;
- consecutive winning trades alone;
- time spent with the page open.

This prevents overtrading/grinding from becoming optimal play.

## 5. Starting capability: `SPOT_BASIC`

Unlocked immediately.

Starting bankroll:

- `0.5 ETH`.

Visible capabilities:

- fixed `0.05 ETH` market buy on simulator-eligible WETH/ETH-quoted Ink pools;
- sell entire open spot position;
- one open simulated spot position at a time for the earliest tutorial phase;
- view current quantity;
- average entry;
- median entry fill;
- current price;
- unrealized PnL;
- realized PnL after close.

The fixed first ticket is intentional: it creates a safe, simple 10%-of-starting-bankroll action while the user learns the basic position loop.

The simulator supports richer actions internally; Career controls disclosure.

## 6. Skill 1 — `SCALE_CONTROL`

Grants:

- `SCALE_IN`;
- `PARTIAL_EXIT`;
- quick exit buttons `25% / 50% / 75% / CLOSE`.

Qualification V0 (`TUNABLE`):

- at least 3 closed spot trades;
- no single closed trade lost more than 10% of then-current account equity;
- player retains positive account equity.

Why:

The first unlock should arrive quickly. It teaches that positions are not binary all-in/all-out objects.

It does not require profitable trades.

Target skilled-player time to unlock: roughly 10–20 minutes in active practice, subject to headless/user testing.

## 7. Skill 2 — `STOP_LOSS`

Grants:

- `STOP_MARKET`;
- visible stop line on chart;
- explicit estimated account loss if stop fills at current model assumptions.

Qualification V0 (`TUNABLE`):

- `SCALE_CONTROL` unlocked;
- at least 5 total closed spot trades;
- at least one `MANUAL_LOSS_CUT` where the player voluntarily closed a losing trade before the loss exceeded 5% of account equity, **or** completion of one deterministic `PROTECT_CAPITAL` practice challenge that demonstrates the same behavior;
- account remains above 70% of starting equity.

Why:

The mechanic appears after the user has experienced accepting a controlled loss. The deterministic challenge is an alternate path so an unusually lucky early run cannot block progression forever. The stop is introduced as automation of a behavior the player has already performed.

No tutorial wall is required.

## 8. Skill 3 — `RISK_SIZING`

Grants:

- custom position sizing;
- `RISK_PERCENT_SIZING` helper;
- position risk display;
- stop-distance -> position-size calculator;
- planned risk field stored with the trade.

Qualification V0 (`TUNABLE`):

- `STOP_LOSS` unlocked;
- 3 completed spot trades with a stop placed before entry or within the frozen `STOP_PLAN_WINDOW_MS` after the opening fill;
- `STOP_PLAN_WINDOW_MS` is evaluated against simulator event time, never browser wall-clock time, and is `TUNABLE`;
- zero `STOP_WIDENED` events across those 3 qualifying trades;
- at least one partial exit used across Career history.

Why:

Sizing becomes meaningful once the player can define an invalidation/stop distance.

The application should now introduce the concept:

```text
ACCOUNT RISK
1.8%

IF STOP FILLS
-0.0090 ETH est.
```

This is the first major transition from “paper trading” into explicit risk training.

## 9. Skill 4 — `MARGIN_2X`

Major unlock.

Grants:

- access to historical `MARGIN//TRAINING` episodes;
- isolated margin only;
- `1x / 2x` selector;
- `PERP_LONG_2X`;
- liquidation line;
- margin / notional / ROE display;
- funding display when episode contains funding.

Qualification V0 (`TUNABLE`):

- `RISK_SIZING` unlocked;
- at least 8 closed spot trades total;
- at least 3 trades with an explicit risk plan;
- at least 2 partial exits total;
- zero risk-budget violations in the most recent 3 risk-planned trades;
- Career max account drawdown <= 20%;
- no account-reset mechanic used.

No minimum profit requirement.

Why:

Leverage is unlocked by demonstrating control, not by making money.

The major unlock presentation may be game-like:

```text
NEW DESK AUTHORIZED

MARGIN // 2x

You may now lose money twice as efficiently.
```

But the simulator underneath remains exact and sober.

## 10. Skill 5 — `SHORT`

Grants:

- `PERP_SHORT_2X`.

Qualification V0 (`TUNABLE`):

- `MARGIN_2X` unlocked;
- complete 2 long-only margin training episodes;
- no liquidation in those qualifying episodes;
- a protective stop was used in both;
- planned maximum account risk <= 5% in both.

Why:

The user first learns that leverage changes loss geometry before adding the directional inversion of shorting.

## 11. `3x` and higher leverage

Post-MVP candidate, not required for initial launch.

Do not expose >2x until the scoring/qualification system survives user behavior and headless adversarial testing.

Likely future qualification:

- multiple closed perp positions;
- no recent liquidations;
- stable drawdown;
- repeated risk-budget compliance;
- successful long and short training episodes.

No unlock based on raw PnL alone.

## 12. Contextual objective system

Adapt the RPS `getNextObjective()` philosophy.

Only one primary instruction should normally appear.

Examples by state:

```text
NEXT // Close 1 more spot position.
NEXT // Cut one losing trade before -5% account loss.
NEXT // Place a stop on your next trade.
NEXT // Complete 2 protected trades without widening the stop.
NEXT // Use a partial exit.
NEXT // Spot Qualification 86% — protect one more trade.
```

The objective is derived from qualification state, not manually scripted page copy.

## 13. Risk-plan semantics

After `RISK_SIZING` unlock, a planned trade can record:

```ts
interface RiskPlan {
  equityAtPlanWei: bigint;
  intendedEntryPriceX18: bigint;
  stopPriceX18: bigint;
  maxLossWei: bigint;
  maxLossBpsOfEquity: bigint;
  createdAtMs: number;
}
```

`RISK_BUDGET_VIOLATED` occurs when a player knowingly increases exposure or widens a stop such that the latest projected loss exceeds the frozen planned budget by the configured tolerance.

The tolerance is versioned/tunable.

The simulator does not prevent this in normal Practice. Career records the behavior.

Challenge episodes may forbid it.

## 14. Discipline streak

If a streak exists, it is process-based.

Possible qualifying sequence:

- trade had explicit risk plan;
- risk budget was not violated;
- no stop widening;
- no liquidation;
- position closed normally/stop/target.

It is **not** based on:

- consecutive wins;
- number of trades;
- rapid action;
- notional volume.

A losing but disciplined trade may preserve a Discipline Streak.

This is intentional.

## 15. Receipts / collectibles V0

Receipts are status/cosmetic collectibles.

They never alter simulator economics.

Initial candidates:

### COMMON — `PAPER HANDS`

Closed a position very quickly after entry.

Tone: teasing, not a skill endorsement.

### COMMON — `STOPPED OUT`

First stop executes.

Normalizes taking controlled losses.

### UNCOMMON — `ACTUALLY TOOK PROFIT`

First partial exit from a profitable position.

### RARE — `RISK OFFICER`

Five risk-planned trades with zero budget violations.

### RARE — `KNIFE CATCHER`

Profitable close after an entry near a replay episode local low. Clearly hindsight-defined collectible, never predictive label.

### EPIC — `LIQUIDATION SURVIVOR`

Position entered a frozen near-liquidation buffer but exited without liquidation. This is a collectible, not positive process grading.

### LEGENDARY — `NOT EXIT LIQUIDITY`

Candidate milestone tied to scaling out of an extreme winner before a major retracement in a deterministic replay episode.

Exact achievement conditions are versioned and testable.

## 16. Trade grading V0

Do not build an opaque AI score.

Trade review is initially a transparent deterministic breakdown.

Possible dimensions:

```text
RISK
EXECUTION
MANAGEMENT
OUTCOME
```

### Risk

Can use:

- planned risk vs actual maximum planned risk;
- stop widening;
- liquidation;
- account drawdown contribution.

### Execution

Can use:

- size relative to available liquidity/model participation;
- unnecessary repeated entries if they violate an explicit risk plan;
- fill slippage as information, but do not blame user for provider/model latency.

### Management

Can report:

- scale-in count;
- partial exits;
- stop usage;
- stop widening;
- time under risk.

Do not assert that partial exits or stops are always superior trading strategies.

### Outcome

Report factual:

- net PnL;
- return;
- realized R-multiple once a RiskPlan exists;
- MAE/MFE;
- hold duration.

The product must separate:

> “what happened”

from:

> “what process rule you followed or violated.”

## 17. Career Score V0

A single leaderboard score is **PROVISIONAL / NOT FROZEN** until headless testing.

Initial hypothesis for offline experimentation:

```text
35% discipline/process
25% drawdown/risk control
20% risk-adjusted outcome
10% sample confidence
10% execution/market-impact discipline
```

Hard penalties:

- liquidation;
- repeated risk-budget violations;
- intentional stop widening beyond budget;
- account wipe/reset.

But no production weighting is accepted until adversarial agents are tested.

Required headless falsification:

- all-in agent must not dominate through one lucky path;
- overtrader must not gain score merely from sample volume;
- random agent must not unlock leverage faster than disciplined agent in expectation;
- a disciplined losing trade must not be treated as worse process than a reckless lucky winner.

Until this passes, expose factual stats and qualification progress rather than a global ranked score.

## 18. Practice vs Ranked boundary

### Practice

- local-first;
- Dexie persistence;
- user may reset;
- offline historical episodes possible;
- not trusted for global leaderboard.

### Ranked — post-MVP

- server-authoritative action stream;
- canonical episode or live source;
- server-side simulator;
- immutable result receipt;
- no client-supplied PnL/score accepted.

Career capabilities may be mirrored locally for UX but ranked authority lives server-side.

## 19. Headless tuning harness

Implement before freezing numerical gates.

Target script:

```text
scripts/sim-career-agents.mjs
```

Minimum policy agents:

### DISCIPLINED

- modest size;
- cuts losses;
- does not widen stop;
- low turnover.

### ALL_IN

- maximum allowed exposure whenever possible.

### OVERTRADER

- submits actions at maximum practical frequency.

### RANDOM

- random entries/exits within capabilities.

### STOP_WIDENER

- repeatedly moves stop away when losing.

### REVENGE

- increases risk after a loss.

Metrics:

- time/actions/trades to each unlock;
- wipe probability;
- max drawdown;
- liquidation rate;
- score distribution;
- reward/receipt frequency.

Gate:

> Capability progression must favor demonstrated process quality over action count and reckless variance.

## 20. Mobile progression contract

The Career system must improve mobile simplicity rather than create menus.

At Career start, bottom action dock may show only:

```text
BUY 0.05 ETH
SELL ALL
```

As skills unlock, controls appear in-place:

```text
25 / 50 / 75 / CLOSE
STOP
RISK
LONG / SHORT
1x / 2x
```

Do not unlock a capability only inside a hidden settings screen.

Unlock presentation is brief and then returns immediately to trading.

## 21. UI truth boundary

Game-flavored copy is allowed around a capability.

Examples:

```text
MARGIN // 2x
You may now lose money twice as efficiently.
```

But financial labels remain literal:

- margin;
- leverage;
- liquidation;
- mark;
- entry;
- fees;
- funding;
- PnL;
- drawdown.

Do not rename financial mechanics into fictional currencies that obscure what the player is learning.

## 22. Career V0 closure gate

`CAREER_V0 = PASS` only if:

- initial user can trade without reading a tutorial wall;
- first capability unlock occurs quickly enough to demonstrate progression;
- leverage cannot be unlocked by action spam alone;
- no collectible changes fills/PnL;
- no Career event can directly mutate simulator economic state;
- save migration is deterministic and versioned;
- a losing disciplined trade can still satisfy process qualifications;
- a lucky all-in trade does not automatically qualify the player for margin;
- the `getNextObjective` equivalent always produces a short actionable next step;
- headless adversarial policies have been run before numerical thresholds are declared release-frozen.
