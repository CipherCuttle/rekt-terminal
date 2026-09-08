# REKT INK(CUBATOR) — Canonical MVP Authority

**Status:** CANONICAL / MVP SCOPE + FRONTEND AUTHORITY LOCK

**Locked:** 2026-09-06

**Frontend authority amended:** 2026-09-08

**Current implementation checkpoint:** PHASE 9 branch active / REKT INSTRUMENT OS REBUILD GATE INSERTED

**Next canonical execution:** PHASE 9A — REKT INSTRUMENT OS FRONTEND REBUILD → PHASE 9B — FOUNDING-COHORT REHEARSAL

## Purpose

This directory is the canonical authority for the REKT INK(CUBATOR) product from the founding-cohort MVP onward.

The central scope decision remains:

> **MVP is the complete founding-cohort loop, not a thin submission-form prototype.**
>
> A Player enters a Round, creates a persistent identity, declares a Mission, connects a Project, receives a truthful Command Center, sees progress and the next move, collaborates through Assists and Help Beacons, earns meaningful Cheevos, Ships with evidence, accumulates reputation/history, and can enter another Mission. The SDK/CLI/MCP developer surface is part of the launch scope because it connects the builder's actual work to the world.

Phases 0–8 of the canonical roadmap are implemented/closed under the bounded completion policy. Phase 9 began as founding-cohort rehearsal, but on 2026-09-08 the user explicitly changed the launch frontend direction after direct inspection showed the current V3/Golden-Screen composition materially undersold the implemented product and solved the wrong visual problem.

That is an explicit scope/authority amendment, not silent design drift.

## Authority order

When documents disagree, use this order:

1. `NORTH_STAR_MVP_V0.md` — product identity, desired user loop, MVP boundary and success definition.
2. `PRODUCT_CONTRACT_MVP_V0.md` — canonical product nouns, states, user journeys, truth classes, social/reputation rules and anti-goals.
3. `ARCHITECTURE_CONSTITUTION_V0.md` — non-negotiable trust, build, semantic and systems-surface invariants.
4. `REKT_INSTRUMENT_OS_V1.md` — **current frontend visual/motion/tooling authority**; software-instrument thesis, OP-1-inspired interaction philosophy, CRT material language, REKT micro-sprites, renderer boundaries, rebuild order and acceptance gates.
5. `REKT_SIGNAL_SYSTEM_V0.md` — retained semantic/UX ancestry for Thread, truth colors, three intensity modes, accessibility and anti-gamification where not superseded by Instrument OS v1.
6. `DEVKIT_CONTRACT_V0.md` — SDK/CLI/MCP authority, public API philosophy and anti-cheat boundaries.
7. `CURRENT_STATE_AND_GAP_V0.md` — implementation-state record as of the Phase-8→9 handoff; its statement that Phase 9 must not become a visual redesign is superseded by the explicit 2026-09-08 user-authorized frontend amendment in this index and `REKT_INSTRUMENT_OS_V1.md`.
8. `IMPLEMENTATION_ROADMAP_MVP_V0.md` — original bounded implementation order. Its Phase-9 rehearsal gate is amended to execute frontend rebuild/calibration first, then whole-product rehearsal.
9. `DECISION_REGISTER_V0.md` — frozen decisions and reopen criteria; visual/tooling rows that conflict with `REKT_INSTRUMENT_OS_V1.md` are superseded by the newer explicit decision.

Phase closure receipts, including `PHASE_8_CLOSURE_V0.md`, record evidence/status for completed phases but do not outrank the authorities above.

Older repository documents remain historical evidence unless this index explicitly promotes them. Historical React Bits rebuild/swap documents and the existing V3/Phase-2 Golden Screens are reference ancestry/fixtures, not launch frontend authority.

## 2026-09-08 explicit frontend authority change

### Prior decision

Incrementally evolve the V3/REKT Signal System composition into the authenticated product, with Base UI/Ink frames, Inter/system typography, Lucide + custom glyphs, selective Motion, React Bits/Three atmosphere and five Golden Screens as the primary visual proof.

### Evidence/problem

Direct review of the GitHack build and source showed:

- scrolling marketing-microsite composition rather than a persistent product instrument;
- generic panels/card grammar dominating authenticated concepts;
- fixture-driven Golden Screens rather than real backend manifestation;
- React Bits CSS fallbacks providing decorative gradients/noise rather than the intended high-end effects;
- Inter/system typography weakening terminal identity;
- insufficient causal animation: backend events are rendered as nouns/status rather than visible signal flow;
- product/backend capability materially exceeds what the current frontend communicates.

### New decision

Build the frontend as **REKT Instrument OS**:

> OP-1-class realtime graphical interaction philosophy + black CRT terminal material + diegetic field-instrument behavior + tiny REKT pixel-state identity.

The product is a software instrument, not a dashboard skin.

### Preserved invariants

- `CLAIMED != OBSERVED != PROVEN`;
- private source stays private;
- one dominant Next Move;
- Thread remains the cross-product red thread;
- `BROADCAST / COCKPIT / ARTIFACT` remains the intensity grammar;
- familiar accessible web interaction under the world language;
- no raw engagement XP/status authority;
- backend/trust architecture is unchanged.

### Migration impact

- existing V3 and Golden Screens remain available as historical/reference fixtures until replacements pass comparison;
- production frontend composition is replaced rather than incrementally polished;
- generated Inkubator API client becomes the production network contract;
- a new Instrument/Motion Lab calibrates final primitives before screen manufacture;
- COMMAND is the first production-quality proof;
- whole-product founding rehearsal resumes after the rebuilt frontend is coherent enough to test honestly.

## Current continuation checkpoint

Live Git/PR facts remain volatile and must be reconciled read-only before mutation.

Known checkpoint at this authority amendment:

- Phase-8 closure head: `272668120ab351ddbcc1447e4ae732c92d2c495e`;
- Phase-8 PR: #43 draft/open/unmerged;
- Phase-9 PR: #44 draft/open/unmerged on `feature/inkubator-founding-cohort-rehearsal-v0`;
- no merge authority has been granted;
- `REKT_INSTRUMENT_OS_V1.md` is now canonical frontend authority;
- Phase-9 closure must not validate the discarded frontend composition as the launch UI merely because older browser tests pass.

A receiving orchestrator must hydrate from this authority set and reconcile current Git/PR facts before mutation.

## Scope-change rule

The locked MVP may change only through an explicit documentation change that states:

- what invariant or product objective is changing;
- why evidence requires the change;
- what documents/contracts are superseded;
- migration/compatibility consequences;
- whether the change expands, narrows or merely clarifies scope.

A code implementation, UI mock, agent suggestion, issue comment or opportunistic dependency does **not** silently change product authority.

The 2026-09-08 Instrument OS change satisfies this protocol: it changes frontend implementation/aesthetic authority while preserving product/trust semantics.

## Completion discipline

Default bounded rule remains:

`IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE re-review only if Critical/High fixes were needed → COMMIT → MOVE FORWARD`

For the frontend rebuild, visual calibration is part of implementation, not permission for an unbounded review loop. Freeze the Instrument OS grammar, build the Motion Lab, make COMMAND the proof, then propagate.

Medium/Low findings do not restart a phase unless they undermine the objective, invalidate evidence, violate a frozen contract/invariant, create a fail-closed/security defect, or make the launch frontend fail the explicit Instrument OS kill criteria.

## Product shorthand

The MVP loop remains:

`BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER → REPEAT`

The durable product model remains:

`PLAYER → MISSION → PROJECT → EVIDENCE → PROGRESS → ASSIST → SHIP → REPUTATION/HISTORY`

The visual operating model is now:

`SIGNAL/INPUT → OBSERVE → INTERPRET → INSTRUMENT RESPONSE → NEXT MOVE → ACTION`

The frontend rebuild sequence is:

`FREEZE OLD V3 → INSTRUMENT SYSTEM → MOTION LAB → LIVE COMMAND → SHARED SHELL → PROJECT → WORLD → PLAYER → SHIP → BROADCAST ENTRY`
