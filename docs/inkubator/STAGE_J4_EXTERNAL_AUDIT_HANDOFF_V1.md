# REKT INKUBATOR — STAGE J4 EXTERNAL SMART-CONTRACT AUDIT HANDOFF V1

**Status:** TECHNICAL PACKAGE READY FOR EXTERNAL SMART-CONTRACT AUDIT / J4 NOT CLOSED  
**Date:** 2026-09-19  
**Repository:** `CipherCuttle/rekt-terminal`  
**Branch:** `agent/stage-j4-production-candidate-vault-v1`  
**PR:** #129 — draft / open / unmerged  
**Exact auditor scope head:** `05e345181dfde2c720874b1fc2d1ee7dd39272a9`  
**Merge authority:** NONE  
**Mainnet deployment authority:** NONE  
**Production-money authority:** NONE  
**Production-signer authority:** NONE  
**External smart-contract audit:** NOT STARTED  
**Legal/accounting/privacy gates:** OPEN

## 1. Verdict

`TECHNICAL_AUDIT_HANDOFF_READY`

The production-candidate source, tests, threat model, reproducible-release evidence,
controlled native-USDC integration evidence, signer/recovery model and reconciliation
controls are ready to be given to an independent smart-contract security reviewer.

This is **not**:

- an audit-passed claim;
- Stage-J4 closure;
- mainnet deployment authorization;
- production-USDC authorization;
- production signer/key authorization;
- legal/compliance approval;
- merge authorization.

The auditor must scope the exact commit above. Later documentation-only commits do not
silently alter that code scope.

## 2. Auditor code scope

Primary implementation:

- `contracts/inkubator-vault/src/ProductionCandidateChallengeVault.sol`;
- `contracts/inkubator-vault/src/ImmutableResolver1271.sol`.

Primary contract evidence:

- `contracts/inkubator-vault/test/ProductionCandidateChallengeVault.t.sol`;
- `contracts/inkubator-vault/test/ProductionCandidatePreAuditMatrix.t.sol`;
- `contracts/inkubator-vault/test/ProductionCandidateKnownAnswer.t.sol`;
- `contracts/inkubator-vault/foundry.toml`.

Application / release boundary:

- `packages/inkubator-protocol/src/production-candidate-vault-adapter.mjs`;
- `packages/inkubator-protocol/src/payout-roster.mjs`;
- `packages/inkubator-protocol/test/stage-j4-production-candidate.test.mjs`;
- `scripts/inkubator/stage-j4-release-candidate.mjs`;
- `scripts/inkubator/stage-j4-known-answer-vectors.mjs`;
- `scripts/inkubator/stage-j4-preaudit-verify.mjs`;
- `scripts/inkubator/stage-j4-readonly-ink-asset-probe.mjs`;
- `scripts/inkubator/stage-j4-controlled-fork-usdc.mjs`;
- `scripts/inkubator/stage-j4-release-differentiation.mjs`;
- `.github/workflows/inkubator-j4.yml`.

Authority / threat / acceptance inputs:

- `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`;
- `STAGE_J3_PRODUCTION_VALUE_DECISIONS_V1.md`;
- `STAGE_J3_PRODUCTION_VALUE_THREAT_MATRIX_V1.md`;
- `STAGE_J3_PRODUCTION_CANDIDATE_TEST_MATRIX_V1.md`;
- `STAGE_J3_SIGNER_CUSTODY_RUNBOOK_V1.md`;
- `STAGE_J3_REPRODUCIBLE_DEPLOYMENT_IDENTITY_V1.md`;
- `STAGE_J3_EXTERNAL_REVIEW_PACKAGE_V1.md`;
- `STAGE_J4_IMPLEMENTATION_RECEIPT_V1.md`;
- `STAGE_J4_PREAUDIT_MATRIX_RECEIPT_V1.md`;
- this handoff.

## 3. Exact-head verification

At exact auditor scope head:

`05e345181dfde2c720874b1fc2d1ee7dd39272a9`

the following completed successfully:

- Inkubator J4 Production Candidate Verification, push run `35405529740` — PASS;
- Inkubator J4 Production Candidate Verification, PR run `35405530719` — PASS;
- Inkubator Vault Verification `35405530824` — PASS;
- Inkubator J2 Verification `35405530700` — PASS;
- Inkubator Verification `35405530816` — PASS;
- generic CI, push run `35405529606` — PASS.

Generic CI includes:

- fast secret sanity check;
- synthetic gitleaks detector canary;
- gitleaks working-tree scan;
- gitleaks history scan;
- canonical toolchain verification;
- deterministic/source/product/Inkubator invariants;
- generated API-client contract verification;
- typecheck;
- repository unit suite;
- canonical production build.

The bounded internal review cycle remains:

- hostile review `5253171614` — three High findings;
- all three High findings repaired;
- targeted rereview `5253190481` — PASS / original High findings closed.

No second broad internal review loop was created.

## 4. Production-candidate law in scope

The reviewer should treat the following as frozen requirements.

### Asset / chain

- Ink mainnet chain ID `57073`;
- native Circle-issued USDC only;
- exact token address `0x2D270e6886d130D724215A266106e6832161EAEd`;
- six decimals;
- bridged `USDC.e` at `0xF1815bd50389c46847f0Bda824eC8da914045D14` excluded;
- initial platform fee zero.

### Authority

- organizer and outcome are independent authorities;
- resolver is an immutable verification-only ERC-1271 contract;
- resolver signer set exactly three immutable addresses;
- resolver quorum exactly 2-of-3;
- no owner/threshold/module/upgrade/delegatecall/custody/arbitrary-execution surface;
- ERC-1271 verification subcall has a fixed gas ceiling and fails closed on gas grief.

### Qualifier recovery

Before `resolution_deadline`:

`RECOVERY = outcome + resolver threshold`

At/after `resolution_deadline` and before `terminal_long_stop`, only if no qualifier set exists:

`RECOVERY = resolver threshold only`

An existing qualifier set can never be replaced.

### Deterministic settlement

Once the final qualifier set is frozen:

- exact default manifest identity is frozen with it;
- organizer selection is available only before organizer deadline;
- after organizer deadline the mathematical default is permissionless;
- one qualifier → 100%;
- multiple qualifiers → equal split with canonical payout-order remainder;
- zero qualifiers → immutable refund recipient;
- no fresh outcome/organizer/resolver signature is required.

Pre-build and terminal refund manifests are immutable and permissionless paths accept no
caller-selected manifest.

### Accounting

- one exact prize liability;
- exact funding delta;
- exact claim vault debit;
- exact recipient balance credit;
- claimable zeroed before token call;
- explicit nonreentrancy;
- `totalClaimed <= prizeAmount`;
- authorized credits must equal exact prize;
- final only when exact prize is claimed.

## 5. Cross-language signature / digest evidence

The package contains independent JS and Solidity known-answer vectors.

Frozen vector values include:

- domain separator:
  `0x204531b5999ca51070b22a39919156f03fbd230b8bbae0cc64e73217a5f336fc`;
- payout leaf A:
  `0x281a7222c0e843ba2a41febded46e963bf6cde4ba6697bcfa51c6537e7b8f643`;
- payout leaf B:
  `0x2253be8e577fb53a76895f2866840e7ff437a9302922fbe7fbbe6f3f031b2bc2`;
- payout root:
  `0x0195b69843ca1d3cc2e4bfdb67b9a5d3c0719929a033f045db6d90095cf0312d`;
- payout-set digest:
  `0xa1f6397f2ba892b494c657bc6a183ec44183a2ed8be3a62b9f8ecd5ae5202e19`;
- qualifier-set digest:
  `0xfd1656fab8c2c886907ad90e2653f37eafd7da10244871054c8dea25ac7cf138`;
- organizer-winner digest:
  `0x8244a6f57602be276724496196eebca9bbcaaa216145be78d2d8991c09446fc8`.

The JS side manually encodes the ABI/EIP-712 structure and uses `cast keccak` only as the
hash primitive. Solidity independently recomputes the same fixed vectors.

Synthetic known-answer tests also verify:

- an outcome EOA signature over the frozen qualifier digest;
- a 2-of-3 resolver proof over the same digest.

No production signer material is used.

## 6. Replay / ERC-1271 evidence

The adversarial suite covers:

- cross-vault replay rejection;
- cross-chain/domain replay rejection;
- high-s ECDSA rejection;
- bad-v rejection;
- malformed signature rejection;
- zero-recovery rejection;
- duplicate resolver signer rejection;
- outsider resolver signer rejection;
- wrong ERC-1271 magic;
- ERC-1271 revert;
- ERC-1271 short return;
- signature valid for a different legitimate resolver rejected by the frozen resolver;
- gas-burning resolver fails closed under bounded staticcall gas;
- one lost resolver signer leaves the remaining two with valid quorum.

## 7. Payout-plan / identity evidence

J2 and J4 now share one zero-dependency canonical payout-roster primitive.

It freezes:

- UTF-8 byte ordering of entry IDs;
- deterministic payout order;
- SHA-256 entry digest;
- lowercase payout address;
- unique entry ID;
- unique payout address;
- maximum first-candidate recipient count.

J4 additionally builds a content-addressed payout activation plan and rejects an immutable
refund recipient that equals any entrant payout address.

A non-ASCII vector freezes the expected canonical order:

`a → z → ä`

for the supplied test set.

## 8. Native Ink USDC evidence

### Controlled fork

The J4 workflow starts an isolated local Anvil fork of Ink using local chain ID `31337`.

The fork exercise verifies:

- native USDC code exists;
- documented USDC.e code exists;
- native USDC decimals = 6;
- native symbol = `USDC`;
- native zero-value `transfer` returns true;
- native zero-value `transferFrom` returns true;
- candidate planner accepts exact native USDC;
- candidate planner rejects documented USDC.e.

Authority:

`LOCAL_FORK_ONLY_NO_UPSTREAM_BROADCAST_NO_REAL_VALUE`

### Dual-RPC live identity probe

The read-only Gelato + QuickNode probe independently agreed on:

- Ink chain ID `57073`;
- native USDC runtime code hash:
  `0xb75df630ebbd1e0defee38b09288c536b18f5b3f17b1ac8e25d91ac4f79adf67`;
- decimals `6`;
- symbol `USDC`;
- `paused = false`;
- blacklister:
  `0x2163ed19c381a39cf9c564ee73badc35a95d7417`;
- legacy Zeppelin implementation slot:
  `0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3`;
- implementation:
  `0xdd588d02e5df74d112f9c167cdea0b8ba5382369`;
- implementation runtime hash:
  `0xac3ddd8c3008f2fe72deb685982652765784cd3380166c995986a7480b1e27b4`;
- legacy Zeppelin admin slot:
  `0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b`;
- proxy admin:
  `0x1f91b0a56562d5bbb43a4c0cfacc11613550bf22`.

The probe is read-only and performs no signing, approval, transfer, deployment or broadcast.

The USDC proxy/admin is an external issuer-controlled dependency and must remain a residual
risk in the audit report. J4 cannot make Circle's asset immutable.

## 9. Token / claim adversarial evidence

Mock/fuzz tests cover:

- fee/short funding;
- unsolicited token dust;
- short claim delivery;
- false-return token;
- malformed return token;
- supported no-return token behavior;
- malicious reentrant token;
- paused token with recoverable liability after unpause;
- blocked recipient isolation;
- duplicate claim;
- fuzzed one-recipient conservation;
- fuzzed three-recipient distribution/remainder conservation.

## 10. Release identity evidence

Frozen release inputs include:

- Foundry `1.8.3`;
- solc `0.8.37`;
- EVM `prague`;
- optimizer enabled / 200 runs;
- metadata hash none;
- FFI disabled;
- source commit;
- Foundry-config digest;
- artifact digest;
- constructor ABI digest;
- vault creation/runtime hashes;
- resolver creation/runtime hashes;
- resolver signer-set digest/quorum;
- chain/token identity.

Two independent clean GitHub runners rebuild the exact source and must agree on all vault/resolver
creation/runtime hashes.

A separate negative gate builds an intentionally mutated source variant
(`MAX_RECIPIENTS = 4` instead of the frozen `3`) and proves it does **not** match the frozen
candidate bytecode identity.

The earlier attempted optimizer-only mutation `200 → 201` happened to produce identical
candidate bytecode and is therefore not used as evidence.

## 11. Finality / append-only reconciliation

Application finality requires:

- explicit expected transaction hash;
- Ink chain `57073`;
- exact frozen provider pair `gelato + quicknode`;
- successful receipt;
- provider agreement on tx/block number/block hash;
- each provider's canonical block hash matching the receipt block;
- both finalized heads covering the receipt block.

Any missing/disagreeing/reorg/lag evidence remains `RECONCILING`.

Economic correction history is append-only:

- initial `FINALIZED` receipt does not supersede;
- correction creates a new receipt;
- correction must supersede the latest receipt;
- correction cannot change settlement transaction identity;
- identical replay is idempotent;
- payload mutation under the same record ID conflicts.

## 12. Signing boundary / operations evidence

The ordinary application builds unsigned, content-addressed signing requests only.

Each request commits:

- stable request ID;
- authority role;
- action;
- chain ID;
- vault;
- typed-data digest;
- human-readable fields;
- digest of those displayed fields;
- whole request digest.

Identical request replay is idempotent. Changed semantic payload under the same request ID conflicts.

Static verification asserts J4 workflow/scripts contain no:

- production signer private-key input;
- outcome/resolver/organizer private-key variable;
- mnemonic/seed phrase;
- GitHub `secrets.*` signer dependency;
- `cast send`;
- `forge ... --broadcast`.

Generic CI also executes the repository secret-scanner detector canary, working-tree scan and history scan.

Synthetic loss/liveness evidence covers:

- all normal/default authorities unavailable after qualifier freeze → deterministic default remains executable;
- outcome unavailable before qualification completion → timed resolver recovery exists;
- one resolver signer lost → remaining two retain quorum;
- privileged resolver quorum unavailable → terminal long-stop remains permissionless under exact preconditions.

Actual production signer generation/custody/tabletop is intentionally **not performed** because:

`PRODUCTION_SIGNERS = NOT_AUTHORIZED`

The production ceremony remains a pre-launch operations gate after audit findings are resolved.

## 13. On-chain privacy / forbidden surfaces

Static artifact verification asserts:

- no owner/admin sweep/rescue;
- no arbitrary external-call surface;
- no arbitrary-recipient withdrawal;
- no proxy/upgrade setter;
- no yield/swap/bridge/fee surface;
- no `SELFDESTRUCT`;
- no `DELEGATECALL`;
- resolver callable surface is only immutable verification/getters;
- vault events expose no dynamic string/bytes/array blobs;
- event schema exposes no GitHub/user/email/repository/display-name metadata;
- evidence fields remain opaque `bytes32`;
- public zero-argument getters expose no dynamic private blob.

This is technical minimization evidence. DPIA/privacy-law approval remains external.

## 14. Critical / High threat disposition

The J3 Critical/High threat matrix now has executable or static technical evidence for the
production-candidate mechanisms, including payout redirection, co-authority, replay, ECDSA,
ERC-1271 malformed/gas-grief behavior, root/manifest substitution, canonical ordering,
deadline/liveness paths, token behavior, reentrancy, claims, forbidden admin/upgrade surfaces,
release identity, provider disagreement/finality, signer isolation, active-authority immutability,
refund/entrant conflict, privacy minimization, append-only receipts, fee-zero and accidental
production-broadcast boundaries.

Residual categories that remain deliberately outside internal technical closure:

### External smart-contract review

The auditor must independently challenge all controls above and may add new threats.

`EXTERNAL_AUDIT = NOT_STARTED`

### Deployment-dependent attestation

J3 matrix row `M04` requires two-provider `eth_getCode` comparison of the **actually deployed**
candidate against the approved release runtime hash.

No mainnet candidate exists because deployment authority is NONE.

Therefore:

`M04 = POST_AUDIT / PRE_FUNDING DEPLOYMENT GATE`

It is not fabricated with a local deployment and is not treated as PASS.

### Production signer ceremony

Actual hardware/offline outcome and resolver signer creation, custody separation, operator incident
drills and public-address register remain pre-launch operational gates.

No production keys are created merely to satisfy an audit-package checkbox.

### Terminal-refund product/legal residual

The long-stop full-refund policy guarantees liveness but can disadvantage valid builders if all
qualification/recovery authority disappears before qualification freezes.

This disclosed fairness tradeoff remains an external product/legal/terms acceptance gate.

### Asset issuer control

Native USDC is an externally upgradeable/pausable/blacklistable proxy.

Its implementation/admin identities are recorded, but issuer censorship/upgrades cannot be eliminated
by the Challenge vault.

### Legal / accounting / privacy / eligibility

Still separately required before production money:

- Swedish/EU legal classification including MiCA/PSD/CASP where applicable;
- AML/sanctions duties if applicable;
- tax/VAT/accounting/invoicing;
- terms/IP/consumer/business analysis;
- DPIA/privacy;
- age/entity/participant eligibility.

The smart-contract auditor is not asked to certify these.

## 15. Auditor request

The reviewer should independently answer the questions in
`STAGE_J3_EXTERNAL_REVIEW_PACKAGE_V1.md` and prioritize:

- unauthorized prize redirection;
- permanent or economically coercive fund lock;
- qualification/recovery authority bypass;
- replay/signature ambiguity;
- ERC-1271 boundary behavior;
- malicious/nonstandard token accounting;
- claim/reentrancy/conservation failure;
- deterministic-default and terminal-liveness failure;
- hidden mutation/admin/upgrade surface;
- bytecode/release identity mismatch;
- false finality/reconciliation.

Critical/High findings block the candidate.

After fixes, perform one targeted verification of those fixes. Do not create an unbounded internal
review loop.

## 16. Authority after handoff

```text
J4_CORE_IMPLEMENTATION = PASS
J4_INTERNAL_PREAUDIT_TECHNICAL_PACKAGE = PASS
EXTERNAL_AUDIT_HANDOFF = READY
EXTERNAL_AUDIT = NOT_STARTED
J4_STAGE_CLOSED = NO
PRODUCTION_MONEY = NOT_AUTHORIZED
MAINNET_DEPLOYMENT = NOT_AUTHORIZED
PRODUCTION_SIGNERS = NOT_AUTHORIZED
LEGAL_GATE = OPEN
MERGE_AUTHORITY = NONE
```

The next legitimate engineering/security action is independent external review of the exact auditor
scope head. Production deployment/value work remains blocked until that review and the separate
external/operational gates are resolved.
