# REKT INKUBATOR — STAGE F BUILDER CAPSULE V1

**Status:** USER-AUTHORIZED STAGE-F IMPLEMENTATION CONTRACT / STACKED ON STAGE-E CLOSURE  
**Date:** 2026-09-14  
**Base:** `0a115bb806eef82eb6ab5816c2d1598bf08d63ec` (`agent/stage-e-closure-v1`)  
**Parent authorities:** `REKT_INKUBATOR_NORTH_STAR_V2.md`, `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`, `THIRD_PARTY_SUBSTRATE_LOCK_V1.md`

## 0. Objective

Stage F turns the frozen Challenge / Build Contract into a portable builder-native capsule and then connects the already-defined immutable submission law to builder tooling.

Stage-F target:

`FROZEN BUILD CONTRACT → BUILDER CAPSULE → LOCAL CHECKS → IMMUTABLE SUBMISSION`

This stage does **not** authorize funding, settlement, reveal, qualification, winner selection, production money, wallet custody/signing/broadcast, or Stage-G Test Arena mechanics.

Because Stage-E PR #97 is intentionally not merged without explicit merge authority, this Stage-F branch is stacked on the exact Stage-E closure head. Stage-F work may be developed and verified here, but it must not be merged ahead of its Stage-E dependency.

## 1. Reuse rule

Stage F evolves the existing:

- `packages/cli`;
- `packages/sdk`;
- `packages/mcp`;
- scoped DevKit bearer credential path;
- Stage-B `SubmissionManifest` law;
- Stage-C Challenge entry/submission persistence.

Do not create a second Challenge CLI, SDK, token system, submission store, or project-management state machine.

The historical Mission/Project DevKit commands remain compatibility behavior until a separate bounded migration explicitly replaces them.

## 2. F1 — read-only Builder Capsule

The first bounded slice is read-only.

An authenticated builder with an entry in a frozen Challenge may fetch a Builder Capsule. The capsule contains only builder-safe Challenge truth:

```text
CHALLENGE.md
contract.json
acceptance/manifest.json
references/manifest.json
```

The canonical authority is always `contract.json` + its frozen `terms_digest`. `CHALLENGE.md` and the two manifests are deterministic derived projections for human/tool ergonomics.

The capsule MUST NOT expose:

- competitor entries or work;
- payout identities;
- private organizer/funder data;
- qualification/selection results that are not yet public;
- historical Mission/Project state as Challenge truth;
- fake check results.

### F1 access law

- DevKit bearer authentication is required.
- Existing `project:read` is the compatibility read scope for F1; no new auth authority is invented in this slice.
- The credential Player must own an entry for the requested Challenge.
- The Challenge must have a canonical frozen Build Contract.
- Read access remains durable after submission/deadline so builders can inspect what they built against.
- Access never implies funding, qualification, or winner status.

### F1 local layout

`rekt challenge pull <challenge-id>` writes under `.rekt/challenge/` by default so it does not overwrite project files.

`rekt challenge status` reads the local capsule metadata only.

`rekt challenge check` verifies local consistency by requiring:

1. every capsule file to match its declared SHA-256;
2. `contract.json` to be a valid frozen Stage-B Build Contract;
3. Challenge id, contract version, `terms_digest`, and submission deadline metadata to match that frozen contract;
4. `CHALLENGE.md`, `acceptance/manifest.json`, and `references/manifest.json` to reproduce the deterministic views implied by the frozen contract rather than trusting mutable local metadata hashes alone;
5. the exact expected file set, media types, safe relative paths, and non-symlinked capsule paths.

The command reports **`LOCAL CONSISTENCY PASS`**. It does not claim remote authenticity, cryptographic signing of the entire local directory, or that the implementation passes Challenge acceptance criteria. A purely offline local directory cannot provide remote authenticity against an actor deliberately rewriting every local artifact without an additional signature or server check; F1 does not invent that authority. Executable acceptance modules are added only when their exact version/configuration is frozen and implemented.

The existing top-level `rekt status` keeps its historical Mission meaning in F1. Any Challenge-first alias/migration is a separate bounded decision.

## 3. F2 — immutable submission

After F1 is green, Stage F may expose builder submission over the existing Stage-B/C law.

Target command:

`rekt challenge submit`

The server, not the client, remains authority for acceptance time and deadline evaluation.

Submission MUST reuse:

- `SubmissionManifest`;
- `acceptChallengeSubmission()`;
- database clock deadline enforcement;
- request-id idempotency;
- immutable `(entry_id, submission_version)` conflict behavior;
- frozen `terms_digest` lineage;
- existing optional Ship lineage only when compatible.

A client may propose source/artifact/evidence references. It may not choose `accepted_at`, rewrite Challenge state, bypass the frozen digest, or self-declare qualification.

## 4. F3 — asynchronous archive/evidence capture

Archive/evidence capture is asynchronous and fail-closed under Survivor V1.1 rules.

Submission acceptance and archive observation remain distinct facts. A later worker failure must not silently mutate the accepted manifest; it records archive/evidence availability state through the existing protocol semantics.

## 5. Portable capsule semantics

Builder Capsule is intentionally agent/tool neutral.

Optional future Spec Kit export may be generated from the capsule, but Spec Kit is not authority and is not required for F1.

Builders may use Codex, Claude Code, Cursor, RooCode, Grok, Gemini, manual tools or any other compatible environment. Inkubator owns the frozen contract and evidence semantics, not the builder IDE/runtime.

## 6. F1 acceptance matrix

F1 closes only when all are true:

1. builder-owned entry can fetch a frozen capsule through scoped DevKit auth;
2. non-entry Player is denied without leaking private builder data;
3. unfrozen Challenge fails closed;
4. capsule `contract.json` validates as the exact frozen Build Contract and matches Challenge/contract/digest/deadline lineage;
5. derived file hashes are deterministic and derived views are checked against the frozen contract, not merely mutable local hash metadata;
6. `rekt challenge pull` writes only the exact safe relative capsule paths under the selected output root and refuses path traversal, duplicate paths, and symlink traversal;
7. malformed server capsule data is fully rejected before local capsule writes begin;
8. `rekt challenge status` requires no network mutation;
9. `rekt challenge check` detects ordinary file tampering, coordinated helper+metadata-hash tampering, and contract/digest mismatch while making only a local-consistency claim;
10. legacy top-level DevKit commands still behave as before;
11. canonical CI, Inkubator Auth/Foundation integration, and DevKit tests are green on the exact F1 head;
12. one independent hostile F1 closure review completes under the bounded review policy.

## 7. Explicit non-goals

F1 does not add:

- funding mutation;
- production money;
- `DRAFT → AWAITING_FUNDING`;
- seat acquisition UI;
- submission mutation;
- archive workers;
- reveal/Test Arena;
- qualification/selection;
- receipt read transport;
- Spec Kit dependency;
- new model/provider inference;
- remote signing/authenticity for the offline capsule directory.

## 8. Bounded completion

```text
IMPLEMENT F1
→ TEST
→ ONE independent hostile review at F1 closure
→ fix Critical/High
→ ONE targeted re-review only if required
→ INTEGRATE ONLY AFTER STAGE-E DEPENDENCY IS MERGED/AUTHORIZED
→ MOVE TO F2
```

No review loop.

## 9. Current verdict

```text
STAGE E                                      CLOSED / PASS / UNMERGED DEPENDENCY
STAGE F                                      AUTHORIZED / IN PROGRESS
F1 BUILDER CAPSULE                           IMPLEMENTED / EXACT-HEAD GATES PASS / INDEPENDENT REVIEW PENDING
F2 IMMUTABLE SUBMISSION                      SEQUENCED AFTER F1
F3 ARCHIVE / EVIDENCE CAPTURE                SEQUENCED AFTER F2
STAGE G                                      NOT AUTHORIZED
PRODUCTION MONEY                             NOT AUTHORIZED
MERGE AUTHORITY                              NONE
```
