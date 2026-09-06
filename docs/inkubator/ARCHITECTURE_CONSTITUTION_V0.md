# REKT INK(CUBATOR) — Architecture Constitution v0

**Status:** CANONICAL / NON-NEGOTIABLE PLATFORM INVARIANTS

**Locked:** 2026-09-06

## Purpose

This document exists to preserve four properties while the product grows:

1. clean trust boundaries;
2. reproducible builds/releases;
3. stable semantics/history;
4. the smallest sufficient systems surface.

The implementation may change libraries and providers. These invariants survive unless explicitly superseded by a documented decision.

## 1. Modular monolith first

New product domains begin as modules, not services.

Preferred structure:

```text
apps/
  inkubator-web/
  inkubator-api/
  inkubator-worker/

packages/
  inkubator-protocol/
  inkubator-core/
  inkubator-ui/

apps/inkubator-api/src/modules/
  auth/
  github/
  players/
  projects/
  missions/
  evidence/
  social/
  achievements/
  ships/
  ops/
```

A module may become another deployed process only when at least one of these is true:

- materially different trust boundary;
- materially different scaling profile;
- materially different availability requirement;
- materially different deployment lifecycle;
- existing process cannot safely satisfy the requirement.

"Microservices are industry standard" is not a valid extraction reason.

## 2. Trust boundaries may create processes

The future hostile URL/browser/build verifier is a separate trust zone.

It must not possess:

- GitHub App private key;
- private repo tokens;
- Inkubator session secrets;
- direct write authority to canonical product tables;
- operator credentials;
- repository write permissions;
- React Bits/build-system secrets.

It returns a narrow evidence result to trusted product authority.

The existing public REKT market API remains separate from authenticated Inkubator product authority. Do not bolt Player sessions/private repo data/moderation onto a permissive public market-data service merely to reuse Fastify wiring.

## 3. One canonical database until evidence says otherwise

PostgreSQL is the canonical store for MVP:

- players/sessions;
- projects/missions;
- memberships/social edges;
- comments;
- current state;
- activity/evidence history;
- achievements/assists;
- ship receipts;
- webhook deliveries;
- initial job/outbox substrate.

Do not add Redis, Kafka, MongoDB, Neo4j, Elasticsearch, ClickHouse or a vector database without a measured bottleneck or product requirement that Postgres cannot reasonably satisfy.

Visualization of a graph does not require a graph database.

## 4. Current state + append-oriented history, not full event sourcing

Use normal transactional tables for mutable current state.

Use append-oriented records for durable history where rewriting meaning would be dangerous.

Examples:

Current state:

- players;
- profiles;
- projects;
- missions;
- milestones;
- project_members;
- comments;
- follows/watches.

Append-oriented:

- activity_events;
- evidence_events;
- achievement_grants;
- assists/acceptance history;
- ship_receipts;
- github_deliveries;
- audit/operator actions.

Do not require event replay to answer ordinary product reads.

## 5. Domain mutation + event publication is atomic

When a domain mutation must produce downstream work/history, write the mutation and an outbox/event row in the same Postgres transaction.

Do not perform a database write and then separately "hope" event publication succeeds.

Initial worker implementation may be a small Postgres-backed job/outbox runner using `FOR UPDATE SKIP LOCKED`, bounded retries, `next_attempt_at`, and dead/failed state.

Adopt a queue library such as pg-boss only when the product actually needs additional queue semantics such as advanced cron, priorities, throttling or richer DLQ tooling.

## 6. Background work is idempotent

Every externally retried or agent-triggered mutation must have defined retry semantics.

Requirements:

- webhook deliveries dedupe by provider delivery ID;
- SDK/CLI/MCP mutations accept/derive idempotency keys;
- retrying Ship preparation cannot create duplicate authoritative Ship state;
- retrying Assist/claim/update cannot create duplicate reputation-bearing actions;
- workers may retry safely after crash/timeouts.

Where possible enforce idempotency with database uniqueness, not only in-memory checks.

## 7. Authorization is deny-by-default and resource-specific

Do not model authorization as only `ADMIN` versus `USER`.

Permissions are relationship/attribute based:

- owns Project;
- member of Project;
- operator for Round;
- Project public/unlisted/private;
- comment author/project moderator;
- source/integration ownership.

Every protected action conceptually executes:

`authorize(actor, action, resource)`

and defaults to deny.

Authorization tests must cover negative cases, not only happy-path owners.

## 8. Session credentials remain server-side

Browser authentication uses secure server-managed sessions/opaque identifiers in `Secure` + `HttpOnly` cookies as the default MVP model.

Do not put high-value session/refresh/provider credentials in `localStorage`.

GitHub installation/user credentials remain server-side and encrypted/managed according to provider semantics.

CLI/MCP/project automation credentials are separate credential classes with explicit scopes and revocation.

No single "God API key" spans browser, SDK, MCP, operator and CI authority.

## 9. Private source data requires explicit public projection

Connected repository/integration data is private by default unless the source is public and the product contract explicitly exposes it.

The server constructs public DTOs/projections.

Never send private source objects to the browser and rely on UI/CSS to hide sensitive fields.

Public projection tests are security tests.

## 10. Repository content is hostile input

READMEs, code, issues, commits, comments and dependency manifests may contain malicious instructions/content.

Trusted repo intelligence may statically inspect bounded files/metadata.

The trusted product worker must not run participant-controlled:

- `npm install`;
- build scripts;
- shell scripts;
- Docker builds;
- arbitrary repository executables.

Any future execution/build verification belongs in an isolated sandbox with no platform secrets, restricted network, ephemeral filesystem, and hard CPU/memory/time/output limits.

## 11. AI is advisory, never authoritative

AI/Daemon MAY summarize, classify, suggest, match and draft.

AI/Daemon MAY NOT directly:

- mark PROVEN;
- grant achievement;
- approve Ship;
- alter reputation;
- change authorization;
- expose private data;
- silently alter Mission ship condition;
- execute hostile code inside the trusted product boundary.

Trusted state changes must come from deterministic rules, bounded human actions, trusted adapters or explicit Player mutations permitted by the contract.

## 12. Stable semantics are versioned

Persisted meaning is not coupled to package SemVer.

Version domain semantics explicitly:

- `event_version`;
- receipt schema/rule version;
- achievement rule version;
- Assist rule version where material;
- progress model version;
- leaderboard rule version;
- public projection version when compatibility matters.

Rules:

- existing field meaning never silently changes;
- materially changed required fields/types/enums require a new semantic version;
- old records remain readable;
- historical achievement/receipt meaning is never recomputed under a new rule without explicit migration semantics.

`@rekt-ink/sdk@2.4.1` is not `receipt.v2`.

## 13. Boundary contracts are executable

Use JSON Schema Draft 2020-12 as the canonical protocol-schema basis where applicable.

Use a stable OpenAPI 3.1.x contract for HTTP API generation/compatibility until a later explicit decision upgrades the toolchain.

Prefer one canonical boundary schema and generated derivatives over manually duplicating:

- JSON Schema;
- Zod schema;
- TS interface;
- OpenAPI schema;
- frontend type.

API breaking changes must be detected in CI and explicitly versioned/approved.

## 14. Database migrations use expand → migrate → contract

Production-compatible schema changes follow:

`ADD → DUAL SUPPORT/BACKFILL → SWITCH → VERIFY → REMOVE LATER`

Avoid destructive rename/drop changes that require perfectly synchronized deployment of API + worker + web.

Old/new application versions should be able to overlap during ordinary deploys where practical.

## 15. Reproducible build contract

Production build identity is determined by at least:

- source commit SHA;
- committed lockfile;
- pinned/supported Node/toolchain;
- committed build configuration;
- controlled licensed/private build inputs;
- declared environment configuration.

CI uses `npm ci`, not mutating dependency resolution.

Do not execute critical build tools as floating `@latest` dependencies.

CI verification does not write generated source/build output back into source branches.

## 16. Runtime baseline

Platform Foundation v0 standardizes on Node 24 LTS and constrains supported runtime intentionally (for example `>=24 <25` plus `.node-version`).

Runtime upgrades happen by reviewed PR, not accidental environment drift.

## 17. GitHub Actions/release trust

Production/release workflows should converge on:

- minimum permissions;
- immutable/full-SHA pinned third-party Actions where practical;
- Dependabot/automation to propose upgrades;
- protected main/release branches;
- required verification before deployment;
- short-lived/OIDC deployment credentials where supported;
- release artifact digest/provenance;
- no long-lived npm publishing token when npm Trusted Publishing is available.

Artifact attestations/provenance matter only when verified/used in the release path; do not add provenance as decorative compliance metadata.

## 18. React Bits Pro/private licensed source boundary

Licensed proprietary source must not be treated as ordinary public repository source if its license forbids that distribution.

The app should depend on a stable local abstraction such as an atmosphere/effect adapter rather than deep-importing licensed implementation throughout product code.

Licensed source/registry credentials belong in controlled private build context and must not be committed through generated CI output.

The current branch's React Bits source/public-history state is a Platform Foundation F0 cleanup item and must be resolved before production release.

## 19. Small systems surface rule

Every new infrastructure service/database/runtime must answer:

1. What observed failure/bottleneck does it solve?
2. Why can current Postgres/Node/Vite/Fastify not solve it safely enough?
3. What new operational failure modes does it introduce?
4. What is the rollback/removal path?

If the answer is only "this is standard at scale," defer it.

## 20. Dependency ownership rule

Every major library has one clear job.

Frontend target responsibilities:

- React — component runtime;
- Vite — web build/dev;
- Base UI — accessible unstyled interaction primitives;
- CSS Modules/custom properties — visual system implementation;
- TanStack Router — URL/route state;
- TanStack Query — server/cache state;
- XState — only complex workflow state machines;
- Motion — bounded DOM state/navigation/ceremony motion;
- React Bits/Three/R3F — Broadcast atmosphere only;
- Storybook — component/pattern lab;
- Playwright — browser/E2E/visual testing;
- axe-core — automated accessibility subset;
- Lucide — mundane UI icons; custom Ink glyphs for domain concepts.

Backend target responsibilities:

- Fastify 5 — HTTP server/schema-driven API;
- PostgreSQL — canonical storage/job substrate;
- Kysely — thin type-safe SQL layer unless a later spike invalidates it;
- Octokit / GitHub App — GitHub integration;
- Pino/Fastify logger — structured logs;
- OpenTelemetry — later cross-process tracing when enough async paths exist to justify it.

Avoid overlapping global-state/framework libraries without demonstrated need.

## 21. Security/product controls should fail closed

Examples:

- verifier cannot reach source → UNKNOWN/UNAVAILABLE, not PASS;
- GitHub permission revoked → evidence becomes unavailable/stale, not fabricated from cache;
- public projection uncertainty → omit/private, not expose raw source;
- AI uncertainty → advisory text, not authoritative mutation;
- release provenance verification failure → do not deploy authoritative release.

## 22. Architecture hostile tests

Before MVP launch the system must prove at minimum:

1. participant-controlled SDK cannot create PROVEN;
2. Player credential cannot grant achievement/approve Ship;
3. verifier lacks access to product/GitHub secrets;
4. private repo data cannot leak through public projection;
5. duplicate webhook does not duplicate authoritative domain action;
6. worker crash/retry remains idempotent;
7. old protocol fixtures remain readable after SDK/application upgrades;
8. browser bundle cannot import/use server credential path;
9. deleting CLI/MCP local config/cache loses no authoritative state;
10. production artifact is traceable to approved source/build workflow.

## 23. Reopen rule

Architecture may become more complex only when an explicit decision record identifies the failing invariant/bottleneck and demonstrates why the additional system is the smallest safe repair.