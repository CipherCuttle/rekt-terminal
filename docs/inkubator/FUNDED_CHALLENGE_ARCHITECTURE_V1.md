# REKT INKUBATOR — FUNDED CHALLENGE ARCHITECTURE V1

**Status:** SUPERSEDED WHERE CONFLICTING BY `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` / PLANNING ONLY

**Date:** 2026-09-13

**Implementation authority:** NONE

**Merge authority:** NONE

This document remains useful background architecture. `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` is higher planning authority after hostile review and wins wherever the two conflict.

## Architecture principles

- Keep a modular monolith for the Challenge domain; do not split into microservices without measured need.
- HTTP API instances must be stateless and horizontally scalable.
- PostgreSQL is product-workflow current-state authority; once real-money settlement exists, finalized chain/Vault state is monetary execution authority and must be reconciled before terminal settlement is asserted.
- Every irreversible mutation is transactional, idempotent and auditable.
- Async side effects use the existing durable outbox pattern.
- Public reads are pure/cacheable projections; private/economic state is never served from stale public cache.
- GitHub, verifier, object storage and future chain RPC are dependencies/evidence sources, not hidden product authority.
- Large source/artifact archives do not live in PostgreSQL and private source retention is bounded by policy.
- Economic correctness must survive retries, duplicate requests, delayed workers, multiple API instances and mixed-version rolling deployments.

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
- public GETs never advance Challenge state or acquire economic locks;
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
legacy/          parked old code, NOT registered in production V1 route assembly
```

All Challenge transitions go through one domain/state-machine service. Route handlers do not independently reproduce lifecycle rules.

A mutation performs: authenticate → authorize resource → validate → concurrency guard → due-state advance if needed → state change + history event + outbox jobs in one DB transaction → stable response.

Public reads derive display phase from state/timestamps and do not mutate lifecycle state.

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

- immutable mechanism/policy versions per Challenge;
- unique builder seat per Challenge;
- unique payout address per Challenge entry set;
- unique submission version per entry;
- one normal selection per Challenge;
- one canonical terminal receipt, corrected only by append-only superseding records;
- frozen terms and normative artifacts are immutable/content-addressed;
- state-changing requests have actor/operation-scoped idempotency identity;
- use keyset/cursor pagination for growth paths;
- index Challenge state/deadlines, player/organizer history, pending jobs, submissions and settlement reconciliation.

## Concurrency

Seat acquisition must lock/version Challenge state transactionally with a bounded lock timeout. A burst for the final seat must yield exactly one success.

Database time is authoritative for deadlines. Worker jobs advance due state, but correctness does not depend on a cron firing at the exact second. Mutations may perform an idempotent due-state transition before acting. Public reads never do so.

Selection, settlement and receipt filing must be idempotent single semantic effects even under retries or multiple workers.

## Authentication

GitHub remains the primary V1 account identity.

Use the existing GitHub App model with minimal permissions and stable numeric provider IDs. OAuth must use authorization-code flow with PKCE and unpredictable state; repository access uses GitHub App installation authorization rather than broad personal tokens.

Retain opaque server-side sessions in secure HttpOnly `__Host-` cookies. Harden with session rotation after authentication, explicit logout/revocation, idle/absolute expiry, CSRF tokens in addition to Origin checks, and step-up authentication for high-risk actions.

GitHub identity and payout wallet are separate. Wallet binding uses a standard domain-bound EVM signed challenge with nonce/expiry. The entry payout address becomes immutable before BUILDING or changes only through a dedicated recovery process.

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

Submission deadline acceptance and async archive capture are separate. An accepted immutable manifest may remain valid while archive capture is pending because of platform/GitHub outage; builder-caused source revocation is distinguished by durable event timing.

Production money launch requires bounded-retention private archive/evidence storage so evaluation can survive repository/live-URL changes through the dispute window. Use a provider-neutral private object store with bounded sizes, content-addressed digests, short-lived authorized retrieval, encryption/access audit and lifecycle deletion.

## Verifier boundary

`inkubator-verifier` processes hostile user URLs/artifacts outside the main API trust boundary. It must have no settlement/admin secrets and no production DB credentials.

It needs strict network-target restrictions, redirect/time/size limits, bounded concurrency and structured `PASS / FAILED / UNAVAILABLE` evidence. Verifier unavailability is never automatic builder failure.

Where feasible, network-level egress controls/isolation complement application SSRF filtering.

Executing arbitrary builder code would require a stronger disposable sandbox and is not part of this V1 verifier assumption.

## Async work

Reuse the PostgreSQL outbox first. Job families include GitHub observation, immutable snapshot/archive, verifier work, deadline transitions, notifications, settlement reconciliation, receipt generation and cleanup.

Workers require concurrency-safe claims, bounded per-job concurrency, idempotent effects, retry classification, exponential backoff, max attempts, terminal/dead-letter handling and queue-lag metrics.

Long jobs require per-job leases or lease heartbeat/renewal; a fixed short lease may not cause duplicate processing of a healthy long-running archive job.

Do not add Kafka/Redis/SQS until measured load justifies a separate queue system.

## Read scaling

Public Discover/Challenge summaries use dedicated public projections, cursor pagination, ETag/conditional GET, short shared cache TTL and CDN/edge caching where available.

Private/economic state is `no-store`. Public cache routes never vary by authenticated private fields and do not emit private data.

Redis is optional later; correctness must never depend on cache presence.

## Database scaling

Use small connection pools and document the connection budget across all API/worker instances. Enable managed transaction pooling/PgBouncer when instance/client concurrency approaches database connection limits.

Production transaction-pool mode must not rely on session-level database features. Re-run concurrency/load tests through the exact pool mode used in deployment.

Monitor query latency, slow queries, pool saturation, locks/deadlocks and storage growth. Add read replicas, table partitioning or external search only after measurements prove they are needed.

Before real money: backups/PITR, documented RPO/RTO and an actual restore drill are required.

## Deployment

Use isolated local/test, staging/testnet and production environments.

Prefer one browser origin for UI + `/v1` API to keep secure-cookie auth/CSRF simple. API instances are stateless and horizontally scalable; workers scale separately by queue lag.

Use backwards-compatible expand/contract DB migrations. Do not let every API instance race to perform production migrations on boot. Rolling versions must remain compatible with active Challenge mechanism versions.

Provide shallow `/health` and readiness checks that test core serving capability without making GitHub/verifier outages kill healthy API instances.

## Observability

Production requires structured redacted logs plus metrics/traces.

Measure at minimum:

- edge and origin HTTP rate/error/p95/p99 latency separately;
- CPU/memory/instance count;
- DB connection/query/lock health;
- rate-limit and auth failures;
- GitHub webhook invalid/duplicate/backlog state;
- GitHub API retries/rate-limit state;
- outbox depth/oldest-job age;
- verifier outcomes/timeouts;
- snapshot/archive failures and bytes;
- illegal Challenge transition attempts;
- settlement expected-vs-finalized-chain mismatch;
- receipt failures.

Never log session/OAuth secrets, private source contents, wallet signatures/nonces beyond necessary audit metadata, or settlement credentials.

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
product authority      versioned Challenge state machine
frontend               dedicated Inkubator web, lab separate
API                    stateless Fastify modular monolith
database               PostgreSQL product/workflow truth
async                   durable outbox + workers
identity                GitHub App + server session
payout identity         signed wallet binding
submission              immutable manifest + bounded-retention snapshot
verification            isolated verifier
public read scale       pure CDN/cache/ETag projections
private state           no-store
money                   finalized chain/Vault is execution truth; DB reconciles
observability           structured logs + metrics/traces
scaling                 horizontal API + independent workers + measured DB capacity
```

`FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` is higher authority for all red-team corrections.