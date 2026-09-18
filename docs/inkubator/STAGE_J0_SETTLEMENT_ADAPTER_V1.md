# REKT INKUBATOR — STAGE J0 SETTLEMENT ADAPTER V1

**Status:** ACTIVE / TEST-ONLY PROTOCOL SLICE  
**Date:** 2026-09-18  
**Branch:** `agent/stage-j0-settlement-adapter-v1`  
**Production-money authority:** NONE  
**Wallet custody/signing/broadcast authority:** NONE  
**Merge authority:** NONE

## 1. Objective

Freeze the smallest replaceable settlement boundary that preserves the funded-Challenge product invariant without making the Inkubator web/API a prize wallet.

Permanent product direction remains:

`LOCKED PRIZE → FAIR COMPETITION → AUTHORIZED OUTCOME → GUARANTEED SETTLEMENT → PROVABLE RECEIPT`

Stage J0 is deliberately pre-money. It introduces no Solidity, mainnet adapter, private key, wallet custody, signing, transaction broadcast, provider settlement credential or production settlement route.

## 2. Authority split

The Stage-J direction preserves the Survivor V1.1 split:

- PostgreSQL / Challenge protocol = product and workflow truth;
- settlement adapter = replaceable monetary execution boundary;
- chain/provider finality = monetary execution truth;
- receipt = durable projection of finalized facts only.

No adapter may invent qualification, selection or recipient identity. No Challenge/API state may invent finalized payment.

## 3. J0 adapter registry

J0 recognizes exactly two adapter kinds:

- `MOCK`;
- `TESTNET_CHALLENGE_VAULT`.

Both are permanently tagged `TEST_ONLY` in this version.

There is intentionally no `MAINNET`, `AUDITED_VAULT`, `HOT_WALLET`, `CUSTODIAL` or `LICENSED_PROVIDER` adapter kind in J0. Production rails require a later version after the independent legal/security/settlement gates.

The interface is replaceable by design, but future adapters must be added explicitly through a versioned protocol change rather than inferred from configuration.

## 4. Frozen adapter binding

A Challenge settlement adapter binding commits to:

- Challenge ID;
- frozen terms digest;
- settlement-policy version;
- adapter kind;
- opaque adapter reference;
- test network identifier when applicable;
- settlement asset;
- exact prize amount.

The binding is content-addressed. Any change to the terms, asset, amount, adapter identity or network changes the binding digest.

A funding observation is accepted in J0 only when it is `CONFIRMED_TEST` and matches the exact binding digest, Challenge, terms, asset and amount.

## 5. Settlement manifest

Existing `SettlementIntent` remains the canonical Challenge-side economic resolution.

J0 derives a content-addressed `inkubator.settlement-manifest/1.0` from:

- the frozen Build Contract;
- the canonical SettlementIntent;
- the frozen adapter binding.

The manifest commits to:

- Challenge and terms;
- adapter binding;
- settlement-intent digest/type;
- exact asset and amount;
- exact recipients;
- winner entry if any;
- required authority classes;
- `CLAIMABLE` delivery mode.

The caller cannot supply a fresh recipient list while creating an execution envelope. Execution recipients are inherited from the manifest.

## 6. Authority law

J0 records authority requirements; it does not implement cryptographic verification.

Recorded authorization facts MUST be produced only after the corresponding integration verifies the real authority. The protocol then checks that every fact is bound to the exact manifest digest and that the exact required authority set is present.

Required sets:

| Settlement intent | Required authority facts |
| --- | --- |
| `WINNER_PAYOUT` | `INKUBATOR_OUTCOME` + `ORGANIZER_SELECTION` |
| `DEFAULT_DISTRIBUTION` | `FROZEN_POLICY` + `INKUBATOR_OUTCOME` |
| `REFUND_NO_QUALIFIER` | `FROZEN_POLICY` + `INKUBATOR_OUTCOME` |
| `REFUND_PRE_BUILD` | `FROZEN_POLICY` |
| `CANCELLED_BY_RESOLUTION` | `FROZEN_POLICY` + `RESOLVER_THRESHOLD` |

For the future production vault, the expected direction is that organizer selection and outcome/policy authority become independently verifiable facts. The exact signature scheme, signer topology, threshold policy and on-chain verification are NOT frozen by J0.

## 7. Claimable execution

J0 freezes `CLAIMABLE` delivery semantics for its test-only vault envelope.

The execution envelope contains no caller-supplied payout target. Anyone may eventually be able to trigger an already-authorized execution, but the trigger must not gain authority to change:

- Challenge;
- terms;
- asset;
- amount;
- recipients;
- adapter binding.

This is the protocol expression of “permissionless trigger, no redirect authority.”

## 8. Rail state machine

J0 freezes only the generic rail lifecycle:

`UNBOUND → BOUND → FUNDED → AUTHORIZED → EXECUTION_PENDING → FINALIZED`

`EXECUTION_PENDING ↔ RECONCILING`

`RECONCILING → FINALIZED`

Illegal jumps fail closed. In particular:

- no `UNBOUND → FINALIZED`;
- no `BOUND → AUTHORIZED`;
- no transition out of `FINALIZED`.

J0 deliberately does NOT freeze a production emergency escape distribution. Survivor V1.1 already marks the exact emergency/default rule as a mainnet blocker. That rule must be economically, legally and security reviewed before any production adapter version exists.

## 9. 250-unit pilot scenario

The first useful implementation fixture is:

- one test-only Challenge;
- one test settlement asset;
- prize = 250 units at the asset's frozen minor-unit scale;
- 2–3 curated builders;
- payout identities frozen before BUILDING;
- normal winner payout;
- zero-qualifier refund;
- deterministic qualifier fallback;
- resolver-only cancellation path;
- claimable settlement envelope;
- finalized test execution fact before receipt.

This number is a blast-radius/test fixture, not a legal safe harbour or permanent product cap.

## 10. Explicit non-authority

Stage J0 does not authorize:

- production USDC or any other real-value asset;
- mainnet contract deployment;
- wallet custody;
- private-key storage;
- EOA or smart-contract signing;
- transaction broadcast;
- automatic payment;
- production settlement providers;
- organizer/platform fee collection;
- tax/VAT/accounting treatment;
- KYC/AML implementation;
- changing the existing Challenge qualification or organizer-selection semantics;
- merge or deployment.

## 11. Acceptance gates

J0 is not complete unless tests prove:

1. production-like adapter kinds are rejected;
2. every J0 binding is `TEST_ONLY`;
3. binding digest commits to terms/asset/amount/adapter/network;
4. funding fact must match exact binding, terms, asset and amount;
5. winner payout requires outcome + organizer-selection authority facts;
6. missing authority blocks execution-envelope creation;
7. authorization facts cannot replay against another manifest;
8. default distribution remains winnerless and conserves the full prize;
9. execution is claimable and inherits recipients from the manifest;
10. recipient mutation changes/invalidates the manifest or execution digest;
11. cancellation requires resolver-threshold + frozen-policy authority;
12. illegal rail-state jumps fail closed;
13. FINALIZED is terminal;
14. no production-money or signing/broadcast implementation is introduced.

## 12. Next bounded slice after J0 closure

Only after J0 tests and one hostile review pass:

**J1 — TESTNET CHALLENGE VAULT CONTRACT**

J1 may implement a minimal testnet vault against this adapter contract, still with no production-money authority.

Before any production adapter exists, separately close:

- exact emergency/default policy;
- smart-contract threat model;
- external security review/audit;
- Swedish/EU legal/payment/CASP analysis;
- accounting/tax treatment;
- asset/chain choice;
- production signer/threshold model;
- capped launch policy.
