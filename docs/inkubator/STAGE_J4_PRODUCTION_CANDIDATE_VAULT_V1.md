# REKT INKUBATOR — STAGE J4 PRODUCTION-CANDIDATE VAULT V1

**Status:** ACTIVE / CORE IMPLEMENTED + VERIFIED / PRE-AUDIT MATRIX NEXT  
**Date:** 2026-09-19  
**Branch:** `agent/stage-j4-production-candidate-vault-v1`  
**Base:** J3 closure head `da346243e6fbcf5e259bdd8de85c0e099a6e1adc`  
**Verified implementation head:** `f5875e3be51c21bf55fcf83583f9af5ca9b22403`  
**J4 verification:** `35401916531` — PASS  
**Vault verification:** `35401916544` — PASS  
**J2 regression:** `35401916669` — PASS  
**Generic CI:** `35401916601` — PASS  
**Hostile review:** `5253171614` — 3 HIGH / repaired  
**Targeted rereview:** `5253190481` — PASS / original High findings closed  
**Implementation receipt:** `STAGE_J4_IMPLEMENTATION_RECEIPT_V1.md`  
**Production-money authority:** NONE  
**Mainnet deployment authority:** NONE  
**Production-signer authority:** NONE  
**Merge authority:** NONE  
**External smart-contract audit:** NOT STARTED

## Objective

Implement the smallest auditable production-candidate delta frozen by Stage J3 while preserving all J1/J2 evidence as immutable ancestry.

J4 is implementation and verification only.

It does not deploy to Ink mainnet, move native USDC, create production signer secrets, introduce custody/fees, or authorize external funding.

## Reuse law

J4 does not mutate the reviewed J1 testnet contract.

It adds an isolated candidate contract beside it so:

- J2 public rehearsal evidence remains attributable to the exact J1/J2 bytecode lineage;
- production-specific authority/liveness semantics are reviewable as an explicit delta;
- testnet rehearsal scripts remain synthetic-only;
- a production candidate cannot be mistaken for an already-audited or already-deployed contract.

## Candidate contracts

### `ProductionCandidateChallengeVault.sol`

Preserves proven J1 primitives:

- exact funding delta;
- Merkle payout roster;
- frozen payout addresses/order;
- low-s ECDSA;
- claimable pull payments;
- claim isolation;
- no owner/admin sweep;
- no arbitrary external call;
- no upgrade path;
- no fee/yield/swap/bridge;
- exact conservation accounting;
- exact vault-debit + recipient-credit verification on claims, so short/fee delivery cannot be counted as paid.

Adds the J3 production-candidate delta:

- immutable activation / organizer / resolution / terminal deadlines;
- immutable pre-build-refund manifest;
- immutable terminal-refund manifest;
- payout seal closes exactly at activation boundary;
- qualifier freeze stores exactly one default settlement manifest digest;
- normal qualifier freeze requires outcome + organizer authority;
- recovery qualifier freeze after the resolution boundary requires the immutable resolver threshold only;
- recovery binds a nonzero recovery-evidence digest;
- deterministic defaults after organizer deadline require no live signer;
- terminal fallback after long-stop requires no live signer;
- organizer winner remains bounded to frozen qualifier membership + exact frozen payout address;
- resolver recovery cannot replace an existing qualifier set;
- recovery closes at the terminal boundary.

### `ImmutableResolver1271.sol`

Verification-only ERC-1271 authority:

- exactly three immutable signer addresses;
- exactly 2-of-3 quorum;
- exactly two concatenated canonical 65-byte ECDSA signatures;
- duplicate signer proofs reject;
- non-member proofs reject;
- no owner mutation;
- no threshold mutation;
- no module/delegatecall;
- no upgrade;
- no custody;
- no arbitrary transaction execution.

ERC-1271 success magic remains:

`0x1626ba7e`

## Refund-path disambiguation

J3 freezes two different refund meanings:

1. **pre-build refund** — payout roster never sealed by activation deadline;
2. **terminal refund** — payout roster was sealed, but authoritative qualification never became final before complete recovery failure.

J4 therefore requires `payoutSetSealed == true` for the terminal path.

If the payout roster was never sealed, the pre-build refund remains the canonical path even after the long-stop.

This is a fail-closed implementation consequence of J3's immutable-manifest rule: a permissionless caller may not choose between two different receipt identities for the same unresolved state merely by waiting longer.

This interpretation is explicitly in hostile-review scope.

## Deadline law

Every off-chain not-before timestamp is converted before construction using:

`ceil(deadline_ms / 1000)`

The J4 adapter derives:

- `activation_deadline_seconds`;
- `organizer_selection_deadline_seconds`;
- `resolution_deadline_seconds = organizer + 72h`;
- `terminal_long_stop_seconds = organizer + 30d`.

Boundary semantics in Solidity:

- payout seal: allowed only while `timestamp < activation`;
- pre-build refund: allowed at `timestamp >= activation`;
- organizer winner: allowed only while `timestamp < organizer`;
- deterministic default: allowed at `timestamp >= organizer`;
- normal qualifier freeze: allowed only while `timestamp < resolution`;
- resolver recovery: allowed while `resolution <= timestamp < terminal`;
- terminal refund: allowed at `timestamp >= terminal`.

## Chain / asset planning boundary

The J4 deployment-plan adapter freezes the only candidate tuple:

- chain: Ink mainnet;
- chain id: `57073`;
- asset: Circle-issued native USDC;
- exact token address: `0x2D270e6886d130D724215A266106e6832161EAEd`;
- decimals: `6`.

The Solidity vault keeps the token address immutable per deployment.

Wrong-chain/wrong-token rejection is enforced by the candidate deployment/release workflow before funding; J4 does not deploy anything.

## Finality / reconciliation

J4 application reconciliation requires exactly the frozen provider pair `gelato` + `quicknode` and an explicit expected settlement transaction hash.

`FINALIZED` is returned only if:

- both observations are for Ink chain ID `57073`;
- both observations report the exact expected settlement transaction hash;
- both report transaction success;
- both agree on receipt block number and receipt block hash;
- each provider's canonical block hash equals the receipt block hash;
- both finalized heads are at or above the receipt block.

Anything else remains:

`RECONCILING`

No arbitrary confirmation count is used as final monetary truth.

## Release identity tooling

The J4 adapter can build a non-production candidate release receipt binding:

- source commit;
- Foundry `1.8.3`;
- Solidity `0.8.37`;
- EVM `prague`;
- optimizer enabled / 200 runs;
- metadata hash `none`;
- FFI disabled;
- `foundry.toml` digest;
- artifact digest;
- constructor ABI digest;
- vault creation/runtime bytecode hashes;
- resolver creation/runtime bytecode hashes;
- resolver signer-set digest;
- 2-of-3 quorum;
- Ink chain ID;
- exact native-USDC address;
- `EXTERNAL_AUDIT = NOT_STARTED`;
- `PRODUCTION_MONEY = NOT_AUTHORIZED`.

A release receipt is evidence, not deployment authority.

## Current verification contract

The initial J4 suite covers at minimum:

- immutable 2-of-3 ERC-1271 validity;
- duplicate/outsider resolver rejection;
- exact one-shot funding;
- fee-on-transfer rejection;
- authority independence;
- deadline ordering;
- pre-build refund boundary;
- payout-seal race closure;
- pre-build path permanently disabled after payout seal;
- qualifier-bound default manifest identity;
- signerless one-qualifier default;
- signerless equal distribution + canonical remainder;
- signerless zero-qualifier refund;
- resolver recovery timing and quorum;
- recovery closure at terminal boundary;
- terminal refund timing;
- blocked-recipient claim isolation;
- short/fee claim delivery rejects without consuming liability;
- false-return and malformed-return claim behavior fails closed;
- two-provider finalized-evidence agreement;
- finality bound to exact expected settlement tx + Ink chain ID + frozen provider pair;
- wrong tx / wrong chain / unknown or duplicate provider rejects to reconciling;
- provider disagreement / lag / reorg evidence remains reconciling;
- exact native-USDC planning tuple;
- deadline ceiling vectors;
- candidate release receipt toolchain locks.

The full J3 matrix remains the acceptance ceiling. Missing matrix rows are not silently treated as PASS.

## Bounded hostile review evidence

Hostile review `5253171614` returned `3 HIGH / FIX REQUIRED`:

1. finality was not bound to the expected settlement tx / frozen chain / provider set;
2. a short successful token transfer could be counted as a full claim;
3. the public-USDC gitleaks exception was unanchored at line scope.

All three were repaired. Targeted rereview `5253190481` returned `PASS / ORIGINAL_HIGH_FINDINGS_CLOSED` on repair head `f5875e3be51c21bf55fcf83583f9af5ca9b22403`.

Exact repair-head verification passed J4, Vault, J2 regression and generic CI. The durable receipt is `STAGE_J4_IMPLEMENTATION_RECEIPT_V1.md`.

J4 is intentionally **not** marked stage-closed yet: the remaining J3 pre-external-audit matrix classes stay explicit and must not be inferred from the focused core suite.

## Bounded completion

J4 follows:

`IMPLEMENT → TEST → ONE hostile review → fix Critical/High → ONE targeted rereview iff required → CLOSE/MERGE ONLY WHEN AUTHORIZED`

No review loops.

## Explicit non-authority

J4 does not authorize:

- Ink mainnet deployment;
- real USDC movement;
- production private keys/signers;
- app/runtime custody;
- production fees;
- external-user funding;
- an audit-passed claim;
- legal/compliance approval;
- merge.

Permanent status during J4:

```text
PRODUCTION_MONEY = NOT_AUTHORIZED
MAINNET_DEPLOYMENT = NOT_AUTHORIZED
PRODUCTION_SIGNERS = NOT_AUTHORIZED
EXTERNAL_AUDIT = NOT_STARTED
LEGAL_GATE = OPEN
MERGE_AUTHORITY = NONE
```
