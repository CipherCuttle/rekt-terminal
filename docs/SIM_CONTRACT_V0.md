# Simulation Contract V0

Status: `FROZEN_FOR_IMPLEMENTATION`

Purpose: define the minimum deterministic trading simulator required for the 0.5 ETH Career loop. This is simulated practice only. It authorizes no private keys, signing, approvals, transaction submission, real-money execution, or automated trading.

## 1. North-star invariant

The simulator teaches the consequence of trading decisions. It is:

- deterministic for the same market stream + action stream + model versions;
- fill-driven;
- append-only/event-derived;
- fixed-point/integer based;
- provenance-labelled;
- replayable;
- independent of React/UI state.

Frozen causal chain:

```text
MarketObservation
 -> OrderIntent
 -> SimFill
 -> PositionEvent
 -> AccountEvent
 -> TradeSummary
 -> CareerEvent
```

UI code never directly mutates balance, average entry, realized PnL, leverage, liquidation, or score.

## 2. Account model

Initial Career bankroll:

`0.500000000000000000 ETH`

Canonical spot account unit is wei (`bigint`).

MVP Ink spot practice is enabled only for pools with usable ETH/WETH quote semantics and valid freshness/liquidity evidence. Other quote assets may remain discoverable but are `PRACTICE_UNAVAILABLE_V0` until deliberately supported.

Historical perp training may use a synthetic margin wallet created from Career ETH with a frozen episode-start ETH/USD conversion (`MARGIN_FX_V0`). That is bookkeeping, not a market trade, and is labelled `SYNTHETIC`.

## 3. Numeric precision

Canonical financial state must not depend on unconstrained JavaScript floating point.

Recommended branded atomic/fixed-point representations:

```ts
type Wei = bigint;
type UsdMicros = bigint;
type Bps = bigint;          // 10_000 = 100%
type PriceX18 = bigint;     // decimal price * 1e18
type QuantityAtoms = bigint;
```

Every division helper defines rounding explicitly (`floor`, `ceil`, or round-half-up). Provider decimal strings are parsed into fixed point at the adapter boundary. Display formatting never feeds back into accounting.

## 4. Domain package

Target:

```text
packages/sim/
  src/types.ts
  src/events.ts
  src/math.ts
  src/ledger.ts
  src/account.ts
  src/position.ts
  src/spot.ts
  src/perp.ts
  src/replay.ts
  src/fill-models/spot-fill-v0.ts
  src/fill-models/perp-fill-v0.ts
  src/margin/margin-v0.ts
```

Core types include explicit session IDs, intent IDs, fill IDs, instrument IDs, model versions, event times and source event IDs.

## 5. Append-only event ledger

All economic mutations are represented as ordered immutable events. Initial taxonomy:

```text
SESSION_OPENED
ORDER_INTENT_ACCEPTED
ORDER_INTENT_REJECTED
FILL_APPLIED
POSITION_OPENED
POSITION_CHANGED
POSITION_CLOSED
STOP_PLACED
STOP_REPLACED
STOP_TRIGGERED
MARGIN_ALLOCATED
FUNDING_APPLIED
LIQUIDATION_TRIGGERED
LIQUIDATION_FILLED
ACCOUNT_SNAPSHOT
SESSION_CLOSED
```

Each event has stable `eventId`, sequence, session ID, model version and event time. Replaying the same ordered event IDs must never duplicate economic effect. Duplicate economic identity is rejected/idempotent and auditable.

## 6. Starting spot capability

At Career start the UI exposes only:

- fixed market buy ticket = `0.05 ETH`;
- sell entire open position.

The simulator itself may support scale-in and partial exits from Phase 0 so Career can unlock them without changing accounting semantics.

## 7. Spot fill model — `SPOT_FILL_V0`

This is an explicit deterministic approximation when venue-specific execution replay is unavailable.

Required fresh inputs:

- reference price;
- requested quote notional;
- usable quote-side liquidity estimate;
- fee bps;
- base slippage bps;
- impact coefficient;
- maximum impact/participation bounds;
- source identity and observation timestamp.

Conceptual model:

```text
participation_bps = requested_quote / quote_liquidity * 10_000
impact_bps = min(max_impact_bps,
                 base_slippage_bps + participation_bps * impact_coefficient)

BUY fill = reference * (1 + impact_bps / 10_000)
SELL fill = reference * (1 - impact_bps / 10_000)
fee_quote = notional_quote * fee_bps / 10_000
```

All operations use frozen fixed-point helpers/rounding. Every fill stores reference price, fill price, fee, slippage/impact, market observation identity, times and `SPOT_FILL_V0` version.

Label fills `DERIVED / SPOT_FILL_V0`; never present them as exact on-chain swap quotes.

Fail closed on stale price, invalid/zero price, missing usable liquidity, participation beyond configured ceiling, insufficient balance, unsupported quote, missing source/model identity, invalid quantity.

## 8. Spot position accounting

### Average entry

Display average entry is quantity-weighted average entry fill price for current open quantity, excluding commissions from the displayed price. Cost/fees remain explicit ledger values.

### Median entry

`medianEntryPrice` is the **quantity-weighted median of entry fills for the current open/close position cycle**:

1. retain entry fills that opened/increased the current cycle;
2. sort by entry fill price;
3. weight each by original entry quantity;
4. median is the first price where cumulative quantity reaches at least 50% of total entry quantity for the cycle.

Exit-only fills do not change this historical cycle statistic. It resets when the position returns flat and a new cycle begins. This avoids inventing FIFO/LIFO semantics in a V0 that uses average-cost accounting.

### Scale-in

A new entry fill increases open quantity and recomputes weighted average entry from cost and quantity. Fees are tracked separately.

### Partial close

V0 uses average-cost semantics. Closing quantity `q_close` removes the same fraction of remaining average cost basis and remaining entry fees. Entry fee allocation happens exactly once.

Long spot realized PnL before exit fee is conceptually:

```text
proceeds = q_close * exit_fill_price
allocated_cost = q_close * avg_entry_price
realized = proceeds - allocated_cost - allocated_entry_fees - exit_fee
```

All values are fixed-point/atomic with explicit rounding.

### Full close

After full close:

- open quantity = 0;
- remaining cost basis = 0;
- remaining entry fee allocation = 0;
- position status = CLOSED;
- final realized PnL is immutable in TradeSummary.

No negative free ETH is permitted for spot.

### Unrealized PnL

For an open long spot position:

```text
uPnL = mark_value_of_open_qty - remaining_cost_basis - remaining_entry_fee_cost
```

The exact displayed convention must remain stable/versioned and reconcile account equity.

## 9. Account equity and drawdown

Account snapshots derive from ledger state, never UI numbers.

Track:

- free ETH;
- reserved/open-position value/cost according to model;
- realized PnL;
- unrealized PnL;
- high-water equity;
- max drawdown bps.

When equity exceeds prior high water, update high water. Drawdown is measured from high-water equity with fixed-point bps arithmetic.

## 10. Stops

A stop is an instruction, not a guaranteed fill.

When trigger condition is met on an eligible ordered price observation:

1. append `STOP_TRIGGERED`;
2. create a market exit intent;
3. fill via the relevant versioned fill model;
4. realized price may be worse than the trigger.

Career records stop placement/widening as behavior; simulator remains economic authority.

For deterministic ranked episodes later, OHLC-only data is insufficient for stop/liquidation grading unless an explicit frozen intrabar path rule exists.

## 11. Leverage training boundary

Leverage is not part of Phase 0, but V0 freezes its future shape.

First leverage mode:

- historical real market episode;
- venue-neutral training semantics unless explicitly venue-specific;
- isolated margin only;
- 1x/2x only initially;
- one position at a time;
- long before short is unlocked;
- no cross/portfolio margin;
- stop-market supported;
- funding as discrete episode events;
- liquidation supported.

UI labels this `TRAINING DERIVATIVE / SIM_MARGIN_V0` where applicable. It must not imply exchange-identical liquidation semantics.

### Isolated allocation

```text
notional_quote = isolated_margin_quote * leverage
qty = notional_quote / entry_fill_price
```

Entry fee is explicit. Free collateral cannot become negative.

### Unrealized PnL

Long:

```text
uPnL = qty * (mark - avg_entry)
```

Short:

```text
uPnL = qty * (avg_entry - mark)
```

### Position equity

```text
position_equity = isolated_margin + uPnL - accrued_funding
```

Entry fees are already ledger/account charges and are not silently charged twice.

### Maintenance margin and liquidation reserve

Episode defines `mmr_bps` and `liquidation_fee_bps`:

```text
maintenance_margin = mark_notional * mmr_bps / 10_000
liq_fee_reserve = mark_notional * liquidation_fee_bps / 10_000
```

Liquidation trigger:

```text
position_equity <= maintenance_margin + liq_fee_reserve
```

Liquidation trigger uses mark price. When triggered, append liquidation events, force close with frozen liquidation fill model, charge liquidation fee, and return only positive remainder to free collateral.

### Estimated liquidation price

Because both maintenance margin and liquidation-fee reserve are mark-dependent, combine rates in the solver:

```text
k = maintenance_margin_rate + liquidation_fee_rate
F = already-accrued fixed funding/adjustments
```

Long:

```text
P_liq = (Q * E - M + F) / (Q * (1 - k))
```

Short:

```text
P_liq = (M - F + Q * E) / (Q * (1 + k))
```

`Q` absolute quantity, `E` average entry, `M` isolated margin. Solver valid only for `0 <= k < 1`; otherwise estimate is `UNAVAILABLE`. Apply explicit fixed-point rounding and clamp impossible/non-positive results. Do not guess future funding.

Display: `EST. LIQ / SIM_MARGIN_V0`, never exchange guarantee.

A versioned liquidation safety buffer may warn/reject a requested stop too close to estimated liquidation; simulator never silently moves the player's stop.

## 12. Funding

Historical episode funding is an immutable ordered series with event ID, event time, rate, mark, source and provenance. Each applied funding event is a ledger adjustment. If an episode contains no funding timestamp, no funding is charged. If funding evidence should exist but is missing, the episode is ineligible for ranked leverage training.

## 13. Historical episode contract

Future target:

```text
packages/episodes/schema
packages/episodes/fixtures
```

Episode metadata freezes:

- episode/instrument ID;
- source venue;
- market-data model;
- fill/margin model versions;
- start/end time;
- episode-start ETH/USD conversion when used;
- MMR, maker/taker fees, liquidation fee;
- market sample digest;
- optional funding digest;
- provenance.

Ordered episode stream contains mark samples, execution/trade reference samples, funding events and source receipts. Player action stream is stored separately so the same episode can be replayed against multiple users/strategies.

## 14. Determinism contract

Given:

- episode/source digest;
- initial account;
- ordered action stream;
- simulator model versions;

replay must produce identical:

- event sequence;
- fills;
- position history;
- account snapshots;
- final equity;
- trade summaries;
- liquidation result.

No economic function may call `Date.now()`, `Math.random()`, browser performance clocks, or network providers. Time/entropy enter only through explicit inputs. Presentation effects may use wall clock; economic state may not.

## 15. Provenance taxonomy

- `CONFIRMED`: direct immutable/on-chain/venue historical observation;
- `DERIVED`: deterministic calculation from observed inputs;
- `SYNTHETIC`: simulator-only construct;
- `STALE`: source exceeds freshness contract;
- `UNAVAILABLE`: required evidence absent.

Examples:

- Ink chain head -> CONFIRMED;
- market API pool snapshot -> DERIVED;
- simulated spot fill -> DERIVED / SPOT_FILL_V0;
- training leverage -> SYNTHETIC / SIM_MARGIN_V0.

## 16. Simulator/Career boundary

Simulator emits immutable TradeSummary facts. Career may consume/grade them but never modify them.

TradeSummary includes at least:

- trade/session/instrument IDs;
- mode and side;
- opened/closed times;
- entry/exit counts;
- average and weighted-median entry;
- realized PnL;
- fees/funding;
- max adverse/favorable excursion where measurable;
- account drawdown at close;
- liquidated flag;
- stop used/widened flags;
- partial exit flag;
- model versions.

## 17. Fail-closed reason codes

Initial reason codes:

```text
INSUFFICIENT_BALANCE
UNSUPPORTED_QUOTE
STALE_MARKET
MISSING_LIQUIDITY
PARTICIPATION_LIMIT
INVALID_QUANTITY
CAPABILITY_LOCKED
LEVERAGE_LIMIT
POSITION_ALREADY_OPEN
WOULD_FLIP_POSITION
STOP_INVALID_SIDE
STOP_TOO_CLOSE_TO_LIQUIDATION
EPISODE_ENDED
MODEL_INPUT_UNAVAILABLE
DUPLICATE_EVENT
```

Rejected actions create auditable `ORDER_INTENT_REJECTED` events.

## 18. Verification gates

Before `SIM_V0` closes:

### Accounting

- quantity/cost basis reconciles across all fills/position state;
- no negative spot free ETH;
- no negative perp free collateral before explicit liquidation handling;
- partial exits allocate entry fees exactly once;
- full close leaves zero open quantity/cost/fee remainder;
- same replay produces same digest in independent processes.

### PnL examples

Verify independently:

- profitable/losing long;
- future profitable/losing short;
- scale-in;
- partial exit;
- stop slippage;
- future funding debit/credit;
- future liquidation.

### Adversarial

- duplicate fill/event ID;
- out-of-order market sample;
- stale source;
- huge order/participation overflow;
- over-close attempt;
- insufficient ETH;
- unsupported quote;
- future stop + liquidation same observation;
- future position flip;
- replay after process restart.

## 19. Phase-0 closure

Phase 0 implements spot only. It passes only when:

```text
SIM_SPOT_CORE_V0 = PASS
DETERMINISTIC_REPLAY = PASS
NO_REAL_EXECUTION_PATH = PASS
```

It must prove initial 0.5 ETH, fixed 0.05 ETH buy, scale-in, weighted average/median entry, partial/full closes, exact fee allocation, PnL/equity reconciliation, duplicate-event handling and fail-closed unsupported inputs.

## 20. Explicit V0 non-goals

No:

- real execution/wallet connect/signing;
- cross/portfolio margin;
- >2x first leverage implementation;
- trailing stops;
- limit-order-book simulation;
- exact exchange liquidation claims;
- multi-position netting;
- live ranked leaderboard;
- options;
- spot-margin borrowing/interest.
