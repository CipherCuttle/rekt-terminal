# REKT INKUBATOR — STAGE G REVEAL / TEST ARENA / RECEIPTS V1

**Status:** USER-AUTHORIZED STAGE-G IMPLEMENTATION CONTRACT / G1 ACTIVE  
**Date:** 2026-09-15  
**Base:** `61978e6423ccd388e77a940b0beabd79a7bd9dba` (`agent/stage-f3b-github-r2-capture-v1`)  
**Parent authorities:** `REKT_INKUBATOR_NORTH_STAR_V2.md`, `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`, `STAGE_F3_ARCHIVE_EVIDENCE_CLOSURE_V1.md`

## 0. Objective

Stage G turns sealed immutable Stage-F submissions into a fair, inspectable competition result without inventing a second qualification or receipt authority.

Target lifecycle:

```text
SEALED IMMUTABLE SUBMISSIONS
  → SYNCHRONIZED REVEAL
  → FROZEN TEST MATRIX
  → OBJECTIVE QUALIFICATION
  → SUBJECTIVE SELECTION AMONG QUALIFIERS
  → DURABLE RECEIPT
```

The protocol remains authority for final-submission selection, qualification, selection and receipt semantics. PostgreSQL remains durable product-workflow authority. Stage G exposes and composes those authorities; it does not replace them.

## 1. Permanent Stage-G invariants

1. **No competitor work leaks before the durable reveal cutline.** Reveal is sealed while the Challenge is before `SUBMISSIONS_LOCKED`.
2. **Reveal is simultaneous.** A read cannot reveal one entrant early because of wall-clock inference, archive timing, request ordering or organizer preference.
3. **GET is pure.** Reveal/Test Arena reads never advance Challenge state, finalize a submission, record qualification or mutate evidence.
4. **Final work is immutable.** Reveal derives the canonical final submission using existing Stage-B protocol law over accepted immutable manifests.
5. **No hidden acceptance requirements.** The Test Arena criterion matrix is derived only from mandatory criteria in the frozen Build Contract: Outcome Contract, Production Envelope, Delivery Contract and normative constraints.
6. **Qualification and taste remain separate.** Objective qualification may only use frozen mandatory criteria. Organizer preferences may rank/select only among final qualifiers.
7. **Private evidence remains private.** Public/product reveal projections never expose private archive object references, raw private source, repository credentials, installation credentials or secret evidence bodies.
8. **Archive truth never rewrites acceptance truth.** `PENDING`, `PLATFORM_UNAVAILABLE`, builder-caused unavailability or unsupported capture remain evidence facts; they do not mutate the accepted manifest.
9. **Receipts remain append-only.** Existing protocol receipt and correction semantics remain canonical. Stage G does not create a mutable result record.
10. **No production-money authority.** Stage G may exercise synthetic/test settlement lifecycle already defined by protocol law, but does not authorize real funds, wallet custody, signing, broadcasting or vault execution.

## 2. Reuse rule

Stage G MUST reuse:

- `selectFinalSubmission()` for canonical final-manifest choice;
- `computeQualification()` for objective frozen-criterion qualification;
- `validateSelection()` for organizer selection among qualifiers;
- `fileReceipt()` / `appendReceiptCorrection()` for durable result semantics;
- Stage-C `challenge_submissions`, `challenge_qualifications`, `challenge_decisions`, `challenge_receipts` persistence;
- Stage-F `challenge_submission_archives` evidence state;
- existing session authentication;
- existing worker/outbox/verifier substrate when later execution genuinely needs it;
- `apps/inkubator-lab` as the only Inkubator frontend root.

Do not create a second evaluator state machine, receipt store, submission-finality system, hidden test registry, participant runtime or frontend root.

## 3. G1 — synchronized reveal + Test Arena input projection

G1 is the current authorized implementation slice.

It adds a read-only organizer Test Arena projection after the durable reveal cutline.

Canonical product route:

`GET /v1/challenges/:challengeId/reveal-arena`

### G1 access and cutline law

- session authentication is required;
- only the Challenge organizer may read the organizer reveal arena in G1;
- before durable status `SUBMISSIONS_LOCKED`, the route fails closed with `challenge_reveal_sealed` and exposes no competitor submission facts;
- `SUBMISSIONS_LOCKED` and every later Challenge state are revealable;
- the read never advances a due Challenge merely because its wall-clock submission deadline has elapsed.

### G1 reveal projection

The projection contains:

- Challenge id, frozen contract version and `terms_digest`;
- explicit `REVEALED` state;
- the exact frozen mandatory criterion matrix, with criterion id, description and source group;
- at most one canonical final immutable submission per entry, derived by `selectFinalSubmission()`;
- safe final-manifest facts: entry id, submission id/version, accepted timestamp, immutable source reference, artifact digest and optional live URL;
- safe archive observation facts: status, archive digest, reason code and observation time when available.

The projection MUST NOT contain:

- `archive_reference` / private object-storage location;
- raw archived source or private evidence body;
- GitHub repository/installation identity;
- competitor Project/Mission internals;
- payout identities;
- non-final/superseded submission manifests;
- hidden or non-mandatory criteria presented as qualification requirements.

Ordering is deterministic and repeated reads over unchanged durable state are stable.

### G1 acceptance matrix

| Case | Required result |
| --- | --- |
| unauthenticated request | `401 authentication_required` |
| authenticated non-organizer | `403 challenge_organizer_required`; no competitor facts |
| organizer before `SUBMISSIONS_LOCKED` | `409 challenge_reveal_sealed`; no competitor facts |
| organizer at/after `SUBMISSIONS_LOCKED` | one simultaneous deterministic reveal projection |
| multiple eligible versions for an entry | only protocol-selected final manifest appears |
| no eligible submission for an entry | no fabricated submission is produced |
| frozen optional/non-mandatory criterion | omitted from objective qualification matrix |
| captured private archive | safe digest/status may appear; private archive reference never appears |
| repeated unchanged GET | identical semantic projection; zero writes |

## 4. G2 — objective Test Arena execution/result persistence

G2 is sequenced after G1 closure and is **not implemented by G1 authority**.

G2 may add reusable versioned acceptance modules and normalized fixtures/viewports/scenarios only where their exact meaning is already frozen by the Build Contract or a content-addressed normative reference. It must feed existing `recordChallengeQualification()` / `computeQualification()` law rather than inventing a score.

Any criterion that cannot be honestly automated remains a declared human observation path; automation may not fabricate certainty.

## 5. G3 — organizer comparison / selection / durable receipt transport

G3 is sequenced after G2 closure and is **not implemented by G1 authority**.

G3 may expose side-by-side qualifier comparison and organizer preference/taste selection only after objective qualification. It must reuse existing selection, settlement-intent, finalized-fact and receipt law. Receipt presentation may expose only purpose-justified public fields and append-only corrections.

## 6. Explicit exclusions

G1 does not authorize:

- automated qualification mutation;
- secret tests or post-hoc DONE WHEN requirements;
- appeal/resolver UX expansion;
- winner selection mutation;
- settlement execution;
- production money or real prize custody;
- wallet signing/broadcast;
- Challenge Vault work;
- public raw private-source retrieval;
- archive retention/DSAR/deletion infrastructure;
- broad Mission/World/social migration;
- model/provider inference;
- Stage-H trust hardening implementation;
- merging any stacked PR.

## 7. Dependency and merge law

Stage G1 is stacked on the closed Stage-F3B exact head.

Current dependency order remains:

`#97 → #98 → #100 → #101 → #102 → Stage-G PR`

Development and verification may proceed while those PRs remain unmerged. No PR may be merged out of order without explicit user merge authority.

**Merge authority: NONE.**

## 8. Bounded completion policy

```text
IMPLEMENT G1
→ TEST
→ ONE independent hostile review
→ fix Critical/High only
→ ONE targeted re-review only if Critical/High fixes were required
→ CLOSE G1
→ MOVE TO G2
```

Medium/Low findings do not restart G1 unless they invalidate the reveal cutline, frozen-criterion authority, privacy boundary, deterministic finality, evidence truth separation or product trust.

## 9. Current verdict

```text
STAGE F                                      CLOSED / PASS / UNMERGED STACK
STAGE G                                      USER-AUTHORIZED / ACTIVE
G1 SYNCHRONIZED REVEAL + ARENA INPUT         AUTHORIZED / CURRENT
G2 OBJECTIVE TEST EXECUTION                   SEQUENCED AFTER G1
G3 COMPARISON / SELECTION / RECEIPT TRANSPORT SEQUENCED AFTER G2
STAGE H TRUST HARDENING                       NOT AUTHORIZED BY G1
PRODUCTION MONEY                              NOT AUTHORIZED
MERGE AUTHORITY                               NONE
```
