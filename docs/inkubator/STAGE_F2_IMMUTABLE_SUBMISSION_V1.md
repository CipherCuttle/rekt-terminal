# REKT INKUBATOR — STAGE F2 IMMUTABLE SUBMISSION V1

**Status:** PLANNING LOCK / IMPLEMENTATION BLOCKED UNTIL F1 FORMALLY CLOSES  
**Date:** 2026-09-14  
**Base:** `9aea1c674590f94920a4063b501d9333cef23dda` (`agent/stage-f-builder-capsule-v1`)  
**Parent authorities:** `STAGE_F_BUILDER_CAPSULE_V1.md`, `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md`, `STAGE_C_POSTGRES_DOMAIN_BRIDGE_V1.md`, `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`

## 0. Gate

F2 is the next Stage-F implementation slice after F1 Builder Capsule closure.

This document locks the exact F2 shape so implementation can begin immediately once the existing F1 independent-review gate is satisfied or explicitly replaced by user authority.

It does **not** waive the F1 review gate, merge PR #97 or #98, authorize Stage G, or authorize production money.

## 1. Objective

Add one builder-native immutable submission path over the already-implemented Stage-B/Stage-C law:

`LOCAL FROZEN CAPSULE → BUILDER AUTH → IMMUTABLE SUBMISSION MANIFEST → DB-TIME ACCEPTANCE → DURABLE SUBMISSION RECEIPT`

Target CLI command:

`rekt challenge submit`

F2 is transport/tooling work. It must not create a second submission state machine or a second source of Challenge truth.

## 2. Reuse / authority rule

F2 MUST reuse the existing:

- Stage-B `SubmissionManifest` schema and `assertSubmissionManifest()`;
- Stage-B `isSubmissionEligible()` semantics;
- Stage-C `acceptChallengeSubmission()` persistence command;
- PostgreSQL clock as `accepted_at` authority;
- request-id idempotency through `history_events`;
- immutable `(entry_id, submission_version)` conflict behavior;
- frozen Challenge `terms_digest` lineage;
- optional existing Ship lineage only when explicitly supplied and compatible;
- existing DevKit bearer credential/rate-limit system;
- existing SDK + CLI packages.

No new submission table, submission authority, Challenge lifecycle engine, token system, archive engine or qualification engine may be added in F2.

## 3. DevKit authorization

F2 adds one narrow DevKit scope:

`challenge:submit`

Do not reuse `project:read`, `update:write`, or historical `ship:prepare` for Challenge submission authority.

The submission route MUST prove all of the following before invoking Stage-C persistence:

1. the DevKit credential is valid and has `challenge:submit`;
2. the Challenge exists;
3. the requested Entry belongs to that Challenge;
4. the credential Player is the Entry's `builder_player_id`;
5. the Challenge has a canonical frozen Build Contract;
6. the caller's expected `terms_digest` exactly matches the canonical Challenge digest.

A non-owner must receive a fail-closed authorization response and must not learn competitor submission data.

## 4. HTTP transport

Add one authenticated route inside the existing Inkubator API:

`POST /v1/devkit/challenges/:challengeId/submissions`

Request body:

```json
{
  "request_id": "uuid",
  "submission_id": "uuid",
  "entry_id": "uuid",
  "expected_terms_digest": "sha256hex",
  "submission_version": 1,
  "immutable_source_reference": {
    "kind": "GIT_COMMIT",
    "value": "immutable-ref"
  },
  "artifact_digest": "sha256hex",
  "evidence_references": [],
  "optional_live_url": "https://example.invalid",
  "ship_submission_id": "optional-uuid"
}
```

`optional_live_url` and `ship_submission_id` are optional.

The client MUST NOT provide authoritative `accepted_at`.

The server assembles the canonical Stage-B `SubmissionManifest` from:

- canonical Challenge id from the route;
- authorized Entry id;
- canonical frozen `terms_digest` after equality-checking `expected_terms_digest`;
- client proposal fields allowed by `SubmissionManifest`;
- an internal non-authoritative placeholder only if required by the existing Stage-C command boundary.

`acceptChallengeSubmission()` remains responsible for replacing `accepted_at` with PostgreSQL time before protocol eligibility and durable persistence.

The response returns a builder-safe accepted-submission projection containing at minimum:

- schema version;
- submission id;
- Challenge id;
- Entry id;
- submission version;
- terms digest;
- manifest digest;
- accepted-at timestamp;
- optional Ship submission id.

It must not expose other builders' submissions or payout identities.

## 5. CLI semantics

Extend the existing `rekt challenge` namespace; do not create another CLI.

Target:

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

V1 ergonomics:

- `--source-kind` defaults to `GIT_COMMIT`;
- for `GIT_COMMIT`, if `--source` is omitted, CLI may read the current repository `HEAD`; it must not silently submit an uncommitted working tree as the immutable source reference;
- `--artifact-digest` is explicit in F2; F2 does not invent universal artifact-build semantics;
- `--version` is explicit in F2; the client must not guess server history and accidentally overwrite/relabel an immutable version;
- evidence references default to `[]`;
- the local capsule must pass the existing `rekt challenge check` local-consistency gate before any network submission;
- the CLI reads `challenge_id`, `entry_id`, and expected `terms_digest` from the local capsule rather than asking the user to duplicate them;
- the CLI generates `request_id` and `submission_id` once per invocation and uses the SDK transport;
- retry semantics preserve the same request/submission identifiers only when the same logical submission is retried by the same invocation/library caller.

F2 does not claim that `artifact_digest` proves build correctness. Qualification remains later authority.

## 6. SDK

Extend `packages/sdk` under the existing `challenge` client:

`challenge.submit(input)`

The SDK may generate idempotency/submission UUIDs when omitted, but it must send explicit immutable-source/artifact/version intent and must not fabricate `accepted_at`, qualification, evidence success, or final-submission status.

The canonical HTTP/OpenAPI contract must publish the new route so generated-client freshness remains meaningful.

## 7. Error / status semantics

At minimum map truthfully:

- `400` malformed UUID/digest/version/source/live URL/body;
- `401` missing/invalid DevKit credential;
- `403` missing `challenge:submit` scope or Entry ownership mismatch;
- `404` Challenge/Entry missing where disclosure is safe;
- `409` stale terms digest, Challenge not BUILDING, deadline elapsed, protocol ineligible, immutable version conflict, idempotency conflict, incompatible Ship lineage;
- `429` existing Player-wide DevKit rate limit.

Do not map a late submission to success, and do not trust client wall-clock time.

## 8. Acceptance matrix

F2 closes only when all are true:

1. builder with `challenge:submit` can submit for their own Entry during `BUILDING`;
2. missing/invalid credential fails before mutation;
3. token without `challenge:submit` fails before mutation;
4. different Player cannot submit for another builder's Entry;
5. stale capsule / stale `expected_terms_digest` fails with zero submission rows;
6. client cannot choose `accepted_at`; persisted time comes from PostgreSQL;
7. submission after DB-time deadline fails even if client clock says otherwise;
8. exact request replay returns the same accepted submission under existing Stage-C idempotency law;
9. same `(entry_id, submission_version)` with changed meaning fails immutably;
10. malformed or protocol-ineligible manifest fails closed;
11. optional Ship lineage succeeds only when builder/project lineage is compatible;
12. CLI refuses submission if the local Builder Capsule fails local consistency;
13. CLI does not submit a dirty working tree as an implicit immutable Git source reference;
14. OpenAPI/generated client, SDK and CLI agree on the transport schema;
15. real-Postgres integration proves ownership, stale-digest, deadline, idempotency and immutable-version boundaries;
16. legacy Mission/Project/Ship commands retain their existing behavior;
17. exact-head canonical CI + Inkubator Auth/Foundation + CLI/SDK tests pass;
18. bounded review policy is satisfied for the F2 closure slice when F2 becomes authorized.

## 9. Explicit non-goals

F2 does not add:

- submission archive capture or evidence observation workers (F3);
- final-submission selection transport;
- simultaneous reveal;
- Test Arena;
- qualification or selection;
- receipt transport;
- Challenge funding or settlement;
- production money;
- wallet custody/signing/broadcast;
- model/provider inference;
- a second CLI/SDK/token/submission system.

## 10. Implementation order once authorized

```text
1. add challenge:submit DevKit scope + tests
2. add OpenAPI/contract route
3. add builder-owned HTTP mutation over acceptChallengeSubmission()
4. add SDK challenge.submit()
5. add CLI rekt challenge submit
6. add unit + real-Postgres + CLI regressions
7. exact-head VERIFY
8. bounded hostile review
9. close F2
10. move to F3 archive/evidence capture
```

## 11. Current verdict

```text
F1 BUILDER CAPSULE             IMPLEMENTED / GREEN / INDEPENDENT REVIEW STILL REQUIRED
F2 CONTRACT                    LOCKED / READY FOR IMPLEMENTATION AFTER F1 CLOSURE
F2 IMPLEMENTATION              NOT STARTED
F3 ARCHIVE / EVIDENCE          NOT STARTED
STAGE G                        NOT AUTHORIZED
PRODUCTION MONEY               NOT AUTHORIZED
MERGE AUTHORITY                NONE
```
