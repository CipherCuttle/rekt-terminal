# REKT INKUBATOR — STAGE G3 COMPARISON / SELECTION / RECEIPT TRANSPORT V1

**Status:** USER-AUTHORIZED / ACTIVE  
**Date:** 2026-09-16  
**Base / G2B2 closure head:** `b37b16a7f185538d02b563c198299e9fca9948ca`  
**Parent authorities:** `STAGE_G_REVEAL_TEST_ARENA_RECEIPTS_V1.md`, `STAGE_G2B2_TRUSTED_RUNNER_PERSISTENCE_V1.md`

## 0. Dependency closure

G2B2 is **CLOSED / PASS** on the exact closure-doc head `b37b16a7f185538d02b563c198299e9fca9948ca`.

Closure evidence:

- reviewed implementation/repair head `4331cf6709e15cb12693d0124aad4a885be64eb1` passed CI #1702 and Inkubator Auth Foundation #550;
- the independent hostile review found two P1 defects, both repaired;
- both P1 threads were resolved with exact-head evidence;
- the single targeted Codex rereview of `4331cf6709` found no major issues;
- final docs-only closure head `b37b16a7f185538d02b563c198299e9fca9948ca` passed CI #1706 and Inkubator Auth Foundation #552;
- G2B2 review budget is consumed; no third review loop is authorized.

G3 starts directly from that frozen head.

## 1. Objective

G3 closes the Stage-G organizer/result transport loop without creating parallel winner, qualification, settlement or receipt truth.

Target flow:

```text
DURABLE FINAL_QUALIFIERS DECISION
  + SAFE FINAL-SUBMISSION FACTS
  + FROZEN ORGANIZER PREFERENCES
  → ORGANIZER QUALIFIER COMPARISON
  → EXISTING recordChallengeDecision(SELECTION)
  → EXISTING validateSelection()
  → LATER EXISTING SETTLEMENT AUTHORITY
  → EXISTING challenge_receipts
  → SAFE DURABLE RECEIPT TRANSPORT
```

Qualification remains objective Stage-G2 truth. G3 preference/taste is allowed only after qualification and only among the existing final qualifier set.

## 2. G3 V1 surfaces

G3 V1 authorizes three bounded product surfaces.

### 2.1 Organizer qualifier comparison

Canonical route:

`GET /v1/challenges/:challengeId/qualifier-comparison`

The route is authenticated and organizer-only.

It may be read in `SELECTION` or a later result state, but it MUST source qualifier membership only from the durable `FINAL_QUALIFIERS` decision already derived by Stage C. It MUST NOT recompute final qualifiers from first-pass qualification rows.

The projection may contain:

- Challenge id, contract version and terms digest;
- current Challenge status;
- the frozen Build Contract `preferences` object as non-normative organizer comparison context;
- the durable final qualifier entry ids;
- for each final qualifier, the same purpose-justified safe final-submission facts already permitted by G1 reveal:
  - entry id;
  - submission id/version;
  - accepted timestamp;
  - immutable source reference;
  - artifact digest;
  - optional live URL;
  - safe archive status/digest/reason/observation timestamp;
- existing selection state when a durable `SELECTION` decision already exists.

The projection MUST NOT contain:

- non-qualifier competitors presented as selectable finalists;
- a G3-computed score/rank/winner;
- payout identities;
- private `archive_reference` or raw private archived source;
- GitHub installation/repository credentials or private repository identity;
- raw secret evidence bodies;
- settlement execution identifiers;
- superseded submission versions;
- optional preferences represented as objective qualification requirements.

Ordering MUST be deterministic. GET MUST remain pure.

## 3. Selection authority

Canonical organizer command:

`POST /v1/challenges/:challengeId/selection`

Request body V1:

```json
{
  "request_id": "uuid",
  "decision_id": "uuid",
  "selected_entry_id": "uuid"
}
```

The API fixes the decision type/version server-side:

- `decision_type = SELECTION`;
- `decision_version = stage-g3-selection-v1`.

The client cannot submit a score, rank, alternate decision version, qualification override, settlement intent or winner object.

### 3.1 Canonical mutation law

Selection MUST persist only through existing `recordChallengeDecision()`.

Existing Stage-C validation MUST remain authoritative:

- load the durable `FINAL_QUALIFIERS` decision;
- call existing `validateSelection(selectedEntryId, finalQualifierIds)`;
- require the selected entry to be in that frozen set;
- persist one immutable `challenge_decisions` row;
- preserve existing command idempotency/conflict behavior.

G3 adds one lifecycle invariant at the canonical store boundary:

- a **new** `SELECTION` command requires Challenge status `SELECTION`;
- exact replay of the already-persisted selection command remains idempotent after later lifecycle progress;
- a new/different selection command after lifecycle progress fails closed.

This lifecycle check MUST occur after existing-command replay classification so crash/retry behavior cannot be broken by a later status transition.

The organizer route MUST authenticate the actor and require `organizer_player_id` equality before mutation.

## 4. Preference/taste boundary

Build Contract `preferences` are organizer comparison context only.

G3 MUST NOT:

- translate preferences into new mandatory criteria;
- rewrite a qualification result;
- assign weights/scores unless a future frozen protocol explicitly authorizes them;
- use an LLM/model to rank or select finalists;
- hide post-hoc selection requirements inside UI or API behavior.

Organizer selection is an explicit human choice among already-qualified entries.

## 5. Durable receipt transport

Canonical safe transport route:

`GET /v1/challenges/:challengeId/receipts`

G3 V1 is **read-only receipt transport**. It does not create settlement intents, execution facts or protocol receipts.

Source of truth:

- existing `challenge_receipts` rows;
- existing protocol receipt/correction semantics;
- existing `recordProtocolChallengeReceipt()` remains the only durable filing path.

G3 MAY expose a purpose-justified safe projection only after receipts exist.

### 5.1 Base receipt safe fields

For `inkubator.challenge-receipt/1.0`, the safe transport projection may expose:

- protocol receipt id;
- receipt schema version;
- receipt digest;
- created timestamp;
- Challenge id;
- terms digest;
- contract/mechanism/settlement-policy/IP-terms versions;
- terminal outcome;
- IP transfer fact;
- settlement asset;
- total minor units;
- winner entry id, if present.

It MUST NOT expose:

- settlement recipient payout identities;
- `settlement_execution_fact.execution_id`;
- full raw settlement intent/fact objects;
- private archive/source references;
- raw private evidence.

### 5.2 Correction safe fields

For `inkubator.challenge-receipt-correction/1.0`, V1 transport exposes metadata only:

- protocol correction receipt id;
- schema version;
- digest;
- created timestamp;
- superseded protocol receipt id.

V1 MUST NOT automatically expose correction reason, authority, evidence refs or arbitrary `corrected_projection`, because those fields are not yet constrained to public-safe content.

### 5.3 Ordering and lineage

Receipt transport MUST:

- map internal `supersedes_receipt_id` to the predecessor's protocol receipt id;
- order deterministically by durable creation time plus stable id;
- never fabricate a correction predecessor;
- fail closed on malformed/unsupported stored receipt data rather than leak raw JSON.

## 6. Existing receipt filing authority remains unchanged

`recordProtocolChallengeReceipt()` already requires for a base receipt:

- frozen-contract match;
- Challenge status `SETTLED`;
- matching stored `SETTLEMENT_INTENT` decision;
- matching stored `SETTLEMENT_EXECUTION_FACT` decision;
- immutable/idempotent receipt persistence;
- atomic `SETTLED → RECEIPT_FILED` transition.

Corrections already require the predecessor chain and `RECEIPT_FILED` state.

G3 V1 MUST NOT weaken or bypass any of these requirements.

## 7. Explicit exclusions

G3 V1 does **not** authorize:

- recomputing or rewriting final qualifier truth;
- organizer selection outside the durable final qualifier set;
- LLM/model judging, ranking or scoring;
- weighted scoring;
- hidden tests or post-hoc qualification criteria;
- a new winner/result table;
- a new receipt store;
- settlement-intent creation through G3 routes;
- settlement execution or finalized execution-fact creation;
- production money;
- wallet custody, signing or transaction broadcast;
- public payout identity transport;
- public settlement execution identifiers;
- public raw archive/source/evidence retrieval;
- Stage-H trust-hardening implementation;
- merging the stacked PR chain.

## 8. Acceptance matrix

| Case | Required result |
| --- | --- |
| unauthenticated qualifier comparison | `401 authentication_required` |
| non-organizer qualifier comparison | `403 challenge_organizer_required` |
| comparison before final qualifiers exist | fail closed |
| final qualifier membership | sourced only from stored `FINAL_QUALIFIERS` decision |
| comparison contains non-qualifier | forbidden |
| comparison GET repeated over unchanged state | semantically identical; zero writes |
| organizer preference | comparison context only; never qualification truth |
| new selection while status `SELECTION` | may proceed through existing store |
| selected entry not in final qualifiers | existing `validateSelection()` rejects |
| new selection outside `SELECTION` | fail closed at canonical store boundary |
| exact persisted selection replay after lifecycle advance | idempotent replay allowed |
| different selection after persisted selection | immutable/idempotency conflict |
| receipt route with no receipts | deterministic empty safe list or explicit no-receipt state; no fabrication |
| base receipt projection | no payout identities or execution id |
| correction projection | metadata only; no arbitrary reason/evidence/projection leakage |
| private archive/source fact | never exposed by G3 |
| G3 route attempts settlement execution | unsupported |

## 9. Verification plan

Minimum G3 verification:

- unit coverage for deterministic final-qualifier comparison and redaction;
- organizer/non-organizer auth tests;
- Postgres integration proving selection among qualifiers persists via existing decision authority;
- selected non-qualifier fails closed;
- new selection outside `SELECTION` fails closed while exact replay after lifecycle advance succeeds;
- receipt projection test with deliberately secret payout identities, execution id, correction reason/evidence/projection values and private-looking strings proving none leak;
- normal API and combined Render runtime route-wiring regression;
- exact-head repo CI + Inkubator Auth Foundation;
- ONE independent hostile review focused on qualifier authority, lifecycle/idempotency, privacy/redaction, parallel-truth avoidance and runtime wiring;
- fix Critical/High only; one targeted rereview only if required.

## 10. Bounded completion

```text
IMPLEMENT G3
→ TEST
→ ONE independent hostile review
→ fix Critical/High only
→ ONE targeted rereview only if required
→ CLOSE G3
→ MOVE TO STAGE H PREPARATION / CLOSED-ALPHA READINESS AS AUTHORIZED
```

**Merge authority: NONE.**

## 11. Current verdict

```text
G1 SYNCHRONIZED REVEAL + ARENA INPUT           CLOSED / PASS
G2A FROZEN ACCEPTANCE MANIFEST                 CLOSED / PASS
G2B1 EXECUTION AUTHORITY CONTRACT              CLOSED / PASS
G2B2 TRUSTED RUNNER + QUALIFICATION PERSIST    CLOSED / PASS @ b37b16a7...
G3 COMPARISON / SELECTION / RECEIPT TRANSPORT  USER-AUTHORIZED / ACTIVE
STAGE H TRUST HARDENING                        NOT AUTHORIZED BY G3
PRODUCTION MONEY                               NOT AUTHORIZED
MERGE AUTHORITY                                NONE
```