# MARGIN_2X_V0

Status: `CLOSED_PASS`

Canonical base: `ebcaa1a7cad0e7eada57a818c24ea8def9b7d24f`

## Objective

Introduce the first leverage training surface without weakening the existing deterministic spot simulator or implying real-wallet/exchange execution.

The authorized product slice is venue-neutral `SIM_MARGIN_V0`:

- historical perpetual-market replay only;
- isolated long only;
- 1x or 2x only;
- one isolated position at a time;
- explicit entry/exit fees;
- discrete funding-event support;
- mark-price maintenance/liquidation;
- deterministic stop-vs-liquidation ordering;
- deterministic replay;
- synthetic episode-start Career ETH -> USD bookkeeping via `MARGIN_FX_V0`;
- no shorting, cross margin, >2x, wallet signing, broadcast, or claim of exchange-identical liquidation.

## Market evidence

First episode: `ETHUSDT_PERP_20260828_0530_OHLC_PATH_V0`.

Public source page: `https://tradeidea.io/en/contract/binance/ethusdt`

The source identifies the instrument as Binance ETHUSDT perpetual market data. The implementation froze the observed 2026-08-28 05:30 UTC OHLC values used by the episode:

- open: `2488.93`
- high: `2488.99`
- low: `2488.62`
- close: `2488.84`

The source evidence is OHLC, not authoritative tick order. Therefore the episode does **not** claim that the venue printed those extrema at the simulator's sub-times. `OHLC_PATH_V0` freezes the deterministic training ordering:

`OPEN -> LOW -> HIGH -> CLOSE`

The ordered marks are labelled `DERIVED`. Simulator margin mechanics are labelled `SYNTHETIC`.

No funding timestamp lies inside this short first episode. The episode funding array is therefore empty; discrete funding mechanics are implemented and separately exercised by deterministic domain tests.

## Economics contract

`SIM_MARGIN_V0` uses fixed-point integer arithmetic. The UI never owns balances, PnL, ROE, maintenance state, liquidation state, fees, funding, or trade summaries.

For an isolated long:

1. requested isolated margin is bounded by free collateral plus the entry fee;
2. leverage is runtime-enforced to exactly `1` or `2`;
3. entry and exits receive deterministic adverse taker slippage;
4. maintenance and liquidation-fee reserve are evaluated from the sampled mark;
5. if one sampled mark crosses both maintenance/liquidation and the voluntary stop, liquidation has priority;
6. free collateral is never allowed to become negative from liquidation settlement;
7. duplicate action IDs have no duplicate economic effect.

Protective stops must be positive, below entry, below the **current** mark when submitted, and above the frozen liquidation safety buffer when liquidation exists.

## Career gate

`MARGIN_2X` authorizes only `PERP_LONG_2X`.

Qualification requires:

- `RISK_SIZING` already unlocked;
- at least 8 gradable closed spot trades;
- at least 3 explicit risk-planned trades;
- at least 2 partial exits;
- the most recent 3 risk-planned outcomes all `RESPECTED`;
- Career maximum account drawdown <= 20%;
- confirmed bankroll-reset count exactly 0.

`UNVERIFIED` is never treated as compliance. A prior violation may age out only after three newer verified respected risk-planned trades.

Legacy saves that cannot prove pre-v4 reset history migrate with reset history `UNKNOWN`, so they cannot receive a leverage authorization from invented evidence.

Explicit practice-session resets and environment-switch bankroll restarts are recorded as Career reset facts.

## UI evidence boundary

The MARGIN training surface is hidden until `PERP_LONG_2X` is authorized.

The replay reveals exactly one historical mark at a time. Future OHLC values are not displayed before the corresponding advance action.

Truth labels remain visible:

- market: `DERIVED`;
- economics: `SYNTHETIC`;
- model: `SIM_MARGIN_V0`;
- bookkeeping conversion: `MARGIN_FX_V0`;
- intrabar ordering: `OHLC_PATH_V0`.

The screen explicitly states that this is venue-neutral training and not a Binance liquidation replica.

## Verification targets

Domain tests cover:

- 0.5 ETH -> episode-start USD conversion;
- 1x/2x isolated exposure;
- >2x rejection;
- liquidation geometry and safety buffer;
- discrete funding;
- forced liquidation;
- liquidation-before-stop sampled-gap ordering;
- frozen episode execution;
- duplicate-action idempotency;
- byte-identical deterministic replay;
- current-mark stop rejection;
- interactive/public execution and replay using the same current-mark stop authority.

Career tests cover:

- complete `MARGIN_2X` process gate;
- recent-three violation blocking;
- old-violation aging;
- `UNVERIFIED` blocking;
- >20% drawdown blocking;
- bankroll-reset blocking;
- legacy unknown reset history fail-closed.

Web tests cover:

- desk hidden before authorization;
- future marks hidden until advance;
- 1x and 2x entry controls;
- absence of a >2x control;
- already-crossed stop rejection at the UI/domain boundary.

## Review closure

One hostile review pass found one High finding:

- `H-01 REPLAY/PUBLIC-GATE DIVERGENCE` — interactive calls used the public current-mark stop guard while `replayMarginActions()` still folded actions through raw open/stop functions. The same action stream could therefore diverge depending on whether it was executed interactively or replayed.

Repair:

- public replay now folds `OPEN_LONG` through public `openMarginLong()` and `PLACE_STOP` through public `placeMarginStop()`;
- repair commit: `290626f5f7f5072b46e54930531214aff5ca545d`;
- targeted byte-identical interactive-vs-replay regression commit: `a8a90aaaedfbaafefaececd5934819a293317f83`.

Targeted re-review of H-01: `PASS`.

No further Critical/High findings were identified in the reviewed liquidation settlement, Career reset/migration gate, or UI authority boundary.

Final repaired candidate verification:

- candidate: `a8a90aaaedfbaafefaececd5934819a293317f83`;
- GitHub Actions CI run: `33283653213` / run `141`;
- core deterministic invariants: `PASS`;
- source invariants: `PASS`;
- typecheck: `PASS`;
- unit tests: `PASS`;
- production build: `PASS`;
- committed-secret rejection: `PASS`.

## Closure policy

This phase followed the bounded completion policy:

`IMPLEMENT -> TEST -> ONE hostile review -> fix Critical/High -> ONE targeted re-review because a High repair was required -> COMMIT -> MOVE FORWARD`

Verdict: `MARGIN_2X_V0 = CLOSED_PASS`.
