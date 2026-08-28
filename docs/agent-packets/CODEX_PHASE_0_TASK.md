# Codex Cloud Task — Phase 0 Spot Simulator Spine

Status: `AUTHORIZED_TO_IMPLEMENT`

Base authority: repository HEAD containing this packet.

## Objective

Implement exactly `docs/PHASE_0_IMPLEMENTATION_ORDER.md`: the framework-free deterministic spot simulator spine plus the first Career progression gate. Do not redesign the frontend and do not expand product scope.

## Read first

1. `AGENTS.md`
2. `docs/PROJECT_PLAN_V1.md`
3. `docs/PHASE_0_IMPLEMENTATION_ORDER.md`
4. `docs/SIM_CONTRACT_V0.md`
5. `docs/CAREER_CONTRACT_V0.md`
6. `docs/RPS_REUSE_MATRIX_V1.md`

Treat those documents as frozen authority for this phase.

## Implement

Create/complete:

- root workspace support for `packages/*`;
- `packages/sim` as a framework-free TypeScript package;
- `packages/career` as a framework-free TypeScript package;
- branded bigint/fixed-point helpers with explicit rounding;
- append-only economic events and deterministic replay;
- initial account = exactly `0.500000000000000000 ETH`;
- `SPOT_FILL_V0` using frozen fixture inputs;
- fixed default first ticket = `0.05 ETH`;
- spot buy/open;
- scale-in;
- partial close;
- full close;
- weighted average entry;
- quantity-weighted median of entry fills for the current open/close cycle;
- entry/exit fees without double counting;
- realized/unrealized PnL;
- high-water equity and max drawdown;
- exactly-once/idempotent event handling;
- stable replay digest;
- Career state/reducer for `SPOT_BASIC` and provisional `SCALE_CONTROL` qualification;
- contextual `getNextObjective`-style helper adapted from the RPS design pattern;
- save-version/migration hooks only (no IndexedDB wiring yet);
- deterministic golden fixtures and tests.

## Required tests

At minimum prove:

1. initial equity is exactly 0.5 ETH;
2. fixed 0.05 ETH buy is represented without floating-point drift;
3. second buy updates weighted average entry correctly;
4. uneven entry fill sizes produce the correct quantity-weighted median entry fill;
5. partial close allocates/depletes entry cost/fees exactly once according to the frozen average-cost semantics;
6. full close leaves zero open quantity and zero remaining entry fees/cost basis;
7. realized + unrealized accounting reconciles to account equity under the model;
8. duplicate fill/event identity has no duplicate economic effect;
9. replay digest is stable across at least two independent process executions;
10. stale/unsupported/ambiguous quote inputs reject fail-closed;
11. three qualifying closed spot trades unlock `SCALE_CONTROL` under the provisional gate;
12. non-economic action/order spam does not advance qualification;
13. `packages/sim` and `packages/career` have no React/UI imports;
14. no execution/signing/private-key path exists.

Add adversarial tests where useful: zero liquidity, absurd price/quantity, integer rounding boundaries, duplicate sequence, out-of-order event, over-close attempt, insufficient free ETH, unsupported quote asset.

## Explicitly forbidden in this phase

Do NOT implement:

- React UI redesign/integration beyond changes needed to keep the repo compiling;
- live trade execution;
- wallet connect/signing/approvals/private keys;
- perps, margin, liquidation, funding, leverage, or shorting;
- leaderboard/ranked multiplayer;
- global Career Score;
- NFT marketplace expansion;
- Howler/audio assets;
- PWA redesign;
- AI coach;
- new dependencies unless they are genuinely required for Phase 0 and justified in the final report.

## Engineering rules

- Canonical accounting values are integer/fixed-point. Display conversions may use formatted strings but may not feed back into accounting.
- Define rounding at every division boundary.
- Economic state derives from events/fills; no manual average-entry or PnL mutation shortcuts.
- Timestamps/randomness used by deterministic replay come from explicit inputs/fixtures, never `Date.now()`/`Math.random()` in domain transitions.
- Career consumes simulator facts/summaries and cannot mutate simulator state.
- Prefer small pure functions with hostile unit tests over framework abstractions.

## Verification before stop

Run the repository's available verification/build/typecheck/test commands, fixing all Phase-0 failures. Also run the golden replay twice in separate processes and compare the digest.

Perform exactly ONE hostile self-review focused on:

- floating-point leaks;
- fee double counting;
- partial-close cost basis;
- replay nondeterminism;
- duplicate/out-of-order economic effects;
- cross-domain mutation;
- Career spam exploits;
- fail-open source handling;
- accidental execution capability.

Fix Critical/High findings. Re-review once only if such fixes were required.

## Closure output

Return a compact report with:

### PLAN
What was implemented.

### CHANGESET
Files/packages created or changed, dependencies added, and commit/branch if applicable.

### VERIFY
Exact commands and outputs, including replay digest comparison.

### HOSTILE REVIEW
Critical / High findings and repairs.

### VERDICT
Only PASS when all are true:

```text
SIM_SPOT_CORE_V0 = PASS
CAREER_SPOT_BASIC_V0 = PASS
DETERMINISTIC_REPLAY = PASS
NO_REAL_EXECUTION_PATH = PASS
```

Then STOP. Do not begin the next UI, leverage, leaderboard, or NFT phase.
