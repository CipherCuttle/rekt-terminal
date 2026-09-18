# REKT INKUBATOR — STAGE J3 TERMINAL FALLBACK DECISION V1

**Status:** TECHNICAL DECISION / EXTERNAL LEGAL-TERMS REVIEW STILL REQUIRED  
**Date:** 2026-09-18  
**Parent:** `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`  
**Production-money authority:** NONE

## Decision

If all of the following are true:

- the Challenge was funded;
- payout identities were frozen;
- no final qualifier set was ever established;
- no settlement was authorized;
- normal qualification/recovery windows have expired;
- the immutable `terminal_long_stop` has been reached;

then:

> **Anyone may trigger full refund of the exact remaining prize to the immutable refund recipient.**

For the first capped candidate:

`terminal_long_stop = organizer_selection_deadline + 30 days`

The production contract may not choose a different recipient at terminal long-stop.

## Why this is the least-authority fallback

At terminal long-stop with **no authoritative qualifier set**, the system does not possess a contract-valid fact identifying a builder who is entitled to the prize.

The contract can safely know only:

- the exact prize;
- the frozen payout roster;
- that no final qualifier set exists;
- the immutable refund recipient;
- the precommitted deadlines.

A terminal fallback must not invent economic facts that were never finalized.

## Alternatives rejected

### A. Lock funds forever

Rejected.

This makes complete platform/operator disappearance a permanent custody failure and violates the product's no-permanent-lock requirement.

### B. Admin/platform sweep

Rejected.

A master recovery key able to move prize funds creates exactly the arbitrary-redirection authority the vault is designed to eliminate.

### C. Pay all frozen entrants equally

Rejected.

The payout roster is not the qualifier set.

This could pay:

- entrants who never submitted;
- invalid/non-qualifying work;
- abandoned entries.

It also creates a Sybil incentive to occupy seats merely to share the terminal fallback.

### D. Random winner

Rejected.

No frozen product rule or entitlement fact supports random allocation.

### E. Pay the “best known” entrant from database state

Rejected.

That turns mutable/offline application state into unilateral monetary truth after the chain's authority process failed.

### F. Burn/unrecoverably strand the prize

Rejected.

This provides no builder benefit, creates a custody failure and makes the platform disappearance case economically destructive.

## Why refund does not create an easy organizer option

The organizer/funder cannot trigger this path early.

Before the terminal fallback:

1. normal qualification can finalize;
2. an existing final qualifier set permanently disables the no-qualifier terminal refund;
3. deterministic default becomes permissionless once qualification is final;
4. exceptional recovery remains available through the resolver threshold;
5. after `resolution_deadline`, the resolver 2-of-3 can recover a qualifier set only from the already-frozen payout roster and only if no qualifier set exists;
6. the organizer alone cannot erase an existing qualifier set or accelerate `terminal_long_stop`;
7. the 30-day deadline is immutable per funded Challenge.

The organizer therefore cannot simply dislike submitted work and choose a refund.

The residual risk requires coordinated authority failure/collusion or prolonged loss of the qualification process.

## Builder-fairness residual risk

A genuine residual risk remains:

> Valid builder work may exist, but if no final qualifier set is ever established and all recovery authority fails for the full long-stop period, the funder eventually receives the prize back.

The contract cannot both avoid invented entitlement and guarantee payment for an entitlement that never became authoritative.

This residual risk must be:

- disclosed in Challenge terms;
- visible before builders join;
- included in legal/product review;
- measured during capped launch;
- revisited if real-world incidents show the recovery window is insufficient.

## Recovery evidence requirement

The resolver-only recovery path after `resolution_deadline` must bind a durable `recovery_evidence_digest`.

That digest is expected to commit to the product-side evidence supporting the recovered qualifier set, such as:

- final immutable submission identities;
- frozen acceptance manifest;
- criterion result set;
- qualification computation/receipt;
- incident/recovery reason.

The production contract does not interpret those artifacts. The resolver threshold attests the recovery fact and the digest makes that attestation auditable/non-equivocal.

## Monotonicity

Once any final qualifier set is frozen:

- it cannot be replaced;
- the terminal no-qualification refund becomes impossible;
- post-deadline deterministic default is the liveness path.

Once any settlement is authorized:

- long-stop/recovery alternatives are impossible.

This prevents timeout paths from becoming competing settlement choices.

## Timing

Provisional first-candidate policy:

- normal organizer/qualification process: Challenge-specific frozen timeline;
- `resolution_deadline = organizer_selection_deadline + 72 hours`;
- `terminal_long_stop = organizer_selection_deadline + 30 days`.

These values become immutable when the Challenge vault is deployed/funded.

Changing launch-default durations before external audit freeze is allowed as a new policy decision. Changing an active Challenge's deadlines is not.

## External gate

This is the **technical architecture decision**.

Production value still requires qualified review of whether:

- the refund outcome is correctly described/enforceable in organizer/builder terms;
- the timing is reasonable for disputes/consumer/business obligations;
- any jurisdiction-specific rule requires a different treatment.

If legal/product review rejects the fallback, the contract specification must change and relevant J3 security review must be rerun before audit freeze.

Until then:

`TERMINAL_FALLBACK = TECHNICALLY_FROZEN / LEGAL_GATE_OPEN`
