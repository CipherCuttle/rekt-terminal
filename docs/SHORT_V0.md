# SHORT_V0

Status: `CLOSED_PASS`

Canonical base: `275d59b99cbe700016b4e130431ccfaffbbae7cc`

## Objective

Extend the closed `MARGIN_2X_V0` historical training desk with the first directional inversion while preserving the existing leverage ceiling and deterministic accounting boundary.

Authorized scope:

- isolated historical perpetual training only;
- LONG remains available at 1x / 2x;
- SHORT becomes available at 1x / 2x only after Career qualification;
- no cross margin;
- no >2x;
- no real-wallet execution, signing, or broadcast;
- no exchange-identical liquidation claim.

`SHORT` grants exactly `PERP_SHORT_2X`.

## Qualification

`SHORT` unlocks only when:

- `MARGIN_2X` is already unlocked;
- two **distinct** historical long-training `episodeId`s have produced qualifying simulator completion receipts;
- each qualifying replay reaches `EPISODE_END`; an immediate manual close is a valid trade but is not a completed training episode;
- neither qualifying long was liquidated;
- a protective stop was present at entry in both;
- the entry-time modeled maximum account risk was known and `<= 500 bps` in both;
- the historical market evidence was gradable (`CONFIRMED` or `DERIVED`).

Replaying or restarting the same episode does not advance the distinct-episode counter.

A v4 Career save carries no historical margin-completion receipts, so v4 -> v5 migration gives zero SHORT qualification credit.

## Planned maximum account risk

For SHORT qualification, `plannedMaxAccountRiskBps` is an entry-time process fact derived by the simulator.

For a LONG with a protective stop supplied in the same opening action:

1. use the actual adverse entry fill;
2. model the stop exit with deterministic adverse long-exit slippage;
3. include the recorded entry fee;
4. include the expected stop-exit taker fee;
5. divide the modeled stop loss by the episode-start Career-equity USD bookkeeping collateral;
6. round account-risk bps upward.

Future OHLC marks and future funding are not inputs.

A later stop does not retroactively create an entry-time risk plan. Unknown planned risk is not qualifying evidence.

## Second historical episode

Second frozen qualification episode:

`ETHUSDT_PERP_20260805_2055_OHLC_PATH_V0`

Public source page:

`https://tradeidea.io/en/contract/binance/ethusdt`

The public page identifies the market as Binance ETHUSDT perpetual futures and exposes the following 2026-08-05 20:55 UTC OHLC observation:

- open: `1919.99`
- high: `1919.99`
- low: `1916.82`
- close: `1917.00`

The source is OHLC, not authoritative tick order. As in `MARGIN_2X_V0`, `OHLC_PATH_V0` freezes the training order:

`OPEN -> LOW -> HIGH -> CLOSE`

The sub-times are deterministic replay anchors only. Ordered marks are `DERIVED`; simulator margin economics are `SYNTHETIC`.

## SHORT economics

`SIM_MARGIN_V0` remains the venue-neutral training model identity.

Adverse SHORT execution:

- opening SELL fills below mark;
- closing BUY fills above mark.

SHORT gross PnL:

`entry notional - exit notional`

so falling price benefits a short and rising price harms it.

All money arithmetic remains fixed-point `bigint` in the simulator domain.

## Funding

Existing convention is preserved:

- positive funding means LONG pays;
- therefore positive funding means SHORT receives;
- negative funding means LONG receives and SHORT pays.

The SHORT engine stores funding as a signed cost: positive = paid by short; negative = received by short.

## SHORT liquidation

SHORT liquidation is above entry and remains finite at 1x because upside loss is unbounded.

Maintenance margin and liquidation-fee reserve remain evaluated from sampled mark notional.

A SHORT protective stop must:

- sit above short entry;
- remain above the current mark when submitted;
- remain below the frozen short-side liquidation safety buffer.

For a revealed sampled mark that crosses both the voluntary stop and the maintenance/liquidation threshold:

`LIQUIDATION FIRST`

The simulator does not assume an unseen voluntary fill occurred before insolvency inside a gap.

## Completion authority

The simulator derives a `MarginEpisodeCompletion` receipt from completed margin state.

The Practice store accepts completed simulator LONG state plus the immutable episode and derives the completion receipt itself before reducing Career. React does not submit caller-constructed graded completion fields.

The React screen does not calculate or assert:

- completion;
- liquidation status;
- stop usage;
- planned risk;
- PnL;
- leverage;
- side.

Completion event processing is idempotent, and SHORT qualification stores distinct episode identities.

## Public/replay authority

After the `MARGIN_2X_V0` H-01 repair, replay remains part of the public authority boundary.

SHORT replay uses the same public functions as interactive execution for:

- opening SHORT;
- placing/replacing SHORT stop;
- advancing historical marks;
- closing SHORT.

A replay path must not accept a stale stop that interactive execution rejects.

## UI

Before `PERP_SHORT_2X` authorization:

- the margin desk remains LONG-only;
- no actionable SHORT selector is rendered;
- Career/desk show progress toward two qualifying distinct long episodes.

After authorization:

- an in-place LONG / SHORT selector appears;
- the existing 1x / 2x selector remains the leverage ceiling;
- position truth remains literal: side, margin, notional, entry, mark, uPNL, ROE, funding, estimated liquidation, stop, position equity;
- future historical marks remain hidden until replay advance.

## Verification

Final repaired candidate before this closure-only documentation commit:

- candidate: `a6e5d21efd8bf9f12e69f7d686092ae26bd74213`;
- GitHub Actions CI run: `33285245695` / run `177`;
- core deterministic invariants: `PASS`;
- source invariants: `PASS`;
- typecheck: `PASS`;
- simulator tests: `85/85 PASS`;
- Career tests: `45/45 PASS`;
- API tests: `20/20 PASS`;
- web tests: `102/102 PASS`;
- total tests: `252/252 PASS`;
- production build: `PASS`;
- committed-secret rejection: `PASS`.

Simulator coverage includes:

- SHORT 1x and 2x;
- >2x rejection;
- adverse SELL entry / BUY exit;
- PnL direction;
- fee accounting;
- funding sign;
- finite short liquidation;
- forced liquidation and non-negative returned collateral;
- SHORT stop geometry and liquidation buffer;
- liquidation-before-stop gap ordering;
- duplicate action idempotency;
- byte-identical public interactive vs replay behavior;
- entry-time-only planned-risk derivation.

Career coverage includes:

- one qualifying distinct episode does not unlock;
- same episode repeated does not grind progress;
- two distinct qualifying episodes unlock;
- immediate manual close does not count as episode completion;
- liquidation, missing stop, unknown risk, >500 bps risk, SHORT-side completion, and ungradable evidence do not qualify;
- exactly 500 bps qualifies;
- SHORT grants only `PERP_SHORT_2X`;
- v4 migration gives no back-credit.

Web coverage includes:

- SHORT hidden before authorization;
- LONG remains usable;
- two distinct episodes selectable without future-mark leakage;
- SHORT appears only after authorization;
- SHORT 1x / 2x entry;
- no >2x control;
- current-mark SHORT stop rejection visible from the domain.

## Hostile review closure

One hostile review pass found two High findings.

### H-01 — instant manual-close qualification bypass

The initial gate treated any non-liquidated protected close as an episode completion. A player could open and immediately manually close EP1 and EP2 without traversing either historical replay and unlock SHORT.

Repair:

- qualifying long completion now requires `closeReason === 'EPISODE_END'`;
- manual close remains a valid trade receipt but is not SHORT qualification evidence;
- regression added proving two immediate manual closes grant zero qualifying episode IDs.

Targeted re-review: `PASS`.

### H-02 — caller-supplied completion authority

The initial Practice bridge exposed a method accepting a preconstructed `MarginEpisodeCompletionFact`. Although the product screen used simulator derivation, another web caller could supply fabricated graded fields directly to Career.

Repair:

- the Practice boundary now accepts completed simulator LONG state plus the frozen episode;
- `deriveLongMarginCompletion()` executes inside the Practice store;
- React no longer constructs or submits the graded completion fact.

Targeted re-review: `PASS`.

No further Critical/High findings were identified in the reviewed SHORT liquidation/funding math, entry-time planned-risk calculation, distinct-episode anti-grind gate, replay parity, migration behavior, or preservation of existing LONG regressions.

## Non-goals

Explicitly deferred:

- 3x or higher leverage;
- cross/portfolio margin;
- live leveraged execution;
- wallet signing/broadcast;
- exchange-specific liquidation replication;
- advanced order types;
- ranked/server authority;
- AI coaching/signals;
- unrelated chart or UI redesign.

## Completion policy

This phase followed:

`IMPLEMENT -> TEST -> ONE hostile review -> fix Critical/High -> ONE targeted re-review because High repairs were required -> COMMIT -> MOVE FORWARD`

Verdict: `SHORT_V0 = CLOSED_PASS`.
