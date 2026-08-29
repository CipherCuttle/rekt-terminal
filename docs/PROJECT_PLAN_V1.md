# Project Plan V1 — Working Name TBD

Status: `FROZEN_DIRECTION / MARKET_TRUTH_V1_CLOSED / RISK_SIZING_V0_IMPLEMENTED / NEXT: MARGIN_2X (unauthorized)`

## 1. Product thesis

Build a browser-first trading terminal/game where the player begins with a realistic simulated bankroll of **0.5 ETH**, starts with simple Ink spot trading, and progressively earns access to more advanced trading capabilities by demonstrating risk/process competence.

The terminal is real market instrumentation.

The Career layer is the game.

The product teaches through:

```text
observe -> trade -> manage -> consequence -> feedback -> unlock
```

not through a large tutorial curriculum.

## 2. Core fantasy

> Start with 0.5 ETH. Survive. Earn the dangerous controls.

Initial user experience:

```text
EQUITY  0.5000 ETH
DESK    SPOT

BUY 0.05 ETH
SELL ALL
```

Later the same interface grows into:

```text
SCALE OUT
STOP
RISK %
LONG / SHORT
1x / 2x
MARGIN
LIQUIDATION
FUNDING
```

Complexity appears only after the user has encountered the problem the new capability solves.

## 3. 10-stack architecture decisions

### 1. Socratic — actual job

Primary job:

> Become better at entries, exits, sizing, risk control, leverage, and liquidation awareness without immediately risking real capital.

Therefore the MVP is not a generic crypto dashboard or course.

### 2. Design synthesis — tool vs game

Keep two layers:

- **MARKET** = serious, literal, low-latency;
- **CAREER** = progression, humor, collectibles, feedback.

The game never changes financial outcomes.

### 3. Falsification

The product fails if:

- action spam unlocks leverage;
- maximum leverage dominates score;
- lucky all-in trades qualify as skill;
- fake fills create impossible PnL;
- mobile is a squeezed desktop layout;
- collectibles modify economics.

Every phase tests these failure modes.

### 4. Causal progression

Progress comes from demonstrated process, not raw profit.

Examples:

- cut a loss;
- use a stop;
- do not widen the stop;
- respect risk budget;
- keep account drawdown controlled.

### 5. Systems

Four boundaries:

```text
MARKET ENGINE
SIMULATION ENGINE
CAREER ENGINE
PRESENTATION ENGINE
```

They communicate with typed immutable events.

### 6. Feedback

Every important action must produce a fast interpretable consequence:

```text
entry -> position -> risk -> PnL -> exit -> trade summary -> career progress
```

### 7. Calibration

Truth labels:

- `CONFIRMED`;
- `DERIVED`;
- `SYNTHETIC`;
- `STALE`;
- `UNAVAILABLE`.

A historical market observation and a simulated fill are never presented as the same kind of fact.

### 8. Information density

Use progressive disclosure instead of context bloat.

One primary next objective.

One dominant mobile action surface.

Advanced controls remain locked/hidden until relevant.

### 9. Experimental design

Career thresholds and scoring are tuned with deterministic headless agents and replay episodes, not intuition alone.

### 10. Adversarial

Assume players will:

- edit local saves;
- spam orders;
- reload;
- exploit scoring;
- chase variance;
- forge leaderboard requests later.

Practice can be local-authoritative.

Ranked mode must eventually be server-authoritative.

## 4. Frozen domain invariants

1. Game/Career mechanics never change market price or simulated economics.
2. Simulator economics never depend on React state.
3. Market data never depends on Career progression.
4. Financial state is event/ledger derived.
5. Same market stream + action stream + model versions = same simulator result.
6. No simulator economic code uses `Date.now()` or `Math.random()`.
7. Initial bankroll is 0.5 ETH.
8. MVP Ink spot practice only executes against supported ETH/WETH-quoted pools.
9. First leverage mode is 2x isolated training, not cross margin.
10. No real-wallet execution path exists in MVP.

## 5. Product surfaces

### `INK//RADAR`

Find live Ink opportunities.

MVP data:

- token/pair;
- venue;
- price;
- short-horizon changes;
- volume;
- liquidity;
- buys/sells;
- age;
- unusual-flow state;
- source/freshness.

### `ASSET//TERMINAL`

Understand the asset.

Contains:

- Lightweight Charts candles;
- volume;
- source status;
- recent market activity;
- position overlays;
- average entry;
- weighted median entry;
- current PnL.

### `TRADE//DESK`

Only displays currently unlocked actions.

Starts with:

- `BUY 0.05 ETH`;
- `SELL ALL`.

Expands through Career progression.

### `CAREER`

Shows:

- current desk;
- qualification progress;
- factual trading stats;
- current next objective;
- unlocked capabilities;
- receipts/collectibles.

### `VAULT//RECEIPTS`

RPS-derived collection layer.

Collectibles document events/achievements and unlock cosmetics only.

## 6. Architecture

```text
PUBLIC MARKET SOURCES
        |
        v
MARKET NORMALIZATION
        |
        +----------------------+
        |                      |
        v                      v
MARKET READ MODEL         SOURCE RECEIPTS
        |
        v
SIMULATOR
  intent -> fill -> position -> account
        |
        v
TRADE SUMMARY
        |
        v
CAREER REDUCER
  qualification -> unlock -> receipt
        |
        v
PRESENTATION
  React / chart / animation / audio / PWA
```

## 7. Internal repo reuse

### Rugpull Tycoon

Frozen donor commit:

`80db648a86c34dd99193b494c9e07b087f8c8681`

Borrow:

- reducer architecture;
- next-objective system;
- save migration philosophy;
- bounded feedback effects;
- card/collection presentation;
- audio abstraction;
- headless pacing tests;
- crypto-native humor.

Reject:

- clicker economy;
- fictional chart movement;
- economic buffs;
- combo/supercharge economics;
- monetary lost-bag recovery;
- prestige multipliers.

See `RPS_REUSE_MATRIX_V1.md`.

### QntySpot

Borrow accounting/replay principles:

- append-only economic events;
- exact identities;
- deterministic replay;
- fail-closed boundaries.

### Pyroshade

Borrow:

```text
market event -> rolling state -> signal -> receipt -> forward outcome
```

Useful later for evaluating player results after signals.

### SerrataOS

Borrow source/provenance/tamper-evidence discipline.

### Grudge.bid

Borrow EVM index -> read model -> Postgres pattern.

### ReKtrace

Borrow health probes, heartbeats, degraded-state observability.

## 8. OSS stack

Frontend:

- React 19;
- TypeScript strict;
- Vite;
- Tailwind;
- Radix primitives;
- bounded React Bits Pro effects.

Market:

- TradingView Lightweight Charts v5;
- viem;
- TanStack Query for snapshots/server state;
- TanStack Virtual when Radar requires it.

Simulation/Career:

- custom framework-free TypeScript packages;
- fixed-point `bigint` accounting;
- deterministic replay tests.

Persistence:

- Dexie/IndexedDB for Practice;
- Drizzle/Postgres later for ranked/server state.

Backend:

- Fastify;
- Zod;
- ws.

Feel:

- WAAPI/CSS;
- Motion for low-frequency layout transitions;
- Howler for audio.

Mobile:

- PWA first;
- safe-area/dvh layout;
- Pointer Events;
- Haptics adapter;
- Capacitor only if traction justifies native packaging.

## 9. MVP progression

```text
SPOT_BASIC
   |
   v
SCALE_CONTROL
   |
   v
STOP_LOSS
   |
   v
RISK_SIZING
   |
   v
MARGIN_2X
   |
   v
SHORT
```

Only the first part of this tree must be complete before the first playable internal build.

The 2x desk is the major MVP payoff.

3x+ is post-MVP until scoring/progression survives testing.

See `CAREER_CONTRACT_V0.md`.

## 10. Simulator economics

Spot:

- account unit = ETH/wei;
- actual supported WETH/ETH-quoted Ink pool observations;
- explicit versioned derived fill model;
- fees/slippage visible;
- fill-derived average/median entry;
- partial exits;
- realized/unrealized PnL;
- account drawdown.

Leverage training:

- real historical perp market episode;
- venue-neutral `SIM_MARGIN_V0` initially;
- 2x isolated only;
- real/replayed mark sequence;
- explicit fees/funding inputs;
- stop-market;
- liquidation;
- no exchange-identical claim until a venue-specific model exists.

See `SIM_CONTRACT_V0.md`.

## 11. Phase plan

### Phase 0 — deterministic core

Build only:

- `packages/sim` spot core;
- `packages/career` base progression;
- fixed-point accounting;
- golden replay;
- first unlock.

No UI redesign.

See `PHASE_0_IMPLEMENTATION_ORDER.md`.

### Phase 1 — spot UI integration

Integrate simulator into current Radar/Terminal.

Acceptance:

- real eligible Ink pair -> fake 0.05 ETH buy -> visible position -> sell -> correct ledger/PnL.

### Phase 2 — Career feel

Add:

- next objective;
- SCALE_CONTROL unlock;
- bounded RPS-derived feedback;
- save persistence/migrations;
- first receipts.

Acceptance:

- progression is obvious without tutorial text.

### Phase 3 — stop/risk training

Add:

- stop line;
- stop-market semantics;
- risk plan;
- risk-based sizing;
- process review.

Acceptance:

- user can explain account risk before taking a trade.

### Phase 4 — leverage training

Add:

- first deterministic real historical perp episode;
- margin wallet conversion;
- long 1x/2x;
- liquidation;
- funding/fees;
- leverage qualification.

Then unlock shorting.

### Phase 5 — mobile/PWA polish

Treat mobile as a distinct composition using same domain state.

Portrait:

- chart;
- position;
- thumb-accessible action dock;
- bottom navigation.

Landscape:

- chart-first trading mode.

### Phase 6 — launch hardening

- source/degraded states;
- installable PWA;
- replay regressions;
- performance tests;
- accessibility;
- analytics limited to product usage, not private wallet surveillance.

## 12. Explicit post-MVP

Do not block launch on:

- live global ranked seasons;
- real execution;
- wallet signing;
- 5x/10x/20x;
- cross margin;
- advanced order types;
- AI coach;
- wallet-cluster intelligence;
- sophisticated Smart Money ranking;
- native mobile app;
- full NFT marketplace integration.

## 13. Build/review workflow

Frontend:

```text
frozen phase brief
-> Opus primary build
-> browser render
-> Kimi visual red-team
-> one bounded repair
-> Codex/GPT engineering review
-> CI
-> commit
```

Qwen/GLM/Kimi can replace implementation workers when quota/economics require it.

Role contracts stay stable even when model providers change.

General phase rule:

```text
IMPLEMENT
-> TEST
-> ONE hostile review
-> fix Critical/High
-> ONE re-review only if C/H fixes were required
-> COMMIT
-> MOVE FORWARD
```

## 14. Launch bar

The first public MVP is good enough when a new user can:

1. open the app;
2. see real Ink market activity;
3. start with 0.5 ETH;
4. make a simulated spot trade;
5. understand average entry, current position and PnL;
6. manage/close it;
7. receive short transparent feedback;
8. unlock a capability;
9. eventually qualify for a 2x isolated leverage training episode;
10. understand why the leveraged trade won, lost, stopped, or liquidated;
11. immediately want another run.

If this loop works, ship and iterate.
