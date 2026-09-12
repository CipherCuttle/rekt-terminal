# REKT INK(CUBATOR) — Current State and Gap v0

**Status:** CANONICAL CURRENT IMPLEMENTATION MAP

**Updated:** 2026-09-08 — REKT Instrument OS amendment applied

**Current completed product phase:** PHASE 8 — DEVKIT LAUNCH SURFACE

**Current active branch/PR:** PHASE 9 / PR #44 — draft / open / unmerged

**Current execution split:** PHASE 9A — REKT INSTRUMENT OS FRONTEND REBUILD → PHASE 9B — FOUNDING-COHORT REHEARSAL

**Canonical frontend authority:** `REKT_INSTRUMENT_OS_V1.md`

**Phase-8 reviewed product candidate:** `a3eeffba1ee9a3955af5c7e6372820acf136e709`

**Phase-8 closure receipt:** `PHASE_8_CLOSURE_V0.md`

## 1. Critical distinction

The backend/product capability is substantially ahead of the launch frontend.

Phases 0 through 8 of `IMPLEMENTATION_ROADMAP_MVP_V0.md` implemented the founding product loop, trust boundaries, Ship flow, reputation/Cheevos and DevKit under the bounded completion policy.

Phase 9 originally began as rehearsal-only. On 2026-09-08 the user explicitly reopened **frontend implementation/aesthetic authority** after direct review of the current GitHack/V3/Golden-Screen experience showed that it materially undersold the product and solved the wrong visual problem.

This does not reopen Phase-1..8 truth/security/domain work. It inserts a launch-frontend rebuild gate before founding rehearsal can close.

Do not regress planning to the historical PR-#29 protocol slice. Do not treat the current V3/Golden-Screen composition as the final product merely because old browser tests pass.

## 2. What exists now

### Platform / trust substrate

- Node 24-oriented deterministic workspace and CI discipline;
- authenticated Inkubator API boundary;
- Postgres-backed Player, Project, Mission and supporting state;
- secure session/auth separation and deny-by-default resource authorization;
- explicit public/private projections;
- versioned OpenAPI contract and generated clients;
- append-oriented history/evidence + bounded outbox/worker foundation;
- GitHub App installation/webhook ingestion, signature validation, delivery dedupe and repository authority controls.

### Product loop

Implemented product capability covers:

`BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER`

Including:

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

## 3. What is wrong with the current frontend

The current launch-preview composition is not accepted as the final frontend.

Confirmed issues from source/build review:

- V3 remains structurally a scrolling marketing microsite;
- Phase-2 Golden Screens are development-fixture views rather than production route projections;
- major surfaces still read as cards/panels rather than one persistent instrument chassis;
- the frontend often renders backend nouns/status instead of causal state flow;
- actual React Bits Pro source is not the public runtime identity; fallback CSS gradients/noise stand in for several effects;
- Inter/system typography and generic iconography weaken the intended terminal/instrument identity;
- the rich generated API client exists, but the older Golden Screens do not represent the final real-data architecture;
- the backend/product loop is more sophisticated than the current interface communicates.

The previous frontend is therefore **reference/archive, not launch authority**.

## 4. New canonical frontend direction

`REKT_INSTRUMENT_OS_V1.md` now governs visual, motion and frontend-renderer decisions.

Thesis:

> **REKT Inkubator is a black software instrument for building: OP-1-class realtime graphical interaction philosophy + CRT terminal material + diegetic field-machine behavior + tiny REKT pixel-state identity.**

Core manifestation:

- persistent machine shell rather than scrolling-page composition;
- one visual OS viewed through WORLD / COMMAND / PROJECT / PLAYER / SHIP;
- `BROADCAST / COCKPIT / ARTIFACT` intensity grammar retained;
- COMMAND is the first production-quality proof;
- Mission Machine + graphical Thread + one dominant Next Move;
- backend events visibly travel as truthful signals;
- small REKT state sprites live inside instruments rather than acting as a giant mascot;
- raw UI must already look high quality with CRT/postprocessing disabled;
- CRT is a material/compositor layer, not a design crutch.

## 5. Frontend stack direction

Keep:

- React 19;
- Vite 7;
- Base UI;
- Storybook;
- Playwright/axe/visual snapshots;
- Three + React Three Fiber for Broadcast/WORLD/rare ceremony.

Adopt for the rebuild:

- TanStack Router — route/mode architecture;
- TanStack Query — server state over the generated API client;
- GSAP + `@gsap/react` — main choreography authority;
- GSAP SVG/layout/text capabilities where justified;
- PixiJS 8 — 2D instrument graphics, scopes, radar and REKT sprite sheets;
- bespoke REKT domain glyphs + strict-grid pixel utility icons.

Selective only:

- Rive for a very small number of stateful hero instruments if it outperforms SVG/Pixi in a real prototype;
- xterm.js for actual CLI/log/dev-terminal content only;
- React Bits Pro as compliant licensed atmospheric set pieces, not the core visual system.

Do not introduce multiple competing general animation frameworks without a demonstrated missing capability.

## 6. Preserved hard invariants

The frontend change does not alter:

- `CLAIMED != OBSERVED != PROVEN`;
- private source stays private;
- AI/Daemon remains advisory only;
- participants cannot mint Ship/PROVEN/Cheevo/reputation authority;
- one dominant Next Move remains core UX;
- Thread remains the cross-product red thread;
- missing/stale/unavailable evidence fails visibly closed;
- accepted Ship authority remains trusted-server controlled;
- backend domain state remains canonical; frontend animation cannot manufacture truth.

## 7. Phase 9A — frontend rebuild gate

Before whole-product founding rehearsal can close, execute:

`FREEZE OLD V3 → INSTRUMENT SYSTEM → MOTION LAB → LIVE COMMAND → SHARED SHELL → PROJECT → WORLD → PLAYER → SHIP → BROADCAST ENTRY`

### Instrument/Motion Lab minimum set

- signal path;
- rotary/gauge;
- oscilloscope;
- numeric readout;
- mode switch;
- Thread node;
- REKT sprite states;
- CRT treatment;
- Verifier instrument;
- Mission Machine.

Where meaningful each demonstrates `IDLE / INPUT / ACTIVE / SUCCESS / ERROR`.

This is a bounded calibration gate, not an endless design-system project.

### COMMAND proof requirements

The first live COMMAND must:

- use canonical generated API state rather than development fixtures;
- make Mission/current state/Next Move/Thread obvious;
- distinguish Daemon advisory state from authoritative Mission state;
- visibly manifest blocker/help/source/evidence status;
- demonstrate at least healthy/building, blocked/help-needed and ship-ready/proven scenarios;
- show coordinated causal response to at least one real or deterministic replayed backend event;
- remain usable with CRT disabled and with reduced motion.

## 8. Phase 9B — founding-cohort rehearsal

Once the launch frontend is coherent enough to test honestly, resume/complete the whole-system rehearsal with 2–3 friendly/internal Players.

Required product/recovery drills still include:

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

Also require full desktop/mobile journeys through the rebuilt product.

Synthetic actors cannot replace the final human-rehearsal requirement.

## 9. Frontend acceptance gates

The launch frontend fails if:

- removing the REKT logo leaves a generic crypto/SaaS dashboard;
- raw UI only looks good because CRT/shaders hide weak composition;
- user cannot identify Mission/current state/blocker/Next Move quickly;
- production routes import fixture state;
- CLAIMED visually reads like OBSERVED/PROVEN;
- acid green becomes generic decoration;
- every surface uses the same card grid;
- REKT becomes a mascot layer rather than a small state language;
- animations run without causal/state meaning;
- Three/Pixi/Rive canvases proliferate without renderer boundaries;
- the old V3 is merely reskinned rather than structurally replaced.

Aesthetic fit and perceived runtime quality outrank marginal Lighthouse-score gains, but input latency, motion smoothness, loading quality, mobile layout and accessibility are still quality requirements.

## 10. Operational/repository state

At this amendment:

- Phase-8 PR #43 remains draft/open/unmerged;
- Phase-9 PR #44 remains draft/open/unmerged;
- PR #44 is now titled `feat(inkubator): rebuild Instrument OS before founding rehearsal`;
- no merge authority has been granted;
- current frontend authority lives in `REKT_INSTRUMENT_OS_V1.md`;
- `INDEX.md` records the precedence/supersession rules.

Volatile SHA/CI/deployment state must still be reconciled from GitHub before any implementation mutation.

## 11. Next action

Proceed with **PHASE 9A — REKT INSTRUMENT OS FRONTEND REBUILD** on the active Phase-9 lineage.

First implementation target:

1. install/freeze the selected frontend stack and renderer boundaries;
2. create the Instrument/Motion Lab;
3. lock the raw visual grammar without relying on CRT;
4. build one live production-quality COMMAND against the generated API client;
5. test healthy/building, blocked/help-needed and ship-ready/proven states;
6. only then propagate the shared machine shell to PROJECT/WORLD/PLAYER/SHIP/Broadcast.

Use the bounded completion discipline. Do not spend another phase polishing the discarded V3 composition.
