# REKT INKUBATOR — CURRENT STATE MIGRATION MAP V1

**Status:** LOCKED MIGRATION MAP / STAGE-E FRONTEND DECISION RESOLVED  
**Date:** 2026-09-14  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`

Purpose: stop two expensive mistakes during the product reset:

1. rewriting already-good substrate because old public product nouns changed;
2. accidentally keeping obsolete public surfaces/authority because code already exists.

Classification:

```text
PRESERVE  = keep semantics/boundary; reuse directly where possible
ADAPT     = reuse implementation/substrate behind new Challenge product
PARK      = keep code/history but remove from forward launch path
PROMOTE   = existing runtime becomes the forward product root through refactor
NEVER MIX = distinct product boundary; no Inkubator coupling
```

## 1. Repository product boundary

### `apps/web` — REKT Terminal frontend

**Classification:** `NEVER MIX`

- distinct trading/career Terminal product;
- not the Inkubator frontend;
- may share repository tooling/packages only under frozen product-boundary rules.

### `apps/api` — REKT Terminal API

**Classification:** `NEVER MIX`

- do not mount Challenge routes here;
- do not make Terminal simulated market/career state Inkubator truth.

## 2. Inkubator application roots

### `apps/inkubator-api`

**Classification:** `PRESERVE + ADAPT`

Preserve:

- authenticated Fastify product boundary;
- authorization model;
- PostgreSQL access;
- GitHub integration;
- outbox/job foundations;
- canonical-json/digest utilities where protocol ownership permits;
- history/evidence lineage;
- provider/session configuration patterns.

Adapt:

- introduce bounded Challenge-domain modules during Stage C;
- build explicit Challenge-first production route assembly;
- keep historical domain code from becoming implicit launch API merely because it remains compiled;
- avoid further growth of monolithic `app.ts` / `contract.ts` by placing Challenge code behind a cohesive module boundary.

Do not:

- create a second database/truth system for Challenges;
- rewrite stable auth/GitHub/job foundations without evidence;
- register parked legacy/dev routes in Challenge production assembly.

### `apps/inkubator-verifier`

**Classification:** `PRESERVE`

- remains isolated hostile remote-URL/network observation boundary;
- no trusted DB/GitHub/session/payment credentials;
- later acceptance/evidence modules may call it through narrow contracts;
- do not merge into API merely to reduce deploy count.

### `apps/inkubator-lab`

**Classification:** `PROMOTE + REFACTOR / STAGE-E FRONTEND ROOT`

Stage-E decision: this existing runtime is the canonical forward Inkubator frontend.

Promote/refactor for:

- Discover;
- Compiler / Create;
- Challenge;
- My Build;
- Review / Test Arena shell;
- Receipt / History;
- Operator Exceptions;
- Technical Faceplate calibration;
- desktop/mobile/reduced-motion verification;
- Storybook/visual/interaction proofs.

Rules:

- the historical `WORLD / COMMAND / PROJECT / PLAYER / SHIP` shell is parked from forward navigation and may remain only through explicit compatibility access such as `?mode=...` deep links and lab/legacy queries used for test/lab evidence;
- existing auth/session, generated API client, React Query, Playwright, Storybook, Lighthouse and visual-calibration substrate should be reused rather than duplicated;
- missing Challenge-first transport renders explicitly unavailable; parked legacy routes are not substituted;
- promoting the runtime does not promote obsolete public nouns or mutable legacy authority.

### dedicated production Inkubator frontend

**Classification:** `DECIDED — DO NOT CREATE FOR STAGE E`

The Stage-E frontend-root decision is to promote/refactor `apps/inkubator-lab`, which is already the machine-enforced `rekt-inkubator` frontend/deployment root in `docs/PRODUCT_BOUNDARIES_V1.md` and `config/product-boundaries.json`.

Do not create `apps/inkubator-web` unless later implementation evidence proves the promoted runtime cannot safely satisfy the product boundary. Do not reuse Terminal `apps/web`.

## 3. Protocol/packages

### `packages/inkubator-protocol`

**Classification:** `PRESERVE + EXTEND`

This is the canonical home for Stage B and the pure Stage-D Compiler.

Preserve:

- package identity `@rekt-ink/protocol`;
- AJV/schema validation lineage;
- canonical schemas already used by Inkubator;
- deterministic/canonical serialization patterns where valid;
- Node test-runner simplicity;
- deterministic `CompilerState` / blueprint / Build Contract candidate semantics.

Extend only under the relevant stage contracts.

Do not create a parallel `challenge-protocol` or frontend-local compiler semantics.

### `packages/cli`

**Classification:** `ADAPT IN STAGE F`

Evolve existing CLI toward Builder Capsule commands. Avoid a second Challenge CLI.

### `packages/sdk`

**Classification:** `ADAPT IN STAGE F`

Expose Challenge/Build Contract client semantics through the existing generated-transport/domain-wrapper philosophy. Do not grant client authority to mint qualification/payment/receipt facts.

### `packages/mcp`

**Classification:** `ADAPT LATER`

Useful as coding-agent access to Challenge context/actions. MCP is not Challenge truth and not required for ordinary web participation.

## 4. Existing domain nouns

### Player

**Classification:** `PRESERVE AS IDENTITY SUBSTRATE`

Future public concept: Builder identity/history/Passport facts.

Do not require users to learn historical Player-world semantics to join a Challenge.

### Project

**Classification:** `PRESERVE + ADAPT`

Connected repository/artifact/workspace locus beneath a Challenge Entry.

Challenge authority does not depend on mutable Project progress state.

### Mission / Next Move

**Classification:** `PARK AS LAUNCH VOCABULARY / ADAPT OPTIONAL OPERATIONS`

Potentially useful to help a builder work through a Challenge, but:

- not Challenge lifecycle authority;
- not organizer qualification authority;
- not required public navigation;
- no duplicate project manager.

### Round

**Classification:** `PARK`

Historical cohort/grouping concept. It does not control funded Challenge lifecycle. Later campaign/sponsored-program concepts may reuse ideas only through explicit new authority.

### World / social feed / Follow / Watch / comments

**Classification:** `PARK FOR ALPHA`

Keep implementation/history but do not expose simply because it exists. Reintroduce only if real Alpha evidence shows it materially improves Challenge discovery/building.

### Help Beacon / Assist / Party / external test

**Classification:** `PARK + REUSABLE CARTRIDGES`

Potentially valuable contextual collaboration/evaluation mechanisms later. Not Alpha dependencies unless a concrete Challenge needs one to work.

### Cheevos / boards / game status

**Classification:** `PARK`

Do not let engagement/gamification compete with Challenge comprehension. Evidence-backed Builder Passport facts may reuse parts of historical reputation infrastructure later.

### Evidence / observations / history

**Classification:** `PRESERVE`

Core reusable truth substrate for:

- GitHub/source observations;
- evaluation evidence;
- immutable submission lineage;
- receipt/history;
- operator/audit events.

`CLAIMED != OBSERVED != PROVEN` remains valuable ancestry; new Challenge qualification semantics must remain explicit and versioned rather than collapsing everything into PROVEN.

### Ship / Ship Receipt

**Classification:** `PRESERVE + ADAPT`

Preserve durable artifact/evidence/receipt lineage where compatible.

Challenge submission itself is defined by the new immutable `SubmissionManifest`; later integration may reference/create a Ship artifact boundary rather than invent a second copy of source/artifact truth.

Do not force historical Ship UI vocabulary into the organizer/builder Challenge experience.

## 5. GitHub integration

**Classification:** `PRESERVE`

Reuse:

- stable provider IDs;
- installation/repository binding;
- webhook verification/deduplication;
- read-minimum permission philosophy;
- repository observations;
- revocation/tombstone handling;
- outbox-driven work.

Challenge additions later include immutable source reference/snapshot acquisition and Builder Capsule feedback, without expanding permissions casually.

## 6. Jobs / outbox

**Classification:** `PRESERVE + ADAPT`

Existing Postgres durable outbox/`SKIP LOCKED` worker pattern remains the preferred low-operator-cost foundation.

Later Challenge jobs may include:

- due-state advancement;
- snapshot/archive capture;
- verifier/evaluation orchestration;
- notification delivery;
- settlement reconciliation after that system is authorized.

Long jobs require lease duration/renewal semantics per Survivor V1.1. Do not add Redis/BullMQ/Kafka without measured need.

## 7. Frontend/design ancestry

### REKT Technical Faceplate

**Classification:** `PRESERVE AS VISUAL AUTHORITY`

Apply to new Challenge/Compiler surfaces. Do not merely reskin obsolete IA.

### Historical five-surface shell (`WORLD / COMMAND / PROJECT / PLAYER / SHIP`)

**Classification:** `PARK AS IA / REUSE COMPONENTS`

Useful design/component/runtime evidence, but not Alpha navigation.

Alpha IA is locked by `STAGE_E_CHALLENGE_UI_V1.md`:

```text
Discover
Compiler / Create
Challenge
My Build
Review / Test Arena
Receipt / History
Operator Exceptions
```

## 8. Production-route policy

The Challenge-first production app must use an explicit allowlisted route assembly.

Classification of historical endpoints:

- auth required by Challenge app → `PRESERVE`;
- GitHub integration required by Challenge app → `PRESERVE`;
- Challenge/submission/review/receipt routes → `ADD IN STAGES C+`;
- health/readiness → `PRESERVE`;
- historical Mission/Round/World/social/help/assist/devkit routes → `PARK FROM PRODUCTION ASSEMBLY` unless explicitly promoted;
- dev/test/fixture routes → `NEVER PRODUCTION`.

Parking an endpoint from production assembly does not require deleting its code immediately.

## 9. Database migration philosophy

Stage C is additive first.

Prefer new Challenge-owned tables with explicit foreign/reference links to useful existing identities/artifacts over renaming or destructively transforming historical tables.

Conceptual additions:

```text
Challenge
ChallengeContractVersion
ChallengeEntry
ChallengeSubmission
ChallengeQualification
ChallengeDecision
ChallengeReceipt
```

Only after the new product stabilizes should unused historical tables be considered for archival/removal. No destructive cleanup as part of first Challenge implementation unless it is required for a security boundary.

## 10. Deployment implication

Keep Terminal and Inkubator deployments distinct.

Within Inkubator, bootstrap deployment preference remains:

```text
frontend
one modular Inkubator API
one PostgreSQL
one small worker process/entrypoint where needed
isolated verifier
```

The Compiler is a module/library + replaceable model adapter inside this system, not a fleet of services.

## 11. Migration kill criteria

Stop/review if implementation attempts to:

- rebuild auth/GitHub/jobs from scratch without evidence;
- import Terminal app/API code into Inkubator;
- make Mission/Project/Ship mutable state authoritative Challenge economics;
- expose parked historical routes automatically;
- create parallel SDK/CLI/MCP stacks;
- add a second canonical database;
- split every Challenge function into services;
- delete old data/code simply because public product nouns changed;
- preserve old top-level navigation solely because it was expensive to build;
- create a second Inkubator frontend without new evidence that invalidates the Stage-E promotion decision.

## 12. Verdict

```text
TERMINAL                       NEVER MIX
INKUBATOR API                  PRESERVE + MODULARLY ADAPT
VERIFIER                       PRESERVE ISOLATED
INKUBATOR FRONTEND ROOT        apps/inkubator-lab / PROMOTE+REFACTOR
SECOND INKUBATOR FRONTEND      DO NOT CREATE IN STAGE E
INKUBATOR PROTOCOL             PRESERVE + EXTEND UNDER STAGE CONTRACTS
CLI / SDK / MCP                ADAPT, DO NOT DUPLICATE
PLAYER / PROJECT               PRESERVE AS SUBSTRATE
MISSION / WORLD / SOCIAL       PARK FROM ALPHA AUTHORITY
OLD FIVE-SURFACE IA            PARK FROM FORWARD PRODUCT
HELP / ASSIST                  PARK AS LATER CARTRIDGES
EVIDENCE / HISTORY             PRESERVE
SHIP / RECEIPT                 PRESERVE + ADAPT
GITHUB                         PRESERVE
POSTGRES OUTBOX                PRESERVE
DB MIGRATION                   ADDITIVE FIRST
OLD CODE                       KEEP UNTIL SAFE/USEFUL TO RETIRE
OLD PUBLIC IA                  NOT AUTHORITY
```
