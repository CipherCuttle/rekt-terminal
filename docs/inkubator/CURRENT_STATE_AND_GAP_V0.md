# REKT INK(CUBATOR) — Current State and Gap v0

**Status:** CANONICAL CURRENT IMPLEMENTATION MAP

**Updated:** 2026-09-08

**Current completed phase:** PHASE 8 — DEVKIT LAUNCH SURFACE

**Next canonical phase:** PHASE 9 — FOUNDING-COHORT REHEARSAL

**Phase-8 reviewed product candidate:** `a3eeffba1ee9a3955af5c7e6372820acf136e709`

**Phase-8 closure receipt:** `PHASE_8_CLOSURE_V0.md`

**Phase-8 PR:** #43 — draft / open / unmerged

## 1. Critical distinction

The implementation is no longer the original PR-#29 protocol slice described by the 2026-09-06 baseline.

Phases 0 through 8 of `IMPLEMENTATION_ROADMAP_MVP_V0.md` have now been implemented and closed under the bounded completion policy. The remaining MVP work is rehearsal and founding-cohort launch validation, not another broad architecture build.

Do not regress planning to Platform Foundation or treat historical PR #29 state as the current product state.

## 2. What exists now

### Platform / trust substrate

- Node 24-oriented deterministic workspace and CI discipline;
- authenticated Inkubator API boundary;
- Postgres-backed Player, Project, Mission and supporting state;
- secure session/auth separation and deny-by-default resource authorization;
- public/private projections;
- versioned OpenAPI contract and generated clients;
- append-oriented history/evidence + bounded outbox/worker foundation;
- GitHub App installation/webhook ingestion, signature validation, delivery dedupe and repository authority controls.

### Product loop

The implemented product now covers the core founding loop:

`BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER`

Implemented capability includes:

- persistent Player/profile identity;
- Round membership;
- Project/Mission creation and state;
- ship condition, current focus, blocker and canonical Next Move;
- Command projection and bounded participant milestone claims;
- GitHub observations, evidence freshness and advisory Daemon state;
- Player/Project discovery;
- Follow/Watch;
- comments/replies/useful reactions;
- Help Beacons;
- Assist offer/acceptance and Party attribution;
- external tester flow;
- privacy-safe World Signals;
- bounded moderation seams;
- isolated Ship submission/verifier/acceptance flow;
- versioned accepted Ship Receipt and artifact projection;
- immutable Cheevo awards;
- multidimensional reputation facts;
- contextual SHIPPERS / ASSISTS / COLLABORATION boards.

### DevKit

Phase 8 closed the public developer surface:

- `@rekt-ink/protocol`;
- `@rekt-ink/sdk` browser/cookie client;
- `@rekt-ink/sdk/server` credential-bearing server client;
- `@rekt-ink/cli` / `rekt`;
- `@rekt-ink/mcp`;
- scoped/revocable/expiring opaque DevKit credentials;
- Player-wide DB-serialized rate limiting across credentials;
- bounded mutation/idempotency semantics;
- OIDC/Trusted-Publishing/provenance-shaped npm release workflow;
- generated-client freshness enforcement before publication.

Participant DevKit surfaces still cannot create PROVEN evidence, grant Cheevos/reputation, approve Ships, moderate Players or acquire operator/verifier authority.

## 3. Verification state

The Phase-8 repair verifier run `34211195400` passed:

- API typecheck/build;
- generated-client freshness;
- migration 018;
- SDK/CLI/MCP builds and hostile tests;
- focused Phase-8 authority regression;
- token-rotation rate-limit falsification;
- release provenance/freshness gate;
- full Postgres integration: 35/35 PASS.

The single targeted Codex rereview of exact `a3eeffba1e` reported no major issues. All three original Phase-8 P1 threads were repaired and resolved.

## 4. What is NOT proven yet

The remaining gap is not feature inventory. It is whole-system rehearsal quality.

Before founding launch, the product still needs to prove with 2–3 friendly/internal Players that:

- the complete user journey works without knowledge of the internal phase model;
- the five core product screens are understandable as one coherent product family;
- Mission, Next Move, blocker, evidence state and Ship condition are obvious enough in real use;
- desktop and mobile journeys both work;
- the product can be operated through supported OPS paths without database surgery;
- failure recovery works under realistic GitHub, worker, verifier, deployment and retry faults;
- private/untrusted repository content cannot escalate authority or leak secrets;
- browser/server DevKit boundaries survive real packaging/bundling;
- achievement/reputation history remains stable across rule-version changes;
- deployment rollback is operationally usable;
- closing a Mission without Ship behaves truthfully;
- a real user can complete `BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER` without an operator explaining the architecture.

This is PHASE 9, not a reopening of Phases 1–8.

## 5. Known rehearsal risks

### Whole-product UX coherence

Automated and phase-local evidence does not prove the current UI is understandable to a fresh founding user. Phase 9 must explicitly test the end-to-end information hierarchy and the REKT Signal System as a lived journey, especially the newer authenticated screens.

A backend-green system that requires users to understand internal phase terminology is not launch-ready.

### Deployment capacity / environment

Recent PR deployments hit the connected Vercel account's free deployment-rate limit. This is not a Phase-8 authority defect, but Phase 9 needs a usable rehearsal environment and a tested rollback path before launch.

### Publication timing

The canonical npm provenance path is implemented and verified. Actual registry release timing is a launch operation; publishing from a developer laptop is not an accepted substitute.

### Stacked unmerged lineage

Phase branches/PRs remain intentionally stacked and unmerged unless the user grants merge authority. Rehearsal work must inherit the frozen Phase-8 closure base rather than silently rebuilding from `main` or historical PR #29.

## 6. Phase 9 required drills

Per the canonical roadmap:

- duplicate GitHub webhook;
- repo renamed/transferred/private/revoked;
- worker crash after DB commit;
- out-of-order webhook;
- hostile/private README content;
- browser bundle attempts server-only SDK import;
- verifier localhost/private-IP/redirect attacks;
- Assist/Ship retry behavior;
- old protocol fixture under current SDK;
- achievement rule-version change;
- deployment rollback;
- Mission closed without Ship.

In addition, Phase 9 must run real desktop/mobile founding-user journeys across the complete product loop.

## 7. Next action

Start **PHASE 9 — FOUNDING-COHORT REHEARSAL** from the exact Phase-8 closure branch head.

Phase 9 should add only the rehearsal harness, fixtures, OPS support and minimal Critical/High repairs required by observed failures. It must not become a new feature phase or visual redesign project.

Use the same bounded completion rule:

`IMPLEMENT/REHEARSE → TEST → ONE independent hostile review → fix Critical/High → ONE targeted rereview only if needed → CLOSE → MOVE FORWARD`

Phase-9 exit requires no remaining Critical/High architecture/product-truth defect, successful core desktop/mobile journeys, and operation through supported OPS paths without database surgery.
