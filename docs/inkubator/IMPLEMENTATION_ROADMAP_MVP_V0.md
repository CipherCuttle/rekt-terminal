# REKT INK(CUBATOR) — MVP Implementation Roadmap v0

**Status:** CANONICAL / BOUNDED IMPLEMENTATION ORDER

**Locked:** 2026-09-06

## Goal

Build the complete founding-cohort MVP defined by `NORTH_STAR_MVP_V0.md` without allowing platform hardening, design-system work or speculative infrastructure to become independent endless projects.

Every phase exists to close a specific product capability.

## Default phase completion rule

For every phase:

`IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE re-review only if Critical/High fixes were needed → COMMIT → MOVE FORWARD`

Medium/Low findings do not restart a phase unless they undermine the phase objective, invalidate evidence, violate a frozen invariant/contract or create a fail-closed/security defect.

Do not merge/rewrite PR #29 as part of this roadmap unless the user explicitly authorizes it.

---

# PHASE 0 — AUTHORITY FREEZE

**Status:** this documentation phase.

## Objective

Make the agreed MVP/product/architecture/UX/DevKit scope canonical before further broad implementation.

## Deliverables

- canonical authority index;
- North Star;
- Product Contract;
- Architecture Constitution;
- REKT Signal System;
- DevKit Contract;
- Current State/Gap;
- Roadmap;
- Decision Register;
- historical Inkubator visual docs marked non-canonical/superseded where necessary.

## Exit gate

A new agent can answer, from repo docs alone:

- what MVP means;
- what exists now;
- what must be built;
- what truth means;
- what the visual system is;
- what the trust/build constraints are;
- what DevKit may and may not do;
- what phase comes next.

No product feature implementation required.

---

# PHASE 1 — PLATFORM FOUNDATION V0

## Objective

Create the smallest safe authenticated platform substrate that allows real Player/Mission work to begin.

This is a floor, not a platform project.

## Required work

### F1A — build/runtime/licensing cleanup

- standardize Node 24 LTS support/pin;
- replace mutating `npm install` CI with deterministic `npm ci` verification;
- remove floating critical `@latest` tool execution from production verification path;
- separate verification CI from deployment/build publication;
- resolve React Bits Pro public-source/license boundary and stop prohibited/generated licensed source commits if applicable;
- reduce workflow permissions/secrets to minimum jobs/steps;
- define protected release artifact path.

### F1B — authenticated product boundary

Create separate authenticated Inkubator product API rather than extending the current permissive market API trust boundary.

Establish:

- Fastify 5 authenticated app skeleton;
- Postgres;
- thin SQL layer (Kysely target unless spike invalidates it);
- secure server-side session model;
- Player identity table/model;
- resource-specific deny-by-default authorization helper/tests;
- public/private projection seam;
- OpenAPI 3.1 contract generation;
- one generated typed web/client consumer.

### F1C — event/job foundation

- append-oriented activity/evidence envelope with explicit semantic version;
- transactional outbox/job table;
- one small idempotent worker;
- bounded retry/failure state;
- no Redis/Kafka.

### F1D — GitHub App skeleton

- GitHub App install/auth path with minimum read permissions;
- immutable GitHub user/repository IDs stored where relevant;
- webhook HMAC validation;
- delivery-ID dedupe;
- one normalized repository observation;
- private source remains private.

## Required vertical proof

One real authenticated Player can:

1. create/login;
2. create a minimal development Mission/Project record;
3. connect an allowed GitHub repo;
4. receive one webhook/observation;
5. see a safe public/private projection distinction;
6. survive duplicate webhook + worker retry without duplicate authoritative events.

## Explicit non-scope

- broad social product;
- leaderboards;
- full Cheevo library;
- AI Daemon;
- arbitrary URL verifier;
- polished final Command Center;
- Redis/microservices.

## Exit gate

All Architecture Constitution hostile tests relevant to the foundation pass; the end-to-end proof works; no Critical/High review defect remains.

Then stop platform work.

---

# PHASE 2 — REKT SIGNAL SYSTEM / FIVE GOLDEN SCREENS

## Objective

Make the locked visual grammar executable before feature teams invent parallel styles.

## Required work

- semantic tokens;
- Base UI `Ink*` accessible wrappers;
- Signal, Frame, Thread, Portrait, Event, Beacon primitives/patterns;
- Storybook;
- keyboard/focus/reduced-motion states;
- container-responsive behavior;
- five development-fixture scenes:
  - WORLD;
  - COMMAND;
  - PROJECT;
  - PLAYER;
  - SHIP.

## Quality gates

- Playwright journeys;
- axe automated subset;
- visual snapshots;
- manual keyboard/mobile review;
- manual screen-reader sampling;
- bundle/performance regression budgets;
- no React Bits/Three critical-path leakage into ordinary Cockpit interactions.

## Exit gate

A tester can move through the five screens and recognize one product family while correctly identifying Mission, Next Move, blocker, state and Ship context.

---

# PHASE 3 — PLAYER → MISSION → COMMAND VERTICAL SLICE

## Objective

Turn an authenticated visitor into a real Player with a persistent Project/Mission and useful Command Center in under roughly 90 seconds for the happy path.

## Required work

- Player profile/optional Character;
- Round join/selection;
- `WHAT ARE YOU SHIPPING?` Mission creation;
- Project creation/link;
- ship condition;
- Mission state machine;
- current focus;
- canonical Next Move;
- milestone/gate/progress model v1;
- blocker;
- stack detection/confirmation where available;
- Command Center using REKT Signal System;
- no full task/backlog manager.

## Exit gate

A founding user can enter, declare a Mission, understand what Ship means and return to a persistent Command view without operator database edits.

---

# PHASE 4 — GITHUB EVIDENCE + DAEMON V0

## Objective

Make the Command Center react to real work instead of manual status fields alone.

## Required work

- bounded static repo insight derived from DaemonLink principles;
- stack/manifest detection;
- GitHub commit/PR/workflow/deployment observations where permissions/data allow;
- provenance/source state;
- evidence freshness/stale behavior;
- observation→proof rule examples;
- Daemon summary:
  - what changed;
  - likely blocker;
  - scope-damage warning;
  - proposed Next Move;
- Daemon output advisory-only;
- hostile repository prompt-injection fixtures.

## Exit gate

A real GitHub change updates observed Project state and can influence a transparent versioned progress/Next-Move rule without participant code directly minting PROVEN.

---

# PHASE 5 — MULTIPLAYER HELP LOOP

## Objective

Make another builder materially useful to the current builder.

## Required work

- public Player/Project discovery;
- Follow Player;
- Watch Project;
- Project comments/replies/reactions (plain text first);
- Help Beacon;
- skills needed/can-help-with profile fields;
- Assist offer + acceptance;
- external tester request/action;
- Party membership/collaborator visibility;
- World Signals for meaningful project events;
- basic moderation primitives:
  - delete own comment;
  - operator remove;
  - block/report seam;
  - Project owner lock where appropriate.

## Explicit non-scope

- DMs;
- algorithmic timeline;
- raw engagement XP;
- paid boosts;
- full realtime surveillance presence.

## Exit gate

Two founding users can discover a contextual need, provide help, accept/record an Assist/test and see the resulting durable Project/Player history without duplicate/gaming behavior.

---

# PHASE 6 — SHIP / VERIFIER / RECEIPT

## Objective

Close the central `WORKING URL OR GTFO` loop with a real trust boundary.

## Required work

- Ship preparation/submission;
- isolated arbitrary-URL verifier service/trust zone;
- SSRF/private-network defenses;
- redirect/DNS controls;
- strict time/size/network limits;
- no platform secrets/write authority in verifier;
- human/operator review path;
- evidence promotion rules;
- accepted Ship Receipt based on the existing protocol lineage;
- artifact-first Ship presentation;
- Party/Assist attribution;
- shareable Ship state.

## Exit gate

A real founding-cohort Project can submit a public artifact, be evaluated without crossing trust boundaries, and receive exactly one versioned accepted Ship Receipt with evidence no stronger than what was actually observed.

---

# PHASE 7 — CHEEVO + REPUTATION + CONTEXTUAL BOARDS

## Objective

Add reward/status only after the behavior being rewarded is real.

## Required work

Implement a deliberately small v1 Cheevo set (roughly 8–12 meaningful achievements), based on versioned authoritative rules.

Suggested starting set:

- FIRST BLOOD;
- TOUCH GRASS;
- PARTY UP;
- UNREKT;
- ACTUALLY HELPFUL;
- WORKING URL OR GTFO;
- REPEAT OFFENDER / multi-Ship;
- NECROMANCER only if graveyard/resurrection data exists truthfully.

Add contextual boards only from real data:

- SHIPPERS;
- ASSISTS;
- COLLABORATION;
- COMEBACK if definable;
- curator WILDCARD.

No universal editable XP.

## Exit gate

Achievements/boards are derived from authoritative history, resistant to trivial retry/click farming and understandable to founding users.

---

# PHASE 8 — DEVKIT LAUNCH SURFACE

## Objective

Make the canonical world available from terminal/code/agent without creating a second truth system.

## Required work

- public protocol package;
- typed TypeScript SDK over generated transport;
- `rekt` CLI;
- MCP bridge;
- scoped/revocable DevKit credentials;
- idempotency/rate-limit behavior;
- optional tiny React/embed Ship/status surface;
- npm Trusted Publishing/provenance path;
- docs/examples;
- DevKit hostile tests `SDK-H01`…`SDK-H10`.

Representative commands:

- `rekt init`;
- `rekt status`;
- `rekt next`;
- `rekt update`;
- `rekt beacon`;
- `rekt claim`;
- `rekt ship`;
- `rekt doctor`.

MCP read/write tools must obey `DEVKIT_CONTRACT_V0.md`.

## Exit gate

Web, CLI and MCP show one canonical Mission state. Participant clients cannot create PROVEN, achievement or Ship-approval authority. Public packages are released through the controlled provenance path.

---

# PHASE 9 — FOUNDING-COHORT REHEARSAL

## Objective

Run the whole system with 2–3 internal/friendly test Players before inviting the full founding cohort.

## Required failure drills

- duplicate GitHub webhook;
- repo renamed/transferred/private/revoked;
- worker crashes after DB commit;
- webhook arrives out of order;
- private README contains prompt injection/secret-like content;
- browser bundle tries server-only SDK import;
- verifier targets localhost/private IP/redirect chain;
- Player retries Assist/Ship mutation;
- old protocol fixture read under new SDK;
- achievement rule version changes;
- deployment rollback;
- Player closes Mission without Ship.

## Exit gate

No Critical/High architecture/product-truth defect remains. All core journeys work on desktop/mobile and can be operated through OPS without database surgery.

---

# PHASE 10 — FOUNDING MVP LAUNCH: 8–10 PLAYERS

## Objective

Test the real product thesis, not only technical correctness.

## Observe

- activation: invited → Mission;
- meaningful evidence generated;
- understanding of Next Move;
- use of Help Beacons/Assists;
- voluntary inspection of other builders;
- Ship rate;
- repeat desire;
- confusion around truth/status/game language;
- where operator/manual work remains heavy.

Do not protect a mechanic because it was expensive to build.

## Completion

MVP is complete as a founding-cohort product when the end-to-end loop works truthfully for real Players and the observed behavior is strong enough to justify iteration/scaling.

---

# After MVP — explicitly not required to launch unless promoted by evidence

Potential future systems:

- full Build Replay timeline;
- visual World graph/constellation;
- guilds/squads;
- Rivalries;
- richer Graveyard/resurrection UI;
- public project telemetry SDK;
- Python/Go SDKs;
- EAS/onchain attestations;
- Farcaster/social distribution integrations;
- richer safe embeds;
- dedicated queue system/Redis only if workload demands it;
- vector search only if repo/knowledge use cases demand it;
- audio/REKT Radio;
- sophisticated realtime presence.

These ideas remain valid backlog/vision candidates, not hidden launch dependencies.