# REKT//INK Agent Contract

This repository is contract-first. Do not reopen product scope while executing an implementation phase.

## Authority order

1. `docs/PROJECT_PLAN_V1.md`
2. Active phase packet in `docs/agent-packets/`
3. Domain contract for the active phase (`docs/SIM_CONTRACT_V0.md`, `docs/CAREER_CONTRACT_V0.md`, etc.)
4. `docs/RPS_REUSE_MATRIX_V1.md` for donor semantics
5. Existing runtime implementation

If two authorities conflict, stop implementation at the conflicting surface and preserve evidence. Do not silently choose a convenient interpretation.

## Completion policy

IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE targeted re-review only if Critical/High fixes were needed → COMMIT → MOVE FORWARD.

Medium/Low findings do not restart a phase unless they invalidate the stated objective, evidence, a frozen invariant, or fail-closed/safety behavior.

## Frozen invariants

- Practice simulation only. No private keys, wallet signing, approvals, transaction broadcast, or real-money execution.
- Market state, simulator state, Career state, and presentation effects are separate domains.
- React/UI must never be canonical accounting state.
- Economic mutations are fill/event driven and replayable.
- Canonical financial quantities use explicit fixed-point/integer arithmetic; no unconstrained JS floating point in ledger state.
- Same ordered market stream + action stream + model version must produce the same economic result and replay digest.
- Game mechanics may change presentation/progression only; they may never improve fills, prices, PnL, fees, liquidation, or simulated economics.
- Career progress is behavior based. Repeated clicks/orders/page visits/notional volume do not grant progress by themselves.
- Unsupported/stale/ambiguous source data fails closed; never relabel fixtures as LIVE.

## RPS donor boundary

Frozen donor snapshot: `CipherCuttle/rugpull-tycoon@80db648a86c34dd99193b494c9e07b087f8c8681`.

Reuse architecture/patterns only as specified by `docs/RPS_REUSE_MATRIX_V1.md`. Do not import RPS fictional price physics, clicker economy, economic card buffs, Candle Chain, Supercharge/Overdrive economic bonuses, or RUG IT monetary semantics.

## Verification

Before closing a phase, run the strongest available commands from repository scripts plus phase-specific tests. Record exact commands and results. A missing network/dependency capability is a limitation, not a PASS.
