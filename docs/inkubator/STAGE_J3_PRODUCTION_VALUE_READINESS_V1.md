# REKT INKUBATOR — STAGE J3 PRODUCTION-VALUE READINESS / THREAT MODEL V1

**Status:** ACTIVE / TARGETED REREVIEW NEXT  
**Date:** 2026-09-18  
**Branch:** `agent/stage-j3-production-value-readiness-v1`  
**Base:** Stage-J2 closure head `b765984a93c4c865a1da20d1daeb0355700ce8d0`  
**Production-money authority:** NONE  
**Mainnet deployment authority:** NONE  
**Merge authority:** NONE

## 1. Objective

Turn the J0→J2 test-only settlement proof into an **audit-ready production-value specification** without deploying production contracts or moving production value.

J3 is the first P9 slice from Survivor V1.1:

`VAULT TRUST MODEL → EMERGENCY/LONG-STOP → AUDIT PACKAGE → LEGAL/COMPLIANCE GATES → CAPPED LAUNCH AUTHORITY`

J3 covers the technical trust model and blocker inventory only.

It does not declare the system production-ready.

## 2. Permanent trust invariant

> No single compromise or mistake may silently alter Challenge terms, change the frozen payout identity, fabricate qualification, redirect settlement, sweep prize funds, or trap funds forever.

Every production settlement path must be explainable as:

`FROZEN TERMS + FROZEN IDENTITIES + FROZEN OUTCOME FACTS + PRECOMMITTED TIME/POLICY → EXACT RECIPIENT/AMOUNT`

No web/API/database administrator receives arbitrary prize-redirection authority.

## 3. J2 evidence inherited

J3 starts only because J2 proved the synthetic public-chain loop on Ink Sepolia:

- exact reviewed implementation head: `66c45586ffadec5d85455c895cd320455c5413ee`;
- public run: `35396664547`;
- J2 closure: `STAGE_J2_CLOSURE_V1.md`;
- winner/default/refund vault paths: PASS;
- immutable deployment snapshots: PASS;
- finality/conservation: PASS;
- hostile review: PASS / no Critical-High.

This evidence is reusable. J3 does not ceremonially rerun J2.

## 4. Production blockers inherited from J1/J2

The J1/J2 vault is intentionally test-only and must not be promoted unchanged.

Known blockers:

1. resolver authority is one test EOA, not a production threshold authority;
2. EIP-1271 contract-wallet verification is absent;
3. deterministic default settlement still requires a fresh outcome signature after qualification is already frozen;
4. no precommitted long-stop exists for unresolved/nonterminal Challenges;
5. J0 `REFUND_PRE_BUILD` has no equivalent J1 vault path;
6. production token identity/code behavior is not frozen;
7. production deployment bytecode/factory identity is not frozen;
8. production chain finality/RPC-disagreement policy is not wired to settlement reconciliation;
9. key generation/storage/rotation/recovery policy is not defined;
10. external smart-contract review/audit has not occurred;
11. legal/payment/CASP, sanctions/AML if applicable, tax/accounting, privacy/DPIA and IP/business terms remain independent blockers.

## 5. Production authority model

### 5.1 Organizer winner before deadline

Normal organizer selection may authorize only a recipient already frozen in the payout set and already present in the final qualifier set.

Required authority:

- Inkubator outcome attestation; and
- organizer selection authority.

The authorization binds:

- chain ID / verifying contract;
- Challenge digest;
- terms digest;
- settlement binding digest;
- qualifier-set root;
- settlement manifest digest;
- exact recipient;
- exact amount;
- settlement kind.

No signer may substitute a different payout address.

### 5.2 Deterministic default after deadline

Once the final qualifier set is frozen, the default result is mathematical policy.

Production direction:

- single qualifier → full prize to that frozen qualifier;
- multiple qualifiers → frozen equal-split/remainder law in canonical payout order;
- zero qualifiers → frozen refund recipient.

After the organizer-selection deadline, execution of those already-determined outcomes should be **permissionless where possible**.

A fresh organizer or platform outcome signature must not be required merely to execute deterministic policy already committed by the frozen qualifier set.

This removes an unnecessary liveness dependency without creating redirection authority.

### 5.3 Resolution cancellation

Resolution cancellation is exceptional and may not be a single EOA.

Production direction:

- resolver is a separately governed threshold/contract-wallet authority;
- resolver identity cannot equal organizer/outcome authority;
- cancellation can only route the full authorized refund amount to the immutable refund recipient;
- no arbitrary partial amount or alternate recipient;
- resolution facts are append-only and auditable.

Exact threshold composition is a J3 decision gate.

## 6. Long-stop / emergency law

A production Challenge must not be able to lock prize funds forever if Inkubator disappears.

The long-stop must be committed before funding and cannot be shortened after builders join.

Required state cases:

### A. Final qualifier set already frozen

No emergency administrator is needed.

After organizer-selection expiry, deterministic default settlement is executable by anyone to frozen recipients.

### B. Qualification never becomes final

A separate, much later `long_stop_deadline` must exist.

The exact unresolved long-stop policy is a mainnet blocker and must balance:

- organizer cannot gain a cheap option to avoid paying valid builders;
- builders cannot force an arbitrary payout without qualification evidence;
- complete platform/operator disappearance cannot trap funds forever.

Candidate direction:

- permit an independent resolver threshold to finalize/cancel during the recovery window;
- after the committed terminal long-stop, allow only the predeclared fallback recipient/policy;
- never allow an admin sweep.

Exact timing and fallback semantics require product/legal review before contract freeze.

## 7. Pre-build refund

J0 already models `REFUND_PRE_BUILD`.

Production vault semantics must explicitly define whether funding can happen before BUILDING and, if so, the only legal pre-build refund cases.

Preferred simplification:

- avoid unnecessary pre-build custody where possible;
- if a Challenge may be funded before activation, refund eligibility/deadline must be immutable and contract-valid;
- ordinary API/database mutation cannot create a refund right.

This gap must be closed before audit.

## 8. Wallet / signer compatibility

Production payout identities may include EOAs and smart-contract wallets.

Required:

- EIP-712 domain separation;
- low-s ECDSA enforcement;
- EIP-1271 verification for contract-wallet authorities/participants where applicable;
- exact chain ID and verifying-contract binding;
- replay resistance across Challenge vaults and chains;
- wallet-binding message with origin/domain, address, chain, nonce, issued/expiry time and resource identifier;
- payout address frozen before BUILDING except through a separately audited recovery protocol.

No production private key is stored in the ordinary web/API runtime.

## 9. Asset boundary

V1 production launch supports exactly one settlement asset on exactly one chain.

Before audit freeze, J3 must record:

- canonical chain ID;
- canonical token contract address;
- decimals;
- token implementation/proxy behavior;
- transfer/transferFrom return/revert behavior;
- fee-on-transfer/rebase prohibition;
- blacklist/pause/freeze behavior and operational consequences;
- deployment bytecode/codehash expectations where technically meaningful.

The vault continues to enforce exact balance delta on funding.

Arbitrary-token support is out of scope.

## 10. Deployment identity

Production vault instances must be attributable to one reviewed release.

Freeze before audit:

- compiler version/settings;
- source commit;
- creation/runtime bytecode hashes;
- constructor schema;
- factory/deployment mechanism if a factory is used;
- explorer verification procedure;
- release/version identifier;
- supported chain/token tuple.

Preferred direction remains simple/non-upgradeable.

No broad upgrade key or arbitrary-call surface is introduced merely for operational convenience.

## 11. Fund conservation and claim isolation

Permanent monetary invariants:

- funded amount equals the exact frozen prize amount;
- credited amount equals the exact frozen prize amount;
- `totalClaimed <= prizeAmount`;
- terminal state requires `totalClaimed == prizeAmount`;
- one blocked recipient cannot prevent other recipients from claiming;
- `claimFor` cannot redirect;
- reentrancy cannot create duplicate claims;
- no owner/admin sweep;
- unsolicited token dust cannot change prize accounting;
- any surplus-token policy must be explicit and unable to touch prize liability.

## 12. Chain finality / reconciliation

The vault is monetary execution truth; PostgreSQL remains product/workflow truth.

Production application law:

`TX_SUBMITTED != PAID`
`TX_INCLUDED != FINAL`
`SETTLED == FINALIZED CHAIN EVIDENCE`

J3 must freeze:

- chain-specific finality threshold/policy;
- at least two independent RPC/provider observations for disputed terminal facts where practical;
- behavior on provider disagreement;
- behavior on reorg;
- idempotent reconciliation;
- immutable receipt/correction semantics.

RPC disagreement must hold state in `RECONCILING`; it may not choose whichever answer is convenient.

## 13. Privacy

On-chain data is minimized to custody/enforceability facts.

Never put on chain:

- GitHub user IDs;
- names;
- private source;
- descriptions;
- private evidence;
- unnecessary personal metadata.

Use opaque digests/identifiers and payout addresses only where necessary.

DPIA/privacy review remains a pre-mainnet gate.

## 14. Audit-ready threat matrix

The J3 technical review must explicitly cover at least:

- signer compromise;
- organizer/outcome collusion;
- resolver compromise;
- replay/cross-chain replay;
- signature malleability;
- EIP-1271 behavior;
- payout-root/qualifier-root substitution;
- payout-order/remainder manipulation;
- wrong manifest/terms/binding;
- early default execution;
- permanent fund lock;
- pre-build cancellation abuse;
- blocked/blacklisted recipient;
- fee-on-transfer/rebasing token;
- token pause/blacklist;
- malicious/nonstandard ERC-20 return behavior;
- reentrancy;
- accidental token dust;
- duplicate/replayed claim;
- wrong chain/token deployment;
- malicious or wrong factory bytecode;
- RPC disagreement/reorg;
- operator disappearance;
- key loss/rotation;
- privacy leakage;
- upgrade/admin-key abuse.

Each row must have:

`THREAT → ASSET → PRECONDITION → PREVENTION → DETECTION → RECOVERY → RESIDUAL RISK → TEST/EVIDENCE`

## 15. External review package

J3 exits technical design only when an independent reviewer can receive one bounded package containing:

- frozen production contract specification;
- threat matrix;
- state/authority diagram;
- Solidity source;
- compiler/deployment config;
- invariants/property tests;
- known assumptions/non-goals;
- J0/J1/J2 ancestry and public-testnet evidence;
- exact unresolved questions.

Do not call an internal hostile review an external smart-contract audit.

## 16. Non-technical blockers

J3 records but does not answer legal/accounting questions.

Production value remains independently blocked on:

- Sweden/EU MiCA/PSD/payment-service/CASP analysis;
- AML/sanctions/financial-crime duties if applicable;
- tax/VAT/invoicing/accounting treatment;
- cross-border IP/consumer/business terms;
- privacy/DPIA/retention;
- age/entity eligibility;
- smart-contract external security review/audit.

Do not build heavyweight KYC/compliance infrastructure until qualified counsel determines actual obligations.

Do not launch around the questions.

## 16A. J3 design package

The complete technical design package is:

- `STAGE_J3_PRODUCTION_VALUE_THREAT_MATRIX_V1.md` — 40-threat adversarial inventory and control/evidence map;
- `STAGE_J3_PRODUCTION_VALUE_DECISIONS_V1.md` — chain, native USDC, finality, authority, liveness, deployment and issuer-risk decisions;
- `STAGE_J3_SIGNER_CUSTODY_RUNBOOK_V1.md` — outcome/resolver/organizer custody, loss and compromise law;
- `STAGE_J3_REPRODUCIBLE_DEPLOYMENT_IDENTITY_V1.md` — clean-build/runtime-hash/deployment identity procedure;
- `STAGE_J3_PRODUCTION_CANDIDATE_TEST_MATRIX_V1.md` — executable future implementation acceptance matrix;
- `STAGE_J3_EXTERNAL_REVIEW_PACKAGE_V1.md` — exact independent smart-contract review handoff;
- `STAGE_J3_TERMINAL_FALLBACK_DECISION_V1.md` — technically frozen no-qualification long-stop fallback with external legal/terms gate explicitly open.

No production Solidity implementation is introduced by these documents.

## 17. J3 acceptance gates

J3 closes only when:

1. production authority graph is frozen;
2. deterministic post-deadline defaults no longer depend on a fresh platform signature unless a documented security reason survives review;
3. resolver threshold/contract-wallet design is frozen;
4. EIP-1271 policy is frozen;
5. unresolved long-stop semantics are frozen;
6. pre-build refund semantics are frozen;
7. exact single-chain/single-asset requirements are frozen;
8. deployment identity/codehash procedure is frozen;
9. finality/reconciliation policy is frozen;
10. key lifecycle/rotation/recovery policy is frozen;
11. threat matrix is complete;
12. property/adversarial test plan is complete;
13. independent audit package is ready;
14. legal/accounting/privacy questions are explicitly listed as unresolved external gates;
15. one bounded hostile review finds no remaining Critical/High architecture issue.

Gates 1–14 are specified by the J3 design package. The bounded hostile review found three High issues; those exact surfaces have been repaired. The only next review action is one targeted rereview of those repairs.

## 18. Explicit non-authority

J3 does not authorize:

- mainnet deployment;
- real USDC/USDT0 movement;
- production wallet creation;
- production signer secrets;
- custody;
- fees;
- external-user funding;
- declaring legal compliance;
- declaring an audit passed;
- merge.

## 19. Next after J3

After J3 architecture closes:

1. implement the smallest production-candidate vault delta in an isolated stage;
2. run adversarial/property verification;
3. commission independent external smart-contract security review/audit;
4. complete qualified legal/accounting/privacy review;
5. only then request explicit authority for a tightly capped curated production canary.

Until those independent gates pass:

`PRODUCTION_MONEY = NOT_AUTHORIZED`
