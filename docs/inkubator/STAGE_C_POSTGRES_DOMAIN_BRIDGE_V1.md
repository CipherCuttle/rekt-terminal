# REKT INKUBATOR — STAGE C POSTGRES DOMAIN BRIDGE V1

**Status:** ACTIVE IMPLEMENTATION CONTRACT  
**Date:** 2026-09-13  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`  
**Protocol authority:** `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md` + `packages/inkubator-protocol`

Stage C persists the pure Stage-B Challenge protocol in the existing Inkubator PostgreSQL authority without changing protocol meaning.

This is an additive bridge. It does not redesign the Challenge mechanism, expose production HTTP routes, or authorize real money.

## 1. Objective

Create one durable relational home for Challenge lifecycle facts that can survive process restarts, concurrency, retries, mixed protocol versions, and later API/worker projection work.

Stage C succeeds when PostgreSQL can represent and enforce the important Stage-B identity/immutability/concurrency boundaries while reusing existing Inkubator identity, Project, Ship/evidence, history, and outbox foundations.

## 2. Code home

```text
apps/inkubator-api/src/
  database.ts
  migrations/021-stage-c-challenge-domain-bridge.ts
  migrations.ts
  challenge-store.ts

apps/inkubator-api/test/integration/
  stage-c-challenge-domain-bridge.test.mjs
```

No second database, ORM, queue, service, or Challenge protocol package.

## 3. Canonical ownership

`packages/inkubator-protocol` remains semantic authority for:

- supported protocol/version registries;
- Build Contract validation and canonical digest;
- Challenge lifecycle legality;
- entry/submission/qualification/selection/settlement/receipt semantics.

PostgreSQL owns durable facts and concurrency, not a competing reimplementation of those semantics.

The DB bridge MUST preserve protocol version fields instead of assuming all historical Challenges use the newest implementation.

## 4. Additive Stage-C tables

### `challenges`

Durable lifecycle container.

Minimum columns:

```text
challenge_id uuid primary key
organizer_player_id uuid -> players
status text
mechanism_version text
settlement_policy_version text
ip_terms_version text
current_contract_version text nullable
current_terms_digest char(64) nullable
slot_limit integer
activation_minimum integer
entry_deadline timestamptz
build_start timestamptz
submission_deadline timestamptz
appeal_window_ms bigint
review_deadline timestamptz
created_at timestamptz
updated_at timestamptz
```

`status` must accept the Stage-B state vocabulary. Version fields are stored per Challenge and never inferred from current code at read time.

### `challenge_contract_versions`

Immutable frozen Build Contract snapshots.

```text
challenge_id uuid -> challenges
contract_version text
schema_version text
terms_digest char(64)
contract_json jsonb
frozen_at timestamptz
primary key (challenge_id, contract_version)
unique (challenge_id, terms_digest)
```

Once inserted, a contract row is append-only. A different payload for an existing `(challenge_id, contract_version)` or digest is an idempotency conflict, not an update.

`challenges.current_contract_version/current_terms_digest` may point to the frozen version used by the lifecycle, but must never silently rewrite the snapshot.

### `challenge_entries`

Builder seat and existing substrate links.

```text
entry_id uuid primary key
challenge_id uuid -> challenges
builder_player_id uuid -> players
project_id uuid nullable -> projects
mission_id uuid nullable -> missions
payout_identity text
state text
build_start timestamptz nullable
submission_deadline timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Hard invariants:

- unique `(challenge_id, builder_player_id)`;
- unique `(challenge_id, payout_identity)`;
- entry state uses Stage-B entry vocabulary;
- Project/Mission are references only and cannot become Challenge lifecycle authority;
- organizer identity may not acquire a builder seat in its own Challenge in V1.

Seat acquisition must lock the Challenge row and check remaining capacity in the same transaction as insertion. Application-only `count then insert` without a lock is forbidden.

A failed or replayed seat command must not consume another seat.

### `challenge_submissions`

Immutable accepted SubmissionManifest lineage.

```text
submission_id uuid primary key
challenge_id uuid -> challenges
entry_id uuid -> challenge_entries
submission_version text
terms_digest char(64)
manifest_json jsonb
manifest_digest char(64)
ship_submission_id uuid nullable -> ship_submissions
accepted_at timestamptz
is_final boolean default false
created_at timestamptz
```

Hard invariants:

- unique `(entry_id, submission_version)`;
- immutable `manifest_json`/digest after acceptance;
- submitted `terms_digest` must equal the Challenge's frozen terms digest used for the build;
- at most one `is_final=true` submission per entry;
- a Ship link is evidence/artifact lineage only, not authority to mutate the manifest.

### `challenge_qualifications`

Append-only qualification facts, versioned by evaluation attempt/revision rather than overwritten.

```text
qualification_id uuid primary key
challenge_id uuid -> challenges
entry_id uuid -> challenge_entries
terms_digest char(64)
qualification_version text
result text
qualification_json jsonb
created_at timestamptz
```

`result` is limited to the Stage-B qualification result vocabulary. Qualification must bind to the same Challenge terms digest as the final submission under review.

### `challenge_decisions`

Append-only Challenge authority decisions/events that need relational lookup without making history projections authoritative.

```text
decision_id uuid primary key
challenge_id uuid -> challenges
entry_id uuid nullable -> challenge_entries
decision_type text
decision_version text
decision_json jsonb
decision_digest char(64)
created_at timestamptz
```

Examples include persisted final qualifier set, selected entry, default resolution, and authorized settlement intent. The Stage-B protocol determines valid shape/meaning before persistence.

Same logical decision type/version for one Challenge must be idempotent and immutable once authoritative.

### `challenge_receipts`

Append-only linkage to protocol receipt facts and existing proof/history substrate.

```text
receipt_id uuid primary key
challenge_id uuid -> challenges
terms_digest char(64)
receipt_version text
receipt_json jsonb
receipt_digest char(64)
ship_receipt_id uuid nullable -> ship_receipts
supersedes_receipt_id uuid nullable -> challenge_receipts
created_at timestamptz
```

Corrections append successors. Original receipts are never updated or deleted by product commands.

## 5. Command idempotency

Stage C reuses the existing `history_events.dedupe_key` command-receipt pattern rather than adding a second idempotency table.

For every mutating Challenge store command:

1. normalize/validate the request ID;
2. run in one DB transaction;
3. acquire the row lock(s) required for its concurrency invariant;
4. check the deterministic command dedupe key in `history_events`;
5. if the existing receipt matches actor/subject/type/payload digest, return the already-created durable result;
6. if the same key has different semantics/payload, fail closed with an idempotency conflict;
7. otherwise write domain rows + history event + required outbox job in the same transaction.

No in-memory idempotency authority.

## 6. Time authority

Database-backed commands use PostgreSQL `clock_timestamp()` through the existing database clock helper when a durable authoritative timestamp is required.

Stage-B pure functions continue to receive time explicitly. Stage C must not introduce hidden JavaScript wall-clock authority for lifecycle decisions.

## 7. Worker / due-state rule

Stage C may enqueue Challenge due-state work through the existing durable `outbox_jobs` table.

Rules:

- stable versioned job type;
- stable idempotency key;
- payload digest checked on replay;
- worker uses existing lease/retry/`SKIP LOCKED` behavior;
- stale/out-of-order jobs must re-read current Challenge state and fail closed/no-op rather than applying an obsolete transition;
- due-state progression cannot be performed as a side effect of a public read.

This stage does not require a new queue system.

## 8. Mixed-version support

Existing rows retain their stored:

- Build Contract schema version;
- mechanism version;
- settlement policy version;
- IP terms version;
- contract/receipt/decision version identifiers.

A future code release may reject creation of a new unsupported version while still reading historical rows. Migration must not rewrite old Challenge facts merely to match a new default.

## 9. Read purity

Challenge reads are projections over durable facts only.

A `GET`/read helper must not:

- advance lifecycle;
- claim seats;
- freeze contracts;
- mark final submissions;
- create qualification facts;
- choose/default a winner;
- enqueue settlement;
- file/correct receipts.

Those require explicit commands or worker commands.

## 10. Stage-C non-scope

Do not add in Stage C:

- new Fastify/public HTTP routes;
- frontend/UI;
- Compiler/model calls;
- Archify/anydoc/Spec Kit integration;
- new GitHub App behavior;
- chain RPC, vault, smart contracts, custody, or production settlement execution;
- production-money authority;
- Stage-D Compiler work;
- destructive cleanup/renaming of Mission/Round/Ship tables;
- Redis/BullMQ/Kafka or another database;
- a second Challenge semantic engine.

## 11. Fail-closed constraints

Implementation must reject or serialize:

- concurrent seat acquisition above `slot_limit`;
- duplicate builder seat;
- duplicate payout identity within one Challenge;
- organizer occupying a builder seat in own Challenge;
- changed payload under an existing request ID;
- changed frozen contract payload/version/digest;
- submission against wrong terms digest;
- mutation of an accepted submission manifest;
- more than one final submission per entry;
- qualification against the wrong Challenge/entry/terms lineage;
- replacement of an already-authoritative decision with a different payload;
- receipt replacement instead of correction lineage.

## 12. Closure gate

Stage C is closure-ready only when:

- migration is additive and reversible for test/dev teardown;
- DB typings compile;
- integration tests prove concurrency, uniqueness, idempotency, immutability, lineage, mixed-version storage, and read purity;
- existing Inkubator tests remain green;
- repository CI is green;
- one independent hostile review is consumed;
- Critical/High and frozen-invariant findings are repaired;
- at most one targeted re-review is used if such repairs were needed.

Then stop for merge/closure authority. Do not start Stage D automatically.
