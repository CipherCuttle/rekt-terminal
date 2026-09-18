# REKT INKUBATOR — STAGE J1 TESTNET CHALLENGE VAULT V1

**Status:** ACTIVE / TESTNET-CONTRACT SLICE  
**Date:** 2026-09-18  
**Branch:** `agent/stage-j1-testnet-vault-v1`  
**Base:** Stage-J0 exact head `fa0d6d71e9bdf906d077f82dabb4c00563f951bc`  
**Production-money authority:** NONE  
**Mainnet deployment authority:** NONE  
**Merge authority:** NONE

## 1. Objective

Implement the smallest executable `TESTNET_CHALLENGE_VAULT` behind the Stage-J0 settlement adapter without giving the normal Inkubator web/API arbitrary prize-redirection authority.

J1 proves contract mechanics only:

`TEST FUND → FREEZE PAYOUT SET → AUTHORIZE OUTCOME → CREATE CLAIMS → CLAIM → FINALIZE`

It does not deploy to a public testnet in this slice. It does not add any production asset, private key, signing service, transaction broadcaster, platform fee, or production settlement route.

## 2. Contract boundary

The vault is one bounded Challenge instance with immutable:

- settlement token;
- Challenge digest;
- frozen terms digest;
- J0 adapter-binding digest;
- exact prize amount;
- frozen refund recipient;
- Inkubator outcome authority;
- organizer-selection authority;
- resolver authority.

The contract has deliberately **no**:

- owner;
- upgrade/proxy mechanism;
- admin sweep;
- arbitrary withdrawal;
- arbitrary recipient setter;
- yield/staking/swap/bridge path;
- oracle;
- platform-fee path;
- generic external call.

A later production version must be separately designed and audited. J1 is not production code by declaration or implication.

## 3. Funding law

Funding is one-shot and exact.

The vault rejects:

- a second funding attempt;
- a non-zero pre-funding token balance;
- a transfer whose observed balance delta is not the exact frozen prize.

The last rule deliberately rejects fee-on-transfer behavior for the test vault.

Direct unsolicited token transfers after funding are not part of Challenge accounting and have no admin sweep path in J1.

## 4. Frozen payout set

Before winner/default settlement, J1 seals a bounded payout set of at most three builder recipients.

The payout set is a domain-separated Merkle root over:

`entryDigest + payoutAddress`

Sealing requires signatures from both:

- `INKUBATOR_OUTCOME`;
- `ORGANIZER_SELECTION`.

Those authority addresses are immutable and must be different.

This models the future product invariant that payout identities are frozen before settlement and that no single normal winner authority can silently change the recipient set.

## 5. Authorization model

J1 uses EIP-712-style domain-separated authorization digests bound to:

- chain ID;
- vault address;
- Challenge digest;
- terms digest;
- adapter-binding digest;
- manifest digest;
- payout-set root;
- settlement kind;
- exact recipient digest.

Testnet signer roles are EOA-only in J1. Contract-wallet/EIP-1271 support is explicitly deferred to a later production-readiness slice.

### Winner payout

Requires:

- recipient membership proof against the frozen payout root;
- exact full-prize amount;
- `INKUBATOR_OUTCOME` signature;
- `ORGANIZER_SELECTION` signature.

### Default distribution

Requires:

- 2–3 recipient membership proofs;
- unique ascending entry digests;
- deterministic equal-split economics, with at most one minor-unit difference;
- exact prize conservation;
- `INKUBATOR_OUTCOME` signature.

The equal-split rule itself is the on-chain `FROZEN_POLICY`; it cannot be replaced by a signed skewed split.

### No-qualifier refund

Requires:

- sealed payout set;
- frozen refund recipient;
- exact full prize;
- `INKUBATOR_OUTCOME` signature.

### Resolver cancellation

Requires:

- funded vault;
- frozen refund recipient;
- exact full prize;
- separate resolver signature.

J1 models one resolver EOA only. Production threshold/multisig authority is not implied.

## 6. Claimable settlement

Authorization never pushes tokens to builders.

Instead it creates frozen `claimable[recipient]` balances. Anyone may call:

`claimFor(recipient)`

but the caller cannot redirect the transfer.

This isolates recipients: a token-level failure for one recipient does not prevent another recipient from claiming.

The settlement becomes finalized only when:

`totalClaimed == frozenPrizeAmount`

Therefore:

- authorized != paid;
- one successful claim != fully settled;
- blocked recipient => settlement remains pending/reconciling;
- full claims => finalized monetary fact candidate.

## 7. Replay / redirection resistance

J1 rejects:

- settlement before funding;
- winner/default settlement before payout-set sealing;
- recipient not present in the frozen payout set;
- wrong authority signature;
- one actor substituted for the other winner authority;
- signature replay against a different manifest digest;
- a second settlement manifest after one has been authorized;
- skewed default-distribution economics;
- duplicate/non-canonical default entry ordering;
- token transfer failure being silently recorded as a successful claim.

## 8. Toolchain

J1 uses an isolated Foundry project because the repository previously had no Solidity toolchain.

CI is pinned to:

- Foundry `v1.8.3`;
- Solidity `0.8.37`;
- Prague EVM target.

There are no Solidity library dependencies in J1.

## 9. Acceptance gates

J1 closes only if exact-head CI proves:

1. contract formats and compiles;
2. exact funding and single-fund semantics;
3. fee-on-transfer funding rejection;
4. distinct winner authorities;
5. dual-authorized payout-set seal;
6. Merkle-bound winner recipient;
7. dual-authorized winner settlement;
8. manifest replay resistance;
9. exactly one settlement authorization;
10. on-chain equal-split policy;
11. full-prize conservation;
12. pull/claimable settlement;
13. blocked-recipient isolation;
14. no-qualifier refund;
15. separate resolver cancellation;
16. settlement cannot start before funding;
17. no owner/upgrade/sweep/arbitrary-withdraw path exists;
18. no deployment or production-money code is introduced.

## 10. Explicit non-authority

J1 does not authorize:

- deployment to Ink mainnet;
- deployment to any public testnet;
- real USDC/USDT0 or other production-value asset;
- wallet/private-key custody;
- server-side signing;
- transaction broadcast;
- production EIP-1271 policy;
- production resolver threshold;
- emergency/long-stop production escape;
- organizer/platform fee;
- accounting/tax/compliance implementation;
- external audit claims;
- merge.

## 11. Next slice after J1 closure

Only after exact-head tests and one bounded hostile review:

**J2 — PUBLIC TESTNET ADAPTER REHEARSAL**

J2 would connect the J0 protocol adapter to one deployed testnet vault and execute the bounded 250-unit synthetic/test-token scenario end-to-end.

That still would not authorize production money. Production remains blocked on the independent security/audit/legal/settlement gates already frozen by Survivor V1.1 and Stage J0.
