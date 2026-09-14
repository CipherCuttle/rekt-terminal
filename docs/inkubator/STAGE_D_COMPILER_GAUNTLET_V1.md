# REKT INKUBATOR — STAGE D COMPILER GAUNTLET V1

**Status:** ACTIVE STAGE-D ACCEPTANCE CONTRACT  
**Date:** 2026-09-13  
**Implementation corpus:** `packages/inkubator-protocol/compiler/gauntlet/seed-corpus.v1.json`

## 1. Purpose

The gauntlet tests compiler sensitivity, not stack fashion.

A passing compiler is not one that always picks a preferred framework. It is one that changes deterministic consequences when material requirements change, and does not invent consequences from irrelevant wording.

Expected outputs are primarily properties/invariants.

## 2. Seed corpus

V1 begins deliberately small and executable. It covers:

- baseline static web page;
- accounts;
- private uploads;
- realtime shared updates;
- wallet transaction intent;
- private-key custody (unsupported boundary);
- irrelevant visual wording (`more purple`).

This seed is the start of D-GATE-4, not the final 100–200 case corpus.

## 3. Mandatory invariants

### Baseline static

Must keep `WEB_STATIC` applicable with no persistence/auth/transaction facts and low baseline risk.

### Accounts mutation

Must introduce persistence + identity boundary consequences and make static-only architecture unsuitable.

### Private-upload mutation

Must introduce private object-storage/privacy consequences and surface retention/deletion as a material decision.

### Realtime mutation

Must introduce realtime transport + synchronized runtime-state consequences and leave transport/consistency as a material decision.

### Wallet-transaction mutation

Must select the transaction-capable Web3 blueprint, escalate risk, expose wallet-signing/transaction-intent boundaries and never imply platform key custody.

### Private-key custody

Must fail closed as `UNSUPPORTED` for Stage D / pre-production Alpha.

### Irrelevant visual mutation

Changing visual wording/preferences such as making a logo “more purple” must not alter:

- blueprint applicability;
- Production Envelope;
- risk/quality profile;
- causal facts;
- reference architecture;
- acceptance modules;
- readiness status.

## 4. Determinism / adversarial properties

The test suite must additionally prove:

- semantically identical requirement sets compile the same regardless of input array order;
- conflicting values for the same requirement surface as unresolved rather than last-write-wins;
- provider proposals cannot forge deterministic provenance or inject derived authority fields;
- schemas accept canonical compiler output and the pinned blueprint registry.

## 5. Growth rule

Add a gauntlet case only when it protects a real causal boundary or falsifies an existing rule/blueprint assumption.

Priority future mutations from the readiness authority include:

```text
persistence
notifications
100x traffic
mutable private dependencies
vague consulting scope
additional transaction/read combinations
```

Do not inflate the corpus with cosmetic paraphrases that do not test a distinct semantic boundary.

## 6. Stage-D closure gate

Stage D does not close merely because the seed corpus passes. Before closure:

- expand coverage enough to exercise every V1 causal rule and blueprint edge;
- benchmark at least two replaceable low-cost interpretation providers (D-GATE-5);
- run protocol + repository verification gates;
- consume one independent hostile review;
- fix Critical/High findings;
- use one targeted re-review only if Critical/High repairs were required.
