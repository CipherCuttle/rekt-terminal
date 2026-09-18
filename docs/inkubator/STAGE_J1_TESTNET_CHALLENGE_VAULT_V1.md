# REKT INKUBATOR — STAGE J1 TESTNET CHALLENGE VAULT V1

**Status:** ACTIVE / TESTNET-CONTRACT SLICE  
**Date:** 2026-09-18  
**Branch:** `agent/stage-j1-testnet-vault-v1`  
**Base:** hardened Stage-J0 settlement-provenance authority  
**Production-money authority:** NONE  
**Mainnet deployment authority:** NONE  
**Public-testnet deployment authority:** NONE  
**Merge authority:** NONE

## 1. Objective

Implement the smallest executable `TESTNET_CHALLENGE_VAULT` behind the Stage-J0 settlement adapter without giving the normal Inkubator web/API arbitrary prize-redirection authority.

J1 proves contract mechanics only:

`TEST FUND → FREEZE PAYOUT SET → FREEZE FINAL QUALIFIER SET → AUTHORIZE OUTCOME → CREATE CLAIMS → CLAIM → FINALIZE`

It does not deploy anywhere in this slice.

## 2. Why J1 adds a final-qualifier commitment

The first contract sketch proved only that a payout belonged to an entrant. That was insufficient.

The funded-Challenge mechanism says:

- Test Arena determines final qualifiers;
- organizer selection may choose only among final qualifiers;
- organizer timeout default distributes only among final qualifiers.

Therefore J1 freezes two different sets:

1. **payout set** — every builder payout identity admitted before settlement;
2. **final qualifier set** — the exact subset produced by qualification after appeals/resolution.

The final qualifier set must itself be a subset of the frozen payout set.

This closes two red-team failures:

- organizer cannot select a seated non-qualifier;
- one compromised outcome signer cannot silently omit/include arbitrary entrants in ghost/default distribution after the qualifier set has been independently co-attested.

## 3. Authority split

Immutable J1 test roles:

- `INKUBATOR_OUTCOME`;
- `ORGANIZER_SELECTION`;
- `RESOLVER`.

All three addresses must be pairwise distinct.

### Payout-set seal

Requires outcome + organizer.

### Final-qualifier-set seal

Requires outcome plus either:

- organizer in the normal path; or
- resolver in the fallback path when organizer participation is unavailable.

The qualifier set is content-bound to the already-frozen payout set.

### Normal winner

May settle only **before** the frozen organizer-selection deadline.

Requires:

- membership proof in the final qualifier set;
- outcome signature;
- organizer-selection signature.

### One-qualifier organizer-timeout default

Stage J0 now explicitly distinguishes winner provenance.

If the frozen default policy has exactly one qualifier, the economic intent is still `WINNER_PAYOUT`, but its authorization mode is `FROZEN_DEFAULT`, not `ORGANIZER_SELECTION`.

J1 therefore permits the sole frozen qualifier to receive the prize only **at/after** the frozen organizer-selection deadline, with:

- final-qualifier membership proof;
- outcome signature;
- on-chain one-qualifier default rule;

and **no organizer settlement signature**.

This prevents a disappeared organizer from locking a valid sole qualifier's prize.

### Multi-qualifier default

May settle only **at/after** the frozen organizer-selection deadline.

Requires:

- every frozen final qualifier, not a subset;
- membership proofs for all recipients;
- unique canonical entry ordering;
- unique payout addresses;
- deterministic equal split, including the exact frozen remainder rule: extra minor units go to the first sorted qualifier IDs;
- exact prize conservation;
- outcome signature.

The split policy is enforced by contract code.

### No-qualifier refund

Requires:

- a separately co-attested zero-qualifier result;
- outcome signature;
- exact full-prize refund to the immutable refund recipient.

### Resolver cancellation

J0 models `FROZEN_POLICY + RESOLVER_THRESHOLD`.

J1 does not pretend one test EOA is a production threshold. Therefore its testnet cancellation path is deliberately stricter and requires:

- resolver signature; and
- independent outcome co-sign;

while still forcing the full amount to the immutable refund recipient.

A production threshold/multisig model remains a later gate.

## 4. Funding law

Funding is one-shot and exact.

The vault rejects:

- second funding;
- observed funding-call token balance delta different from the frozen prize.

It deliberately does **not** require a zero pre-funding balance, because any third party can transfer ERC-20 dust directly to a contract address. Such dust must not brick a Challenge. Fee-on-transfer behavior is rejected because the funding delta must still equal the exact prize.

The contract has no admin sweep. Unsolicited extra token transfers remain outside Challenge accounting and may be stranded in J1.

## 5. Claimable settlement

Authorization creates `claimable[recipient]`; it never pushes prize tokens.

Anyone may call:

`claimFor(recipient)`

but cannot redirect the payout.

A failed token transfer reverts only that claim and restores its claimable state. Other recipients remain independently claimable.

Finalization is true only when:

`totalClaimed == prizeAmount`

So:

`AUTHORIZED != PAID != FINALIZED`

## 6. Cryptographic binding

J1 uses EIP-712-style domain-separated digests bound to:

- chain ID;
- vault address;
- Challenge digest;
- terms digest;
- J0 adapter-binding digest;
- payout-set root or qualifier-set root;
- settlement manifest digest;
- settlement provenance/kind;
- exact recipients.

EOA signatures are test-only J1 substrate. EIP-1271 / contract-wallet policy is deferred.

ECDSA recovery rejects high-`s` malleable signatures.

## 7. Contract surface deliberately absent

J1 has no:

- owner;
- upgrade/proxy;
- admin sweep;
- arbitrary withdrawal;
- arbitrary recipient setter;
- yield;
- staking;
- swap;
- bridge;
- oracle;
- fee collection;
- generic external call;
- production deploy script;
- private key;
- transaction broadcaster.

## 8. Toolchain

J1 is isolated under `contracts/inkubator-vault`.

Pinned verification:

- Foundry `v1.8.3`;
- Solidity `0.8.37`;
- Prague EVM target.

There are no Solidity library dependencies.

## 9. Acceptance gates

J1 closes only if exact-head verification proves:

1. format + compile;
2. one-shot exact funding;
3. fee-on-transfer funding rejection and pre-funding dust grief resistance;
4. pairwise-independent authorities;
5. dual-authorized payout-set seal;
6. final qualifier set is a verified subset of payout set and preserves the J0 canonical entry-order rank;
7. qualifier set requires an independent co-authority;
8. organizer winner must be a frozen final qualifier;
9. normal winner requires outcome + organizer and expires at the frozen selection deadline;
10. one-qualifier frozen default cannot execute before that deadline and does not require vanished organizer selection;
11. manifest signatures cannot replay to another manifest;
12. only one settlement may be authorized;
13. multi-qualifier default must include the entire frozen qualifier set;
14. default economics exactly match canonical sorted equal-split remainder allocation and conserve full prize;
15. blocked-recipient failure does not freeze unrelated claims;
16. zero-qualifier refund requires frozen zero-qualifier outcome;
17. resolver cancellation cannot be driven by the test resolver key alone;
18. settlement cannot begin before funding;
19. full settlement finality requires all prize claims;
20. no owner/upgrade/sweep/arbitrary-withdraw path;
21. no deployment or production-money code.

## 10. Explicit non-authority

J1 does not authorize:

- Ink mainnet;
- any public testnet deployment;
- real USDC/USDT0;
- wallet/private-key custody;
- server signing;
- transaction broadcast;
- platform fee;
- production resolver threshold;
- production emergency escape;
- accounting/tax/compliance implementation;
- external audit claims;
- merge.

## 11. Next slice after J1 closure

Only after exact-head contract tests and one bounded hostile review:

**J2 — PUBLIC TESTNET ADAPTER REHEARSAL**

J2 may deploy one J1-derived test vault to an approved public testnet and execute the synthetic 250-unit loop end-to-end.

Production money remains separately blocked by smart-contract threat modeling, external security review/audit, Swedish/EU legal/payment/CASP analysis, accounting/tax treatment, final asset/chain choice, production signer/threshold policy, emergency exit, and capped-launch authority.
