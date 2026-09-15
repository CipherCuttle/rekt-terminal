# REKT INKUBATOR — STAGE G2B2 TRUSTED RUNNER + QUALIFICATION PERSISTENCE V1

**Status:** USER-AUTHORIZED / ACTIVE  
**Date:** 2026-09-16  
**Base / G2B1 closure head:** `9ec1577b1b6a86d2904bed4af6c9e96952f2ac48`  
**Parent authorities:** `STAGE_G_REVEAL_TEST_ARENA_RECEIPTS_V1.md`, `STAGE_G2_ACCEPTANCE_MANIFEST_V1.md`, `STAGE_G2B_OBJECTIVE_EXECUTION_V1.md`

## 0. Dependency closure

G2B1 is **CLOSED / PASS** at exact head `9ec1577b1b6a86d2904bed4af6c9e96952f2ac48`.

Closure evidence:

- exact-head CI #1662 PASS;
- exact-head Inkubator Verification #640 PASS;
- one independent hostile review found one P1 execution-identity defect;
- repair bound execution identity to the canonical digest of the complete protocol-selected submission manifest;
- focused regressions prove changes to accepted time, submission evidence and optional live URL change execution identity;
- the single targeted rereview on exact repair head reported no major issues;
- the P1 thread is resolved;
- review budget is consumed.

G2B2 starts directly from that frozen closure head.

## 1. Objective

G2B2 makes the G2B1 execution contract usable against **durable server-owned Challenge state** without introducing a second evaluator or unsafe participant runtime.

Target flow:

```text
POSTGRES CHALLENGE SNAPSHOT
  + COMPLETE ENTRY SUBMISSION SET
  + DURABLE is_final ROW
  + FROZEN ACCEPTANCE MANIFEST
  + TRUSTED SERVER RUNNERS
  + EXACT HUMAN OBSERVATIONS
  → G2B1 CONTENT-ADDRESSED EXECUTION
  → EXISTING recordChallengeQualification()
  → APPEND-ONLY EXECUTION EVIDENCE EVENT
```

## 2. Canonical route

Organizer qualification command:

`POST /v1/challenges/:challengeId/test-arena/entries/:entryId/qualify`

Trusted module discovery:

`GET /v1/test-arena/modules`

Both routes require an authenticated Inkubator session. Qualification is organizer-only.

## 3. Durable submission authority

G2B2 MUST source candidate submissions from canonical `challenge_submissions` through the existing Challenge snapshot.

For the target entry it MUST:

1. load the complete durable candidate set;
2. independently run existing `selectFinalSubmission()` over that set;
3. require exactly one durable `is_final = true` row;
4. require that durable final row to equal the protocol-selected complete manifest digest/version;
5. refuse qualification if durable finality and protocol finality disagree.

A request cannot provide, remove or reorder the durable candidate set.

## 4. Acceptance-manifest authority

The request may carry the acceptance-manifest body because its meaning is already frozen by the Build Contract.

The runtime MUST call existing `bindAcceptanceManifestToContract()` and therefore refuses any body whose Challenge, contract version, criterion coverage or content digest differs from the unique frozen `ACCEPTANCE_MANIFEST` normative reference.

The request does not gain authority by supplying manifest content; it only supplies content whose digest must equal frozen law.

The validated canonical acceptance-manifest body is retained in the internal Test Arena evidence event together with the G2B1 execution artifact. This makes the evaluation law reconstructable from durable evidence rather than requiring an external copy of the manifest body.

## 5. Trusted automated runner boundary

Automated observations may only be produced by the server-owned trusted module registry.

A frozen automated binding must match all three exactly:

- `module_id`;
- `module_version`;
- `module_digest`.

The runtime does not accept automated PASS/FAIL/DISPUTED values from the request.

### 5.1 Runner-contract identity

`module_digest` is the canonical digest of a declarative trusted-module contract. That contract includes:

- module schema version;
- `runner_engine_version = trusted-fact-runner/1.0`;
- module id/version;
- executor kind;
- durable authority description;
- declared semantics;
- config policy;
- fixture policy;
- blocked archive states;
- archive states that require a content digest;
- result map.

The generic trusted-fact engine dispatches from this frozen declarative contract. A semantic runner change therefore requires a changed declarative contract and/or runner-engine version, which changes `module_digest`; retaining only the same friendly module name is insufficient authority.

G2B2 V1 intentionally supports only server-owned deterministic modules whose inputs are already canonical durable facts.

### `submission-lineage-integrity / 1.0.0`

Authority:

- canonical `challenge_submissions` row;
- existing Stage-B final-submission law.

Result:

- `PASS` only when the durable final row matches the protocol-selected complete submission manifest under frozen terms;
- disagreement is a fail-closed execution error, not a user-selectable FAIL/PASS result.

### `archive-capture-integrity / 1.0.0`

Authority:

- canonical Stage-F `challenge_submission_archives` row after exact final-submission lineage validation.

Result map:

| Archive state | Qualification behavior |
| --- | --- |
| `CAPTURED` with valid archive digest | automated `PASS` |
| `PENDING` | **no qualification is recorded; fail command closed until a terminal observation exists** |
| `PLATFORM_UNAVAILABLE` | automated `DISPUTED` |
| `BUILDER_CAUSED_UNAVAILABLE` | automated `FAIL` |
| `UNSUPPORTED_SOURCE` | automated `FAIL` |

`PENDING` is capture intent, not an evidence observation. Because Stage-C qualification rows are immutable and first-pass completion can advance the Challenge lifecycle, a temporary queue state MUST NOT be crystallized into a durable qualification result. `PLATFORM_UNAVAILABLE`, by contrast, is a terminal ambiguous platform observation and remains `DISPUTED`, never builder fault.

V1 trusted modules accept no runner-specific config or fixture references. A frozen binding that attempts to add either fails closed as unsupported rather than changing module semantics underneath a known module id/version.

## 6. Human observation boundary

The request may provide values only for bindings already frozen as `HUMAN_OBSERVATION`.

Human observations MUST exactly equal the frozen human-binding criterion set and contain:

- `criterion_id`;
- result in `PASS | FAIL | DISPUTED`;
- one or more evidence references.

A request cannot submit an automated result through the human channel or add post-hoc criteria.

Organizer taste/preferences remain outside qualification and remain G3-only.

## 7. Qualification persistence

After G2B1 constructs the execution artifact, G2B2 MUST call existing `recordChallengeQualification()` with:

- the protocol-selected durable final `submission_id`;
- deterministic G2B1 `qualification_version`;
- exact criterion results from the execution artifact.

Existing Stage-C law therefore remains authoritative for:

- `QUALIFICATION` lifecycle state;
- final-submission lineage;
- immutable qualification conflicts;
- idempotency;
- durable `challenge_qualifications` storage.

No G2B2 qualification table or score store is authorized.

## 8. Execution evidence

After qualification persistence, G2B2 appends one `evidence` history event:

`challenge.test_arena.executed`

The event is content-addressed/idempotent through existing `appendHistoryEvent()` and records:

- command request id;
- qualification id/version/result;
- Challenge/entry/submission lineage;
- the validated canonical acceptance manifest;
- G2B1 execution digest;
- the safe execution artifact including trusted module identity and evidence refs.

It does not contain private archive object references or raw private source bodies.

If qualification persistence succeeds but event append is interrupted, retry replays the immutable qualification and can complete the idempotent evidence append; no alternate qualification truth is created.

The Postgres acceptance test must prove:

- one real immutable `challenge_qualifications` row;
- one replay-safe `challenge.test_arena.executed` event;
- preserved acceptance-manifest body and selected-manifest digest in evidence;
- changed replay fails closed;
- `PENDING` archive state creates zero qualification rows.

## 9. Explicitly unsupported in G2B2 V1

G2B2 V1 does **not** authorize:

- arbitrary HTTP/browser fetches to participant URLs;
- participant-code execution on platform infrastructure;
- generic sandbox/container execution;
- SSRF-capable network runners;
- hidden tests;
- organizer-supplied automated results;
- LLM grading/judging/scoring;
- weighted scores;
- new qualification or execution database tables;
- G3 selection or receipt transport;
- settlement execution;
- production money;
- Stage H;
- merging the stacked PR chain.

Unsupported automated module id/version/digest/config/fixture combinations fail closed.

## 10. Acceptance matrix

| Case | Required result |
| --- | --- |
| durable final row = protocol-selected final manifest | execution may proceed |
| durable `is_final` disagrees with protocol selection | fail closed |
| caller attempts to choose submission set | impossible at route boundary |
| acceptance-manifest body differs from frozen digest | fail closed |
| trusted module id/version/digest exact | runner may execute |
| runner contract / engine version changes | module digest changes |
| module digest substituted | fail closed |
| trusted V1 module receives config/fixtures | fail closed |
| caller supplies automated observation | rejected by request contract |
| human criterion missing/extra/duplicate | fail closed |
| archive `CAPTURED` + valid digest | automated PASS |
| archive `PENDING` | no immutable qualification; fail closed until terminal observation |
| archive `PLATFORM_UNAVAILABLE` | automated DISPUTED |
| builder-caused unavailable / unsupported source | automated FAIL |
| archive lineage differs from final submission | fail closed |
| exact result set complete | existing `computeQualification()` semantics |
| qualification replay same payload | idempotent |
| qualification replay changed payload | immutable/idempotency conflict |
| durable evidence event | retains canonical acceptance manifest + execution identity |
| canonical Render runtime | G2B routes registered |

## 11. Bounded completion

```text
IMPLEMENT G2B2
→ TEST
→ ONE independent hostile review
→ fix Critical/High only
→ ONE targeted rereview only if required
→ CLOSE G2B2
→ MOVE TO G3 OR A SEPARATELY AUTHORIZED NETWORK-RUNNER SLICE
```

**Merge authority: NONE.**

## 12. Current verdict

```text
G1 SYNCHRONIZED REVEAL + ARENA INPUT          CLOSED / PASS
G2A FROZEN ACCEPTANCE MANIFEST                CLOSED / PASS
G2B1 EXECUTION AUTHORITY CONTRACT             CLOSED / PASS @ 9ec1577b...
G2B2 TRUSTED RUNNER + QUALIFICATION PERSIST   ACTIVE
G3 COMPARISON / SELECTION / RECEIPT TRANSPORT SEQUENCED AFTER G2B
NETWORK/BROWSER RUNNERS                       NOT AUTHORIZED BY G2B2 V1
PRODUCTION MONEY                              NOT AUTHORIZED
MERGE AUTHORITY                               NONE
```
