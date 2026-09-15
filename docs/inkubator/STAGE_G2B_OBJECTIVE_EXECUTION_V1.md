# REKT INKUBATOR — STAGE G2B OBJECTIVE EXECUTION V1

**Status:** USER-AUTHORIZED / ACTIVE  
**Date:** 2026-09-15  
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
  + FINAL IMMUTABLE SUBMISSION
  + EXACT OBSERVATIONS
  → CONTENT-ADDRESSED TEST-ARENA EXECUTION
  → EXISTING computeQualification()
  → EXISTING recordChallengeQualification()
```

G2B1 in this PR freezes the execution/result authority contract. Trusted browser/API/security runner adapters and their scheduling/wiring are subsequent G2B slices; they must plug into this contract rather than bypass it.

## 2. Execution artifact

Schema:

`inkubator.test-arena-execution/1.0`

Execution profile:

`objective-test-arena/1.0`

Every execution is bound to:

- frozen Challenge id and contract version;
- frozen `terms_digest`;
- canonical acceptance-manifest digest;
- exact final-submission lineage supplied to the executor;
- exact mandatory criterion set;
- exact observation mode for each criterion;
- frozen automated module id/version/content digest;
- durable evidence references;
- the existing Stage-B qualification law.

The deterministic `qualification_version` is derived from the execution-profile version, Build-Contract `terms_digest`, and acceptance-manifest digest. A change in contract law, acceptance law, or execution profile therefore cannot silently overwrite the same immutable qualification version.

## 3. Observation law

### AUTOMATED

An automated observation MUST match the frozen acceptance binding exactly:

- `criterion_id`;
- `mode = AUTOMATED`;
- `module_id`;
- `module_version`;
- `module_digest`;
- result in `PASS | FAIL | DISPUTED`;
- one or more durable evidence references.

A caller cannot relabel a different runner as the frozen module.

### HUMAN_OBSERVATION

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

The protocol execution artifact verifies that the supplied submission manifest:

- belongs to the frozen Challenge;
- carries the frozen `terms_digest`;
- was accepted by the frozen submission deadline.

Durable API persistence MUST still go through existing `recordChallengeQualification()`, which independently requires QUALIFICATION state and an `is_final = true` submission row for the same Challenge/entry/submission and terms digest. The protocol layer does not replace that database authority.

## 6. Qualification law reuse

G2B MUST reuse existing:

- `computeQualification()` for overall `QUALIFIED | NOT_QUALIFIED | DISPUTED`;
- `recordChallengeQualification()` for immutable durable storage;
- `challenge_qualifications` rather than a new score/result table;
- existing final-submission lineage;
- existing appeal/final-qualifier law after first-pass qualification.

No weighted score, LLM grade, secret rubric, taste score, or parallel evaluator is authorized.

## 7. Runner boundary

Compiler blueprint names such as `http-smoke`, `accessibility-basic`, `asset-budget`, `persistence-roundtrip`, `realtime-consistency`, and `reconnect-path` are **not executable authority merely because the compiler names them**.

A future trusted runner adapter may execute an AUTOMATED binding only when its implementation identity/version/content digest matches the frozen acceptance manifest. Unsupported criteria remain on their explicitly frozen `HUMAN_OBSERVATION` path; G2B must not fake automation certainty.

G2B1 therefore establishes the runner/output contract but does not claim that browser/API/security runners already exist.

## 8. Acceptance matrix

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
| submission terms digest differs | fail closed |
| submission accepted after frozen deadline | fail closed |
| only observation/evidence ordering changes | execution digest stable |
| frozen acceptance law changes | qualification version changes |
| criterion FAIL | existing law returns NOT_QUALIFIED |
| criterion DISPUTED | existing law returns DISPUTED |

## 9. Explicit exclusions

G2B1 does not authorize:

- arbitrary organizer-supplied values being treated as automated test output;
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

## 10. Bounded completion

```text
IMPLEMENT G2B1 EXECUTION AUTHORITY
→ TEST
→ ONE independent hostile review
→ fix Critical/High only
→ ONE targeted rereview only if required
→ CLOSE G2B1
→ MOVE TO TRUSTED RUNNER + PERSISTENCE WIRING
```

**Merge authority: NONE.**

## 11. Current verdict

```text
G1 SYNCHRONIZED REVEAL + ARENA INPUT          CLOSED / PASS
G2A FROZEN ACCEPTANCE MANIFEST                CLOSED / PASS @ 7bd6182d...
G2B1 EXECUTION AUTHORITY CONTRACT              ACTIVE
G2B2 TRUSTED RUNNER + QUALIFICATION PERSIST    SEQUENCED AFTER G2B1
G3 COMPARISON / SELECTION / RECEIPT TRANSPORT  SEQUENCED AFTER G2B
PRODUCTION MONEY                               NOT AUTHORIZED
MERGE AUTHORITY                                NONE
```
