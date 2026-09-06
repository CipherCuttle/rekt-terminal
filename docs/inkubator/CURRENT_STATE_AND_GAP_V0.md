# REKT INK(CUBATOR) — Current State and Gap v0

**Status:** CANONICAL IMPLEMENTATION BASELINE MAP

**Baseline date:** 2026-09-06

**Implementation head:** `623e73ebeb8bab22533b8c38362fe9c2c84b2147`

**PR:** #29 — draft, open, mergeable, not merged

**Base:** `concept/inkubator-dossier-polish-v2` @ `ad709826adf0660e6d331a67c3073fb0219b7d8c`

## 1. Critical distinction

The **MVP product scope** is now the complete founding-cohort loop defined in `NORTH_STAR_MVP_V0.md`.

The **current implementation** is only the first slice of that MVP.

Do not use "MVP" as shorthand for what PR #29 already contains.

## 2. What is implemented now

PR #29 establishes:

`ROUND → PLAYER → SHIP RECEIPT → DERIVED PUBLIC STATE → V3 INSTRUMENT UX`

Implemented:

- `@rekt-ink/inkubator-protocol` private package;
- JSON Schema Draft 2020-12 contracts for Round, Player and Ship Receipt;
- Ajv 2020 validation + formats;
- deterministic restricted canonical JSON/digest profile;
- versioned development fixtures;
- deterministic public-state compiler;
- Player identity seam with optional character metadata;
- development-fixture Player/Receipt preview in the existing V3 `THE MACHINE` section;
- evidence statuses that distinguish supplied fixture URLs from actual machine PASS;
- progressive disclosure for technical evidence;
- reputation facts derived from Ship history rather than editable XP;
- protocol/unit/component verification;
- bundle and Lighthouse gates;
- serialized preview CI to reduce generated-output races.

Current receipt fixture digest:

`5afddb330bb6b64e62c48ebf368f853f4c7c39a66e7f97261d96bb68febe84f8`

## 3. Current verification baseline

Authoritative run for PR #29 implementation slice:

- protocol tests: 6/6;
- React tests: 13/13;
- deterministic compile: PASS;
- TypeScript + Vite production build: PASS;
- initial JS: ~66.8 KiB gzip;
- initial CSS: ~6.8 KiB gzip;
- initial transfer: ~73.6 KiB gzip;
- Lighthouse median: Performance 99 / Accessibility 100 / Best Practices 100 / SEO 100;
- LCP: 1358 ms;
- CLS: 0.000;
- TBT: 94 ms.

These numbers are a performance discipline baseline, not permanent exact budgets for the authenticated application.

## 4. Current public visual baseline

The closed V3 design lineage provides:

- six top-level beats: HERO/SIGNAL, WHAT TO BUILD, THE MACHINE, THE COMEBACK, ROADMAP, OPEN CHANNEL;
- near-black/purple/lilac palette;
- acid green reserved for real/current/actionable signal;
- large grotesk display typography + mono metadata;
- one-pixel seams/flush compartments;
- React Bits jobs: GrainWave, DitherWave, SquircleShift;
- real REKT/Chibi moving art fallbacks;
- no fake live holder/growth metrics;
- restrained effects with semantic jobs.

The V3 public page is now a Broadcast ancestor/reference, not the final information architecture for the authenticated MVP.

## 5. What is NOT implemented yet

### Product/domain

- persistent accounts/sessions;
- real multi-Player database;
- Character profile editing;
- Project entity/lifecycle;
- Mission entity/lifecycle/ship condition;
- canonical Mission Next Move;
- milestones/progress dimensions;
- blocker/scope-damage model;
- Party/collaboration model;
- Follow Player / Watch Project;
- comments/replies/reactions;
- Help Beacons;
- Assists;
- external tester flow;
- Cheevo rules/grants;
- contextual/seasonal leaderboards;
- persistent Player/Project history beyond fixture-derived Ship facts;
- graveyard/postmortem/resurrection UX;
- Proven Pull/network lineage;
- live World activity/presence.

### Integrations/intelligence

- GitHub App auth/install flow;
- webhook ingestion/signature/dedupe;
- repo static intelligence/stack detection;
- trusted deployment/workflow observations;
- Daemon summaries/next-move/scope warnings;
- private→public projection enforcement;
- outbox/job worker.

### Ship/proof

- isolated arbitrary-URL verifier;
- human/operator Ship review flow;
- real Ship submission lifecycle;
- verifier evidence promotion;
- production receipt publication/share flow.

### Developer platform

- public `@rekt-ink/protocol`;
- TypeScript SDK;
- CLI;
- MCP bridge;
- React/embed surface;
- scoped DevKit credentials;
- DevKit idempotency/rate-limit contract.

### Platform foundation

- separate authenticated `inkubator-api` trust boundary;
- Postgres;
- resource-specific authorization;
- secure session model;
- OpenAPI contract generation/diffing;
- Node 24 baseline;
- deterministic read-only verification CI;
- protected release flow/provenance;
- production deployment topology;
- operator/admin surface;
- moderation controls.

### UX/design system

- canonical semantic tokens;
- Base UI `Ink*` wrappers;
- Storybook;
- executable Signal/Thread/Frame/Portrait patterns;
- five golden screens: World, Command, Project, Player, Ship;
- Playwright/axe/visual-regression quality system;
- manual keyboard/mobile/screen-reader evaluation.

## 6. Known current upstream debt / blockers

### React Bits Pro source/licensing boundary

The historical documentation says private React Bits Pro source is not committed, but the current feature branch contains `apps/inkubator-lab/src/components/react-bits/*.tsx` installed/generated component source.

Treat this as a Platform Foundation F0 issue before production release:

- confirm applicable license terms;
- stop CI from committing licensed/generated source back to the public repository if prohibited;
- move licensed source to controlled private/ephemeral build context or replace with permitted implementation;
- preserve a stable public Inkubator effect adapter boundary;
- decide whether repository history requires cleanup.

Do not assume a future file deletion erases public Git history.

### CI reproducibility/supply chain

Current Inkubator preview CI uses mutable operations such as `npm install`, `shadcn@latest`/registry installation, `lighthouse@latest` and `contents: write` generated commits.

This is acceptable historical preview machinery, not the production release model.

### Runtime drift

Root package currently permits Node `>=20` while Platform Foundation target is Node 24 LTS with an intentional supported range/pin.

### Current API trust mismatch

Existing `apps/api` is a public market-data/realtime service with permissive CORS/unauthenticated streams. It is not the authenticated Inkubator product API and must not become one by convenience.

## 7. Reuse inventory

Useful previous-project concepts/code to port selectively rather than transplant wholesale:

### DaemonLink

Reuse ideas:

- root-aware/bounded repo inspection;
- deterministic receipts/digests;
- evidence normalization/dedupe;
- read-only project insight;
- hostile-input hygiene;
- explicit source state.

Do not create a second Python/FastAPI backend merely to preserve the old topology.

### RekTrace

Reuse ideas:

- heartbeat/status discipline;
- explicit exit/outcome semantics;
- HTTP/public-health probe;
- observable worker/progress feedback.

### SPCM lineage concept

Reuse:

- prompt/decision/diff/test/outcome lineage as a mental model for Build Replay/history;
- evidence-first state transitions.

Do not depend on a nonexistent/unclear standalone SPCM package.

### Cheevo

Reuse product concept:

- meaningful achievement/state-transition layer;
- shareable achievement identity.

Do not assume the historical codebase is a production-ready subsystem.

## 8. What starts next

Do **not** jump directly from PR #29 into broad social/UI feature implementation.

Next canonical phase is `PLATFORM_FOUNDATION_V0` as defined in `IMPLEMENTATION_ROADMAP_MVP_V0.md`:

1. resolve build/license/runtime trust debt;
2. establish authenticated API + Postgres + session/authorization skeleton;
3. establish versioned contracts/public projection/outbox/GitHub App skeleton;
4. prove one end-to-end Player/Mission/GitHub observation path;
5. keep the phase bounded and feature-light.

Then build the executable REKT Signal System and complete founding-player vertical slices against that foundation.

## 9. PR #29 disposition

PR #29 remains a valuable first implementation slice and should not be rewritten into the entire new MVP scope.

It should be reviewed/merged or otherwise closed on its own objective/evidence when the user authorizes that action.

The new canonical docs branch starts from its exact head so future work can inherit the protocol slice without pretending PR #29 already implements the full MVP.