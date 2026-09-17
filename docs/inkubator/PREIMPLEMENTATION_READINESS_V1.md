# REKT INKUBATOR — PREIMPLEMENTATION READINESS V1

**Status:** PLANNING GATE / STAGE B READY WHEN IMPLEMENTATION IS EXPLICITLY AUTHORIZED  
**Date:** 2026-09-13  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`

This document prevents two opposite failures:

1. starting implementation while core contracts are still ambiguous;
2. continuing to produce planning documents after the next bounded implementation step is clear.

> **Plan until the next stage has an executable contract, then build it. Do not plan the entire North Star in implementation-level detail before the current stage exists.**

## 1. Current repo mapping

### Canonical protocol

Existing:

```text
packages/inkubator-protocol/
  schema/
    player.schema.json
    round.schema.json
    ship-receipt.schema.json
  src/
  test/
```

Stage B extends this package additively with Challenge / Build Contract schemas and pure state logic rather than creating a second protocol package.

### Product backend

Existing:

```text
apps/inkubator-api/
```

It already contains auth/authorization, database, contracts, GitHub integration and jobs/outbox. Stage C should add a bounded Challenge domain module rather than put more unrelated logic into the already-large `app.ts` / `contract.ts` files.

Conceptual modular shape inside the same deployable API:

```text
apps/inkubator-api/src/challenge/
  repository
  service
  routes
  projections
  commands
```

Exact filenames remain implementation decisions.

### Verifier

Existing `apps/inkubator-verifier/` remains an isolated trust boundary. Do not fold hostile URL/network verification into the product API merely for deployment simplicity.

### Design lab

Existing `apps/inkubator-lab/` is for Compiler/Challenge/Test-Arena visual calibration and states, not production truth.

### Production frontend

There is currently no dedicated `apps/inkubator-web` directory on this planning branch. Before Stage E, explicitly decide whether to create a dedicated Challenge frontend app or promote a suitable authenticated Inkubator surface. Do not mix the trading-terminal `apps/web` product into Inkubator by accident.

### Builder tooling

Existing:

```text
packages/cli
packages/sdk
packages/mcp
```

Stage F evolves these rather than creating parallel Challenge-specific client stacks.

## 2. Stage-B planning gates — CLOSED

### B-GATE-1 — canonical nouns/state set

**CLOSED by:** `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md`

### B-GATE-2 — lifecycle + invariant table

**CLOSED by:** `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md`

### B-GATE-3 — versioning/digest law

**CLOSED by:** `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md`

### B-GATE-4 — explicit Stage-B acceptance/property suite

**CLOSED by:** `STAGE_B_PROPERTY_TEST_MATRIX_V1.md`

### Stage-B readiness verdict

```text
B-GATE-1 CANONICAL NOUNS / STATES       CLOSED
B-GATE-2 LIFECYCLE / INVARIANTS         CLOSED
B-GATE-3 VERSION / DIGEST LAW            CLOSED
B-GATE-4 PROPERTY-TEST MATRIX            CLOSED
IMPLEMENTATION AUTHORITY                 NONE
```

Therefore additional broad planning is **not a prerequisite** for Stage B. Once the user explicitly authorizes implementation, the next bounded work is the pure Challenge / Build Contract protocol inside `packages/inkubator-protocol` and nothing broader.

## 3. Planning gates before Compiler Stage D

These do not block Stage B.

### D-GATE-1 — CompilerState schema

One structured state model covering intent, known/assumed/unknown, project class, requirements, production envelope, risk profile, blueprint candidates, architecture, acceptance, preferences, findings and unresolved decisions.

### D-GATE-2 — blueprint contract

Define one blueprint schema before authoring the initial ~5 families.

### D-GATE-3 — causal rule format

Define how requirement changes create deterministic consequences without model improvisation.

### D-GATE-4 — compiler gauntlet corpus

Grow toward 100–200 synthetic cases; begin with a smaller seed corpus. Store expected properties rather than one canonical stack.

Useful mutations include accounts, persistence, transactions, uploads, notifications, realtime, 100x traffic, custody/private keys, mutable private dependencies, and vague consulting scope.

### D-GATE-5 — cheap-model benchmark

Benchmark at least two replaceable low-cost models against identical structured tasks. Measure intent extraction, question selection, schema validity, explanation quality, prompt-injection resistance, latency and cost.

Provider choice is never product authority.

## 4. Planning gates before Stage E UI

### E-GATE-1 — final Alpha information architecture

Required public surfaces only:

```text
Discover
Compiler / Create
Challenge
My Build
Review / Test Arena
Receipt / History
Operator Exceptions
```

Historical WORLD / COMMAND / PLAYER / PROJECT / SHIP surfaces may contribute components/data without automatically remaining top-level navigation.

### E-GATE-2 — canonical screen states

For every launch surface define normal, loading, empty, error, unavailable/stale, unauthorized, mobile and reduced-motion states.

### E-GATE-3 — no fake instrumentation

Every Faceplate display/micrographic that presents state maps to real data or is clearly decorative.

## 5. Planning gates before external-human Alpha

These remain mandatory but do not block Stage B.

### H-GATE-1 — Trust & Reputation Threat Model

Create `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1`.

### H-GATE-2 — claims/brand policy

Freeze allowed public language around REKT affiliation/identity, production/security claims, qualification, AI recommendations, payment state, audits/reviews, sponsorship and official endorsement.

### H-GATE-3 — data inventory + retention matrix

For identity, GitHub data, private source, artifacts, evidence, logs, receipts, model prompts and backups define collection purpose, access, retention/deletion, public/private projection and recovery behavior.

### H-GATE-4 — operator runbooks

At minimum cover GitHub unavailable/compromised, model unavailable, compiler output suspected wrong, DB restore, worker retry storm, verifier unavailable, suspected source exposure, submission dispute, receipt correction and budget cap reached.

### H-GATE-5 — failure/chaos matrix

Automate/rehearse deadline races, duplicate requests, worker crash-after-commit, provider outage, GitHub revocation, archive delay, DB connection exhaustion and zero-inference mode.

## 6. Cost/operation readiness

`PRE_REVENUE_INFRA_CAP_V1.md` now defines the owner-funded bootstrap ceiling.

Before deploying a new provider/service record:

```text
purpose
monthly expected cost
hard cost cap
failure behavior
whether product correctness depends on it
operator burden
exit/replacement path
```

No provider is architecture authority.

## 7. Highest-value remaining planning artifacts

These should be created **just in time for the stage they unlock**, not all as a giant paperwork phase:

1. **Current-state migration/ownership map** — before Stage C; map existing DB/routes/Player/Project/Mission/Ship/Receipt to `PRESERVE / ADAPT / PARK / REMOVE_FROM_PRODUCTION_ASSEMBLY`.
2. **CompilerState + blueprint schema** — immediately before Stage D.
3. **Compiler Gauntlet seed corpus** — executable fixtures, not prose, during Stage D.
4. **Trust & Reputation Threat Model** — before external Alpha; earlier only if it changes protocol choices.
5. **Brand/Claims policy** — before public REKT-branded Alpha promotion.
6. **Data retention matrix** — before accepting private external source.
7. **Operator runbooks + exception-surface contract** — before Alpha.
8. **Cost dashboard/ledger contract** — before external use can create variable costs.

Everything else is optional until one of these reveals a concrete gap.

## 8. Planning anti-goals

Do not create detailed implementation specs for distant K-stage features, dozens of blueprint docs before the blueprint schema, repeated architecture docs saying the same thing, fake precision in timelines/costs, unresolved TBD lists without stage/reopen conditions, or parallel old/new roadmaps.

## 9. Planning completion state

```text
North Star / roadmap                         LOCKED
Funded Challenge survivor mechanism          LOCKED
REKT visual authority                        LOCKED
Solo-operator constraint                     LOCKED
Bootstrap budget                             LOCKED
Alpha cutline                                LOCKED
Stage-B nouns/lifecycle/version contract      LOCKED
Stage-B property-test matrix                  LOCKED
Stage-B implementation authority             NONE
```

**VERDICT: Stage A planning is sufficiently complete.**

The next mandatory work is not another broad vision document. When explicitly authorized, it is **Stage B implementation of the pure versioned Challenge / Build Contract protocol** in the existing `packages/inkubator-protocol` package.
