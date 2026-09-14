# REKT INKUBATOR — FUNDED CHALLENGE MECHANISM V1

**Status:** USER-AUTHORIZED MECHANISM LOCK / PLANNING AUTHORITY ONLY  
**Date:** 2026-09-13  
**Branch:** `plan/inkubator-challenge-os-v1`  
**Implementation authority:** NONE  
**Merge authority:** NONE

This document freezes the reviewed V1 competition mechanism for the funded Challenge product.

Where this document conflicts with lifecycle or mechanism candidates in `FUNDED_CHALLENGE_PRODUCT_LOCK_V1.md`, **this document wins**. The product-lock document remains authority for product purpose, positioning, ownership direction, visual direction, business model direction and deferred scope.

No production-money deployment is authorized by this document.

---

## 1. Product mechanism in one line

> An organizer funds a clearly bounded build Challenge, a small sealed group of builders take seats, everybody receives the same build window, immutable submissions are judged against frozen acceptance criteria, the organizer chooses among qualifying results, settlement happens deterministically, and a durable receipt records the outcome.

Public shorthand remains:

`POST → FUND → BUILD → SUBMIT → PICK → PAY → RECEIPT`

---

## 2. Hard invariants

The V1 implementation must preserve all of these.

1. **Challenge terms freeze before builder entry opens.**
2. **Prize funding is proven before a funded Challenge opens.**
3. **Builder identities are sealed from competing builders during entry/build.**
4. **One verified human may occupy at most one seat in a Challenge.** Pilot enforcement may be curated/manual.
5. **All activated builders receive the same official build start and submission deadline.**
6. **No organizer unilateral cancellation after activation.**
7. **The organizer cannot add requirements after terms freeze.** Ambiguity may not be interpreted more strictly against a builder after the fact.
8. **The final submission is an immutable artifact snapshot, not merely a mutable URL or branch name.**
9. **Qualification and winner selection are separate decisions.**
10. **Only a qualifying submission can win.**
11. **The platform/resolver never chooses subjective taste between multiple qualifying submissions.**
12. **Silence cannot lock builder work or prize funds indefinitely.**
13. **Losing work remains the builder's property.**
14. **Winning bespoke economic-rights transfer is triggered only after successful payout under the agreed terms.**
15. **Default-distribution outcomes do not create a winner and do not transfer loser IP.**
16. **Economic state cannot depend on GitHub availability, frontend availability, verifier availability, or a mutable Project/Mission state.**
17. **Every business mutation is idempotent and leaves a durable history event.**
18. **Application servers do not hold unilateral keys capable of redirecting production prize funds.**

---

## 3. Canonical lifecycle

```text
DRAFT
  ↓
AWAITING_FUNDING
  ↓
FUNDED
  ↓
ENTRY_OPEN              ← terms frozen; prize locked; entrants sealed
  ↓ entry deadline
  ├─ below activation minimum
  │      ↓
  │  NOT_ACTIVATED
  │      ↓
  │  REFUNDED_PRE_BUILD
  │
  └─ activation minimum met
         ↓
      BUILDING          ← synchronized start
         ↓ submission deadline
  SUBMISSIONS_LOCKED    ← latest valid immutable snapshot per entry
         ↓
    QUALIFICATION
         ↓
    APPEAL_WINDOW
         ↓
  FINAL_QUALIFIERS
         ↓
      SELECTION
      /       \
 organizer     review deadline expires
 chooses          ↓
    │       DEFAULT_RESOLUTION
    │            │
    └─────┬──────┘
          ↓
  SETTLEMENT_PENDING
          ↓
        SETTLED
          ↓
     RECEIPT_FILED
```

Exceptional terminal outcomes:

- `REFUNDED_PRE_BUILD`
- `REFUNDED_NO_QUALIFIER`
- `DEFAULT_DISTRIBUTED`
- `CANCELLED_BY_RESOLUTION`
- `RECEIPT_FILED`

User-facing labels may be simpler; protocol states remain explicit.

---

## 4. Terms freeze and activation

### Funding

Funding proves the prize exists. Funding alone does not mean builders have started work.

### Entry opening

When `ENTRY_OPEN` begins, the following are immutable for V1:

- title / brief;
- `DONE WHEN` criteria;
- prize amount and settlement asset;
- slot limit;
- activation minimum;
- entry deadline;
- synchronized build start;
- submission deadline;
- review/appeal windows;
- IP terms version;
- settlement policy version.

A canonical terms record is hashed using the existing Inkubator canonical JSON/digest machinery. The committed digest is included in submissions, qualification evidence, settlement records and final receipts.

V1 does **not** support ordinary post-freeze amendments. A materially broken brief enters a bounded resolution path instead of silently creating `v2` terms after builders relied on `v1`.

### Activation

A funded Challenge activates only if its configured minimum number of real builders still occupy seats at the entry deadline.

Pilot policy candidate:

- default slot limit: `4`;
- allowed pilot slot range: `3–6`;
- default activation minimum: `2`;
- default minimum prize: `500 USDC`.

These are configurable product-policy defaults, not protocol laws.

If activation minimum is not met, no official build starts, the prize is refunded, and the platform fee is refunded under the current business-policy direction.

---

## 5. Entry / seat semantics

A builder may take one seat per Challenge while entry is open.

Candidate entry states:

- `SEATED`
- `WITHDRAWN_PRE_BUILD`
- `ACTIVE`
- `SUBMITTED`
- `INVALID_SUBMISSION`
- `ABANDONED`

During `ENTRY_OPEN`, a builder may leave and reopen the seat. Repeated seat reservation/withdrawal may affect admission to later Challenges, but V1 should expose factual history rather than a hidden reputation score.

When the Challenge activates, every remaining seat becomes `ACTIVE` at the same official start time.

After activation there is no semantic `withdraw`; a builder may stop, but an active entry with no valid submission at deadline becomes `ABANDONED`.

### Sealed competition

Before submissions lock, competing builders may see:

- slot capacity;
- number of seats occupied;
- prize;
- deadlines;
- Challenge rules;
- their own state.

They must not receive competitor identity, source, submission contents or exact progress state from the API.

This is a server-side privacy rule, not merely a UI hiding rule.

---

## 6. DONE WHEN and eligibility

There are two layers.

### Global submission eligibility

A submission must first satisfy platform-level safety/inspectability rules, for example:

- required artifact/evidence fields exist;
- artifact is inspectable under the Challenge rules;
- submission does not intentionally contain malicious behavior;
- builder represents that they have authority to submit the work;
- required third-party/OSS licenses are disclosed;
- evidence is not intentionally falsified.

### Challenge qualification

Then every mandatory frozen `DONE WHEN` criterion is evaluated independently.

Criterion result:

- `PASS`
- `FAIL`
- `DISPUTED`

Overall result:

- `QUALIFIED`
- `NOT_QUALIFIED`
- `DISPUTED`

No universal weighted score or opaque AI score is authoritative in V1.

AI may assist drafting criteria, flag ambiguity, summarize evidence or run deterministic tools, but may not become an unexplained final qualification oracle.

---

## 7. Submission freeze

A valid submission is a versioned immutable manifest.

Minimum direction:

```text
challenge_id
entry_id
terms_digest
submission_version
repository_id? / source reference
commit_sha or equivalent immutable source reference
artifact_digest
archive_reference? / immutable snapshot reference
live_url?
demo_url?
evidence references
submitted_at
```

Builders may submit/update repeatedly before the deadline. The latest valid immutable snapshot received before the authoritative deadline becomes `FINAL_FOR_REVIEW`.

A mutable `main` branch or live URL alone is never sufficient to define what was submitted.

Production real-money launch requires durable snapshot retention sufficient to evaluate a submission even if the GitHub repository or live deployment later changes or disappears.

---

## 8. Qualification, appeal and selection

### Organizer qualification

The organizer performs first-pass criterion-by-criterion qualification against the frozen terms.

Each failure requires a criterion, reason and evidence reference.

### Builder appeal

A builder may appeal a concrete qualification error during a bounded appeal window.

Appeals are limited to frozen rule/evidence errors. `I worked hard`, subjective preference or new requirements are not appeal grounds.

### Resolver

A resolver may determine:

- whether a frozen criterion was met;
- whether evidence is valid;
- whether a platform/dependency failure invalidated a claimed failure;
- whether fraud/rule breach occurred;
- whether an exceptional cancellation path is justified;
- whether settlement evidence matches the authorized result.

A resolver may **not**:

- add requirements;
- change terms;
- prefer one qualifying design over another;
- award a subjective winner among multiple qualifiers.

Normal dispute budget:

`ORGANIZER DECISION → ONE BUILDER APPEAL → ONE INDEPENDENT RESOLVER DECISION → FINAL`

No recursive review loop.

### Selection

After qualification is final, the organizer may select exactly one qualifying submission.

Selection is final except for narrowly defined fraud/protocol-resolution authority.

---

## 9. Organizer ghosting / deterministic default

A bounded review deadline is mandatory.

If the organizer fails to select by that deadline:

- `0` qualifiers → prize refund;
- `1` qualifier → full prize to that qualifying builder;
- `2+` qualifiers → prize split equally among final qualifying builders.

For `2+` qualifier default distribution:

- no subjective winner is declared;
- no customer IP transfer is triggered;
- receipt outcome is `DEFAULT_DISTRIBUTION`.

The purpose is to prevent organizer silence from becoming a free indefinite option on completed work.

---

## 10. Cancellation and failure matrix

### Before entry opens

Organizer may cancel; no builder reliance exists.

### Entry open, before activation

Organizer cannot silently change terms. Cancellation follows the published pre-build policy and refunds the prize/fee if no build is activated.

### After activation

Unilateral organizer cancellation is forbidden.

Exceptional cancellation requires a recorded resolution reason and explicit settlement disposition.

### All builders abandon / no valid submissions

At deadline this becomes a no-qualifier path. Prize is refunded to organizer under current policy; platform fee may remain earned after activation.

### Submissions exist but none qualify

After appeal window, prize is refunded; losing builders keep their work.

### Organizer-supplied dependency fails

A declared organizer/platform dependency that is materially unavailable cannot automatically become evidence of builder failure. Challenge may require bounded extension/resolution.

### Verifier unavailable

Verifier unavailability is never an automatic builder failure. Evaluation falls back to admissible evidence/human review or waits within the bounded resolution policy.

---

## 11. IP / ownership trigger

Default product rule remains:

- while building: builder owns work;
- submitted but not paid: builder owns work;
- losing submission: builder owns work;
- winner selected but unpaid: builder still owns work;
- successful winner payout: agreed transferable economic rights in the bespoke winning deliverable transfer according to the accepted terms;
- pre-existing, OSS and third-party components remain governed by their existing ownership/licenses;
- default distribution has no winner and does not transfer losing source/IP.

Source disclosure must be minimized. Public/live evidence should be enough where possible; source inspection requirements must be disclosed in frozen terms before entry.

Exact legal terms require Swedish/EU and cross-border legal review before public real-money launch.

---

## 12. Payment/business-policy direction

Initial policy direction:

- one settlement chain/asset in V1;
- builders pay `0%` platform fee;
- winner receives `100%` of the displayed prize;
- organizer pays target `~8%` platform fee, configurable;
- proposed minimum platform fee: `40 USDC`;
- platform fee refunded if Challenge never activates;
- platform fee may be earned once a real build competition activates even if no submission later qualifies;
- gas/rail costs are explicit and separate.

Prize liability and platform revenue must remain separately accounted.

Production settlement remains blocked behind security and legal gates.

---

## 13. Anti-abuse / Sybil policy

The pilot does not attempt to solve global proof-of-personhood cryptographically.

Pilot admission may require:

- approved human account;
- stable GitHub identity;
- bound payout wallet before build start;
- one human / one seat / Challenge;
- maximum one active Challenge for unproven builders;
- factual history of seated/submitted/qualified/won/abandoned behavior.

Do not create a single opaque reputation score in V1.

---

## 14. Separation from legacy Inkubator concepts

Marketplace authority belongs to `Challenge`, not `Mission`, `Round`, `World`, `Project` or `Ship` state.

Existing concepts remain useful substrate:

- `Player` → identity;
- `Project` → builder workspace / connected repository;
- `Ship` → artifact/evidence primitive;
- `HistoryEvent` → durable timeline;
- `OutboxJob` → durable asynchronous work;
- GitHub integration → source observation and immutable snapshot acquisition;
- verifier → bounded evidence observation.

Legacy social/game concepts are parked and may not influence the launch state machine.

---

## 15. V1 mechanism acceptance tests

The mechanism is not implemented correctly unless tests prove at least:

1. Terms cannot mutate after `ENTRY_OPEN`.
2. No Challenge activates below its minimum builder count.
3. All activated entries share the same build start/deadline.
4. Concurrent join attempts never exceed slot capacity.
5. One builder cannot occupy two seats in one Challenge.
6. Sealed competitor data is never returned before reveal.
7. A submission after deadline cannot become final.
8. A mutable URL/branch cannot replace the immutable final snapshot.
9. A non-qualifying submission cannot be selected.
10. Organizer cannot add criteria during qualification.
11. A resolver cannot select subjective winner preference.
12. A timed-out organizer reaches deterministic default settlement.
13. A default split produces no winner/IP transfer.
14. Settlement retries are idempotent.
15. Receipt can only be filed from a terminal settlement fact.
16. IP transfer status cannot become `TRANSFER_TRIGGERED` before successful winner payout.
17. GitHub/verifier outage cannot silently mutate economic state.
18. Duplicate/replayed webhook/API requests cannot duplicate business actions.

---

## 16. Final mechanism lock

```text
TERMS FREEZE        BEFORE ENTRY
PRIZE               FUNDED BEFORE ENTRY
ENTRY               SMALL / BOUNDED / SEALED
BUILD START         SYNCHRONIZED
SUBMISSION          VERSIONED + IMMUTABLE
QUALIFICATION       OBJECTIVE DONE-WHEN
APPEAL              ONE NARROW APPEAL
SELECTION           ORGANIZER TASTE AMONG QUALIFIERS
REVIEW DEADLINE     HARD / BOUNDED
GHOST FALLBACK      DETERMINISTIC
IP TRANSFER         AFTER SUCCESSFUL WINNER PAYOUT ONLY
RECEIPT             DURABLE TERMINAL FACT
```

This mechanism is the V1 planning authority until explicitly superseded by a later user-authorized version.