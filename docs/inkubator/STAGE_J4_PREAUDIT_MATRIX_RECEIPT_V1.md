# REKT INKUBATOR — STAGE J4 PRE-AUDIT MATRIX RECEIPT V1

**Status:** PRE-AUDIT MATRIX TRANCHE PASS / J4 NOT CLOSED  
**Date:** 2026-09-19  
**Branch:** `agent/stage-j4-production-candidate-vault-v1`  
**PR:** #129 — draft / open / unmerged  
**Verified implementation head:** `18998bfe485a420046596ebba8a132691f02c2ff`  
**Merge authority:** NONE  
**Mainnet deployment authority:** NONE  
**Production-money authority:** NONE  
**Production-signer authority:** NONE  
**External smart-contract audit:** NOT STARTED  
**Legal/accounting/privacy gates:** OPEN

## Verdict

`J4_PREAUDIT_MATRIX_TRANCHE_PASS`

This receipt records a bounded pre-external-audit verification tranche against
`STAGE_J3_PRODUCTION_CANDIDATE_TEST_MATRIX_V1.md`.

It does **not** mark Stage J4 closed and does not infer uncovered matrix rows as PASS.

No second broad hostile-review loop was created. The prior bounded hostile review
`5253171614` and targeted rereview `5253190481` remain the completed J4 core review cycle.

## Frozen-law repair discovered by matrix reconciliation

The J3 recovery law requires:

- before `resolution_deadline`: recovery qualifier freeze requires **outcome + resolver**;
- at/after `resolution_deadline`, while no qualifier set exists and before terminal long-stop:
  immutable resolver threshold may freeze one recovery qualifier set;
- an existing qualifier set can never be replaced.

The initial J4 core implementation had outcome+organizer normal freeze before the boundary and
resolver-only recovery after the boundary, but omitted the explicit pre-resolution outcome+resolver path.

J4 now implements:

`sealQualifierSetRecoveryCoSigned(...)`

which binds:

- frozen payout-root membership;
- qualifier root/count;
- exact default settlement manifest digest;
- nonzero recovery-evidence digest;
- RECOVERY mode;
- outcome EOA signature;
- immutable ERC-1271 resolver threshold signature.

This is a repair to match already-frozen J3 law, not a policy change.

## Exact-head verification

At implementation head:

`18998bfe485a420046596ebba8a132691f02c2ff`

the following passed:

- Inkubator J4 Production Candidate Verification, push run `35403653150` — PASS;
- Inkubator J4 Production Candidate Verification, PR run `35403656052` — PASS;
- Inkubator Vault Verification `35403656058` — PASS;
- Inkubator J2 Verification `35403656061` — PASS;
- Inkubator Verification `35403656051` — PASS;
- generic CI, push run `35403653070` — PASS.

Generic CI includes:

- synthetic secret-detector canary;
- gitleaks working-tree scan;
- gitleaks full-history scan;
- canonical Node/toolchain;
- deterministic/source/product/Inkubator invariants;
- generated API-client contract;
- typecheck;
- unit tests;
- canonical production build.

## Independent reproducible-build evidence

J4 push run `35403653150` used two separate clean GitHub-hosted runners:

- `release_repro_a`;
- `release_repro_b`.

Each independently:

1. checked out the exact source head;
2. installed pinned Foundry `1.8.3`;
3. removed local build/cache output;
4. rebuilt the candidate;
5. computed vault and resolver creation/runtime bytecode hashes.

`release_repro_compare` passed exact equality for all four hashes.

This closes the same-environment-only reproducibility loophole for this candidate head.

It is not a deployed-code attestation.

## Read-only Ink/native-USDC identity evidence

J4 push run `35403653150` also executed the read-only dual-RPC asset probe.

Authority:

`READ_ONLY_NO_BROADCAST_NO_VALUE`

Provider pair:

- Gelato public Ink RPC;
- QuickNode public Ink RPC.

Both independently reported:

- Ink chain ID `57073`;
- native USDC at `0x2D270e6886d130D724215A266106e6832161EAEd`;
- nonempty native-USDC runtime code;
- identical runtime code hash:
  `0xb75df630ebbd1e0defee38b09288c536b18f5b3f17b1ac8e25d91ac4f79adf67`;
- decimals `6`;
- symbol `USDC`;
- `paused = false`;
- identical blacklister:
  `0x2163ed19c381a39cf9c564ee73badc35a95d7417`.

The distinct documented bridged `USDC.e` address:

`0xF1815bd50389c46847f0Bda824eC8da914045D14`

also has code on Ink but is explicitly frozen as:

`EXCLUDED_FROM_FIRST_CANDIDATE`

and the deployment planner rejects it.

The probe performs no signing, transfer, approval, funding, deployment or broadcast.

## Matrix coverage added in this tranche

### Constructor / identity

Evidence now directly covers:

- zero token/refund authority rejects;
- zero challenge/terms/binding digest rejects;
- zero prize rejects;
- authority independence already preserved from core suite;
- immutable constructor readback matches the local frozen deployment plan;
- real documented `USDC.e` identity is rejected by the candidate planner;
- deadline ceiling conversion is monotonic and never floors a not-before right.

Relevant J3 matrix rows include:

`A01 A02 A03 A04 A05 A07 A08 A09`

### Funding / payout freeze

Added or retained evidence for:

- exact one-shot funding;
- fee/short-transfer funding rejection;
- unsolicited dust cannot satisfy or change exact prize liability;
- wrong payout co-authority rejects;
- payout root/count cannot be resealed;
- canonical deterministic remainder ordering;
- fuzzed prize conservation in one- and three-qualifier paths.

Relevant rows include:

`B01 B02 B03 B04 B05 B06 B07 B08 C01 C02 C03 C05`

### Qualifier recovery / monotonic freeze

Added direct evidence for:

- pre-resolution recovery requires outcome + resolver;
- resolver-only recovery rejects before its boundary;
- resolver-only recovery works only after the frozen boundary;
- recovery members remain payout-root bounded;
- recovery evidence digest mutation invalidates authorization;
- default-manifest mutation invalidates authorization;
- final qualifier state cannot be frozen twice;
- stored default-manifest identity remains fixed.

Relevant rows include:

`D02 D03 D04 D05 D06 D11 D12`

### Organizer winner / deterministic default / terminal paths

Added or retained evidence that:

- organizer winner expires exactly at deadline;
- non-qualifier winner rejects;
- wrong winner amount rejects;
- frozen payout address/proof controls destination;
- defaults need no live authority signer once qualifier state is final;
- one/three/zero-qualifier deterministic economics conserve exact prize;
- terminal fallback remains signerless only under frozen preconditions;
- settlement authorization is single-use.

Relevant rows include:

`E01 E02 E03 E04 E05 F01 F02 F03 F05 F06 F08 F09 G01 G03 G04 G05 G06 G08 G09 G10 G11`

### ECDSA / ERC-1271

Added direct adversarial evidence for:

- high-s ECDSA rejection;
- invalid-v rejection;
- malformed-length rejection;
- zero-recovery rejection;
- immutable resolver returns exact ERC-1271 magic for two valid distinct signers;
- duplicate signer proof rejection;
- wrong-magic resolver rejection;
- reverting resolver rejection;
- short-return resolver rejection;
- a signature demonstrably valid for a different legitimate 2-of-3 resolver is rejected by the vault's frozen resolver;
- signatures cannot replay across vaults;
- signatures cannot replay across chain IDs;
- remaining two immutable resolver signers retain quorum after loss of any one signer;
- resolver ABI has no mutating signer/threshold/module/upgrade surface.

Relevant rows include:

`H01 H02 H03 H04 H05 H06 H07 H09 H10 H11 H12 H13`

### Claims / token behavior / conservation

Added direct evidence for:

- duplicate claim rejects;
- reentrant token cannot double claim;
- blocked/reverting recipient does not block another recipient;
- failed claim preserves liability;
- exact vault-debit + recipient-credit accounting remains enforced;
- no-return exact ERC-20 behavior succeeds under the explicit optional-return wrapper policy;
- malformed/false-return behavior fails closed;
- pause causes a failed-but-recoverable claim;
- unpause allows the preserved claim to complete;
- fuzzed `totalClaimed <= prize`;
- fuzzed post-authorization conservation;
- finalized iff exact prize claimed.

Relevant rows include:

`I01 I02 I03 I04 I05 I06 I07 I08 I09 J05 J06 J07 J08 J09 J10`

### Forbidden surfaces

Compiled-artifact verification now asserts:

- no owner/admin/sweep/rescue-style callable surface;
- no arbitrary-call/withdraw/upgrade/proxy/yield/swap/bridge/fee callable surface;
- resolver callable ABI is view/pure only;
- resolver ABI is exactly the expected verification/getter surface;
- vault and resolver runtime opcode listings contain no `SELFDESTRUCT`;
- vault and resolver runtime opcode listings contain no `DELEGATECALL`;
- J4 CI contains no `forge ... --broadcast`, `cast send`, production private-key or mainnet-RPC execution path.

Relevant rows include:

`H12 K01 K02 K03 K04 K05 K06 K07 P01 P04 P05`

### Finality / reconciliation

Existing repaired adapter evidence plus added properties cover:

- submitted/included evidence is never directly treated as settlement truth;
- two approved providers must agree on expected settlement tx/block;
- wrong tx stays reconciling;
- wrong chain stays reconciling;
- missing/unknown/duplicate provider stays reconciling;
- receipt/block-hash disagreement stays reconciling;
- simulated canonical-hash disagreement/reorg stays reconciling;
- provider finalized-head lag stays reconciling;
- identical reconciliation evidence is idempotent.

Relevant rows include:

`L01 L02 L03 L04 L05 L06 L07 L08 L09`

### Release identity

This tranche now directly proves:

- pinned toolchain builds candidate hashes;
- creation/runtime hashes are reproduced;
- a clean independent second runner reproduces the same hashes;
- constructor immutables can be read back locally against the plan;
- explorer verification is not used as sole identity truth.

Relevant rows include:

`M01 M02 M03 M06 M07`

## Still open before external-audit handoff

The tranche intentionally does **not** pretend the full J3 matrix is closed.

Material remaining work includes:

### Cross-language known-answer vectors

Hard-code and verify JS ↔ Solidity exact known-answer vectors for:

- payout leaf/root;
- qualifier-set authorization including default manifest;
- organizer-winner authorization;
- EIP-712 domain.

Remaining rows include:

`C07 D09 E06 H08`

### Controlled native-USDC behavior exercise

The live probe is identity/read-only evidence only.

Still needed in a controlled fork/test environment:

- exact native-USDC proxy accepted by the actual candidate workflow;
- canonical native-USDC `transfer/transferFrom` behavior through the safe wrapper;
- explicit production-candidate fork receipt.

Remaining rows include:

`J01 J04`

No real mainnet value or production broadcast is authorized.

### Deployed-code attestation

Still unavailable without a separately authorized candidate deployment:

- two-provider `eth_getCode` comparison against approved release runtime hash.

Remaining:

`M04`

### Negative release differentiation

Still needed:

- prove altered compiler/optimizer/source produces a distinct candidate and cannot satisfy the frozen release identity.

Remaining:

`M05`

### Signer operations

Still needed before audit/launch readiness:

- ordinary app secret inventory proving no production outcome/resolver private key;
- durable human-readable signer request/digest parity;
- duplicate signing request idempotency;
- signer-loss/compromise operating drill receipts beyond the contract-level quorum proof.

Remaining includes:

`N01 N02 N05 N07 N08`

### Receipt / correction / privacy operations

Still needed:

- append-only/superseding finalized-reconciliation correction semantics;
- receipt correction without destructive mutation;
- explicit contract event/storage privacy inventory;
- deployment/signing log secret inventory/canary evidence.

Remaining includes:

`L10 O01 O02 O03 O04 O05 O06`

### Broader state-machine completeness

The fuzz/property tranche materially strengthens conservation and replay coverage, but this receipt does not claim every legal state transition has been exhaustively modeled by a dedicated handler-based state machine.

Any remaining unmapped Critical/High threat row must be closed or explicitly handed to the external reviewer before J4 audit handoff.

## Authority after this tranche

```text
J4_CORE_IMPLEMENTATION = PASS
J4_PREAUDIT_MATRIX_TRANCHE = PASS
J4_STAGE_CLOSED = NO
EXTERNAL_AUDIT_HANDOFF_READY = NO
PRODUCTION_MONEY = NOT_AUTHORIZED
MAINNET_DEPLOYMENT = NOT_AUTHORIZED
PRODUCTION_SIGNERS = NOT_AUTHORIZED
EXTERNAL_AUDIT = NOT_STARTED
LEGAL_GATE = OPEN
MERGE_AUTHORITY = NONE
```

## Next bounded action

The smallest next tranche is:

1. add hard-coded JS ↔ Solidity known-answer digest vectors;
2. add controlled native-USDC fork behavior tests with **no broadcast/no real value**;
3. add negative release-differentiation tests;
4. freeze append-only reconciliation/correction semantics;
5. prepare signer/secret/privacy operations evidence.

Only after those are green should J4 be assessed for external smart-contract audit handoff.
