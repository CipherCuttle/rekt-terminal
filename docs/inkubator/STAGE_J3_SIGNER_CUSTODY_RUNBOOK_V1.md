# REKT INKUBATOR — STAGE J3 PRODUCTION SIGNER CUSTODY RUNBOOK V1

**Status:** ACTIVE / AUDIT INPUT  
**Date:** 2026-09-18  
**Parent:** `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`  
**Production-money authority:** NONE  
**Production signer creation authority:** NONE

This runbook defines the production-candidate authority topology and operating rules. It does not authorize creation or funding of production signers.

## 1. Authority graph

The first capped production candidate has four economically relevant identities:

1. **Organizer authority** — the Challenge organizer wallet frozen into the vault.
2. **Outcome authority** — one isolated Inkubator EOA used only to co-attest normal qualification/selection facts.
3. **Resolver authority** — one ERC-1271-compatible 2-of-3 threshold wallet used only for exceptional recovery/resolution.
4. **Refund recipient** — immutable Challenge refund destination, normally tied to the funder/organizer terms.

No one identity can redirect arbitrary prize funds.

The deployer is not a settlement authority.

## 2. Separation law

The following addresses must be distinct for each active Challenge where the roles coexist:

- outcome authority;
- organizer authority;
- resolver authority.

The ordinary web/API/worker environment may know these public addresses but may not contain their private signing material.

No database mutation changes an already-deployed vault authority.

## 3. Outcome signer

### Purpose

The outcome signer co-attests:

- payout-set freeze;
- normal qualifier-set freeze;
- organizer-winner settlement before the organizer deadline.

It does **not**:

- hold prize funds;
- choose an arbitrary payout address;
- sweep;
- execute deterministic post-deadline defaults;
- unilaterally cancel/refund;
- replace an existing qualifier set.

### Key form

First-candidate direction:

- EOA;
- generated in a hardware-backed/offline signing environment;
- private key never committed, logged, pasted into chat, stored in GitHub/Render/Vercel, or exposed to the ordinary Inkubator runtime;
- signing is an explicit separate operation over a precomputed EIP-712 digest.

A later audited contract-wallet outcome authority is allowed only as a new reviewed authority design.

### Signing request

Every signing request must display or independently derive:

- environment: production candidate;
- chain ID: 57073;
- vault address;
- Challenge digest;
- terms digest;
- binding digest;
- action type;
- payout/qualifier root;
- manifest digest if applicable;
- exact recipient(s)/amount(s) where applicable;
- expiry/deadline context.

Blind signing of opaque arbitrary calldata is prohibited.

## 4. Resolver threshold

The resolver authority is a **minimal immutable ERC-1271 threshold verifier**, not a mutable general-purpose wallet.

First-candidate law:

- exactly three immutable signer addresses;
- immutable quorum `2-of-3`;
- no owner/signatory mutation;
- no threshold mutation;
- no modules;
- no delegatecall;
- no upgrade/proxy;
- no asset custody;
- no arbitrary transaction execution;
- ERC-1271 verification only.

The three signers must not all depend on one security boundary.

Minimum topology:

- signer R1 — operational recovery signer;
- signer R2 — cold recovery signer held separately from R1;
- signer R3 — independent recovery signer/security principal.

Examples of unacceptable “3 signers”:

- three browser profiles on one laptop;
- three keys in one password manager;
- three cloud secrets under one cloud account;
- three software wallets backed by one seed phrase.

The verifier implementation itself is part of the production-candidate smart-contract audit scope. Active Challenges never change its signer set/quorum.

## 5. Organizer authority

Organizer authority may be:

- an EOA; or
- an ERC-1271 smart-contract wallet.

The organizer wallet is frozen per Challenge before BUILDING.

Ordinary account/session recovery must never silently replace the on-chain organizer authority for an active Challenge.

If organizer signing becomes unavailable, deterministic default after the selection deadline remains live without organizer participation.

## 6. Signer lifecycle

### Generate

Before capped launch:

- create keys/wallet under the approved ceremony;
- record only public addresses and custody metadata in the launch register;
- verify each address through an independent readback/signature challenge;
- never copy raw private key material into deployment configuration.

### Activate

An authority becomes economically active only when its address is committed into a deployed/funded Challenge vault.

Activation checklist includes:

- chain and vault address;
- source/codehash release;
- authority addresses;
- token address;
- deadlines;
- terms/binding digest.

### Operate

Every authority use creates an append-only receipt containing:

- request ID;
- Challenge/vault;
- action type;
- digest signed;
- signer/threshold identity;
- timestamp;
- verification result.

Do not log raw signatures where they expose unnecessary operational correlation unless required for audit; on-chain signatures/transactions remain public where applicable.

### Retire

An EOA authority cannot be removed from an already-deployed immutable vault.

Retirement means:

- stop using it for new Challenges;
- preserve only the minimum evidence needed for active liabilities;
- active Challenges continue under their frozen law or timed recovery path.

## 7. Outcome-key loss

Outcome key loss must not create permanent custody failure.

If a final qualifier set already exists:

- no outcome signer is needed for deterministic post-deadline default.

If no qualifier set exists:

- before `resolution_deadline`, follow the normal recovery rule requiring the authorities frozen by the candidate specification;
- at/after `resolution_deadline`, the resolver 2-of-3 may use the one-time recovery qualifier-set path defined by J3;
- at `terminal_long_stop`, the predeclared terminal fallback remains permissionless if no qualifier set/settlement exists.

Never replace the frozen outcome address by editing PostgreSQL.

## 8. Resolver signer loss

The 2-of-3 topology tolerates loss of one resolver signer.

If one signer is lost:

1. mark that underlying key unavailable;
2. verify the immutable verifier still requires two valid remaining principals;
3. operate with the two remaining signers only when resolver authority is contract-valid;
4. deploy a new reviewed resolver verifier for **new Challenges** if membership must change.

The active resolver verifier is never reconfigured.

If quorum is lost entirely, no privileged override is introduced. The immutable terminal long-stop remains the ultimate liveness path.

## 9. Compromise response

### Suspected outcome-key compromise

- stop creating new Challenges using that outcome authority;
- disable the signing workflow;
- inventory active Challenge liabilities;
- do not attempt to mutate active vault authority addresses;
- rely on already-frozen qualifier/default state where possible;
- use resolver recovery only under contract-valid conditions;
- publish/record an incident correction receipt.

### Suspected resolver compromise

- freeze new Challenges referencing the affected immutable resolver verifier;
- identify the compromised underlying signer;
- if the two uncompromised signers remain trustworthy, they still form the fixed 2-of-3 quorum for contract-valid recovery only;
- do not rotate/reconfigure the active verifier;
- deploy a new reviewed immutable verifier for new Challenges;
- if fewer than two trustworthy signers remain, do not use resolver privileges on active Challenges;
- rely on normal/deterministic/terminal paths that do not require resolver authority.

### Suspected organizer compromise

The platform may pause UI/API progression, but may not invent a replacement organizer signature. Existing vault law remains authoritative.

## 10. No emergency master key

There is deliberately no:

- platform master private key;
- owner sweep key;
- database override;
- proxy admin capable of rewriting active settlement law;
- “break glass” arbitrary-recipient transfer.

Recovery comes from precommitted state transitions and timeouts, not superior hidden authority.

## 11. Production signing transport

The ordinary application creates **unsigned canonical authorization requests** only.

A signer boundary receives:

- canonical typed-data payload;
- expected digest;
- decoded human-readable fields;
- exact vault/chain identity.

The signer independently recomputes the digest before signing.

Returned signature is verified locally and against the expected authority before it is submitted or persisted.

The transport must be replay/idempotency safe; duplicate signing requests may not create different semantic actions for the same request identity.

## 12. Secrets policy

Never store production signer private material in:

- repository files/history;
- GitHub Actions secrets;
- Render environment variables;
- Vercel environment variables;
- ordinary application databases;
- analytics/logging systems;
- test fixtures;
- screenshots;
- chat transcripts.

This policy is stricter than “secret encrypted at rest”: the ordinary app must not possess the production settlement key at all.

## 13. Pre-launch signer ceremony evidence

Before production authority can be requested, produce:

- public authority-address register;
- role/separation checklist;
- resolver threshold configuration evidence;
- ERC-1271 known-answer signature test;
- outcome EOA known-answer EIP-712 test;
- signer recovery tabletop;
- one lost-outcome-key liveness rehearsal;
- one lost-resolver-signer quorum rehearsal;
- one proof that resolver signer set/quorum/code are immutable for active Challenges;
- secret inventory proving ordinary runtime does not contain signing keys.

## 14. Remaining external decisions

This runbook does not choose:

- a specific hardware wallet;
- a specific threshold-wallet vendor;
- a managed HSM/KMS provider;
- a human/legal identity for R3.

Those choices must preserve this authority model and enter the external audit/operations review.

Until a production signer ceremony is separately authorized:

`PRODUCTION_SIGNERS = NOT_CREATED`
