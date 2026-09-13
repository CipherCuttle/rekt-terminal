# REKT INKUBATOR — FUNDED CHALLENGE VERIFICATION + SCALE PLAN V1

**Status:** USER-AUTHORIZED PLANNING LOCK ONLY

**Date:** 2026-09-13

**Implementation authority:** NONE

**Merge authority:** NONE

This document defines the verification, security, reliability and traffic-scaling gates for the funded-Challenge build. It is subordinate to `FUNDED_CHALLENGE_MECHANISM_V1.md` and `FUNDED_CHALLENGE_ARCHITECTURE_V1.md`.

## 1. Verification philosophy

No amount of frontend E2E testing substitutes for state-machine, database-concurrency or settlement invariants.

Every implementation phase follows the bounded completion policy:

`IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE targeted rereview if needed → COMMIT/MERGE → MOVE FORWARD`

Do not create permanent review loops.

## 2. Test layers

### Pure unit tests

Cover Challenge transition rules, terms canonicalization/digest, qualification aggregation, default distribution calculations, IP-transfer trigger, authorization predicates and validation/normalization.

### Property/invariant tests

Generate state/event sequences and prove at minimum:

- illegal states remain unreachable;
- terms cannot change after freeze;
- seats never exceed capacity;
- one builder cannot take two seats in one Challenge;
- activation minimum is enforced;
- all activated builders share the same start/deadline;
- no late submission becomes final;
- non-qualifier cannot win;
- organizer cannot select twice;
- default distribution conserves the prize amount;
- winner settlement conserves the prize amount;
- receipt cannot precede terminal settlement;
- rights transfer cannot precede successful winner payout;
- duplicate requests/events do not duplicate economic effect.

### PostgreSQL integration tests

Use real ephemeral PostgreSQL, not mocked database behavior.

Test constraints, indexes, transactions, row/version locks, retry behavior, outbox atomicity, migrations and database-time deadline semantics.

### Mandatory concurrency tests

- 100 simultaneous requests for the final seat → exactly one success;
- duplicate submission-version race → one canonical result;
- submit-vs-deadline race → database time resolves deterministically;
- duplicate selection requests → one selection;
- duplicate settlement callbacks/reconciliation → one economic effect;
- multiple workers claiming jobs → no lost/double-owned work.

### API contract tests

Validate OpenAPI schemas, bounded pagination, idempotency, stable error codes, cache/privacy headers and sealed-data boundaries.

Every resource family gets cross-account Broken Object Level Authorization tests.

### Authentication/security tests

Test:

- OAuth state mismatch/replay;
- PKCE mismatch;
- callback/redirect validation;
- expired/revoked session;
- session rotation/fixation resistance;
- logout/all-session revocation;
- CSRF rejection;
- cross-origin mutation rejection;
- GitHub installation/repository revocation;
- payout-wallet nonce replay;
- authorization escalation attempts;
- staff/resolver high-risk authorization.

### Webhook tests

Test valid/invalid signatures, replayed delivery IDs, out-of-order deliveries, removal/revocation ordering, oversized bodies and recovery after worker failure.

### Verifier adversarial tests

Test private/loopback/link-local targets, cloud metadata endpoints, redirect-to-private targets, DNS rebinding, redirect loops, slow responses, oversized responses, decompression bombs, malformed TLS and unsupported content types.

A verifier timeout/outage must produce `UNAVAILABLE`, never an automatic builder qualification failure.

### Frontend E2E

Playwright covers the complete organizer/builder/reviewer flow:

- create/fund fixture/open;
- take seat;
- sealed competitor behavior;
- build-window state;
- submit and update submission;
- deadline lock;
- qualification;
- appeal;
- selection;
- ghost/default fixture;
- settlement fixture;
- receipt;
- mobile viewport and keyboard path.

Run accessibility checks on core screens.

## 3. Performance/load tests

Use k6 or equivalent with explicit pass/fail thresholds.

Required traffic profiles:

1. sustained anonymous Discover reads;
2. a hot single-Challenge read spike;
3. authenticated My Build reads;
4. seat-rush concurrency;
5. submission-deadline burst;
6. GitHub webhook burst;
7. worker backlog catch-up;
8. degraded/downstream dependency behavior.

Initial candidate SLOs to validate and tune:

- public cached/read path p95 under roughly 300 ms;
- uncached ordinary API read p95 under roughly 500 ms;
- ordinary mutation p95 under roughly 800 ms, excluding intentionally external settlement waits;
- HTTP error rate below 1% during expected-load profiles;
- webhook ingress acknowledgement p95 under roughly 250 ms after verification/dedupe/enqueue;
- zero economic invariant violations at any tested concurrency;
- worker queue lag recovers after spike within its declared objective.

These are engineering targets, not public promises.

Load runs increase in steps such as 100 → 500 → 1,000+ concurrent virtual readers/users until an SLO/resource limit fails. Capacity is recorded for the exact deployment size. Scaling decisions use that measured limit plus headroom.

## 4. Resource-limit tests

Explicitly test server maxima for:

- request body size;
- string length;
- `DONE WHEN` count;
- page size;
- submission evidence count;
- archive size;
- verifier response size;
- redirect count;
- concurrent verifier work;
- per-user/IP sensitive mutations;
- external API retries.

No user-controlled parameter may create unbounded database, memory, network or external-provider work.

## 5. Failure/chaos tests

Inject failures for:

- GitHub unavailable/rate limited;
- verifier unavailable;
- object storage timeout;
- worker crash after claiming/before completion;
- database transaction retry/deadlock;
- API instance killed after commit but before response;
- deadline worker delayed;
- settlement RPC unavailable;
- duplicate/reordered external events.

Expected behavior: retry/reconcile safely, preserve economic state and never silently convert dependency failure into builder failure or prize movement.

## 6. Observability gates

Before public growth, dashboards must expose:

- request rate, status, p50/p95/p99 latency;
- CPU/memory/instance count;
- PostgreSQL active/pool connections and query latency;
- lock/deadlock/conflict rate;
- rate-limit rejects;
- auth/CSRF failures;
- webhook invalid/duplicate/backlog state;
- GitHub API retry/rate-limit state;
- outbox depth and oldest-job age;
- verifier outcome/latency/timeout;
- snapshot/archive failures and bytes;
- Challenge transition errors;
- settlement reconciliation mismatches;
- receipt-generation failures.

Alerts target user-impacting symptoms: sustained 5xx/latency, DB saturation, queue lag, missed transitions, broad verifier outage, webhook backlog, settlement mismatch and storage/capacity danger.

## 7. Database and recovery gates

Before real money:

- automatic backups/PITR enabled according to provider capability;
- RPO/RTO documented;
- restore performed into isolated environment and verified;
- schema migration rollback/recovery procedure documented;
- storage growth alert configured;
- connection budget documented for each API/worker scale level.

When horizontal API/worker scaling makes direct connections risky, enable managed transaction pooling/PgBouncer or equivalent and re-run the full concurrency/load suite.

## 8. Security gates

Public application target: OWASP ASVS 5 Level 2 relevant controls.

Required before public launch:

- threat model for prize, identity, private source, submission integrity, qualification/resolution and settlement;
- secure-cookie/session review;
- PKCE/state OAuth review;
- CSRF review;
- object-level/function-level authorization review;
- request/resource limiting;
- CSP/security headers;
- secret scanning and dependency scanning;
- webhook replay/signature review;
- verifier SSRF review;
- privileged resolver/admin audit path;
- one independent hostile review with Critical/High repaired.

Production money adds separate contract-security and legal gates.

## 9. Smart-contract/settlement tests — later phase

Before production Challenge Vault use:

- unit tests;
- fuzz tests;
- stateful accounting invariants;
- access-control tests;
- supported-token transfer edge cases;
- payout/refund/default paths;
- pause/recovery semantics;
- Ink testnet E2E;
- independent external security review/audit;
- reconciliation tests proving backend facts match chain facts.

The base application remains testable with a mock settlement adapter so blockchain availability cannot contaminate core product tests.

## 10. Scaling stages

### Stage 0 — curated pilot

One stateless API instance, one worker, one PostgreSQL primary, isolated verifier, mock/testnet settlement and manual builder/resolver admission are acceptable if the test suite/load gates pass.

### Stage 1 — public growth

Add multiple API instances, managed DB connection pooling, independently scalable workers, durable object storage and stronger alerting when metrics show sustained need.

### Stage 2 — meaningful scale/revenue

Only after measurement: autoscaling API, worker pools by job class, read replica, shared cache/rate-limit store and stronger edge caching. Dedicated search only after indexed PostgreSQL search fails the SLO.

### Stage 3 — large marketplace

Only proven bottlenecks may become separate services. Likely future boundaries are verifier/snapshot processing, settlement and search/read models. Challenge lifecycle authority remains singular.

## 11. Release gates

### Mechanism gate

No unresolved Critical/High mechanism flaw and at least three concierge/mock/testnet Challenges demonstrate understandable criteria and rational participation.

### Software gate

State-machine/invariant, PostgreSQL integration, concurrency, API, auth, E2E and migration suites green. Load profile passes expected launch traffic plus headroom. Restore drill passes.

### Security gate

Threat model, ASVS-derived checklist, verifier SSRF controls and one independent hostile review complete; Critical/High fixed.

### Settlement/legal gate

One chain/asset, testnet reconciliation, contract review/audit, no ordinary web-server payout authority, Swedish/EU payment/crypto legal review and IP/dispute terms complete.

### Operations gate

Dashboards, alerts, rollback, dependency-outage, credential-rotation and restore runbooks exist and have an owner.

No real-money launch until every applicable gate is explicitly passed.

## 12. CI/CD placement

Every PR: typecheck/build, unit/invariant tests, targeted integration/contract tests, secret/dependency checks and product-boundary checks.

Staging/release/nightly: full PostgreSQL integration, Playwright, verifier adversarial, concurrency, k6 load, chaos/failure and restore exercises as appropriate.

Never waive a red required gate simply to deploy faster.

This verification/scale plan remains planning authority until explicitly superseded.