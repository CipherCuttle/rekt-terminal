# REKT INKUBATOR — STAGE J4 RUNTIME IDENTITY REPAIR RECEIPT V1

**Status:** CLOSED / PASS  
**Date:** 2026-09-19  
**Repair branch:** `agent/stage-j4-runtime-identity-repair-v1`  
**Repair PR:** #133  
**Superseded auditor code scope:** `05e345181dfde2c720874b1fc2d1ee7dd39272a9`  
**Repaired auditor code scope:** `56eaa98497f4c036227c7e2512dadeb640eacfe4`  
**Solidity settlement semantics changed:** NO  
**Production-money authority:** NONE  
**Mainnet deployment authority:** NONE  
**Merge authority:** NONE

## Finding

The production-readiness local-fork rehearsal attempted to verify the old Stage-J4 release law:

`keccak(deployed runtime) == keccak(compiler artifact deployedBytecode.object)`.

That law is invalid for the J4 contracts because both contain Solidity `immutable` values.

The compiler artifact contains the runtime template. Constructor execution writes immutable values into compiler-declared runtime offsets, so a valid deployed instance has different exact runtime bytes from the unpatched artifact template.

The rehearsal observed the expected mismatch on a legitimate `ImmutableResolver1271` deployment.

The previous gate therefore failed closed, but it could not successfully attest a legitimate production deployment.

## Repair law

Release identity is now split into two distinct identities.

### Release-wide code-template identity

For each candidate contract:

1. freeze exact creation-bytecode hash;
2. freeze the compiler-declared immutable-reference layout;
3. validate reference ranges are safe, non-overlapping and inside runtime bytecode;
4. zero **only** those declared immutable spans;
5. hash the resulting normalized runtime template;
6. freeze the immutable-layout digest alongside that normalized template hash.

Release receipt schema:

`inkubator.production-candidate-release/1.1`

Runtime mode:

`IMMUTABLE_NORMALIZED_TEMPLATE_PLUS_EXHAUSTIVE_READBACK`

### Per-deployment instance identity

A future M04 deployment gate must additionally:

1. fetch the exact deployed runtime bytes independently from two providers;
2. require both providers to return identical bytes / exact runtime hash;
3. record that exact per-instance deployed runtime hash;
4. normalize those bytes using the frozen compiler immutable layout;
5. require the normalized deployed-runtime hash to equal the frozen release template hash;
6. exhaustively read back all immutable/business constructor values and require the signed deployment-plan values exactly;
7. record the readback evidence.

A normalized-template match without immutable readback is insufficient.

An immutable readback without normalized-template match is insufficient.

Provider disagreement is fail-closed.

## Code changes

Added:

- `scripts/inkubator/stage-j4-runtime-identity.mjs`
- `scripts/inkubator/stage-j4-runtime-identity.test.mjs`

Updated:

- `scripts/inkubator/stage-j4-release-candidate.mjs`
- `packages/inkubator-protocol/src/production-candidate-vault-adapter.mjs`
- `packages/inkubator-protocol/test/stage-j4-production-candidate.test.mjs`
- `.github/workflows/inkubator-j4.yml`

No Solidity contract source changed.

## Empirical rehearsal evidence

The separate production-readiness rehearsal demonstrated on an isolated Ink fork:

- exact legitimate deployed runtime differs from the unpatched template due to immutables;
- normalized resolver runtime identity matches the compiler template;
- normalized vault runtime identity matches the compiler template;
- all resolver/vault constructor immutables read back exactly;
- dummy outcome signing works;
- all three valid resolver 2-of-3 pairs verify;
- single-signer, duplicate-signer and outsider-pair proofs reject;
- no production key or real value is involved.

## Exact repaired-code verification

Exact repaired code scope:

`56eaa98497f4c036227c7e2512dadeb640eacfe4`

Dedicated J4 push workflow:

`35462005787` — PASS

Passed jobs:

- `verify`;
- `controlled_usdc_fork`;
- `ink_asset_probe`;
- `release_differentiation`;
- `release_repro_a`;
- `release_repro_b`;
- `release_repro_compare`.

The `verify` job includes:

- J4 core vault suite;
- J4 pre-audit matrix;
- J4 Solidity known-answer suite;
- adapter/finality/release tests;
- immutable runtime identity tests;
- JS known-answer vectors;
- forbidden release-surface verification;
- release receipt generation using schema 1.1.

## Security disposition

This finding is a **release/deployment-attestation correctness defect**, not evidence of a settlement-state-machine or custody bypass.

The old comparison failed closed. It did not authorize a wrong deployment.

The risk was operational: a real deployment could never satisfy the stated M04 gate, encouraging ad-hoc/manual exceptions if discovered only at launch.

The repaired law eliminates that ambiguity by separating:

- immutable-neutral code-template identity;
- per-instance exact runtime identity;
- immutable constructor-state identity.

## Audit scope consequence

External audit has **not started**, so the repair is incorporated before independent review begins.

The old code scope:

`05e345181dfde2c720874b1fc2d1ee7dd39272a9`

is superseded for the external-audit engagement by:

`56eaa98497f4c036227c7e2512dadeb640eacfe4`

Auditors should review the repaired commit, not the superseded one.

## Authority

```text
J4_RUNTIME_IDENTITY_REPAIR = PASS
EXTERNAL_AUDIT = NOT_STARTED
MAINNET_DEPLOYMENT = NOT_AUTHORIZED
M04 = NOT_RUN
PRODUCTION_MONEY = NOT_AUTHORIZED
PRODUCTION_SIGNERS = NOT_AUTHORIZED
LEGAL_GATE = OPEN
MERGE_AUTHORITY = NONE
```
