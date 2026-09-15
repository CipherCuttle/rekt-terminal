# REKT INKUBATOR — STAGE G2A ACCEPTANCE MANIFEST V1

**Status:** USER-AUTHORIZED / ACTIVE  
**Date:** 2026-09-15  
**Base:** `e2e24ee55a0e81294660055a6a6ed7094f61ddba` (`agent/stage-g1-reveal-arena-v1`)  
**Parent authority:** `STAGE_G_REVEAL_TEST_ARENA_RECEIPTS_V1.md`

## 0. Objective

G2A freezes **evaluation meaning before evaluation execution**.

It closes the authority gap between:

```text
COMPILER acceptance_plan.modules
        !=
FROZEN QUALIFICATION LAW
```

Compiler modules are advisory planning output until the organizer freezes an exact, content-addressed acceptance manifest into the Build Contract's existing normative-reference set.

Target flow:

```text
FROZEN MANDATORY CRITERIA
  → ONE DECLARED BINDING PER CRITERION
  → CONTENT-ADDRESSED ACCEPTANCE MANIFEST
  → EXACTLY ONE BUILD-CONTRACT ACCEPTANCE-MANIFEST REFERENCE
  → TERMS DIGEST
  → LATER G2B EXECUTION
```

G2A does not execute tests and does not record qualification.

## 1. Protocol artifact

Schema:

`inkubator.acceptance-manifest/1.0`

Build-Contract normative-reference kind:

`ACCEPTANCE_MANIFEST`

A manifest contains:

- `challenge_id`;
- `contract_version`;
- exactly one binding for every mandatory frozen criterion;
- no binding for optional criteria or organizer preferences.

If a valid frozen Build Contract has zero mandatory criteria, the acceptance manifest has zero bindings. G2A does not make the qualification law stricter than the existing Stage-B protocol.

Binding modes:

### `AUTOMATED`

The frozen binding declares:

- `criterion_id`;
- versioned `module_id`;
- `module_version`;
- content-addressed `module_digest`;
- frozen `fixture_reference_ids` that must already exist in the Build Contract's normative references;
- frozen `config`.

Automated `config` is restricted recursively to the existing protocol canonical JSON value domain: `null`, strings, booleans, non-negative-zero safe integers, arrays and plain string-keyed objects composed only from those values. Prototype-bearing/non-JSON values such as `Date` or `Map`, accessors, symbols, sparse arrays, cycles, unsupported primitives, non-safe/non-integer numbers and signed negative zero fail closed before hashing. The executor-visible config therefore cannot carry semantics that disappear from the content digest.

### `HUMAN_OBSERVATION`

The frozen binding declares:

- `criterion_id`;
- exact human-observation instructions.

Human observation cannot silently carry an automated executor, hidden config or post-hoc test definition.

## 2. Binding law

`bindAcceptanceManifestToContract()` MUST fail closed unless all are true:

1. the Build Contract is already a valid frozen contract;
2. manifest `challenge_id` matches the contract;
3. manifest `contract_version` matches the contract;
4. binding criterion ids exactly equal the set of frozen mandatory criteria from Outcome Contract, Production Envelope, Delivery Contract and normative constraints;
5. the Build Contract contains **exactly one** normative reference whose kind is `ACCEPTANCE_MANIFEST`;
6. that unique reference id equals the requested acceptance-manifest reference id;
7. that unique reference digest equals the canonical acceptance-manifest digest;
8. every automated fixture reference is already a frozen normative reference;
9. an automated fixture may not reference the acceptance manifest by id **or by a different reference id whose content digest aliases the acceptance-manifest digest**.

Multiple `ACCEPTANCE_MANIFEST` references are invalid even if one of them has the expected digest. An operator may not choose evaluation authority after the Build Contract is frozen. Content-addressed identity, not merely reference naming, controls circular-lineage rejection.

No optional criterion, preference, compiler-only module, hidden test or later operator choice may become qualification law through G2A.

## 3. Canonicalization

Manifest digests are deterministic under the existing protocol canonicalization profile.

Binding order and automated fixture-reference order are normalized so non-semantic ordering changes do not mint a different acceptance law.

Changing module identity/version/digest, canonical config, fixture bindings, human instructions, criterion coverage, Challenge identity or contract version changes the manifest meaning and therefore its digest. Values outside the canonical protocol domain are rejected rather than being normalized into a misleading digest. `-0` is rejected because the protocol canonicalizer serializes it as `0` while JavaScript executors can distinguish the signed value.

## 4. Reuse rule

G2A reuses:

- the existing Stage-B Build Contract;
- existing `normative_references` rather than adding a second contract truth system;
- existing `terms_digest` to transitively freeze the acceptance-manifest digest;
- existing Stage-G mandatory-criterion law.

G2A does **not** change `computeQualification()` or `recordChallengeQualification()`.

Those remain G2B execution/result-persistence authority.

## 5. Acceptance matrix

| Case | Required result |
| --- | --- |
| every mandatory criterion bound exactly once | PASS |
| zero mandatory criteria + zero bindings | PASS |
| mandatory criterion missing | fail closed |
| optional criterion added | fail closed |
| hidden/post-hoc criterion added | fail closed |
| zero `ACCEPTANCE_MANIFEST` references | fail closed |
| multiple `ACCEPTANCE_MANIFEST` references | fail closed |
| selected reference id differs from unique frozen authority | fail closed |
| manifest digest differs from frozen normative reference | fail closed |
| automated config contains `Date`, `Map`, unsafe/non-integer number, signed `-0` or other non-canonical value | fail closed |
| automated fixture reference not frozen in Build Contract | fail closed |
| acceptance manifest references itself directly as fixture | fail closed |
| different fixture reference id aliases the acceptance-manifest content digest | fail closed |
| module/config semantics change | manifest digest changes |
| only binding/fixture ordering changes | canonical digest remains stable |
| human binding contains executor/config fields | fail closed |

## 6. Explicit exclusions

G2A does not authorize:

- running participant code;
- browser/API/security module execution;
- qualification mutation;
- hidden tests;
- LLM judging or scoring;
- organizer selection;
- receipt transport;
- settlement execution;
- production money;
- wallet custody/signing/broadcast;
- Stage H;
- merging the stacked PR chain.

## 7. Dependency / closure law

G1 closed at exact reviewed head:

`e2e24ee55a0e81294660055a6a6ed7094f61ddba`

Evidence:

- exact-head Inkubator Auth Foundation #534 PASS;
- exact-head CI #1612 PASS;
- original hostile review found one P1 product-runtime wiring defect;
- P1 repaired on the exact G1 head;
- one targeted Codex rereview on that exact head found no major issues;
- the P1 review thread is resolved.

G2A is stacked directly on that closure head.

G2A's single independent hostile review at `f7c752825509217bf45d1cc6b12a3d4a0250aa51` found two P1 authority defects:

1. cloneable non-JSON automated config values could preserve executor-visible semantics while collapsing under canonical hashing;
2. a differently named normative reference could alias the acceptance-manifest content digest and bypass id-only self-reference rejection.

Both were repaired with focused regression coverage and exact-head verification. The one policy-authorized targeted rereview at `1ae62e0166e4fe79a81ff4be36077b257c080eb3` then found one additional P1 within the config repair: JavaScript `-0` passed the safe-integer check and canonicalized to the same digest text as `0` while remaining executor-distinguishable. G2A now rejects signed negative zero and includes a focused regression.

The bounded review budget is consumed. After this targeted-rereview repair, run exact-head verification and close G2A if green; do not open a third review loop.

Bounded completion:

```text
IMPLEMENT G2A
→ TEST
→ ONE independent hostile review
→ fix Critical/High only
→ ONE targeted re-review only if required
→ fix any Critical/High found by that targeted rereview
→ REVERIFY EXACT HEAD
→ CLOSE G2A
→ MOVE TO G2B EXECUTION
```

**Merge authority: NONE.**

## 8. Current verdict

```text
G1 SYNCHRONIZED REVEAL + ARENA INPUT         CLOSED / PASS
G2A FROZEN ACCEPTANCE MANIFEST               ACTIVE / TARGETED-REREVIEW P1 REPAIRED / REVERIFY NEXT
G2B OBJECTIVE TEST EXECUTION                  SEQUENCED AFTER G2A
G3 COMPARISON / SELECTION / RECEIPT TRANSPORT SEQUENCED AFTER G2B
PRODUCTION MONEY                              NOT AUTHORIZED
MERGE AUTHORITY                               NONE
```
