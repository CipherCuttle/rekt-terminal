# REKT INKUBATOR — STAGE J2 INK SEPOLIA PUBLIC-TESTNET REHEARSAL V1

**Status:** ACTIVE / PUBLIC-TESTNET REHEARSAL  
**Date:** 2026-09-18  
**Branch:** `agent/stage-j2-ink-sepolia-rehearsal-v1`  
**Base:** Stage-J1 exact head `6b73f63bd77da5fc4d2407428538088c0995f18e`  
**Target network:** Ink Sepolia  
**Chain ID:** `763373`  
**Production-money authority:** NONE  
**Mainnet authority:** NONE  
**Merge authority:** NONE

## 1. Objective

Exercise the Stage-J0 settlement protocol through the Stage-J1 vault on a real public testnet without introducing production value or reusable custody.

J2 proves:

`J0 FROZEN CONTRACT → J2 DEPLOYMENT PLAN → PUBLIC TEST TOKEN → VAULT DEPLOY → FUND → FREEZE PAYOUTS → FREEZE QUALIFIERS → SETTLE → CLAIM → ONCHAIN FINALITY → RECEIPT`

The bounded live rehearsal uses only a synthetic fixed-supply test token.

## 2. Network lock

J2 is hard-pinned to:

- network: `Ink Sepolia`;
- chain ID: `763373`;
- public RPC: `https://rpc-gel-sepolia.inkonchain.com`;
- explorer: `https://explorer-sepolia.inkonchain.com`;
- native gas asset: testnet ETH.

Any other chain ID fails closed.

Ink mainnet `57073` is not authorized.

## 3. Wallet / key law

J2 does not create a reusable Inkubator wallet.

The manual rehearsal workflow:

1. generates a fresh deployer key inside one GitHub-hosted runner;
2. masks the private key immediately;
3. publishes only the public deployer address for the faucet;
4. funds it only with Ink Sepolia faucet ETH;
5. generates fresh outcome / organizer / resolver test keys in the same runner;
6. uses those keys only for the single J2 rehearsal;
7. never commits or uploads any private key;
8. relies on runner destruction as the terminal key lifecycle.

No Render secret, repository secret, local owner wallet or production signer is introduced.

## 4. J0 → J1 mapping

J2 adds an explicit pure adapter plan.

The plan binds:

- exact J0 `binding_digest`;
- exact frozen `terms_digest`;
- SHA-256 digest of `challenge_id`;
- exact synthetic token address;
- exact 250-unit minor-unit amount;
- exact refund recipient;
- exact outcome / organizer / resolver addresses;
- exact organizer review deadline;
- canonical payout roster.

### Review deadline conversion

Build Contract time is milliseconds.

EVM `block.timestamp` is seconds.

J2 therefore uses:

`ceil(review_deadline_ms / 1000)`

This may extend organizer-selection authority by less than one second, but can never permit frozen-default settlement before the off-chain Build Contract deadline.

### Canonical payout order

J0 default distribution sorts entry IDs by UTF-8 byte order.

J2 derives `payout_order` from that exact ordering before deployment.

The rank is committed into the Stage-J1 payout leaf:

`entryDigest + payoutOrder + payoutAddress`

Callers cannot choose remainder order independently.

## 5. Public-testnet scenarios

One manual J2 run creates one synthetic token and three independent Challenge vaults.

### A. Organizer winner

- 250 TEST USDC funded;
- three payout identities frozen;
- two final qualifiers frozen;
- organizer selects `E-A` before the frozen review deadline;
- outcome + organizer authorize;
- 250 units become claimable;
- claim finalizes the vault.

### B. Frozen default distribution

- 250 TEST USDC funded;
- three payout identities frozen;
- three final qualifiers frozen;
- no organizer winner is executed;
- workflow waits until the frozen review deadline;
- contract enforces the J0 equal split;
- exact remainder minor unit goes to canonical first qualifier;
- all three claims finalize the vault.

For 250,000,000 minor units:

- `E-A = 83,333,334`;
- `E-B = 83,333,333`;
- `E-C = 83,333,333`.

### C. Zero-qualifier refund

- 250 TEST USDC funded;
- payout identities frozen;
- independently co-attested zero-qualifier set frozen;
- J0 zero-qualifier refund manifest used;
- exact 250 units return to the immutable refund recipient;
- claim finalizes the vault.

## 6. Synthetic token

`StageJ2RehearsalToken` is deliberately disposable:

- six decimals;
- fixed constructor supply only;
- no post-deploy mint;
- no owner;
- no upgrade;
- no fee;
- no oracle;
- no production-token claim.

The J2 run mints exactly three vault prizes:

`3 × 250,000,000 minor units`.

The symbol/name are explicitly test-only and do not represent Circle USDC.

## 7. Immutable deployment verification

After deployment, J2 reads every vault back from Ink Sepolia and compares it to the frozen J2 plan:

- chain ID;
- token;
- challenge digest;
- terms digest;
- binding digest;
- prize amount;
- organizer-selection deadline;
- refund recipient;
- outcome authority;
- organizer authority;
- resolver authority.

A mismatch aborts the rehearsal before default settlement.

## 8. Rehearsal evidence

A successful manual run records:

- frozen fixture;
- J2 plan digest;
- deployed token address;
- three vault addresses;
- immutable snapshots;
- final synthetic balances;
- public explorer links;
- exact Git head;
- `production_value_moved: false`.

The artifact schema is:

`inkubator.stage-j2-public-rehearsal-receipt/1.0`

## 9. Acceptance gates

J2 closes only if:

1. J0/J2 adapter unit tests pass;
2. Stage-J1 Foundry suite still passes;
3. J2 scripts compile;
4. exact chain ID is `763373`;
5. ephemeral deployer receives only testnet faucet ETH;
6. synthetic fixed-supply token deploys;
7. all vault immutable snapshots match the frozen plan;
8. organizer winner finalizes before deadline;
9. frozen default cannot execute before deadline;
10. default distribution finalizes after deadline;
11. default amounts exactly match J0 canonical ordering;
12. zero-qualifier refund finalizes;
13. all vault liabilities reach zero;
14. exact synthetic supply is conserved;
15. no private key enters repository artifacts/logs;
16. canonical repository CI passes;
17. one bounded hostile review finds no remaining Critical/High issue.

## 10. Explicit non-authority

J2 does not authorize:

- Ink mainnet;
- real USDC, USDT0 or any production-value token;
- owner wallet reuse;
- production signer storage;
- server-side production signing;
- user custody;
- platform fees;
- production resolver threshold;
- EIP-1271 production policy;
- long-stop/emergency production escape;
- accounting/tax/compliance conclusions;
- claims of audit/security certification;
- merge.

## 11. After J2

J2 proves that the protocol can cross the public-chain boundary with synthetic value.

It does **not** make the vault production-ready.

The next stage must return to the frozen production-value gates:

- contract threat model;
- independent smart-contract security review/audit;
- production signer/threshold design;
- production emergency/long-stop path;
- final asset/chain selection;
- Swedish/EU legal/payment/CASP analysis;
- accounting/tax treatment;
- capped production launch authority.

Production money remains prohibited until those gates are separately satisfied and authorized.
