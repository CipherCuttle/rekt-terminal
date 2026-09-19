# REKT INKUBATOR — STAGE J4 POST-AUDIT DEPLOYMENT ATTESTATION REHEARSAL V1

**Status:** LOCAL-FORK REHEARSAL / NO MAINNET AUTHORITY  
**Date:** 2026-09-19  
**Auditor scope:** `05e345181dfde2c720874b1fc2d1ee7dd39272a9`  
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
- approved vault creation/runtime hash;
- approved resolver creation/runtime hash;
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

1. resolver runtime hash equals locally built audited resolver runtime hash;
2. vault runtime hash equals locally built audited vault runtime hash;
3. resolver signer1/signer2/signer3 read back exactly;
4. resolver quorum reads 2;
5. vault token equals native Ink USDC address;
6. challenge/terms/binding digests read back exactly;
7. prize amount reads back exactly;
8. all four deadlines read back exactly;
9. refund/outcome/organizer/resolver authorities read back exactly;
10. pre-build and terminal manifest digests read back exactly;
11. no ETH deployment value is required;
12. local deployment receipt explicitly says it is not M04.

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
9. require providers to return identical runtime bytes;
10. keccak each runtime and require exact audited release hash;
11. read all immutable/business bindings from both providers;
12. require exact deployment-plan match;
13. verify source on canonical explorer;
14. record tx hashes, block hashes, deployment addresses, provider identities, explorer status and release/audit references;
15. **only then** may a separate funding-authorization decision exist.

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
resolver_runtime_hash
resolver_signer_set_digest
resolver_quorum
vault_address
vault_runtime_hash
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
- bytecode hash drift;
- wrong chain;
- wrong USDC address;
- changed USDC implementation/admin state not accepted by release process;
- empty deployed code;
- provider disagreement;
- constructor/readback mismatch;
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
