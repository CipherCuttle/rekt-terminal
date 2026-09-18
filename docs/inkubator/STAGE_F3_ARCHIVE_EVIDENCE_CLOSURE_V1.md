# REKT INKUBATOR — STAGE F3 ARCHIVE / EVIDENCE CLOSURE V1

**Status:** STAGE F3 CLOSED / PASS  
**Date:** 2026-09-15  
**F3A PR:** #101  
**F3A exact closure head:** `7eb3db9222cfc3766a4d282764576abac5b99691`  
**F3B PR:** #102  
**F3B exact closure head:** `29044179a7d078c550c2ba31c70dc60646d50aa1`  
**Merge authority:** NONE  
**Stage G authority:** NOT GRANTED BY THIS CLOSURE

## 0. Verdict

Stage F3 is closed.

The completed product path is:

```text
IMMUTABLE ACCEPTED SUBMISSION
  → DURABLE ARCHIVE INTENT IN THE ACCEPTANCE TRANSACTION
  → EXISTING POSTGRES OUTBOX / LEASE / RETRY WORKER
  → FROZEN POINT-IN-TIME GITHUB REPOSITORY IDENTITY
  → GITHUB APP INSTALLATION AUTH
  → EXACT ACCEPTED GIT COMMIT ARCHIVE
  → PRIVATE R2 OBJECT
  → DURABLE CAPTURE / UNAVAILABLE EVIDENCE FACT
```

Submission acceptance remains authoritative independently of later archive completion. Archive/evidence truth cannot rewrite the accepted manifest, accepted timestamp, Challenge state, or eligibility.

## 1. F3A closure

F3A established the provider-independent durable evidence boundary:

- `challenge_submission_archives` as product evidence state distinct from queue state and accepted-submission truth;
- atomic accepted-submission → archive intent → idempotent outbox job;
- reuse of existing `FOR UPDATE SKIP LOCKED`, lease and bounded retry machinery;
- `PENDING`, `CAPTURED`, `PLATFORM_UNAVAILABLE`, `BUILDER_CAUSED_UNAVAILABLE`, and `UNSUPPORTED_SOURCE` truth states;
- fail-closed distinction between ambiguous/platform unavailability and trustworthy builder-caused unavailability;
- safe evidence history without raw private source, credentials, secrets, or private archive locations;
- crash/lease-exhaustion repair so a final abandoned archive worker lease cannot leave product evidence permanently `PENDING` while its queue job is terminally failed.

F3A final exact-head verification:

```text
HEAD                         7eb3db9222cfc3766a4d282764576abac5b99691
INKUBATOR AUTH FOUNDATION    #523 PASS
CI                           #1578 PASS
HOSTILE REVIEW               COMPLETE — 1 P1
P1 REPAIR                    COMPLETE
TARGETED REREVIEW            PASS
```

## 2. F3B closure

F3B connected the F3A capture boundary to production-capable private provider substrate without changing F2 submission authority:

- additive migration freezes numeric GitHub repository + installation identity for accepted `GIT_COMMIT` archive intent;
- historical submissions are not backfilled from a mutable current Project pointer;
- existing GitHub App installation authentication is reused; no second GitHub credential system exists;
- exact accepted commit archive is fetched through GitHub and written to private Cloudflare R2;
- deterministic object key makes lost-response retries idempotent;
- bounded archive-size ceiling prevents unbounded worker memory/storage use;
- provider absence leaves the F3A retry/pending semantics intact rather than silently changing Challenge truth;
- ambiguous GitHub access loss remains platform/unknown truth, never automatic builder blame;
- Project repository rebinding after acceptance cannot redirect capture.

The bounded hostile F3B review found one P1: repository rebinding could race authoritative `accepted_at` under PostgreSQL READ COMMITTED. The repair reuses the existing Project repository-link advisory lock and acquires it before database time is chosen. The transaction holds that lock through accepted-submission persistence, archive-intent creation, source-lineage freezing and commit.

A focused real-Postgres concurrency regression proves submission acceptance blocks behind an in-flight Project repository rebind and freezes the repository authoritative when acceptance proceeds.

F3B final exact-head verification:

```text
HEAD                         29044179a7d078c550c2ba31c70dc60646d50aa1
INKUBATOR AUTH FOUNDATION    #528 PASS — includes Postgres integration
CI                           #1594 PASS
HOSTILE REVIEW               COMPLETE — 1 P1
P1 REPAIR                    COMPLETE
TARGETED REREVIEW            PASS
```

## 3. Preserved invariants

Stage F3 closure preserves all of the following:

- PostgreSQL database time remains authoritative for F2 acceptance/deadline truth;
- the accepted immutable submission manifest remains unchanged by archive results;
- asynchronous platform failure after valid acceptance does not invalidate the builder submission;
- ambiguous absence/auth/platform failure is not classified as builder fault;
- raw private source is not stored in PostgreSQL history or exposed through public Challenge views;
- no public archive download route is introduced;
- no qualification, selection, reveal, Test Arena or receipt authority is introduced;
- no funding, settlement, production money, wallet custody/signing/broadcast or hosted participant runtime is introduced;
- existing PostgreSQL outbox/worker remains the orchestration substrate;
- Stage-E/F1/F2/F3 stacked PR dependency order remains intact;
- merge authority remains NONE.

## 4. Deferred platform work is not an F3 closure blocker

The F3A authority explicitly deferred broad retention/deletion/DSAR policy, encryption-policy hardening, authorized retrieval UX and lifecycle deletion to future bounded platform/trust work.

Those items remain required before the corresponding production/privacy gate when applicable, but they are not part of the Stage-F archive/evidence implementation objective and do not reopen F3.

Submodules, Git LFS objects and external source dependencies also remain unsupported as authoritative V1 source unless separately frozen under a future bounded contract.

## 5. Stage boundary

With F1, F2 and F3 closed, Stage F is complete.

The roadmap's next stage is:

`STAGE G — REVEAL / TEST ARENA / RECEIPTS`

This closure does **not** itself authorize Stage G implementation. Stage G requires its own bounded implementation contract/authority before production changes begin.

```text
STAGE F1 BUILDER CAPSULE          CLOSED / PASS BY GOVERNANCE WAIVER
STAGE F2 IMMUTABLE SUBMISSION     CLOSED / PASS
STAGE F3 ARCHIVE / EVIDENCE       CLOSED / PASS
STAGE F                           CLOSED / PASS
STAGE G                           NEXT / NOT YET AUTHORIZED
PRODUCTION MONEY                  NOT AUTHORIZED
MERGE AUTHORITY                   NONE
```
