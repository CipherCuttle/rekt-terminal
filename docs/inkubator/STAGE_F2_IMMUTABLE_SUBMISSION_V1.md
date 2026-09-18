# REKT INKUBATOR — STAGE F2 IMMUTABLE SUBMISSION V1

**Status:** USER-AUTHORIZED IMPLEMENTATION CONTRACT  
**Date:** 2026-09-14  
**Base:** `14a8a8cde4e125e164235fa16b6ae43ed7ffddeb` (`agent/stage-f-builder-capsule-v1`)  
**Parent authorities:** `STAGE_F_BUILDER_CAPSULE_V1.md`, `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md`, `STAGE_C_POSTGRES_DOMAIN_BRIDGE_V1.md`, `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`

## 0. Gate

F1 Builder Capsule is `CLOSED / PASS BY EXPLICIT GOVERNANCE WAIVER`. The user explicitly authorized F2 implementation on 2026-09-14.

This authorization does **not** grant merge authority, Stage G authority, production-money authority, funding/settlement authority, or permission to merge Stage F ahead of the Stage-E dependency.

## 1. Objective

Add one builder-native immutable submission path over the already-implemented Stage-B/Stage-C law:

`LOCAL FROZEN CAPSULE → BUILDER AUTH → IMMUTABLE SUBMISSION MANIFEST → DB-TIME ACCEPTANCE → DURABLE SUBMISSION RECEIPT`

Target CLI command: `rekt challenge submit`.

F2 is transport/tooling work. It must not create a second submission state machine or a second source of Challenge truth.

## 2. Reuse / authority rule

F2 MUST reuse Stage-B `SubmissionManifest` / `isSubmissionEligible()`, Stage-C `acceptChallengeSubmission()`, PostgreSQL `accepted_at` authority, request-id idempotency, immutable `(entry_id, submission_version)` conflicts, frozen `terms_digest`, optional compatible Ship lineage, and the existing DevKit/SDK/CLI substrate.

No new submission table, Challenge lifecycle engine, token system, archive engine or qualification engine may be added.

## 3. DevKit authorization

F2 adds one narrow DevKit scope: `challenge:submit`.

The route must prove credential scope, Challenge existence, Entry↔Challenge lineage, credential-Player ownership of the Entry, frozen canonical contract presence, and exact `expected_terms_digest` equality before invoking Stage-C persistence.

## 4. HTTP transport

Add `POST /v1/devkit/challenges/:challengeId/submissions`.

The client supplies request/submission IDs, Entry ID, expected terms digest, submission version, immutable source reference, artifact digest, evidence references, optional live URL and optional Ship submission ID. It does **not** supply authoritative `accepted_at`.

The server assembles the Stage-B manifest with an internal fixed placeholder only at the Stage-C command boundary. `acceptChallengeSubmission()` replaces it with PostgreSQL time before eligibility and persistence.

The response is a builder-safe accepted-submission projection only.

## 5. CLI semantics

Extend the existing namespace:

```text
rekt challenge submit \
  --version <positive-int> \
  --artifact-digest <sha256> \
  [--source-kind GIT_COMMIT|CONTENT_ADDRESS|ARCHIVE_DIGEST] \
  [--source <immutable-ref>] \
  [--evidence <comma-separated-refs>] \
  [--live-url <absolute-url>] \
  [--ship-submission-id <uuid>] \
  [--api <url>] \
  [--out <capsule-dir>]
```

`GIT_COMMIT` is the default source kind. If source is omitted, CLI may use repository `HEAD` only when the working tree is clean. Local capsule consistency must pass before any network mutation. Challenge/Entry/digest lineage comes from the capsule.

## 6. SDK / OpenAPI

The canonical OpenAPI contract publishes the private DevKit route. The server SDK adds a typed authenticated `challenge.submit()` raw transport, matching the existing F1 private-route pattern. The generated broad/public client operation set is not widened merely to expose this builder-private route; generated-client freshness must still remain green for its declared operation set.

## 7. Error semantics

Truthfully map malformed requests to 400, missing/invalid credential to 401, missing scope/ownership mismatch to 403, safe missing Challenge/Entry to 404, stale digest/lifecycle/deadline/protocol/idempotency/immutable-version/Ship-lineage conflicts to 409, and existing rate limits to 429.

## 8. Acceptance matrix

F2 closes only when:

1. builder with `challenge:submit` can submit for their own Entry during `BUILDING`;
2. missing/invalid credential and missing scope fail before mutation;
3. another Player cannot submit for the Entry;
4. stale expected terms digest yields zero submission rows;
5. DB time, not client time, becomes `accepted_at`;
6. late DB-time submission fails;
7. exact request replay is idempotent;
8. changed meaning for the same `(entry_id, submission_version)` fails immutably;
9. malformed/protocol-ineligible input fails closed;
10. optional Ship lineage is accepted only when compatible;
11. CLI refuses inconsistent capsule state and dirty implicit Git source;
12. OpenAPI, SDK typing and CLI payload agree; generated-client freshness remains green for the declared generated surface;
13. real-Postgres integration proves ownership, stale digest, deadline, idempotency and immutable-version boundaries;
14. legacy Mission/Project/Ship behavior remains unchanged;
15. exact-head canonical CI + Inkubator Auth/Foundation + CLI/SDK tests pass;
16. one bounded hostile F2 closure review completes, with Critical/High repairs only and one targeted re-review only if needed.

## 9. Non-goals

No F3 archive/evidence worker, final-submission transport, reveal, Test Arena, qualification, selection, receipt transport, funding/settlement, production money, wallet custody/signing/broadcast, provider inference, or parallel CLI/SDK/token/submission system.

## 10. Current verdict

```text
F1 BUILDER CAPSULE             CLOSED / PASS BY EXPLICIT GOVERNANCE WAIVER
F2 CONTRACT                    LOCKED / IMPLEMENTATION AUTHORIZED
F2 IMPLEMENTATION              ACTIVE
F3 ARCHIVE / EVIDENCE          NOT STARTED
STAGE G                        NOT AUTHORIZED
PRODUCTION MONEY               NOT AUTHORIZED
MERGE AUTHORITY                NONE
```
