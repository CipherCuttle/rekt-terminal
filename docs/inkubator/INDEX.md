# REKT INK(CUBATOR) — Canonical MVP Authority

**Status:** CANONICAL / MVP SCOPE LOCK

**Locked:** 2026-09-06

**Implementation baseline:** `feature/inkubator-protocol-v0` @ `623e73ebeb8bab22533b8c38362fe9c2c84b2147` (PR #29, draft)

## Purpose

This directory is the canonical authority for the REKT INK(CUBATOR) product from the founding-cohort MVP onward.

The central scope decision is:

> **MVP is the complete founding-cohort loop, not a thin submission-form prototype.**
>
> A Player enters a Round, creates a persistent identity, declares a Mission, connects a Project, receives a truthful Command Center, sees progress and the next move, collaborates through Assists and Help Beacons, earns meaningful Cheevos, Ships with evidence, accumulates reputation/history, and can enter another Mission. The SDK/CLI/MCP developer surface is part of the launch scope because it connects the builder's actual work to the world.

The current codebase does **not** yet implement all of that. PR #29 is the first protocol-backed slice. `CURRENT_STATE_AND_GAP_V0.md` is the canonical gap map.

## Authority order

When documents disagree, use this order:

1. `NORTH_STAR_MVP_V0.md` — product identity, desired user loop, MVP boundary and success definition.
2. `PRODUCT_CONTRACT_MVP_V0.md` — canonical product nouns, states, user journeys, truth classes, social/reputation rules and anti-goals.
3. `ARCHITECTURE_CONSTITUTION_V0.md` — non-negotiable trust, build, semantic and systems-surface invariants.
4. `REKT_SIGNAL_SYSTEM_V0.md` — visual/UX/UI constitution and the cross-product "röd tråd".
5. `DEVKIT_CONTRACT_V0.md` — SDK/CLI/MCP authority, public API philosophy and anti-cheat boundaries.
6. `CURRENT_STATE_AND_GAP_V0.md` — what exists now versus the locked MVP.
7. `IMPLEMENTATION_ROADMAP_MVP_V0.md` — bounded implementation order and phase exit gates.
8. `DECISION_REGISTER_V0.md` — frozen decisions, explicit deferrals and reopen criteria.

Older repository documents remain historical evidence unless this index explicitly promotes them. In particular, `docs/INKUBATOR_REACT_BITS_REBUILD_PLAN.md` and `docs/REACT_BITS_PRO_SWAP.md` describe earlier visual/build phases and are not product-scope authority.

## Latest continuation checkpoint

`SESSION_HANDOFF_V3_2_2026-09-06.md` is the current **v3.2 orchestrator handoff checkpoint**. It is not higher authority than the eight documents above; it exists to preserve current Git/PR state, phase status, permissions, review budget, exact next action, risks and receiver-bootstrap instructions between sessions.

A receiving orchestrator must read the handoff **and** hydrate from this authority set before proposing mutation. Volatile Git/PR facts in the handoff must be reconciled read-only against live state.

## Scope-change rule

The locked MVP may change only through an explicit documentation change that states:

- what invariant or product objective is changing;
- why evidence requires the change;
- what documents/contracts are superseded;
- migration/compatibility consequences;
- whether the change expands, narrows or merely clarifies scope.

A code implementation, UI mock, agent suggestion, issue comment or opportunistic dependency does **not** silently change product authority.

## Completion discipline

Default phase rule:

`IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE re-review only if Critical/High fixes were needed → COMMIT → MOVE FORWARD`

Medium/Low findings do not restart a phase unless they undermine the phase objective, invalidate evidence, violate a frozen contract/invariant, or create a fail-closed/security defect.

## Product shorthand

The MVP loop is:

`BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER → REPEAT`

The durable product model is:

`PLAYER → MISSION → PROJECT → EVIDENCE → PROGRESS → ASSIST → SHIP → REPUTATION/HISTORY`

The six foundational event verbs are:

`DECLARE / BUILD / PROVE / HELP / SHIP / PULL`

These are conceptual compression tools, not a requirement that every database table or API endpoint use those exact words.