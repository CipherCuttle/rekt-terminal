# REKT INKUBATOR — STAGE J4 SIGNER CEREMONY REHEARSAL V1

**Status:** DUMMY / EPHEMERAL REHEARSAL ONLY  
**Date:** 2026-09-19  
**Parent:** `STAGE_J3_SIGNER_CUSTODY_RUNBOOK_V1.md`  
**Production signers:** NOT CREATED / NOT AUTHORIZED  
**Production-money authority:** NONE

## 1. Objective

Rehearse the human and technical ceremony required for:

- one isolated outcome EOA;
- three independent resolver signing principals;
- immutable resolver 2-of-3 configuration;
- public-address registration;
- known-answer signing;
- one lost-outcome-key incident;
- one lost-resolver-signer incident;
- full resolver-quorum-loss fallback.

The rehearsal must use ephemeral dummy material only. Nothing generated here may ever become a production key.

## 2. Rehearsal invariants

PASS only if:

- outcome, organizer and resolver authorities are distinct;
- R1/R2/R3 dummy signer addresses are all distinct;
- exactly three resolver signers exist;
- quorum is exactly 2;
- no dummy secret is committed to git;
- no dummy secret is written to GitHub Actions outputs/artifacts;
- no dummy secret is printed in logs;
- ordinary application environment contains no signer material;
- one lost resolver signer still leaves 2-of-3;
- two lost resolver signers remove privileged resolver liveness;
- loss of outcome does not permit database/address replacement;
- deterministic/default/terminal contract paths remain the final liveness law.

## 3. Human ceremony rehearsal

Record four separate logical custody slots:

| Role | Dummy boundary | Production expectation |
| --- | --- | --- |
| Outcome | isolated ephemeral signer | hardware-backed/offline |
| R1 | ephemeral operational signer | independent operational recovery device/principal |
| R2 | separate ephemeral cold signer | separately stored cold device/principal |
| R3 | separate ephemeral independent signer | independent security principal |

The rehearsal may run all dummy processes on one disposable CI runner **only to test protocol mechanics**. That does not satisfy production custody separation.

Production ceremony must use real distinct security boundaries and requires separate authorization after external audit. Any deployed resolver used in the real ceremony must also satisfy the repaired immutable-aware M04 runtime identity/readback law.

## 4. Public address register rehearsal

The rehearsal receipt records public values only:

```text
environment = DUMMY_REHEARSAL
chain = LOCAL_ONLY
outcome_address
resolver_address
resolver_signer_1_address
resolver_signer_2_address
resolver_signer_3_address
resolver_quorum = 2
auditor_scope = 56eaa98497f4c036227c7e2512dadeb640eacfe4
```

Private keys, seeds and raw secret-export files are forbidden receipt fields.

## 5. Known-answer signing rehearsal

Use the frozen J4 qualifier-set digest:

`0xfd1656fab8c2c886907ad90e2653f37eafd7da10244871054c8dea25ac7cf138`

Required checks:

1. outcome dummy signer signs the digest;
2. recovered address equals the recorded outcome address;
3. R1 + R2 produce a valid 130-byte resolver proof;
4. R1 + R3 also produce a valid proof;
5. R2 + R3 also produce a valid proof;
6. one signer alone fails resolver verification;
7. duplicate signer pair fails;
8. outsider + valid signer fails.

The audited Solidity known-answer suite already proves contract-level mechanics. This rehearsal exists to prove the **operator procedure and secret-handling boundary**.

## 6. Lost outcome tabletop

Scenario:

`OUTCOME_KEY_UNAVAILABLE`

Operator response:

1. block creation of new Challenges using that outcome authority;
2. disable the isolated signing workflow;
3. inventory active Challenge/vault liabilities by public address only;
4. do not edit PostgreSQL to replace outcome authority;
5. if qualifier set exists, wait/use permissionless deterministic settlement when eligible;
6. if qualifier set does not exist, use only the frozen recovery law;
7. if privileged qualification recovery ultimately becomes impossible, terminal long-stop remains the final liveness path;
8. record append-only incident/correction evidence.

PASS requires no hidden master-key or mutable-authority proposal.

## 7. One resolver signer lost tabletop

Scenario:

`R2_UNAVAILABLE`

PASS if:

- R1 + R3 still satisfy immutable 2-of-3;
- no active verifier reconfiguration occurs;
- R2 is marked unavailable operationally;
- a new reviewed resolver may be used only for future Challenges.

## 8. Resolver quorum lost tabletop

Scenario:

`ONLY_R1_TRUSTWORTHY`

PASS if:

- resolver privileged action is treated as unavailable;
- there is no threshold reduction;
- there is no owner/module/upgrade path;
- active Challenges retain existing law;
- terminal long-stop remains the final liveness path where its exact preconditions hold.

## 9. Compromise tabletop

Scenario:

`R1_COMPROMISED`

If R2 and R3 remain trustworthy, they are the only valid resolver quorum used for any contract-valid action.

Scenario:

`OUTCOME_COMPROMISED`

Stop using that outcome authority for new Challenges. Do not rotate active immutable vaults by database mutation.

Scenario:

`ORGANIZER_COMPROMISED`

The platform may stop UI/API progression but may not fabricate or replace organizer authorization. Contract law/defaults remain authoritative.

## 10. Production ceremony gate after audit

The real ceremony must additionally prove:

- specific approved hardware/offline device model;
- device initialization provenance;
- physical/geographic/operator custody separation;
- public address readback from each device;
- challenge signature from each device;
- resolver verifier deployed from approved audited release;
- immutable signer-set/quorum readback;
- sealed incident contacts;
- backup/recovery policy;
- lost-device exercise;
- secret inventory showing no app/cloud/repo possession.

Until separately authorized:

```text
SIGNER_REHEARSAL = ALLOWED_WITH_DUMMY_EPHEMERAL_KEYS
PRODUCTION_SIGNER_GENERATION = NOT_AUTHORIZED
PRODUCTION_SIGNERS = NOT_CREATED
```
