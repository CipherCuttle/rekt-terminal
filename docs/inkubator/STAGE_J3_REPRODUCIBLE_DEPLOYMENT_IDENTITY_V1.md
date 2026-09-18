# REKT INKUBATOR — STAGE J3 REPRODUCIBLE DEPLOYMENT IDENTITY V1

**Status:** ACTIVE / AUDIT INPUT  
**Date:** 2026-09-18  
**Parent:** `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`  
**Production deployment authority:** NONE

This procedure defines how a future production-candidate Challenge Vault release is identified, rebuilt and verified. It does not authorize deployment to Ink mainnet.

## 1. Goal

For any production-candidate vault address, an independent reviewer must be able to answer:

> Is this exact deployed runtime bytecode the contract release that was reviewed?

The answer may not depend on a UI label, repository branch name or operator assertion.

## 2. Frozen build inputs

Before external audit freeze, record:

- repository: `CipherCuttle/rekt-terminal`;
- exact source commit SHA;
- contract source paths;
- dependency/submodule revisions;
- Foundry: `v1.8.3`;
- Solidity: `0.8.37`;
- EVM target: `prague`;
- optimizer: enabled;
- optimizer runs: `200`;
- bytecode metadata hash: `none`;
- FFI: disabled;
- constructor ABI/schema;
- supported chain: Ink `57073`;
- supported asset: native Circle USDC at the exact frozen address;
- deployment script exact source hash/commit.

Any change creates a new release candidate and invalidates old bytecode hashes.

## 3. Clean-room rebuild

Run from a clean checkout of the exact frozen source commit.

Minimum procedure:

```bash
git status --porcelain=v1
git rev-parse HEAD

forge --version
cast --version

cd contracts/inkubator-vault
forge clean
forge fmt --check
forge build --force --sizes
forge test -vvv
```

Acceptance:

- working tree clean before build;
- exact expected Git SHA;
- exact pinned Foundry/Solidity config;
- all candidate contract tests pass;
- no generated/local file participates as an untracked source dependency.

## 4. Bytecode identity

For the audited production-candidate contract `<VAULT_CONTRACT>`, derive both creation and runtime bytecode from the clean build.

Reference commands:

```bash
creation="$(forge inspect <VAULT_CONTRACT> bytecode)"
runtime="$(forge inspect <VAULT_CONTRACT> deployedBytecode)"

test "$creation" != "0x"
test "$runtime" != "0x"

creation_hash="$(cast keccak "$creation")"
runtime_hash="$(cast keccak "$runtime")"

printf 'creation=%s\nruntime=%s\n' "$creation_hash" "$runtime_hash"
```

The release receipt records both values.

Do not treat source verification alone as bytecode identity.

## 5. Artifact identity

Also record the canonical build-info / artifact hash relevant to the frozen compiler settings.

At minimum:

- source commit;
- `foundry.toml` digest;
- contract artifact JSON digest;
- constructor ABI digest;
- creation bytecode hash;
- runtime bytecode hash.

The audit package must make the exact hash procedure deterministic.

## 6. Constructor binding

A reviewed runtime bytecode hash proves contract law, not per-Challenge economic identity.

Each deployed vault must additionally publish/read back its immutable constructor-bound values:

- token address;
- Challenge digest;
- terms digest;
- binding digest;
- prize amount;
- activation deadline;
- organizer-selection deadline;
- resolution deadline;
- terminal long-stop;
- refund recipient;
- outcome authority;
- organizer authority;
- resolver authority;
- release/version identifier if included.

Deployment is rejected before funding if any readback mismatches the signed/frozen deployment plan.

## 7. Deployment mechanism

First-candidate direction:

- direct deployment through a pinned script;
- no upgrade proxy;
- no privileged factory required;
- deployer is not a settlement authority;
- deployer private key has no post-deployment vault privilege.

If a factory is later adopted, it becomes part of the audit scope and release identity. A factory must not be able to mutate existing vault law.

## 8. Mainnet preflight — future stage only

A later separately authorized production deployment workflow must fail closed unless all of these inputs match the approved release:

- chain ID exactly `57073`;
- native USDC address exactly equals the frozen release tuple;
- source commit equals approved release SHA;
- creation/runtime hash equals approved release;
- constructor values equal approved Challenge plan;
- deployment value is zero ETH unless explicitly required;
- no production deployment occurs from an unapproved branch/ref;
- explicit owner production authority token/approval gate exists outside ordinary CI.

J3 does **not** create that workflow.

## 9. On-chain runtime verification

After any future deployment and before funding:

1. call `eth_getCode` from two independent RPC providers;
2. require non-empty code;
3. keccak the returned runtime bytecode;
4. require exact match to the audited runtime hash;
5. read every immutable/business binding from the vault;
6. require exact match to the deployment plan;
7. verify source on the canonical explorer;
8. record explorer verification URL/status in the deployment receipt.

Provider disagreement blocks funding.

## 10. Proxy / metamorphic rejection

The first production candidate rejects:

- delegatecall-based upgrade proxy vaults;
- CREATE2/metamorphic patterns that permit code replacement at a stable address;
- arbitrary implementation pointer;
- selfdestruct-based redeployment assumptions;
- owner/admin upgrade surfaces.

The exact audited runtime at the Challenge Vault address is the settlement law.

## 11. Canonical token verification

Before funding any future vault:

- chain ID is `57073`;
- vault token immutable equals the exact approved native USDC proxy address;
- token address has code;
- monitored implementation/admin state matches the accepted Circle dependency baseline or an explicitly reviewed later state;
- token is not confused with bridged `USDC.e`.

Token symbol/name/decimals alone never establish identity.

## 12. Release receipt

The production-candidate release receipt schema must include at least:

```text
release_id
source_commit
foundry_version
solc_version
evm_version
optimizer
optimizer_runs
foundry_toml_digest
artifact_digest
constructor_abi_digest
creation_bytecode_hash
runtime_bytecode_hash
chain_id
token_address
audit_report_digest/reference
known_assumptions
```

A later Challenge deployment receipt references this release receipt plus its own constructor/immutables.

## 13. Independent reproduction gate

Before a production canary can be authorized:

- one independent clean environment reproduces the expected runtime hash from the frozen source;
- one independent reviewer compares deployed `eth_getCode` hash to the release hash;
- differences fail closed.

“Explorer says verified” is supporting evidence, not a substitute for hash equality.

## 14. Change law

Any change to:

- Solidity source;
- compiler/toolchain;
- optimizer;
- EVM target;
- library/dependency code;
- constructor semantics;
- settlement semantics;
- assembly;
- build metadata settings;

creates a new release candidate and requires relevant tests/review to be rerun.

Documentation-only changes do not change bytecode identity but may change launch policy/authority and therefore can still block release.

## 15. J3 acceptance

This procedure is complete when the future production-candidate implementation stage can generate the release receipt mechanically and CI can independently verify it.

Until that future stage:

`PRODUCTION_RELEASE = SPECIFIED_NOT_BUILT`
