# REKT INKUBATOR — STAGE B BUILD-CONTRACT PROTOCOL V1

**Status:** USER-AUTHORIZED PLANNING CONTRACT / NO IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-13  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`  
**Mechanism authority:** `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` + compatible `FUNDED_CHALLENGE_MECHANISM_V1.md`

This document closes Stage-B planning gate B-GATE-1..3: canonical nouns, lifecycle/invariants, and version/digest law for the pure protocol implementation.

It does not authorize database, frontend, model, chain, settlement-contract, or production-money work.

## 1. Stage-B purpose

Implement one pure deterministic protocol that can represent the complete funded Challenge lifecycle without depending on:

- PostgreSQL;
- HTTP/Fastify;
- GitHub;
- wall-clock reads;
- frontend state;
- LLM/model output;
- chain RPC;
- mutable Mission/Project/Ship state.

The intended code home is the existing:

```text
packages/inkubator-protocol/
```

Stage B extends that package additively.

## 2. Canonical Stage-B nouns

### Challenge

Stable identity and lifecycle container for one competition.

### BuildContract

Organizer-accepted, versioned contract frozen before `ENTRY_OPEN`.

The Build Contract contains five separated layers:

1. **OutcomeContract** — qualifying observable results.
2. **ProductionEnvelope** — declared operating assumptions/quality scenarios.
3. **DeliveryContract** — required handoff/delivery facts.
4. **Preferences** — organizer taste; never qualifying by itself.
5. **ReferenceArchitecture** — advisory implementation guidance unless an item is explicitly promoted to a normative compatibility/safety constraint before freeze.

### NormativeReference

Frozen/content-addressed input whose content may affect qualification: fixture, design reference, acceptance example, evaluator/test-harness version, reference file, or other authoritative artifact.

Mutable URLs may be informational but cannot be normative unless the referenced content itself is snapshotted/content-addressed.

### ChallengeEntry

Binding between one Challenge and one eligible builder identity. Existing Player/Project/Mission links belong to later integration and are not Challenge truth.

### SubmissionManifest

Immutable accepted description of one submission version. Submission acceptance is independent of asynchronous archive/snapshot completion.

### Qualification

Criterion-by-criterion decision against the frozen Outcome/Delivery/Envelope contract only.

### PolicyResolution

Separate platform safety/legal/fraud/moderation decision. It is not a hidden second Done When contract and cannot be used by the organizer to invent product requirements after freeze.

### Selection

Organizer preference among final qualifying entries only.

### SettlementIntent

Product-level statement of the authorized payout/refund/default result. It is not evidence that money moved.

### SettlementExecutionFact

Externally supplied immutable fact indicating whether the authorized settlement actually finalized under the active settlement policy. Stage B treats this as input; it does not talk to a chain.

### Receipt

Append-only durable terminal record created only after a valid terminal outcome. Corrections create successor records; originals are never overwritten.

## 3. BuildContract shape

Conceptual protocol shape; exact JSON Schema field names may vary only if semantics remain identical.

```text
BuildContract {
  schema_version
  challenge_id
  contract_version

  mechanism_version
  settlement_policy_version
  ip_terms_version

  title
  brief

  outcome_contract
  production_envelope
  delivery_contract
  preferences
  reference_architecture
  normative_constraints[]
  normative_references[]

  slot_limit
  activation_minimum
  entry_deadline
  build_start
  submission_deadline
  review_deadline
  appeal_window

  prize_display
  settlement_asset

  terms_digest
}
```

### Normative constraints vs reference architecture

A recommended tool/stack does not become qualifying merely because the compiler proposed it.

Example:

```text
ReferenceArchitecture:
  React + Vite + viem
```

is advisory.

But:

```text
NormativeConstraint:
  Must expose an OpenAPI-compatible endpoint because existing consumer X requires it.
```

may be qualifying because compatibility truly depends on it and the organizer accepted it before freeze.

## 4. Known / Assumed / Unknown

The Build Contract may carry explicit planning knowledge:

```text
KNOWN
ASSUMED
UNKNOWN
```

Rules:

- `KNOWN` facts are supported by organizer input/frozen evidence.
- `ASSUMED` facts are visible defaults the organizer explicitly accepts before freeze.
- `UNKNOWN` facts remain visible uncertainty and may block compilation if material.
- material unknowns may force `NEEDS_DECISION`, `NEEDS_NARROWING`, or `UNSUPPORTED` before a Challenge can reach `ENTRY_OPEN`.
- no hidden model confidence score is authoritative.

Stage B does not implement the compiler, but preserves these fields so later compiler output has a canonical destination.

## 5. Challenge lifecycle

Canonical V1 protocol states:

```text
DRAFT
  ↓
AWAITING_FUNDING
  ↓
FUNDED
  ↓
ENTRY_OPEN
  ↓ entry deadline
  ├─ below activation minimum
  │      ↓
  │  NOT_ACTIVATED
  │      ↓
  │  REFUNDED_PRE_BUILD
  │
  └─ activation minimum met
         ↓
      BUILDING
         ↓ submission deadline
  SUBMISSIONS_LOCKED
         ↓
    QUALIFICATION
         ↓
    APPEAL_WINDOW
         ↓
  FINAL_QUALIFIERS
         ↓
      SELECTION
      /       \
 organizer    review deadline
 selects      expires
    │            ↓
    │     DEFAULT_RESOLUTION
    └──────┬─────┘
           ↓
  SETTLEMENT_PENDING
           ↓
        SETTLED
           ↓
     RECEIPT_FILED
```

Exceptional/terminal outcomes:

```text
REFUNDED_PRE_BUILD
REFUNDED_NO_QUALIFIER
DEFAULT_DISTRIBUTED
CANCELLED_BY_RESOLUTION
RECEIPT_FILED
```

A user-facing UI may collapse states, but protocol semantics remain explicit.

## 6. Transition authority table

### DRAFT → AWAITING_FUNDING

Authority: organizer/product command.

Requires:

- syntactically valid Build Contract draft;
- no unresolved material compiler blockers if compiler-generated;
- supported mechanism/policy versions.

### AWAITING_FUNDING → FUNDED

Authority: product command consuming a funding fact from the configured settlement adapter.

Requires:

- expected supported asset/amount matches the frozen candidate;
- funding fact references the correct Challenge/contract commitment.

Stage B models the fact but does not implement custody.

### FUNDED → ENTRY_OPEN

Authority: organizer/product command.

Requires:

- Build Contract accepted/frozen;
- `terms_digest` computed;
- all normative references frozen/content-addressed;
- funding fact valid for funded Challenge type;
- entry/build/submission/review/appeal times valid and ordered;
- slot/activation configuration valid.

Effect:

- ordinary contract mutation becomes illegal.

### ENTRY_OPEN → NOT_ACTIVATED

Authority: due-state command using authoritative timestamp input.

Requires:

- `now >= entry_deadline`;
- active valid seats `< activation_minimum`.

### NOT_ACTIVATED → REFUNDED_PRE_BUILD

Authority: settlement command consuming finalized refund evidence under the configured settlement mode/policy.

No build/IP-transfer fact is created.

### ENTRY_OPEN → BUILDING

Authority: due-state command using authoritative timestamp input.

Requires:

- `now >= entry_deadline`;
- valid seats `>= activation_minimum`.

Effects:

- all remaining valid seats become active at one canonical `build_start`;
- all active entries share one `submission_deadline`.

### BUILDING → SUBMISSIONS_LOCKED

Authority: due-state command.

Requires:

- `now >= submission_deadline`.

Effects:

- each entry's latest valid accepted-before-deadline SubmissionManifest becomes final for review;
- active entry without a valid final manifest becomes abandoned/no-valid-submission.

### SUBMISSIONS_LOCKED → QUALIFICATION

Authority: product workflow command.

Qualification input is frozen contract + accepted immutable submission/evidence facts only.

### QUALIFICATION → APPEAL_WINDOW

Authority: workflow command after first-pass criterion results exist for all reviewable entries.

### APPEAL_WINDOW → FINAL_QUALIFIERS

Authority: due-state/resolution command after appeal deadline and all admitted appeals resolve within the bounded appeal policy.

Final qualifier set is immutable after this transition except a separately modeled exceptional fraud/protocol resolution path that appends history and cannot silently rewrite prior evaluator facts.

### FINAL_QUALIFIERS → SELECTION

Requires one or more final qualifiers.

If zero final qualifiers, proceed to refund/no-qualifier settlement path instead of subjective selection.

### SELECTION → SETTLEMENT_PENDING

Organizer may select exactly one final qualifier before review deadline.

Requires:

- selected entry is in final qualifier set;
- no organizer-added criterion is consulted;
- selection is organizer preference, not resolver taste.

Creates `SettlementIntent = WINNER_PAYOUT`.

### SELECTION → DEFAULT_RESOLUTION

Authority: due-state command.

Requires:

- review deadline elapsed;
- no valid organizer selection.

### DEFAULT_RESOLUTION → SETTLEMENT_PENDING / terminal settlement path

Deterministic:

```text
0 qualifiers  → REFUND_NO_QUALIFIER
1 qualifier   → WINNER_PAYOUT(single qualifier)
2+ qualifiers → DEFAULT_DISTRIBUTION(equal split)
```

For `2+` default distribution:

- no winner exists;
- no organizer/customer bespoke IP transfer is triggered;
- all recipients are final qualifiers;
- split conserves the full prize in integer minor units.

### SETTLEMENT_PENDING → SETTLED

Requires externally supplied finalized execution evidence matching:

- Challenge identity/commitment;
- settlement policy/version;
- expected asset/amount;
- expected recipient(s);
- settlement intent.

Transaction submission alone is insufficient for production monetary settlement.

### SETTLED → RECEIPT_FILED

Requires terminal settlement facts and complete receipt projection.

Receipt filing does not mutate prior facts.

## 7. Entry lifecycle

Candidate protocol states:

```text
SEATED
WITHDRAWN_PRE_BUILD
ACTIVE
SUBMITTED
INVALID_SUBMISSION
ABANDONED
```

Rules:

- one builder identity may occupy at most one seat in one Challenge;
- one payout identity/address per Challenge entry under active settlement policy;
- organizer/funder payout identity cannot also occupy a builder seat under V1.1 curated policy;
- withdrawal is only semantic before activation;
- activation converts remaining valid seats to `ACTIVE` at the same build start;
- after activation, stopping work is represented by lack of valid final submission / `ABANDONED`, not by retroactively freeing a seat;
- competitor identity/source/progress is sealed until reveal policy allows disclosure.

Database uniqueness/concurrency enforcement belongs to Stage C; Stage B exposes the invariant functions/results to test.

## 8. Submission protocol

Conceptual minimum:

```text
SubmissionManifest {
  schema_version
  challenge_id
  entry_id
  terms_digest
  submission_version
  immutable_source_reference
  artifact_digest
  evidence_references[]
  optional_live_url
  accepted_at
}
```

Rules:

- `accepted_at` is authoritative timestamp input from the caller/DB in later stages;
- final eligibility depends on acceptance before deadline, not archive-worker completion;
- mutable branch/live URL cannot be the sole artifact identity;
- builders may submit multiple versions before deadline;
- the latest valid accepted-before-deadline manifest is final for review;
- after deadline no new manifest becomes final;
- snapshot/archive status is separate: `PENDING / CAPTURED / BUILDER_REVOKED / PLATFORM_UNAVAILABLE / FAILED_WITH_REASON` or equivalent later persistence state;
- Git submodules/LFS/external authoritative dependencies require independent freezing or are unsupported in V1.

## 9. Qualification protocol

Each mandatory criterion result:

```text
PASS
FAIL
DISPUTED
```

Overall:

```text
QUALIFIED
NOT_QUALIFIED
DISPUTED
```

Rules:

- qualification evaluates frozen normative criteria only;
- Preferences never alter qualification;
- ReferenceArchitecture never alters qualification unless a requirement was explicitly promoted into `normative_constraints` before freeze;
- platform fraud/malware/rights/sanctions/policy decisions use PolicyResolution, not organizer Done When;
- AI/model outputs may be evidence summaries/advice later but are not unexplained final authority;
- a resolver may resolve criterion/evidence correctness but may not choose subjective taste among multiple qualifiers.

## 10. Appeal protocol

Normal budget:

```text
ORGANIZER FIRST-PASS
→ ONE BUILDER APPEAL
→ ONE INDEPENDENT RESOLUTION
→ FINAL
```

No recursive appeal/review loops.

Appeal grounds are frozen-rule/evidence errors, dependency/platform failure, or admitted protocol/policy error. New requirements and subjective taste are not appeal grounds.

## 11. Default split arithmetic

All prize arithmetic uses integer minor units.

For `n >= 2` final qualifiers:

```text
base = floor(prize_minor_units / n)
remainder = prize_minor_units - (base * n)
```

Each qualifier receives `base`; the first `remainder` recipients under a deterministic canonical ordering (ascending stable `entry_id` byte/string order) receive one additional minor unit.

Properties:

- total distributed equals full prize;
- no floating point;
- ordering is deterministic/versioned;
- no winner fact is created;
- no customer IP-transfer trigger is created.

If legal/economic review later chooses a different remainder policy, that requires a new settlement-policy version for new Challenges only.

## 12. IP-transfer protocol fact

Protocol exposes a fact such as:

```text
NOT_TRIGGERED
TRANSFER_TRIGGERED
```

It may become `TRANSFER_TRIGGERED` only for a normal/single-qualifier winner outcome **after** finalized successful winner payout under the active settlement policy.

It remains `NOT_TRIGGERED` for:

- losing submissions;
- selected-but-unpaid winner;
- no-qualifier refund;
- default distribution among multiple qualifiers;
- pre-build refund;
- cancellation without contract-valid paid winner transfer.

Exact legal effect remains external legal policy; Stage B protects the product invariant.

## 13. Versioning law

Every frozen Challenge stores immutable:

```text
mechanism_version
settlement_policy_version
ip_terms_version
build_contract_schema_version
contract_version
terms_digest
```

Rules:

- active Challenge semantics resolve through its stored versions;
- a later application deploy cannot reinterpret an active Challenge;
- new version applies only to new/future Challenges unless a separate explicit migration policy exists for non-liability draft state;
- versions with active liabilities remain supported until terminal.

## 14. Digest law

Use existing canonical JSON/SHA-256 lineage unless implementation review finds a cryptographic/serialization defect.

`terms_digest` covers the accepted frozen semantic contract, including:

- mechanism/policy/IP/schema versions;
- Outcome Contract;
- Production Envelope;
- Delivery Contract;
- Preferences (frozen but non-qualifying);
- Reference Architecture (frozen but advisory);
- normative constraints;
- normative reference digests/metadata;
- slots/activation/deadlines;
- prize/settlement declaration;
- any other field whose post-freeze change could mislead a builder about the contract they joined.

Secrets/private source are not embedded in a public digest payload; only appropriate canonical identifiers/digests are committed.

A digest proves identity of the frozen representation. It does not by itself prove truth, ownership, legality, safety, or production quality.

## 15. Receipt/correction law

Receipt is append-only.

If correction is needed:

```text
Receipt V1
  ↓
CorrectionReceipt V2 {
  supersedes: V1
  reason
  authority
  evidence refs
  corrected projection
}
```

Original V1 remains queryable/auditable.

No correction may fabricate a monetary execution fact or silently change the frozen Build Contract.

## 16. Time law

Pure protocol functions never call wall clock directly.

All time-sensitive transitions receive an authoritative `now` input from the caller.

This enables deterministic replay/property testing and prevents hidden clock authority.

## 17. Pure protocol API direction

Conceptual functions may include:

```text
validateBuildContract(...)
canonicalizeBuildContract(...)
digestBuildContract(...)
canTransitionChallenge(...)
transitionChallenge(...)
activateEntries(...)
selectFinalSubmission(...)
computeQualification(...)
computeDefaultResolution(...)
computeDefaultDistribution(...)
validateSelection(...)
applyFinalizedSettlementFact(...)
computeIpTransferFact(...)
fileReceipt(...)
appendReceiptCorrection(...)
```

Exact function names are implementation details. Side-effect-free semantics are not.

## 18. Explicit Stage-B non-scope

Do not implement in Stage B:

- SQL/migrations;
- HTTP routes;
- GitHub capture;
- archive/object storage;
- model calls;
- blueprint matching;
- frontend;
- CLI/MCP Challenge commands;
- verifier changes;
- real wallet signing;
- smart contracts;
- RPC/finality logic;
- notifications;
- moderation UI;
- human cohort testing.

## 19. Stage-B exit gate

Stage B closes when:

- schemas/types represent the contract above;
- pure state functions enforce legal transitions;
- canonical digest/version semantics are deterministic;
- property tests in `STAGE_B_PROPERTY_TEST_MATRIX_V1.md` pass;
- one independent hostile review is consumed;
- all Critical/High findings are fixed;
- one targeted rereview occurs only if Critical/High fixes required it;
- no DB/UI/model/chain scope leaked into the phase.

## 20. Verdict

```text
STAGE_B_AUTHORITY                = PURE PROTOCOL ONLY
BUILD_CONTRACT                   = FIVE LAYERS + EXPLICIT ASSUMPTIONS
TERMS                            = VERSIONED + DIGESTED + FROZEN
REFERENCE_ARCHITECTURE           = ADVISORY BY DEFAULT
PREFERENCES                      = NON_QUALIFYING
SUBMISSION                       = IMMUTABLE MANIFEST
QUALIFICATION                    = FROZEN CRITERIA ONLY
POLICY_RESOLUTION                = SEPARATE FROM DONE WHEN
SELECTION                        = ORGANIZER AMONG QUALIFIERS
DEFAULT                          = DETERMINISTIC
MONEY_EXECUTION                  = EXTERNAL FACT INPUT
IP_TRANSFER                      = AFTER FINALIZED WINNER PAYOUT ONLY
RECEIPT                          = APPEND-ONLY
CLOCK                            = CALLER-SUPPLIED
```
