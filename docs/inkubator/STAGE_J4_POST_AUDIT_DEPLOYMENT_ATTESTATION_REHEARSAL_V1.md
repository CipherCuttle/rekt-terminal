# REKT INKUBATOR — STAGE J4 POST-AUDIT DEPLOYMENT ATTESTATION REHEARSAL V1

**Status:** LOCAL-FORK REHEARSAL / IMMUTABLE-AWARE IDENTITY LAW / NO MAINNET AUTHORITY  
**Date:** 2026-09-19  
**Auditor scope:** `56eaa98497f4c036227c7e2512dadeb640eacfe4`  
**Mainnet deployment authority:** NONE  
**Production money:** NONE

## 1. Objective

Rehearse the future M04 post-audit/pre-funding gate without pretending a local deployment satisfies the real mainnet evidence requirement.

The real gate remains:

`AUDIT PASS → APPROVED RELEASE → MAINNET DEPLOY AUTHORITY → DEPLOY → TWO-INDEPENDENT-RPC RUNTIME ATTESTATION → CONSTRUCTOR READBACK → EXPLORER VERIFICATION → FUNDING AUTHORITY`

This rehearsal stops before mainnet and before real value.

## 2. Frozen release checks

Before any future production deployment, fail closed unless:

- exact approved source SHA;
- exact Foundry 1.8.3;
- exact solc 0.8.37;
- EVM prague;
- optimizer 200;
- metadata hash none;
- FFI disabled;
- native Ink USDC exact address;
- chain ID 57073;
- approved vault creation-bytecode hash;
- approved vault immutable-layout digest;
- approved vault immutable-normalized runtime-template hash;
- approved resolver creation-bytecode hash;
- approved resolver immutable-layout digest;
- approved resolver immutable-normalized runtime-template hash;
- approved constructor ABI digest;
- approved audit report digest/reference.

If an audit fix changes Solidity/toolchain/constructor semantics, a new release receipt is mandatory.

## 3. Local fork rehearsal

Permitted now:

- start isolated Anvil fork of Ink;
- force local chain ID 31337;
- use Anvil-unlocked dummy accounts;
- deploy exact candidate resolver and vault locally;
- use native Ink USDC proxy only as a read-only constructor-bound address;
- move no real USDC;
- broadcast no upstream transaction.

Required local assertions:

1. resolver exact deployed runtime is nonempty and its exact per-instance runtime hash is recorded;
2. vault exact deployed runtime is nonempty and its exact per-instance runtime hash is recorded;
3. resolver runtime, after zero-normalizing only the compiler-declared immutable spans, equals the frozen release runtime-template hash;
4. vault runtime, after the same frozen-layout normalization, equals the frozen release runtime-template hash;
5. resolver and vault immutable-layout digests equal the release receipt;
6. resolver signer1/signer2/signer3 read back exactly;
7. resolver quorum reads 2;
8. vault token equals native Ink USDC address;
9. challenge/terms/binding digests read back exactly;
10. prize amount reads back exactly;
11. all four deadlines read back exactly;
12. refund/outcome/organizer/resolver authorities read back exactly;
13. pre-build and terminal manifest digests read back exactly;
14. no ETH deployment value is required;
15. local deployment receipt explicitly says it is not M04.

## 4. Actual post-audit M04 gate

After external audit is closed and deployment is separately authorized:

1. rebuild exact approved release in a clean environment;
2. compare clean-runner release hashes to approved release receipt;
3. verify Ink chain ID = 57073;
4. verify native USDC proxy identity and accepted implementation/admin baseline;
5. deploy resolver;
6. read resolver signer set/quorum from two independent RPC providers;
7. deploy Challenge vault with exact frozen constructor plan;
8. call `eth_getCode` for resolver and vault from provider A and B;
9. require providers to return identical exact runtime bytes and exact per-instance runtime hashes;
10. record those exact deployed runtime hashes;
11. normalize each fetched runtime using the frozen compiler immutable-reference layout;
12. require the normalized runtime-template hashes to equal the approved release receipt;
13. require the immutable-layout digests to equal the approved release receipt;
14. read all immutable/business bindings from both providers;
15. require exact signed deployment-plan match;
16. verify source on the canonical explorer;
17. record tx hashes, block hashes, deployment addresses, provider identities, exact deployed runtime hashes, normalized template hashes, immutable-layout digests, explorer status and release/audit references;
18. **only then** may a separate funding-authorization decision exist.

Any provider disagreement blocks funding.

## 5. Deployment receipt minimum fields

```text
environment
release_id
auditor_source_commit
final_post_audit_source_commit
audit_report_digest
chain_id
token_address
token_runtime_hash
token_implementation
token_implementation_runtime_hash
token_admin
resolver_address
resolver_deployed_runtime_hash
resolver_runtime_template_hash
resolver_immutable_layout_digest
resolver_signer_set_digest
resolver_quorum
vault_address
vault_deployed_runtime_hash
vault_runtime_template_hash
vault_immutable_layout_digest
challenge_digest
terms_digest
binding_digest
prize_amount
activation_deadline
organizer_selection_deadline
resolution_deadline
terminal_long_stop
refund_recipient
outcome_authority
organizer_authority
resolver_authority
prebuild_manifest_digest
terminal_manifest_digest
provider_a
provider_b
provider_a_block_hash
provider_b_block_hash
explorer_verification
deployment_tx_hashes
funding_authority
```

## 6. Fail-closed cases

Funding is blocked if any of the following occurs:

- audit report does not cover the release source;
- source commit drift;
- toolchain drift;
- creation-bytecode hash drift;
- immutable-layout digest drift;
- normalized runtime-template hash drift;
- exact two-provider deployed-runtime disagreement;
- wrong chain;
- wrong USDC address;
- changed USDC implementation/admin state not accepted by release process;
- empty deployed code;
- provider disagreement;
- immutable/business constructor readback mismatch;
- wrong resolver signer set/quorum;
- explorer verification failure that cannot be independently explained;
- missing deployment receipt;
- production signer ceremony incomplete;
- legal gate open;
- explicit production-money authority absent.

## 7. Authority

A successful local rehearsal proves procedure mechanics only.

It does **not** satisfy:

- external audit;
- M04 deployed-code attestation;
- production signer ceremony;
- legal approval;
- mainnet deployment authorization;
- production-money authorization.

```text
LOCAL_DEPLOYMENT_ATTESTATION_REHEARSAL = PERMITTED
M04 = POST_AUDIT / PRE_FUNDING / NOT_YET_RUN
MAINNET_DEPLOYMENT = NOT_AUTHORIZED
PRODUCTION_MONEY = NOT_AUTHORIZED
```
