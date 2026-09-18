# REKT INKUBATOR — STAGE J4 PRODUCTION-CANDIDATE VAULT V1

**Status:** ACTIVE / IMPLEMENTED / VERIFY NEXT  
**Date:** 2026-09-19  
**Branch:** `agent/stage-j4-production-candidate-vault-v1`  
**Base:** J3 closure head `da346243e6fbcf5e259bdd8de85c0e099a6e1adc`  
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
- exact conservation accounting.

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

J4 application reconciliation requires exactly two distinct provider observations.

`FINALIZED` is returned only if both observations agree on:

- successful transaction;
- transaction hash;
- receipt block number;
- receipt block hash;
- canonical block hash;

and both finalized heads are at or above the receipt block.

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
- two-provider finalized-evidence agreement;
- provider disagreement / lag / reorg evidence remains reconciling;
- exact native-USDC planning tuple;
- deadline ceiling vectors;
- candidate release receipt toolchain locks.

The full J3 matrix remains the acceptance ceiling. Missing matrix rows are not silently treated as PASS.

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
