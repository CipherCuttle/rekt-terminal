# REKT INKUBATOR — FUNDED CHALLENGE ARCHITECTURE V1

**Status:** USER-AUTHORIZED PLANNING LOCK ONLY

**Date:** 2026-09-13

**Implementation authority:** NONE

**Merge authority:** NONE

This document is subordinate to `FUNDED_CHALLENGE_MECHANISM_V1.md` and defines how the funded-Challenge product should be implemented without reintroducing legacy product complexity.

## Architecture principles

- Keep a modular monolith for the Challenge domain; do not split into microservices without measured need.
- HTTP API instances must be stateless and horizontally scalable.
- PostgreSQL is current-state authority; `HistoryEvent` is durable historical/evidence record.
- Every irreversible mutation is transactional, idempotent and auditable.
- Async side effects use the existing durable outbox pattern.
- Public reads may be cached; private/economic state is never served from stale public cache.
- GitHub, verifier, object storage and future chain RPC are dependencies/evidence sources, not hidden economic authority.
- Large source/artifact archives do not live in PostgreSQL.
- Economic correctness must survive retries, duplicate requests, delayed workers and multiple API instances.

## Repo/runtime map

```text
apps/web                 REKT trading/practice terminal — keep separate
apps/inkubator-lab       design/Storybook laboratory — keep experimental
apps/inkubator-web       eventual production funded-Challenge UI
apps/inkubator-api       Fastify/Kysely/Postgres Challenge API
apps/inkubator-worker    eventual durable outbox worker process
apps/inkubator-verifier  isolated hostile-URL/evidence observer
packages/inkubator-protocol canonical schemas/state/hashing/receipts
```

The current `apps/inkubator-api`, GitHub integration, server-side sessions, history events, outbox jobs, Project/Ship primitives and protocol hashing are reused rather than replaced.

## Production topology

```text
Browser
  ↓ HTTPS
CDN/edge cache for static/public GETs
  ↓
stateless Inkubator web/API instances
  ↓
PostgreSQL
  ↓ outbox
worker(s)
  ├─ GitHub
  ├─ immutable submission archive
  ├─ verifier
  ├─ notifications
  └─ future settlement reconciliation
```

Future production money flow remains a separate boundary:

`organizer wallet → Challenge Vault → authorized settlement recipients`.

The normal web application must not become a custodial prize wallet.

## Frontend

Create a production `apps/inkubator-web` after the lab design is frozen. Keep React/Vite unless a measured requirement forces a framework change.

Primary routes:

- Discover
- Challenge
- Create
- My Build
- Review
- Receipt/Profile

Rules:

- server/database time controls deadlines;
- economic mutations wait for authoritative server response;
- sealed competitor identity/source is never returned by the API before reveal;
- private routes use `Cache-Control: no-store`;
- public Challenge/discovery reads may use ETag/short shared caching;
- no auth secrets in browser storage;
- constrained/sanitized user content;
- mobile-first responsive behavior, keyboard support, reduced-motion support and WCAG AA target;
- V1 uses polling/conditional GET instead of mandatory WebSockets.

## Backend modules

Target ownership inside `apps/inkubator-api`:

```text
auth/
players/
github/
challenges/      create, terms, entry, transitions, reads
submissions/     manifest, snapshot, qualification
review/          qualification, appeal, selection, resolution
settlement/      adapter, reconciliation, receipt
projects/        retained substrate
ships/           retained substrate
history/         retained substrate
outbox/          retained substrate
legacy/          parked old social/mission surfaces
```

All Challenge transitions go through one domain/state-machine service. Route handlers do not independently reproduce lifecycle rules.

A mutation performs: authenticate → authorize resource → validate → concurrency guard → state change + history event + outbox jobs in one DB transaction → stable response.

## Data model

Add tables without destructively rewriting legacy data:

- `challenges`
- `challenge_terms`
- `challenge_entries`
- `challenge_submissions`
- `challenge_qualification`
- `challenge_qualification_criteria`
- `challenge_appeals`
- `challenge_selections`
- `challenge_settlements`
- `challenge_receipts`

Preserve `players`, `projects`, GitHub bindings, sessions, Ship evidence, `history_events` and `outbox_jobs`.

Important constraints:

- unique builder seat per Challenge;
- unique submission version per entry;
- one normal selection per Challenge;
- one terminal receipt per outcome;
- frozen terms are immutable;
- state-changing requests have idempotency keys;
- use keyset/cursor pagination for growth paths;
- index Challenge state/deadlines, player/organizer history, pending jobs, submissions and settlement reconciliation.

## Concurrency

Seat acquisition must lock/version Challenge state transactionally. A burst for the final seat must yield exactly one success.

Database time is authoritative for deadlines. Worker jobs advance due state, but correctness must not depend on a cron firing at the exact second: reads/mutations may perform a bounded due-state reconciliation before acting.

Selection, settlement and receipt filing must be idempotent single semantic effects even under retries or multiple workers.

## Authentication

GitHub remains the primary V1 account identity.

Use the existing GitHub App model with minimal permissions and stable numeric provider IDs. OAuth must use authorization-code flow with PKCE and unpredictable state; repository access uses GitHub App installation authorization rather than broad personal tokens.

Retain opaque server-side sessions in secure HttpOnly `__Host-` cookies. Harden with session rotation after authentication, explicit logout/revocation, idle/absolute expiry, CSRF tokens in addition to Origin checks, and step-up authentication for high-risk actions.

GitHub identity and payout wallet are separate. Wallet binding uses a one-time signed challenge/nonce. The entry payout address becomes immutable before BUILDING or changes only through a dedicated recovery process.

Resolver/admin permission is separate from ordinary public-user role state and must have stronger authentication and audit requirements before real-money launch.

## Authorization

Authorization is resource-based. IDs never imply access.

- organizer may mutate only owned Challenges and only in allowed states;
- builder may mutate only their entry/submission;
- sealed competitor data remains inaccessible before reveal;
- resolver may act only on assigned disputes and only within resolver jurisdiction;
- system workers use service identity, not a fake player.

Every object endpoint receives broken-object-authorization tests.

## GitHub and submission pipeline

Webhook ingress verifies signature, validates/deduplicates delivery, persists/enqueues minimal durable work, and returns quickly. Heavy processing belongs in workers.

Push webhooks are activity evidence only. A Challenge submission explicitly freezes an immutable commit/source reference and digest. A later push cannot change the submitted build.

Production money launch requires durable private archive/evidence storage so evaluation can survive repository deletion or live-URL changes. Use a provider-neutral private object store with bounded sizes, content-addressed digests, short-lived authorized retrieval and retention policy.

## Verifier boundary

`inkubator-verifier` processes hostile user URLs/artifacts outside the main API trust boundary. It must have no settlement/admin secrets and no production DB credentials.

It needs strict network-target restrictions, redirect/time/size limits, bounded concurrency and structured `PASS / FAILED / UNAVAILABLE` evidence. Verifier unavailability is never automatic builder failure.

Executing arbitrary builder code would require a stronger disposable sandbox and is not part of this V1 verifier assumption.

## Async work

Reuse the PostgreSQL outbox first. Job families include GitHub observation, immutable snapshot/archive, verifier work, deadline transitions, notifications, settlement reconciliation, receipt generation and cleanup.

Workers require concurrency-safe claims, bounded per-job concurrency, idempotent effects, retry classification, exponential backoff, max attempts, terminal/dead-letter handling and queue-lag metrics.

Do not add Kafka/Redis/SQS until measured load justifies a separate queue system.

## Read scaling

Public Discover/Challenge summaries use small projections, cursor pagination, ETag/conditional GET, short shared cache TTL and CDN/edge caching where available.

Private/economic state is `no-store`.

Redis is optional later; correctness must never depend on cache presence.

## Database scaling

Use small connection pools and document the connection budget across all API/worker instances. Enable managed connection pooling/PgBouncer when instance/client concurrency approaches database connection limits.

Monitor query latency, slow queries, pool saturation, locks/deadlocks and storage growth. Add read replicas, table partitioning or external search only after measurements prove they are needed.

Before real money: backups/PITR, documented RPO/RTO and an actual restore drill are required.

## Deployment

Use isolated local/test, staging/testnet and production environments.

Prefer one browser origin for UI + `/v1` API to keep secure-cookie auth/CSRF simple. API instances are stateless and horizontally scalable; workers scale separately by queue lag.

Use backwards-compatible expand/contract DB migrations. Do not let every API instance race to perform production migrations on boot.

Provide shallow `/health` and readiness checks that test core serving capability without making GitHub/verifier outages kill healthy API instances.

## Observability

Production requires structured redacted logs plus metrics/traces.

Measure at minimum:

- HTTP rate/error/p95/p99 latency;
- CPU/memory/instance count;
- DB connection/query/lock health;
- rate-limit and auth failures;
- GitHub webhook invalid/duplicate/backlog state;
- GitHub API retries/rate-limit state;
- outbox depth/oldest-job age;
- verifier outcomes/timeouts;
- snapshot/archive failures;
- illegal Challenge transition attempts;
- settlement expected-vs-observed mismatch;
- receipt failures.

Never log session/OAuth secrets, private source contents or settlement credentials.

## Security baseline

Target OWASP ASVS 5 Level 2 for the public web product; staff resolution and settlement are higher-risk paths requiring stronger controls.

Required controls include TLS/HSTS, restrictive CSP/security headers, secure sessions, PKCE/state OAuth, CSRF + Origin protection, resource authorization, request-size/input limits, parameterized SQL, rate/resource limits, webhook signature/replay protection, SSRF-hardened verifier, output sanitization, dependency/secret scanning and privileged-action audit history.

Production payout authority is never a normal API/worker environment secret.

## Scaling stages

### Curated pilot

One API instance, one worker, one Postgres primary and isolated verifier are sufficient if load tests pass. No Redis/search cluster. Mock/testnet settlement and manual admission/resolution.

### Public growth

When metrics justify it: multiple stateless API instances, managed DB pooling, independently scaled workers, durable object storage, stronger dashboards/alerts and load-test headroom above recent peaks.

### Meaningful scale/revenue

Only as measured: autoscaling API, worker pools by job class, read replica, optional shared cache/rate-limit store, stronger edge cache and dedicated search if Postgres no longer meets SLO.

Avoid Kubernetes, Kafka, service mesh, multi-region writes and many microservices until a real bottleneck makes them valuable.

## Final architecture lock

```text
product authority      Challenge state machine
frontend               dedicated Inkubator web, lab separate
API                    stateless Fastify modular monolith
database               PostgreSQL
async                   durable outbox + workers
identity                GitHub App + server session
payout identity         signed wallet binding
submission              immutable snapshot + digest
verification            isolated verifier
public read scale       CDN/cache/ETag + cursor pagination
private state           no-store
money                   separate settlement adapter/vault boundary
observability           structured logs + metrics/traces
scaling                 horizontal API + independent workers + measured DB capacity
```

This architecture is planning authority until explicitly superseded.