# Phase 0 Implementation Order

Status: `READY_TO_EXECUTE`

This is the bounded next implementation phase after the contracts in:

- `RPS_REUSE_MATRIX_V1.md`
- `SIM_CONTRACT_V0.md`
- `CAREER_CONTRACT_V0.md`

## Objective

Create the framework-free simulator and Career package skeletons with deterministic tests. Do not redesign the frontend in this phase.

## Implement

1. Expand root workspaces from only `apps/*` to `apps/*` + `packages/*`.
2. Add `packages/sim`.
3. Add `packages/career`.
4. Implement fixed-point math helpers and branded bigint types.
5. Implement append-only event reducer/replay core for spot.
6. Implement initial 0.5 ETH account.
7. Implement `SPOT_FILL_V0` with frozen fixture inputs.
8. Implement spot buy, scale-in, full/partial close, avg entry, quantity-weighted median entry, realized/unrealized PnL, fees and drawdown.
9. Implement initial Career reducer with `SPOT_BASIC` and `SCALE_CONTROL` qualification.
10. Port/adapt RPS `getNextObjective` concept.
11. Add migration schema/version hooks but do not wire IndexedDB yet.
12. Add deterministic golden replay fixtures.

## Do not implement

- live trading;
- wallet signing;
- React UI redesign;
- perps/margin;
- leaderboard;
- global Career Score;
- NFT marketplace integration;
- Howler/audio assets;
- full card album;
- PWA packaging changes.

## Test

Required deterministic tests:

- initial equity exactly 0.5 ETH;
- fixed 0.05 ETH buy;
- second buy updates weighted average entry;
- weighted median entry changes correctly with uneven fill sizes;
- partial close allocates entry fees once;
- full close leaves no open quantity/fees;
- realized + unrealized accounting is consistent;
- duplicate fill/event ID is rejected/idempotent;
- replay digest stable across process runs;
- stale/unsupported inputs reject fail-closed;
- three completed spot trades unlock `SCALE_CONTROL` under provisional gate;
- repeated non-economic actions do not advance qualification.

## One hostile review

Reviewer attacks:

- floating-point leaks;
- double-counted fees;
- partial-close cost-basis errors;
- non-deterministic timestamps/randomness;
- UI imports in domain packages;
- Career mutating simulator state;
- action-spam unlock exploits;
- unsupported quote silently converted.

Fix Critical/High only, then one re-review if required.

## Closure

Commit when:

```text
SIM_SPOT_CORE_V0 = PASS
CAREER_SPOT_BASIC_V0 = PASS
DETERMINISTIC_REPLAY = PASS
NO_REAL_EXECUTION_PATH = PASS
```

Then move to the first UI integration phase rather than adding more simulator features.
