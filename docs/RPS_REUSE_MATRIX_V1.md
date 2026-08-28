# RPS Reuse Matrix V1

Status: `FROZEN_FOR_IMPLEMENTATION`

Source repository: `CipherCuttle/rugpull-tycoon`

Frozen donor snapshot:

- branch: `forensic/current-repo-snapshot`
- commit: `80db648a86c34dd99193b494c9e07b087f8c8681`
- commit message: `Add bag rug and lost bag loop v0.5A`

This document freezes what the new project may copy, adapt, study, or reject from RPS. The new product is **not** a continuation of the RPS economy. RPS is a donor of game architecture, interaction pacing, progression grammar, save discipline, feedback throttling, humor, and collection mechanics.

## 1. Non-negotiable boundary

RPS may influence:

- career state and reducer architecture;
- capability progression;
- contextual objectives;
- collectible receipts/cards;
- transient UI effects;
- save migration;
- game audio hooks;
- headless tuning methodology;
- mobile action-surface ergonomics.

RPS must never influence the simulated market outcome through:

- fake candle physics;
- tap-driven price movement;
- stat buffs that improve fills or PnL;
- combo multipliers;
- supercharge/overdrive economics;
- clicker income;
- fictional liquidity;
- prestige multipliers;
- press-your-luck recovery of trading losses.

Frozen invariant:

> Game mechanics may change presentation, access, cosmetics, objectives, and career progression. They may never change market price, fill price, fees, slippage, funding, position PnL, liquidation, or account equity.

## 2. Ten-stack reuse test

Every donor subsystem was screened through the following lenses.

| Lens | Question |
| --- | --- |
| Socratic | Does this make the user better at observing, planning, executing, sizing, or managing a trade? |
| Design synthesis | Can it coexist with a professional terminal without making market truth feel fictional? |
| Falsification | Can a player exploit it to progress faster while trading worse? |
| Causal | Does the mechanic reward a behavior causally related to trading competence rather than lucky outcome? |
| Systems | Can it remain outside the market/simulation ledger? |
| Feedback | Does it shorten action -> consequence -> interpretation? |
| Calibration | Can the user distinguish game state from financial truth? |
| Information | Does it reduce context bloat through progressive disclosure? |
| Experimentation | Can it be tuned in deterministic headless simulations? |
| Adversarial | Can it be spammed, save-edited, or used to game score/equity? |

A subsystem that fails a hard truth/economics boundary is rejected regardless of how fun it is.

## 3. Exact reuse matrix

### 3.1 `src/game/types.ts`

Decision: **ADAPT**

Useful donor concepts:

- `GameState` as one explicit serializable domain state;
- `GameAction` as a closed action/event union;
- `CardRarity` / `CardDefinition`;
- monotonically identified transient effects (`TapEffect`, `FountainEvent`, `ToastEffect`);
- separate persistent state and transient presentation effects;
- event/task progress structures.

Target:

- `packages/career/src/types.ts`
- `packages/career/src/events.ts`
- `packages/career/src/receipts.ts`

Transformations:

- `GameState` -> `CareerState`;
- resource currencies -> remove;
- upgrade effects -> capability unlocks only;
- card `effect` -> cosmetic/achievement metadata only;
- `EventProgress` -> `QualificationProgress`;
- `FountainKind` -> trading feedback kinds;
- no chart/price/economy state in CareerState.

Explicit reject:

- `ResourceState` financial meaning;
- `UpgradeEffect` gain multipliers;
- bonding-curve state;
- fake chart state;
- rug bag/rent/lost-bag monetary state.

### 3.2 `src/game/reducer.ts`

Decision: **ADAPT ARCHITECTURE, DO NOT COPY ECONOMY**

Useful donor functions/patterns:

- `createInitialGame()` -> `createInitialCareer()`;
- deterministic event selection (`deterministicRoll`, `pickLine`) for cosmetic-only choices;
- monotonic `effectSeq`;
- bounded history (`addTicker` pattern);
- single-slot transient feedback (`stampToast` pattern);
- pure reducer discipline: state + event -> state.

Target:

- `packages/career/src/reducer.ts`

Do not copy:

- `SEND_CANDLE` behavior;
- chart advancement;
- heat/impulse/curve logic;
- combo/supercharge/overdrive;
- jeet events;
- RUG_IT/bag economy;
- random rewards that change economic outcomes.

New reducer consumes simulator facts such as:

- `TRADE_OPENED`;
- `TRADE_CLOSED`;
- `PARTIAL_EXIT_COMPLETED`;
- `STOP_PLACED`;
- `STOP_MOVED`;
- `STOP_HIT`;
- `RISK_VIOLATION`;
- `LIQUIDATED`;
- `EPISODE_COMPLETED`.

The Career reducer never receives a mutable Position object and never calculates PnL itself. It consumes immutable summaries emitted by the simulator.

### 3.3 `src/game/economy.ts`

Decision: **REFERENCE METHOD ONLY**

What to retain:

- pure helper functions;
- explicit named tuning constants;
- documented pacing assumptions;
- headless simulation as the arbiter of pacing;
- separate tuning constants from UI.

What to reject:

- all RPS numerical economy formulas;
- combo multipliers;
- critical-tap bonuses;
- supercharge/overdrive;
- chart gravity;
- prestige softening;
- upgrade gain modifiers.

Target:

- `packages/career/src/tuning.ts`
- `scripts/sim-career-agents.mjs`

The new headless simulator must include at minimum these adversarial agent policies:

- disciplined;
- random;
- all-in;
- overtrader;
- stop-widener;
- revenge trader;
- passive/minimal-action.

Release gate:

> A reckless/random policy must not unlock leverage faster merely because it takes more actions.

### 3.4 `src/game/objective.ts`

Decision: **DIRECT CONCEPTUAL PORT**

Useful function:

- `getNextObjective(state)`.

Target:

- `packages/career/src/objective.ts`

New responsibility:

Return one short, actionable objective based on the nearest unmet qualification.

Examples:

- `Close 1 more spot position.`
- `Cut one losing trade before -5% account loss.`
- `Complete 2 protected trades without widening the stop.`
- `Use one partial exit.`
- `Finish Spot Qualification to unlock MARGIN // 2x.`

Rule:

> At most one primary objective is shown in the normal trading UI.

No checklist wall on initial load.

### 3.5 `src/game/save.ts`

Decision: **ADAPT STRONGLY**

Useful donor functions/patterns:

- shape validation before accepting persisted state;
- additive migrations;
- safe defaults for newly introduced fields;
- clear transient effects on load;
- avoid invalidating old saves for additive changes.

Target:

- `packages/career/src/migrations.ts`
- `apps/web/src/persistence/career-db.ts`

Change:

- replace `localStorage` with Dexie/IndexedDB for career/practice history;
- keep a versioned `CareerSave` envelope;
- use Zod at the persistence boundary;
- ranked truth never comes from local persisted state.

### 3.6 `src/data/cards.ts`

Decision: **ADAPT**

Retain:

- rarity model;
- id/name/flavor/art-prompt structure;
- satirical crypto-native writing;
- explicit collection order.

Target:

- `packages/career/src/receipts.ts`

Rename conceptually:

- cards -> receipts / collectibles / achievements.

Remove:

- every economic effect such as `+5% all gains`, passive gain, card chance, heat shield, etc.

Allowed rewards:

- profile title;
- profile frame;
- CRT palette;
- boot screen;
- chart cursor skin;
- cosmetic terminal treatment;
- collectible NFT-style artwork in the local game layer.

Examples:

- `PAPER HANDS`;
- `KNIFE CATCHER`;
- `RISK OFFICER`;
- `STOPPED OUT`;
- `ACTUALLY TOOK PROFIT`;
- `LIQUIDATION SURVIVOR`;
- `NOT EXIT LIQUIDITY`.

### 3.7 `src/components/CardAlbum.tsx`

Decision: **ADAPT**

Target:

- `apps/web/src/features/vault/ReceiptAlbum.tsx`

Retain:

- owned/locked collection grid;
- rarity presentation;
- locked silhouettes;
- count/progress affordance.

Reject:

- crate currency requirement for MVP;
- duplicate economic compensation.

Possible post-MVP duplicate behavior:

- cosmetic crafting only.

### 3.8 `src/components/StreakFountain.tsx`

Decision: **HIGH-VALUE DIRECT STRUCTURAL REUSE**

Retain:

- capped particle count;
- prominent/minor budgets;
- per-kind cooldowns;
- deterministic visual jitter;
- fixed lanes that avoid important chart areas;
- one cleanup timer rather than one timer per permanent object;
- loud events only receive sound hooks.

Target:

- `apps/web/src/effects/TradeFeedbackFountain.tsx`

New event kinds:

- `good_entry`;
- `risk_held`;
- `partial_exit`;
- `stop_saved`;
- `skill_unlocked`;
- `warning`;
- `liquidated`;
- `receipt_drop`.

Explicit reject:

- trade-win combo streaks;
- action-count streaks.

If a streak concept exists, it is a **DISCIPLINE STREAK**, based on respecting risk/process rules rather than trade count or consecutive profits.

### 3.9 `src/components/MainActionButton.tsx`

Decision: **PATTERN REUSE ONLY**

Retain:

- one dominant context-sensitive mobile action surface;
- short instructional copy at the exact moment it becomes relevant;
- transient response state after an action;
- mobile-first copy length discipline.

Target:

- `apps/web/src/features/trade/TradeActionDock.tsx`

Do not port:

- tap loops;
- timing windows;
- combo pressure;
- “keep mashing” interaction.

New mobile progression:

- initially `BUY 0.05 ETH` / `SELL ALL`;
- later partial-exit controls;
- later stop controls;
- later risk sizing;
- later LONG/SHORT and leverage selector.

### 3.10 `src/game/sound.ts`

Decision: **DIRECT INTERFACE REUSE, REPLACE IMPLEMENTATION**

Retain:

- central audio adapter;
- sound defaults OFF until user interaction/opt-in;
- persistent mute preference;
- call sites depend on semantic `SoundKind`, not audio files.

Target:

- `apps/web/src/audio/audio.ts`

Implementation:

- Howler/Web Audio sound sprite.

Initial semantic sounds:

- `fill`;
- `partial_exit`;
- `profit_close`;
- `loss_close`;
- `stop_hit`;
- `warning`;
- `liquidated`;
- `skill_unlock`;
- `receipt_drop`.

### 3.11 `src/components/BagPanel.tsx` + bag/lost-bag state

Decision: **REJECT ECONOMICS; OPTIONAL VISUAL GRAMMAR ONLY**

Reason:

A lost-bag/recovery mechanic mapped to trading can teach loss chasing and revenge trading.

Never map:

- lost bag -> lost PnL;
- recover bag -> chase a drawdown;
- banking -> delaying legitimate exits.

Allowed reuse:

- compact status-strip layout;
- brief event toast treatment;
- press-your-luck visual tension for non-economic Career challenges only.

### 3.12 `src/data/upgrades.ts` + `UpgradeList.tsx`

Decision: **TRANSFORM INTO SKILL TREE**

RPS stat upgrades are rejected.

Target:

- `packages/career/src/skills.ts`
- `apps/web/src/features/career/SkillTree.tsx`

New definitions grant capabilities, not bonuses.

Example:

```ts
interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  grants: CapabilityId[];
  qualification: QualificationRule;
}
```

No capability may grant better fills, reduced fees, better liquidation price, or improved PnL.

### 3.13 `PrestigeModal` / prestige resets

Decision: **REJECT FOR MVP**

Reason:

Resetting trading competence/progression for multipliers conflicts with the learning fantasy.

Potential later seasonal reset:

- leaderboard season resets;
- career knowledge/capabilities do not reset.

### 3.14 `FakeChart.tsx` + `src/game/chart.ts`

Decision: **REJECT AS MARKET MODEL; STUDY EFFECT TIMING ONLY**

Never copy:

- tap limpulses;
- fictional candle evolution;
- fake resistance prices;
- bullet-time affecting market clock.

Allowed reuse:

- tiny impact freeze in presentation only;
- shake/flash timing;
- visual state machines for feedback overlays.

The real chart remains TradingView Lightweight Charts fed by real/replayed market data.

## 4. Target package boundaries

RPS-derived code must land behind these boundaries:

```text
packages/career/
  src/types.ts
  src/events.ts
  src/reducer.ts
  src/objective.ts
  src/skills.ts
  src/receipts.ts
  src/tuning.ts
  src/migrations.ts

apps/web/src/features/career/
apps/web/src/features/vault/
apps/web/src/effects/
apps/web/src/audio/
```

The Career package must not import:

- React;
- chart libraries;
- Fastify;
- market provider clients;
- database clients;
- wallet/RPC clients.

It accepts immutable simulator summaries and returns career state/effects.

## 5. Source attribution / transplant procedure

When code is directly copied from RPS rather than rewritten:

1. record donor file and donor commit in the destination file header;
2. strip RPS product/economic assumptions;
3. rename types to new domain terminology;
4. add focused tests before behavior changes;
5. preserve the old repo unchanged.

Recommended header:

```ts
// Adapted from CipherCuttle/rugpull-tycoon
// donor commit: 80db648a86c34dd99193b494c9e07b087f8c8681
// donor file: src/components/StreakFountain.tsx
// RPS economic semantics intentionally not retained.
```

## 6. Reuse acceptance gate

`RPS_REUSE_V1 = PASS` only if all are true:

- no RPS mechanic can alter simulation economics;
- no action-count/combo mechanic accelerates leverage unlocks;
- Career logic is framework-free;
- persisted Career state is versioned/migratable;
- UI effects are bounded and never obscure primary chart/action controls;
- collectible rewards are cosmetic/status-only;
- market price is never generated by RPS chart physics;
- economic losses are never recoverable through an arcade “lost bag” mechanic.
