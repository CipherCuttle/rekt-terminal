# REKT INKUBATOR — STAGE G3 CLOSURE V1

**Status:** CLOSED / PASS  
**Date:** 2026-09-16  
**Reviewed implementation head:** `e6c7e0abeaf1be79a9ac35a697c050f51e81e31b`  
**PR:** #107  
**Merge authority:** NONE

## 0. Objective closed

G3 closes the Stage-G product-result loop without introducing parallel winner or receipt truth:

```text
DURABLE FINAL_QUALIFIERS
  → SAFE ORGANIZER COMPARISON
  → EXISTING SELECTION AUTHORITY
  → EXISTING SETTLEMENT / RECEIPT AUTHORITY
  → SAFE DURABLE RECEIPT TRANSPORT
```

The implementation reuses Stage-B/C authority rather than creating a second ranking, winner or receipt system.

## 1. Implemented surfaces

### Organizer qualifier comparison

`GET /v1/challenges/:challengeId/qualifier-comparison`

- authenticated organizer only;
- membership comes only from the one durable `FINAL_QUALIFIERS` decision;
- final-submission facts reuse the safe G1 reveal projection;
- frozen Build-Contract `preferences` are comparison context only and never modify qualification;
- nonqualifiers, payout identities and private archive/source facts are excluded.

### Organizer selection

`POST /v1/challenges/:challengeId/selection`

Request authority is restricted to:

- `request_id`;
- `decision_id`;
- `selected_entry_id`.

The server fixes:

- `decision_type = SELECTION`;
- `decision_version = stage-g3-selection-v1`.

Persistence flows only through existing `recordChallengeDecision()` / `validateSelection()` and the existing Stage-C database lifecycle guard.

Exact already-persisted command replay remains recoverable after Challenge lifecycle advance because Stage-C existing-command classification occurs before a new insert reaches the lifecycle trigger. A new or changed command outside `SELECTION` fails closed.

Concurrent organizer choices serialize through existing Challenge locking / decision guards and produce exactly one durable `SELECTION`.

### Durable receipt transport

`GET /v1/challenges/:challengeId/receipts`

The route is read-only over existing `challenge_receipts`.

Base receipts expose only bounded result metadata including protocol receipt identity/digest, Challenge/contract/version lineage, terminal outcome, IP transfer fact, settlement asset/total and optional winner entry id.

They do **not** expose:

- recipient / payout identities;
- settlement execution identifiers;
- raw settlement intent or execution fact;
- private source/archive facts;
- private evidence bodies.

Correction receipts expose only correction identity/digest/time and superseded **protocol** receipt id. They do not expose arbitrary correction reason, authority, evidence refs or corrected projection content.

Supported stored base/correction rows fail closed on authority, Challenge, terms, digest, id, predecessor or protocol-reconstruction mismatch.

## 2. Verification

Exact tested/reviewed implementation head:

`e6c7e0abeaf1be79a9ac35a697c050f51e81e31b`

Passed:

- CI #1729 — PASS;
- Inkubator Auth Foundation #562 — PASS, including migrations and full Postgres integration suite.

Focused evidence proves:

- comparison contains only durable final qualifiers;
- preferences remain non-normative context;
- missing final-qualifier authority fails closed;
- payout identity, settlement execution id and correction private content do not leak through receipt transport;
- both canonical API entrypoints register G3 routes;
- unauthenticated organizer comparison and selection fail at `401` before database access;
- the Postgres fixture earns `FINAL_QUALIFIERS` through real immutable final submissions, first-pass qualification and elapsed appeal authority;
- a valid qualifier selection persists once;
- an exact persisted selection replays after lifecycle progress;
- a new selection command after lifecycle progress fails closed;
- nonqualifier and nonorganizer selection attempts fail closed;
- concurrent organizer choices produce exactly one durable selection.

An earlier Postgres run failed because the test fixture attempted to insert `FINAL_QUALIFIERS` after manually placing the Challenge in `SELECTION`. The database correctly rejected that invalid setup. The fixture was repaired to traverse the canonical Stage-C authority chain; no product defect was implicated by that failure.

A pre-review self-audit also removed a redundant G3 wrapper lifecycle classifier so replay/new-command legality remains at the existing Stage-C store/database boundary instead of creating a second lifecycle authority.

## 3. Hostile review

One independent Codex hostile review was run on exact green head `e6c7e0abeaf1be79a9ac35a697c050f51e81e31b`.

Result:

`Codex Review: Didn't find any major issues.`

Reviewed commit: `e6c7e0abea`.

No Critical/High repair was required. Therefore the bounded policy does not authorize or require a targeted rereview. The G3 review budget is complete.

## 4. Scope that remains intentionally absent

G3 does not authorize or implement:

- settlement intent creation as a new G3 authority;
- settlement execution;
- production money;
- wallet custody, signing or broadcast;
- LLM judging/scoring/ranking;
- a second winner table;
- a second receipt store;
- arbitrary private receipt evidence exposure;
- Stage-H trust-hardening implementation;
- merge of the stacked PR chain.

## 5. Stage-G verdict

```text
G1  SYNCHRONIZED REVEAL + ARENA INPUT            CLOSED / PASS
G2A FROZEN ACCEPTANCE MANIFEST                   CLOSED / PASS
G2B1 OBJECTIVE EXECUTION AUTHORITY                CLOSED / PASS
G2B2 TRUSTED RUNNER + QUALIFICATION PERSISTENCE  CLOSED / PASS
G3  COMPARISON / SELECTION / RECEIPT TRANSPORT   CLOSED / PASS
STAGE G                                           CLOSED / PASS / STACKED / UNMERGED
STAGE H TRUST HARDENING                           NEXT / NOT AUTHORIZED BY THIS CLOSURE
PRODUCTION MONEY                                  NOT AUTHORIZED
MERGE AUTHORITY                                   NONE
```

Stage H is the next roadmap stage, but this closure does not silently authorize its implementation.
