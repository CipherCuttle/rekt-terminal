# REKT INKUBATOR — STAGE C INTEGRATION TEST MATRIX V1

**Status:** ACTIVE ACCEPTANCE CONTRACT  
**Date:** 2026-09-13  
**Companion:** `STAGE_C_POSTGRES_DOMAIN_BRIDGE_V1.md`

Purpose: make the Stage-C Postgres bridge falsifiable before implementation spreads into HTTP/UI/Compiler work.

Every Critical invariant below must be proven against PostgreSQL, not only mocked/unit-tested.

## 1. Migration / coexistence

| ID | Scenario | Required result |
|---|---|---|
| C-DB-01 | migrate existing Inkubator schema to Stage C | all Challenge tables/indexes/constraints created without destructive historical-table rewrite |
| C-DB-02 | migrate down in isolated test DB | Stage-C objects removed in dependency-safe order; historical schema remains usable |
| C-DB-03 | existing Player/Project/Mission/Ship rows exist before migration | rows remain unchanged and valid |
| C-DB-04 | store two Challenges with different stored protocol version strings | rows coexist; reads preserve exact stored versions rather than substituting current defaults |

## 2. Contract freeze / lineage

| ID | Scenario | Required result |
|---|---|---|
| C-CONTRACT-01 | persist valid frozen Build Contract | snapshot + `terms_digest` + version fields round-trip exactly |
| C-CONTRACT-02 | replay same request and same contract | idempotent; one contract version and one matching history receipt |
| C-CONTRACT-03 | same request ID with changed payload | fail closed with idempotency conflict |
| C-CONTRACT-04 | same `(challenge, contract_version)` with changed snapshot/digest | reject; original remains unchanged |
| C-CONTRACT-05 | same Challenge digest under a second contract version | reject duplicate frozen authority |

## 3. Seat acquisition concurrency

| ID | Scenario | Required result |
|---|---|---|
| C-SEAT-01 | two concurrent builders compete for final available seat | exactly one succeeds; active seat count never exceeds `slot_limit` |
| C-SEAT-02 | same builder attempts second seat with new request ID | reject duplicate builder; no extra seat/history success |
| C-SEAT-03 | different builder reuses payout identity in same Challenge | reject duplicate payout identity |
| C-SEAT-04 | same payout identity used in different Challenge | allowed by Stage-C DB uniqueness unless later settlement policy narrows it |
| C-SEAT-05 | organizer attempts own Challenge seat | reject |
| C-SEAT-06 | exact seat request replay | return same entry; no duplicate row |
| C-SEAT-07 | same seat request ID with different builder/payout/project | idempotency conflict |

## 4. Submission immutability

| ID | Scenario | Required result |
|---|---|---|
| C-SUB-01 | accept immutable manifest for seated/active entry under matching digest | stored exactly with manifest digest |
| C-SUB-02 | replay exact submission command | same durable submission returned |
| C-SUB-03 | same request ID changed manifest | idempotency conflict |
| C-SUB-04 | same `(entry, submission_version)` changed manifest/digest | reject; original unchanged |
| C-SUB-05 | manifest `terms_digest` differs from Challenge frozen terms | reject |
| C-SUB-06 | mark final twice for two submissions of same entry | database/application boundary allows only one final row |
| C-SUB-07 | attach optional Ship submission from another owner/project lineage | reject rather than silently cross-link |

## 5. Qualification / decision authority

| ID | Scenario | Required result |
|---|---|---|
| C-QUAL-01 | persist qualification bound to final submission terms | round-trips unchanged |
| C-QUAL-02 | invalid result outside Stage-B vocabulary | reject |
| C-QUAL-03 | qualification references wrong Challenge/entry/terms digest | reject |
| C-DEC-01 | persist authoritative final-qualifier/selection/default/settlement decision | immutable canonical payload + digest stored |
| C-DEC-02 | exact decision replay | idempotent |
| C-DEC-03 | same authoritative decision type/version with changed payload | reject replacement |

## 6. Receipt lineage

| ID | Scenario | Required result |
|---|---|---|
| C-REC-01 | persist protocol receipt under matching Challenge terms | append-only row stored |
| C-REC-02 | exact receipt replay | idempotent/no duplicate authority |
| C-REC-03 | correction references existing receipt | new successor row; predecessor unchanged |
| C-REC-04 | correction references receipt from another Challenge | reject |
| C-REC-05 | attempt overwrite of original receipt | no supported command path; DB facts remain unchanged |

## 7. Outbox / due-state

| ID | Scenario | Required result |
|---|---|---|
| C-JOB-01 | mutation requiring async progression writes domain fact + outbox job | both commit or both roll back |
| C-JOB-02 | same logical outbox command replay | one job by stable idempotency key; conflicting payload rejects |
| C-JOB-03 | stale due-state job runs after Challenge already advanced | no obsolete transition; state remains current |
| C-JOB-04 | failed/retried job | existing lease/retry semantics preserve one durable outcome |

## 8. Read purity

| ID | Scenario | Required result |
|---|---|---|
| C-READ-01 | read Challenge at/after a deadline | no state transition, no history row, no outbox row |
| C-READ-02 | repeated public/store reads | byte-equivalent durable state; no mutation side effects |

## 9. Adversarial property loop

For randomized small fixtures across `slot_limit=1..8` and command replay/order variants:

- successful entry rows never exceed slot limit;
- successful builders are unique per Challenge;
- payout identities are unique per Challenge;
- frozen contract snapshot/digest never changes;
- an entry has at most one final submission;
- authoritative decision payload for a decision key never changes;
- receipts form append-only predecessor/successor lineage;
- failed commands leave no partial history/outbox/domain writes;
- reads never change row counts or lifecycle state.

## 10. Kill criteria

Stage C fails and must not close if any test demonstrates:

- application-only race protection that permits over-capacity under concurrent transactions;
- mutable frozen contract/submission/decision/receipt authority;
- request-id replay that can change meaning;
- Project/Mission/Ship mutable state silently becoming Challenge lifecycle truth;
- read paths advancing lifecycle;
- protocol versions being inferred from current defaults rather than persisted facts;
- a second queue/database/idempotency truth introduced without evidence.
