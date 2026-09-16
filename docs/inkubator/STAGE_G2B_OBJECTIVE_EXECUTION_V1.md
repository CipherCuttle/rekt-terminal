# REKT INKUBATOR — STAGE G2B OBJECTIVE EXECUTION V1

**Status:** USER-AUTHORIZED / ACTIVE — G2B2 IMPLEMENTATION SLICE
**Date:** 2026-09-16
**Base / G2A closure head:** `7bd6182d6d03971d6235931cdbdfd6e2633c8005`  
**Parent authority:** `STAGE_G_REVEAL_TEST_ARENA_RECEIPTS_V1.md`

## 0. Dependency closure

G2A is **CLOSED / PASS** at exact head `7bd6182d6d03971d6235931cdbdfd6e2633c8005`.

Closure evidence:

- final exact-head CI #1637 PASS;
- final exact-head Inkubator Verification #631 PASS;
- one independent hostile review found two P1 authority defects;
- both were repaired;
- the single policy-authorized targeted rereview found one additional signed-zero P1 inside the config hardening;
- that defect was repaired with a focused regression;
- no third review loop was opened;
- all three review threads are resolved.

G2B starts directly from that frozen closure head.

## 1. Objective

G2B turns frozen acceptance law into qualification inputs **without creating a second evaluator or score system**.

Target flow:

```text
FROZEN BUILD CONTRACT
  + FROZEN ACCEPTANCE MANIFEST
  + PROTOCOL-SELECTED FINAL IMMUTABLE SUBMISSION
  + EXACT OBSERVATIONS
  → CONTENT-ADDRESSED TEST-ARENA EXECUTION
  → EXISTING computeQualification()
  → EXISTING recordChallengeQualification()
```

G2B1 froze the execution/result authority contract. G2B2 now adds one trusted deterministic module, organizer observation recording, append-only evidence events and the adapter into existing qualification persistence. Browser/API/security runner adapters remain future slices and must plug into this contract rather than bypass it.

## 2. Execution artifact

Schema:

`inkubator.test-arena-execution/1.0`

Execution profile:

`objective-test-arena/1.0`

Every execution is bound to:

- frozen Challenge id and contract version;
- frozen `terms_digest`;
- canonical acceptance-manifest digest;
- one entry id plus a candidate submission-manifest set;
- the final eligible submission selected from that set by existing `selectFinalSubmission()` law;
- the canonical digest of the **complete selected submission manifest**, not merely a display projection;
- exact mandatory criterion set;
- exact observation mode for each criterion;
- frozen automated module id/version/content digest;
- durable evidence references;
- the existing Stage-B qualification law.

The deterministic `qualification_version` is derived from the execution-profile version, Build-Contract `terms_digest`, and acceptance-manifest digest. A change in contract law, acceptance law, or execution profile therefore cannot silently overwrite the same immutable qualification version.

The execution artifact separately carries the selected submission's full manifest digest. Changes to authoritative submission facts such as `accepted_at`, submission `evidence_references`, or `optional_live_url` therefore change execution identity even when entry/version/artifact/source projection fields remain the same.

## 3. Observation law

### `AUTOMATED`

An automated observation MUST match the frozen acceptance binding exactly:

- `criterion_id`;
- `mode = AUTOMATED`;
- `module_id`;
- `module_version`;
- `module_digest`;
- result in `PASS | FAIL | DISPUTED`;
- one or more durable evidence references.

A caller cannot relabel a different runner as the frozen module.

### `HUMAN_OBSERVATION`

A human observation contains only:

- `criterion_id`;
- `mode = HUMAN_OBSERVATION`;
- result in `PASS | FAIL | DISPUTED`;
- one or more durable evidence references.

It cannot carry module/executor fields. G2B does not convert organizer taste into qualification law; organizer preference remains G3-only.

## 4. Exact coverage

Execution fails closed unless observations equal the frozen acceptance bindings exactly.

Therefore:

- no missing mandatory criterion;
- no duplicate criterion;
- no optional criterion promoted into qualification;
- no post-hoc criterion;
- no mode substitution;
- no automated module identity/version/digest substitution.

Observation order and evidence-reference order are canonicalized so ordering-only differences do not mint different execution meaning.

## 5. Submission lineage

G2B1 does not let a caller directly nominate which eligible submission should be tested.

The protocol reducer receives:

- one `entryId`;
- a set of candidate submission manifests.

It then calls the existing Stage-B `selectFinalSubmission()` law itself. Therefore, within the provided candidate set:

- only protocol-eligible submissions can be selected;
- a later eligible final version wins according to existing protocol semantics;
- duplicate eligible submission versions fail closed;
- wrong-Challenge, wrong-entry, wrong-terms or late candidates cannot become the selected final submission.

After selection, G2B1 hashes the complete selected manifest with the existing canonical protocol digest and stores that `manifest_digest` in the execution artifact. The execution digest is therefore bound to all authoritative selected-manifest fields, including fields omitted from the compact display projection.

**Completeness boundary:** a pure protocol reducer cannot independently prove that an arbitrary caller supplied the complete durable submission set. G2B2 MUST source the candidate set from the canonical `challenge_submissions` store for the entry before execution/persistence. Durable qualification MUST still go through existing `recordChallengeQualification()`, which independently requires QUALIFICATION state and an `is_final = true` submission row for the same Challenge/entry/submission and terms digest. The G2B1 reducer is not a substitute for that database authority.

## 6. Qualification law reuse

G2B MUST reuse existing:

- `selectFinalSubmission()` for final work selection;
- `computeQualification()` for overall `QUALIFIED | NOT_QUALIFIED | DISPUTED`;
- `recordChallengeQualification()` for immutable durable storage;
- `challenge_qualifications` rather than a new score/result table;
- existing appeal/final-qualifier law after first-pass qualification.

No weighted score, LLM grade, secret rubric, taste score, or parallel evaluator is authorized.

## 7. Runner boundary

Compiler blueprint names such as `http-smoke`, `accessibility-basic`, `asset-budget`, `persistence-roundtrip`, `realtime-consistency`, and `reconnect-path` are **not executable authority merely because the compiler names them**.

A future trusted runner adapter may execute an AUTOMATED binding only when its implementation identity/version/content digest matches the frozen acceptance manifest. Unsupported criteria remain on their explicitly frozen `HUMAN_OBSERVATION` path; G2B must not fake automation certainty.

G2B1 established the runner/output contract. G2B2 implements only `artifact-digest-match@1.0.0`, whose content digest is exported by the API registry and whose implementation compares the selected submission's frozen `artifact_digest` to the frozen `config.expected_artifact_digest`. It performs no network access, accepts no fixture references, executes no participant code and cannot be selected by id/version alone when the digest is wrong. Browser/API/security runners remain future slices.

## 8. G2B2 API and evidence seam

The organizer-only route is:

`POST /v1/challenges/:challengeId/entries/:entryId/test-arena/execute`

The route derives the unique acceptance-manifest reference from the frozen contract, sources all candidate submissions from the durable `challenge_submissions` snapshot, selects the final submission through `selectFinalSubmission()`, and rejects any submission that is not the durable `is_final` row. The request supplies the content-addressed manifest and only human observations; automated observations are generated by the trusted registry.

Each automated or human observation is written as an `evidence`-family `history_events` row with a deterministic dedupe key and content-bound payload. Identical retries replay the event; changed payloads conflict. Missing human observations return `INCOMPLETE` and do not call qualification persistence. Complete observations are passed to `buildTestArenaQualification()`, then to the existing `recordChallengeQualification()` path.

The response contains only challenge/entry/submission identifiers, digests, qualification state and qualification facts. It does not return private archive references, private source paths or raw submission manifests.

## 9. Acceptance matrix

| Case | Required result |
| --- | --- |
| exact automated + human observations | PASS |
| automated module id differs from frozen binding | fail closed |
| automated module version differs | fail closed |
| automated module digest differs | fail closed |
| human observation carries executor fields | fail closed |
| mode substitution | fail closed |
| missing mandatory observation | fail closed |
| duplicate observation | fail closed |
| undeclared/post-hoc observation | fail closed |
| observation has no evidence refs | fail closed |
| candidate set has no eligible final submission | fail closed |
| newer eligible version exists in supplied candidate set | existing `selectFinalSubmission()` chooses it |
| duplicate eligible submission version | fail closed |
| wrong entry/terms/deadline candidate only | fail closed |
| selected manifest `accepted_at` changes | selected manifest + execution digest change |
| selected manifest submission evidence changes | selected manifest + execution digest change |
| selected manifest optional live URL changes | selected manifest + execution digest change |
| only observation/evidence ordering changes | execution digest stable |
| frozen acceptance law changes | qualification version changes |
| criterion FAIL | existing law returns NOT_QUALIFIED |
| criterion DISPUTED | existing law returns DISPUTED |

## 10. Explicit exclusions

G2B1 does not authorize:

- arbitrary organizer-supplied values being treated as trusted automated test output;
- treating a caller-supplied candidate submission subset as durable proof of set completeness;
- network/browser runner implementation yet;
- executing untrusted participant code on platform infrastructure;
- hidden tests or post-hoc acceptance requirements;
- LLM judging/scoring;
- changing `computeQualification()` semantics;
- new qualification persistence tables;
- G3 organizer selection/receipt transport;
- settlement execution or production money;
- Stage H;
- merging the stacked PR chain.

## 11. Review / bounded completion

The single independent hostile review at exact tested head `4d0de4490d560d6f7eb27c13266889d47df13b71` found one P1 authority defect:

- the execution artifact projected only part of the selected submission, so distinct complete submission manifests with the same projected entry/version/artifact/source facts could collapse to the same execution digest.

Repair:

- execution now carries the canonical digest of the complete protocol-selected submission manifest;
- focused regression proves changes to `accepted_at`, submission evidence, or optional live URL change both selected-manifest identity and execution identity.

Bounded completion:

```text
IMPLEMENT G2B1 EXECUTION AUTHORITY
→ TEST
→ ONE independent hostile review
→ fix Critical/High only
→ REVERIFY EXACT REPAIR HEAD
→ ONE targeted rereview of the P1 repair
→ CLOSE G2B1 IF CLEAN
→ MOVE TO TRUSTED RUNNER + DURABLE-STORE/PERSISTENCE WIRING
```

**Merge authority: NONE.**

## 11. Current verdict

```text
G1 SYNCHRONIZED REVEAL + ARENA INPUT          CLOSED / PASS
G2A FROZEN ACCEPTANCE MANIFEST                CLOSED / PASS @ 7bd6182d...
G2B1 EXECUTION AUTHORITY CONTRACT             ACTIVE / P1 REPAIRED / REVERIFY NEXT
G2B2 TRUSTED RUNNER + QUALIFICATION PERSIST   SEQUENCED AFTER G2B1
G3 COMPARISON / SELECTION / RECEIPT TRANSPORT SEQUENCED AFTER G2B
PRODUCTION MONEY                              NOT AUTHORIZED
MERGE AUTHORITY                               NONE
```
