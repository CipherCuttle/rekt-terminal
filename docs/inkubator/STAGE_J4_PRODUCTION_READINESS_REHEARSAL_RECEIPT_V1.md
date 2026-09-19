# REKT INKUBATOR — STAGE J4 PRODUCTION READINESS REHEARSAL RECEIPT V1

**Status:** PASS / LOCAL-FORK + DUMMY-SIGNER REHEARSAL ONLY  
**Date:** 2026-09-19  
**Branch:** `agent/stage-j4-production-readiness-v2`  
**PR:** #134 — draft / open / unmerged  
**Repaired external-auditor code scope:** `56eaa98497f4c036227c7e2512dadeb640eacfe4`  
**Rehearsal head:** `107a8fa50d579f039e0d967fdefee2a50beeb807`  
**Readiness workflow:** `35464257886` — PASS  
**Mainnet deployment authority:** NONE  
**Production-money authority:** NONE  
**Production-signer authority:** NONE  
**Legal gate:** OPEN  
**Merge authority:** NONE

## 1. Objective

Exercise the non-production operational boundary around the repaired Stage-J4 release identity:

- ephemeral dummy outcome signer;
- immutable 2-of-3 resolver ceremony;
- resolver signer-loss/invalid-proof cases;
- isolated local Ink fork;
- exact candidate resolver/vault deployment;
- release receipt schema 1.1 binding;
- immutable-normalized runtime-template identity;
- exact per-instance runtime identity;
- exhaustive immutable/business-state readback.

This rehearsal does not satisfy external audit, M04, production signer ceremony, legal approval or production funding authority.

## 2. Frozen source gate

The rehearsal first requires the audited implementation/release files to remain exactly unchanged from:

`56eaa98497f4c036227c7e2512dadeb640eacfe4`

The scope includes candidate Solidity, tests, Foundry configuration, J4 adapter/release tooling, immutable-runtime identity tooling, canonical payout primitive and J4 workflow.

Any drift fails closed before operational rehearsal.

## 3. Signer rehearsal evidence

Disposable dummy signers were generated only inside the isolated CI runner.

PASS evidence:

- outcome signer address distinct from organizer;
- three resolver signer addresses distinct;
- resolver quorum exactly 2;
- R1+R2 valid;
- R1+R3 valid;
- R2+R3 valid;
- single signer rejected;
- duplicate signer pair rejected;
- outsider+member pair rejected;
- production key material created: **false**.

No production private key was generated or authorized.

## 4. Release/deployment identity evidence

Generated release receipt:

`inkubator.production-candidate-release/1.1`

Runtime identity mode:

`IMMUTABLE_NORMALIZED_TEMPLATE_PLUS_EXHAUSTIVE_READBACK`

Frozen normalized runtime-template hashes observed:

- vault: `0x82c9cbab239bdaaa1ee655cc0d641470f1f02bb52c8071d7ebfe8a005ef60eb9`;
- resolver: `0x3249686a48f90094cbc89a9578c9d143d617d6c49b37d15a8df5f30668f0faff`.

Frozen immutable-layout digests observed:

- vault: `0x65851229a32c4799993a53b80ee7fab0e0e9922ff56384dbdaedf1ebaadfc681`;
- resolver: `0x3c99bf5106a3964a3627ff2e76f49bae2d589d8ba0ca5fc3c5415bb04d558624`.

This local deployment's exact per-instance runtime hashes were:

- vault: `0x65a6806bb34ac4a9c6579911fd8b8867518c0d6a626f91a00e16aac5946d2a08`;
- resolver: `0x1705b3a70ad81c2e24c566d9451d86a2e4c6a2ac45ad2e1f6e06ef4cbf5142c8`.

The exact per-instance hashes are **not** release-wide constants because constructor immutables are embedded into runtime.

PASS requires:

- exact deployed runtime is nonempty;
- compiler-declared immutable spans only are normalized;
- normalized deployed runtime equals the release receipt template hash;
- immutable-layout digest matches the release receipt;
- exact deployed runtime hash remains separately recorded.

The workflow recorded:

`release_receipt_binding_pass = true`

## 5. Constructor / business-state readback

The deployed local candidate read back exactly:

- native Ink USDC address;
- challenge digest;
- terms digest;
- binding digest;
- prize amount;
- activation deadline;
- organizer selection deadline;
- resolution deadline;
- terminal long-stop;
- refund recipient;
- outcome authority;
- organizer selection authority;
- resolver authority;
- pre-build refund manifest digest;
- terminal refund manifest digest;
- resolver signer set;
- resolver quorum.

Therefore:

`immutable_readback_pass = true`

## 6. Local-fork boundary

The rehearsal used:

- local Anvil chain ID `31337`;
- Ink state fork only;
- Gelato provider first with QuickNode fallback;
- no upstream transaction broadcast;
- no real-value transfer;
- no mainnet candidate deployment.

Authority recorded by the workflow:

`LOCAL_FORK_DUMMY_ONLY_NO_MAINNET_NO_REAL_VALUE`

## 7. M04 disposition

The local rehearsal proves the **procedure**, not the real deployment.

It explicitly records:

`m04_satisfied = false`

Actual M04 remains post-audit/pre-funding and requires, on a separately authorized Ink-mainnet candidate deployment:

1. approved post-audit release;
2. two independent RPC providers;
3. provider agreement on exact deployed runtime bytes/hash;
4. normalized runtime-template equality;
5. immutable-layout equality;
6. exhaustive immutable/business-state readback;
7. explorer/source verification;
8. deployment receipt;
9. completed production signer ceremony;
10. closed legal gate;
11. separate production-money authority.

## 8. Parallel legal / operational gates

The branch also carries:

- `STAGE_J4_SWEDEN_EU_PRODUCTION_LEGAL_MATRIX_V1.md`;
- `STAGE_J4_SIGNER_CEREMONY_REHEARSAL_V1.md`;
- `STAGE_J4_POST_AUDIT_DEPLOYMENT_ATTESTATION_REHEARSAL_V1.md`.

The legal matrix does not grant legal approval. The signer rehearsal does not create production signers.

## 9. Verdict

```text
J4_PRODUCTION_READINESS_REHEARSAL = PASS
FROZEN_AUDITOR_CODE_SCOPE = 56eaa98497f4c036227c7e2512dadeb640eacfe4
RELEASE_RECEIPT_SCHEMA = inkubator.production-candidate-release/1.1
DUMMY_SIGNER_CEREMONY = PASS
LOCAL_DEPLOYMENT_IDENTITY_REHEARSAL = PASS
RELEASE_RECEIPT_BINDING = PASS
IMMUTABLE_READBACK = PASS
M04 = NOT_RUN
EXTERNAL_AUDIT = NOT_STARTED
PRODUCTION_SIGNERS = NOT_CREATED
LEGAL_GATE = OPEN
MAINNET_DEPLOYMENT = NOT_AUTHORIZED
PRODUCTION_MONEY = NOT_AUTHORIZED
MERGE_AUTHORITY = NONE
```
