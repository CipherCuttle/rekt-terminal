# REKT INKUBATOR — STAGE J3 EXTERNAL SMART-CONTRACT REVIEW PACKAGE V1

**Status:** READY FOR FUTURE IMPLEMENTATION HANDOFF / NOT YET AUDITABLE CODE  
**Date:** 2026-09-18  
**Parent:** `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`  
**Production-money authority:** NONE  
**Claimed external audit:** NONE

This document defines the exact bounded package an independent smart-contract security reviewer will receive after the production-candidate implementation exists.

J3 is architecture/audit preparation. It must not be described as an external audit.

## 1. Review objective

The reviewer is asked to determine whether the production-candidate settlement system preserves, under adversarial conditions:

1. exact funded-prize conservation;
2. frozen payout identity;
3. qualification/selection authority separation;
4. deterministic post-deadline liveness;
5. exceptional recovery without arbitrary redirection;
6. terminal liveness without hidden admin sweep;
7. replay-safe EOA/ERC-1271 authorization;
8. per-recipient claim isolation;
9. immutable deployment law;
10. trustworthy chain-finality reconciliation.

The reviewer should prioritize economic loss, permanent lock, unauthorized payout, signature/authority bypass, and false terminal accounting.

## 2. Architecture authorities supplied

Required design documents:

- `REKT_INKUBATOR_NORTH_STAR_V2.md`;
- `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`;
- `STAGE_J0_SETTLEMENT_ADAPTER_V1.md`;
- `STAGE_J1_TESTNET_CHALLENGE_VAULT_V1.md`;
- `STAGE_J2_CLOSURE_V1.md`;
- `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`;
- `STAGE_J3_PRODUCTION_VALUE_THREAT_MATRIX_V1.md`;
- `STAGE_J3_PRODUCTION_VALUE_DECISIONS_V1.md`;
- `STAGE_J3_SIGNER_CUSTODY_RUNBOOK_V1.md`;
- `STAGE_J3_REPRODUCIBLE_DEPLOYMENT_IDENTITY_V1.md`;
- `STAGE_J3_PRODUCTION_CANDIDATE_TEST_MATRIX_V1.md`.

Where documents conflict, the J3 authority/decision documents govern the production candidate unless a later explicit authority supersedes them.

## 3. Code supplied — future implementation stage

The implementation handoff must pin:

- exact Git commit;
- production-candidate vault source;
- signature-verification library/source;
- deployment script;
- application settlement/finality adapter;
- tests;
- Foundry config;
- lockfiles/dependencies;
- generated release receipt.

No unpinned branch-only audit scope.

## 4. Expected production-candidate economic model

### Asset / chain

- Ink mainnet;
- chain ID `57073`;
- one asset only: Circle-issued native USDC;
- exact token address frozen in release receipt;
- initial platform fee: zero.

### Prize law

`FUNDED = EXACT PRIZE`

After settlement authorization:

`TOTAL_CREDITED = PRIZE`

At all times after authorization:

`TOTAL_CLAIMED + SUM(CLAIMABLE) = PRIZE`

Terminal:

`FINALIZED <=> TOTAL_CLAIMED = PRIZE`

No owner/admin balance extraction path exists.

## 5. Authority model supplied to reviewer

### Organizer

Can subjectively select only among final qualifiers and only before the organizer deadline.

### Outcome

Co-attests normal frozen payout/qualification/selection facts. It is not a custody key and cannot name arbitrary recipients.

### Resolver

ERC-1271-compatible 2-of-3 threshold authority for exceptional recovery/resolution within exact contract-valid bounds.

### Permissionless execution

Once final qualification is frozen:

- post-deadline default requires no fresh signer;
- claim execution requires no privileged caller.

At terminal long-stop, exact predeclared fallback is executable without privileged signers under its preconditions.

## 6. Time model supplied to reviewer

Production candidate includes immutable:

- `activation_deadline`;
- `organizer_selection_deadline`;
- `resolution_deadline`;
- `terminal_long_stop`.

Provisional first-candidate inputs:

- activation deadline = build start;
- resolution deadline = organizer deadline + 72 hours;
- terminal long-stop = organizer deadline + 30 days.

Reviewer should treat timestamp boundary errors and griefing around these windows as high-value attack areas.

## 7. Signature model supplied to reviewer

Review both:

- strict low-s ECDSA EOAs;
- ERC-1271 contract authorities.

Every authority digest must be domain-separated by chain ID and verifying contract and bind the relevant:

- Challenge digest;
- terms digest;
- binding digest;
- roots;
- manifest/evidence digest;
- settlement/recovery kind;
- exact recipients/amounts where applicable.

Reviewer should attempt:

- cross-vault replay;
- cross-chain replay;
- signature malleability;
- wrong authority;
- ERC-1271 revert/short/wrong magic/gas grief;
- stale authorization reuse;
- semantic payload substitution under the same external request identity.

## 8. Explicit high-risk questions

The independent review should answer at minimum:

1. Can any authority combination redirect prize to an address not frozen by the Challenge law?
2. Can organizer/outcome/resolver bypass final qualifier membership?
3. Can deterministic default be blocked by disappearance of Inkubator or organizer?
4. Can the terminal long-stop be reached early or abused to create an organizer free option?
5. Can a recovery qualifier set replace an existing final qualifier set?
6. Can the resolver threshold authorize arbitrary cancellation/amount/recipient?
7. Can any signature replay across vaults/chains/actions?
8. Can malformed ERC-1271 behavior be interpreted as valid?
9. Can malicious/nonstandard token behavior create accounting divergence?
10. Can reentrancy/double claim exceed prize liability?
11. Can one blocked recipient freeze unrelated claims?
12. Can unsolicited token transfers alter liability/accounting?
13. Can any deployer/factory/admin mutate active vault law?
14. Can finality/reconciliation mark an unfinalized/reorged transaction terminal?
15. Is any recovery path dependent on a secret held by the ordinary web/API runtime?
16. Does the long-stop preserve liveness without creating arbitrary custody power?

## 9. Threat matrix traceability

Reviewer receives the full J3 threat matrix.

Every Critical/High row must map to:

- code/control;
- test/evidence;
- residual risk.

If a row has no executable test or clear proof, the package is incomplete.

The reviewer may raise new threats; J3 does not constrain scope to the existing matrix.

## 10. Required test evidence

Before external review starts, attach:

- full Foundry unit suite;
- fuzz/property suite;
- invariant suite;
- ECDSA/ERC-1271 known-answer vectors;
- boundary-time tests;
- malicious-token mocks;
- native-USDC controlled integration/fork evidence;
- lost-key/recovery operational drills;
- finality/provider-disagreement test evidence;
- reproducible build evidence;
- second-environment runtime-hash reproduction.

The minimum cases are defined in `STAGE_J3_PRODUCTION_CANDIDATE_TEST_MATRIX_V1.md`.

## 11. J0/J1/J2 ancestry evidence

Supply the reviewer with prior design/evidence ancestry but do not treat it as audit coverage.

J2 public testnet evidence:

- reviewed implementation head: `66c45586ffadec5d85455c895cd320455c5413ee`;
- run: `35396664547`;
- artifact SHA-256: `a76381a0e983f82edb13fae268ed5257e5b3c80a5c6e1449f1b418743f328be7`;
- public testnet winner/default/refund/finality/conservation: PASS;
- bounded J2 hostile review: PASS / no Critical-High.

The production candidate intentionally changes authority/liveness semantics and therefore requires fresh independent review.

## 12. Reproducible release evidence

Package includes:

- source commit;
- toolchain versions;
- `foundry.toml` digest;
- creation bytecode hash;
- runtime bytecode hash;
- constructor ABI digest;
- release chain/token tuple;
- independent reproduction result.

Reviewer should independently reproduce at least the runtime hash from a clean environment.

## 13. Out-of-scope but blocking external work

The smart-contract reviewer is not asked to certify:

- Swedish/EU MiCA/PSD/CASP status;
- AML/sanctions obligations;
- tax/VAT/invoicing/accounting;
- IP/consumer/business terms;
- DPIA/privacy compliance;
- participant age/entity eligibility.

Those are separate production-money blockers.

Security review completion does not authorize launch.

## 14. Explicit non-goals

Initial production-candidate review excludes:

- arbitrary tokens;
- multichain settlement;
- bridging;
- yield;
- platform fees;
- upgradeable Challenge vaults;
- arbitrary admin rescue;
- open anonymous marketplace assumptions;
- production wallet custody by the application.

Scope expansion requires a new review delta.

## 15. Finding severity / closure rule

For our engineering closure:

- Critical/High findings block the production candidate;
- fix Critical/High;
- perform one targeted re-review of those fixes;
- Medium/Low are tracked and do not create an infinite review loop unless they undermine the objective/invariants.

The external reviewer may use their own severity nomenclature; map it explicitly to the internal gate.

## 16. Audit-report evidence

A completed external review package must record:

- reviewer/firm identity;
- scope commit(s);
- dates;
- report/version;
- report digest and durable location;
- all Critical/High findings;
- remediation commit(s);
- targeted re-review/verification result;
- residual accepted risks.

Never summarize an external report as “audited” if the deployed code differs from its exact scope.

## 17. Audit start gate

Do **not** commission/declare the bounded code review ready until:

- J3 architecture closes;
- production-candidate implementation exists;
- J3 test matrix passes;
- release hashes are frozen/reproducible;
- no known Critical/High internal architecture issue remains;
- unresolved product/legal questions are clearly separated from smart-contract scope.

Current status:

`AUDIT_PACKAGE_STRUCTURE = READY`

`AUDITABLE_PRODUCTION_CODE = NOT_YET_IMPLEMENTED`

`EXTERNAL_AUDIT = NOT_STARTED`
