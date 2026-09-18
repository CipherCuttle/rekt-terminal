# REKT INKUBATOR — STAGE J3 PRODUCTION-CANDIDATE ADVERSARIAL TEST MATRIX V1

**Status:** ACTIVE / IMPLEMENTATION CONTRACT  
**Date:** 2026-09-18  
**Parent:** `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`  
**Threat matrix:** `STAGE_J3_PRODUCTION_VALUE_THREAT_MATRIX_V1.md`  
**Production-money authority:** NONE

This matrix is the acceptance contract for the future production-candidate vault implementation. J3 does not implement or deploy that vault.

## Test classes

- **UNIT** — exact branch/revert/state behavior.
- **PROPERTY** — fuzz/state-machine invariant.
- **KNOWN-ANSWER** — exact digest/signature/hash vector shared across JS/Solidity.
- **FORK/INTEGRATION** — canonical token/RPC behavior on a controlled fork/test environment.
- **OPERATIONS** — signer/reconciliation/recovery drill.
- **RELEASE** — reproducible bytecode/deployment identity.

## A. Constructor / identity

| ID | Class | Gate |
|---|---|---|
| J3-A01 | UNIT | zero token/refund/outcome/organizer/resolver address rejects |
| J3-A02 | UNIT | zero challenge/terms/binding digest rejects |
| J3-A03 | UNIT | zero prize rejects |
| J3-A04 | UNIT | authority addresses must satisfy frozen independence law |
| J3-A05 | UNIT | deadlines must satisfy strict ordering: activation ≤ normal selection < resolution < terminal long-stop |
| J3-A09 | KNOWN-ANSWER | every Build Contract not-before deadline uses `ceil(ms/1000)`; exact-second/+1ms/+999ms vectors never shorten the off-chain deadline |
| J3-A06 | RELEASE | deployed runtime hash equals approved release hash |
| J3-A07 | RELEASE | every constructor immutable readback matches deployment plan |
| J3-A08 | RELEASE | wrong chain or wrong token tuple blocks funding workflow |

## B. Funding / pre-build refund

| ID | Class | Gate |
|---|---|---|
| J3-B01 | UNIT | exact prize funding succeeds once |
| J3-B02 | UNIT | second funding attempt rejects |
| J3-B03 | UNIT | fee-on-transfer / short delta rejects |
| J3-B04 | UNIT | unsolicited token dust before funding does not satisfy/change exact funding delta |
| J3-B05 | UNIT | unactivated refund impossible before activation deadline |
| J3-B06 | UNIT | at safely ceiling-converted activation deadline with payout set unsealed, full refund becomes permissionless using only immutable pre-build-refund manifest digest |
| J3-B07 | UNIT | once payout set sealed, pre-build refund is permanently unavailable |
| J3-B08 | PROPERTY | no sequence permits funding liability to exceed exact prize |

## C. Payout roster freeze

| ID | Class | Gate |
|---|---|---|
| J3-C01 | UNIT | payout root/count require outcome + organizer authority |
| J3-C02 | UNIT | one missing/invalid signature rejects |
| J3-C03 | UNIT | root/count cannot be resealed |
| J3-C04 | PROPERTY | payout leaf binds entry digest + canonical payout order + address |
| J3-C05 | PROPERTY | caller input order cannot change canonical remainder order |
| J3-C06 | UNIT | duplicate entry IDs/payout addresses reject in off-chain plan |
| J3-C07 | KNOWN-ANSWER | JS and Solidity payout leaf/root vectors match exactly |

## D. Qualifier freeze

| ID | Class | Gate |
|---|---|---|
| J3-D01 | UNIT | normal qualifier set requires outcome + organizer before recovery boundary |
| J3-D02 | UNIT | recovery qualifier set requires outcome + resolver before resolution deadline under frozen policy |
| J3-D03 | UNIT | after resolution deadline, resolver-threshold-only recovery is allowed only if no qualifier set exists |
| J3-D04 | UNIT | resolver-only recovery members must all prove membership in frozen payout root |
| J3-D05 | UNIT | recovery evidence digest is bound into authorization |
| J3-D06 | UNIT | existing qualifier set can never be replaced by recovery path |
| J3-D07 | UNIT | duplicate qualifier entry/address rejects |
| J3-D08 | UNIT | qualifier payout order strictly increasing/canonical |
| J3-D09 | KNOWN-ANSWER | JS and Solidity qualifier-set authorization digest match, including exact frozen default-manifest digest |
| J3-D11 | UNIT | changing only default-manifest digest invalidates normal/recovery qualifier authorization |
| J3-D12 | UNIT | final qualifier state exposes exactly one stored nonzero default-manifest digest and it cannot change |
| J3-D10 | PROPERTY | no legal sequence produces two distinct final qualifier roots |

## E. Organizer winner

| ID | Class | Gate |
|---|---|---|
| J3-E01 | UNIT | winner can be authorized only before organizer deadline |
| J3-E02 | UNIT | winner must prove membership in final qualifier set |
| J3-E03 | UNIT | non-qualifier cannot win even with valid organizer/outcome signatures |
| J3-E04 | UNIT | winner amount must equal exact prize |
| J3-E05 | UNIT | winner payout address cannot differ from frozen leaf |
| J3-E06 | KNOWN-ANSWER | organizer-winner EIP-712 digest matches off-chain implementation |
| J3-E07 | PROPERTY | organizer/outcome signatures cannot redirect to arbitrary address |

## F. Deterministic default — core J3 delta

| ID | Class | Gate |
|---|---|---|
| J3-F01 | UNIT | default rejects at deadline-1 |
| J3-F02 | UNIT | default succeeds at deadline with no fresh organizer/outcome/resolver signature and uses the stored qualifier-bound default manifest |
| J3-F10 | UNIT | permissionless default API has no caller-selected manifest parameter / alternate manifest cannot affect settlement receipt identity |
| J3-F03 | UNIT | one qualifier receives 100% |
| J3-F04 | UNIT | two qualifiers split exactly with canonical first remainder |
| J3-F05 | UNIT | three qualifiers split exactly with canonical remainder |
| J3-F06 | UNIT | zero qualifiers refunds exact immutable refund recipient |
| J3-F07 | PROPERTY | deterministic default recipients are a pure function of frozen payout+qualifier state and prize |
| J3-F08 | PROPERTY | deterministic default credits exactly prize and never more |
| J3-F09 | OPERATIONS | delete/unavailable all authority signing keys after qualifier freeze; default still reaches authorized claimable state |

## G. Resolution / terminal long-stop

| ID | Class | Gate |
|---|---|---|
| J3-G01 | UNIT | resolver recovery cannot run before its allowed boundary |
| J3-G02 | UNIT | resolver threshold cannot name recipient outside frozen payout roster/refund recipient |
| J3-G03 | UNIT | resolver threshold cannot replace existing qualifier set |
| J3-G04 | UNIT | terminal fallback rejects before terminal long-stop |
| J3-G05 | UNIT | terminal fallback succeeds permissionlessly at/after terminal long-stop only if no qualifier set and no settlement, using immutable terminal-refund manifest digest |
| J3-G11 | UNIT | pre-build and terminal refund paths cannot accept/substitute a caller-selected manifest digest |
| J3-G06 | UNIT | terminal fallback always sends exact prize to immutable fallback/refund policy |
| J3-G07 | PROPERTY | no timestamp/state sequence permits arbitrary recipient under recovery/long-stop |
| J3-G08 | OPERATIONS | outcome key lost + organizer unavailable + resolver available → recovery path terminates |
| J3-G09 | OPERATIONS | outcome unavailable + one resolver signer lost → 2-of-3 still terminates |
| J3-G10 | OPERATIONS | all privileged signers unavailable → terminal long-stop still terminates according to frozen fallback |

## H. ECDSA / ERC-1271

| ID | Class | Gate |
|---|---|---|
| J3-H01 | UNIT | strict low-s ECDSA accepts valid signer |
| J3-H02 | UNIT | high-s, bad-v, malformed length, zero recovery reject |
| J3-H03 | UNIT | immutable resolver ERC-1271 verifier returns exact magic `0x1626ba7e` for two distinct valid immutable signers |
| J3-H11 | UNIT | resolver verifier rejects duplicate signer proofs |
| J3-H12 | RELEASE | resolver verifier exposes no signer/threshold/module/upgrade/delegatecall/asset-execution mutation surface |
| J3-H13 | PROPERTY | resolver signer set and quorum remain identical for lifetime of deployed verifier |
| J3-H04 | UNIT | ERC-1271 wrong magic rejects |
| J3-H05 | UNIT | ERC-1271 revert rejects |
| J3-H06 | UNIT | ERC-1271 empty/short/malformed return rejects |
| J3-H07 | UNIT | ERC-1271 valid signature from wrong contract authority rejects |
| J3-H08 | KNOWN-ANSWER | EIP-712 domain binds chain ID + vault address |
| J3-H09 | PROPERTY | signature valid on vault A is invalid on vault B |
| J3-H10 | PROPERTY | signature valid on chain A digest is invalid on chain B digest |

## I. Claims / conservation

| ID | Class | Gate |
|---|---|---|
| J3-I01 | UNIT | anyone can call `claimFor`, destination remains frozen recipient |
| J3-I02 | UNIT | duplicate claim rejects |
| J3-I03 | UNIT | claim state zeroed before external token transfer |
| J3-I04 | UNIT | reentrant token cannot double claim |
| J3-I05 | UNIT | blocked/reverting recipient does not prevent another recipient claiming |
| J3-I06 | UNIT | failed claim leaves that recipient's liability recoverable/claimable under supported-token behavior assumptions |
| J3-I07 | PROPERTY | `totalClaimed <= prize` always |
| J3-I08 | PROPERTY | `sum(claimable)+totalClaimed == prize` after settlement authorization |
| J3-I09 | PROPERTY | finalized iff totalClaimed == prize |
| J3-I10 | PROPERTY | no external call creates value or credits outside frozen recipients |

## J. Token boundary

| ID | Class | Gate |
|---|---|---|
| J3-J01 | FORK/INTEGRATION | exact native Ink USDC proxy address accepted |
| J3-J02 | FORK/INTEGRATION | bridged USDC.e address rejected |
| J3-J03 | FORK/INTEGRATION | token decimals read/assumption matches frozen six-decimal release |
| J3-J04 | FORK/INTEGRATION | canonical USDC transfer/transferFrom behavior works with safe wrapper |
| J3-J05 | MOCK | fee-on-transfer token rejects funding |
| J3-J06 | MOCK | false-return transfer token fails safely |
| J3-J07 | MOCK | no-return/malformed-return token behavior matches explicit wrapper policy |
| J3-J08 | MOCK | reentrant malicious token cannot violate claim invariants |
| J3-J09 | OPERATIONS | paused USDC simulation leaves state non-corrupt and recoverable after unpause |
| J3-J10 | OPERATIONS | blacklisted recipient simulation proves other recipients remain independent |

## K. Forbidden surfaces

| ID | Class | Gate |
|---|---|---|
| J3-K01 | RELEASE | ABI contains no owner/admin sweep |
| J3-K02 | RELEASE | ABI contains no arbitrary external call |
| J3-K03 | RELEASE | ABI contains no arbitrary recipient withdrawal |
| J3-K04 | RELEASE | no upgrade/proxy implementation setter |
| J3-K05 | RELEASE | no yield/swap/bridge |
| J3-K06 | RELEASE | no fee/fee-recipient in first capped candidate |
| J3-K07 | RELEASE | no selfdestruct/metamorphic code-replacement mechanism |
| J3-K08 | PROPERTY | all token outflows occur through frozen claim/refund paths |

## L. Finality / reconciliation

These are application/adapter tests around the vault, not Solidity-only tests.

| ID | Class | Gate |
|---|---|---|
| J3-L01 | UNIT | submitted tx never maps directly to SETTLED |
| J3-L02 | UNIT | included/success tx below finalized head stays nonterminal |
| J3-L03 | UNIT | two providers agreeing on receipt + finalized canonical block permits FINALIZED |
| J3-L04 | UNIT | provider receipt disagreement → RECONCILING |
| J3-L05 | UNIT | block-hash disagreement → RECONCILING |
| J3-L06 | UNIT | missing provider receipt → RECONCILING |
| J3-L07 | UNIT | simulated reorg invalidates included evidence and remains reconciling |
| J3-L08 | PROPERTY | no disagreement state transitions directly to FINALIZED |
| J3-L09 | PROPERTY | reconciliation retries are idempotent |
| J3-L10 | UNIT | finalized correction is append-only/superseding, never destructive mutation |

## M. Release identity

| ID | Class | Gate |
|---|---|---|
| J3-M01 | RELEASE | exact pinned toolchain reproduces expected creation hash |
| J3-M02 | RELEASE | exact pinned toolchain reproduces expected runtime hash |
| J3-M03 | RELEASE | clean second environment produces same runtime hash |
| J3-M04 | RELEASE | deployed `eth_getCode` hash from provider A/B equals release hash |
| J3-M05 | RELEASE | altered optimizer/compiler/source produces a distinct candidate and fails old release gate |
| J3-M06 | RELEASE | constructor readback snapshot equals deployment plan |
| J3-M07 | RELEASE | explorer source verification recorded but not trusted as sole identity proof |

## N. Signer operations

| ID | Class | Gate |
|---|---|---|
| J3-N01 | OPERATIONS | ordinary app secret inventory contains no outcome/resolver production private key |
| J3-N02 | OPERATIONS | known-answer outcome EOA typed-data signing verifies |
| J3-N03 | OPERATIONS | known-answer 2-of-3 resolver ERC-1271 signature verifies |
| J3-N04 | OPERATIONS | one resolver signer lost → quorum still works |
| J3-N05 | OPERATIONS | one resolver signer compromised → no active-verifier rotation; two uncompromised immutable signers still form quorum; new verifier used only for new Challenges |
| J3-N06 | OPERATIONS | outcome key loss follows timed recovery; no DB authority rewrite |
| J3-N07 | OPERATIONS | signer request human-readable fields match signed digest |
| J3-N08 | OPERATIONS | duplicate signing request is idempotent / cannot change semantic payload under same request ID |

## O. Privacy / evidence

| ID | Class | Gate |
|---|---|---|
| J3-O01 | RELEASE | contract storage/events contain no GitHub IDs/names/source/evidence blobs |
| J3-O02 | RELEASE | on-chain identifiers are opaque digests where possible |
| J3-O03 | UNIT | economic receipt is append-only |
| J3-O04 | UNIT | correction creates superseding receipt rather than mutating prior fact |
| J3-O05 | OPERATIONS | deployment/signing logs contain no private keys/seeds |
| J3-O06 | OPERATIONS | secret scanner detects synthetic credential canary |

## P. Mainnet authority negative tests

| ID | Class | Gate |
|---|---|---|
| J3-P01 | RELEASE | ordinary PR/push CI cannot deploy production vault |
| J3-P02 | RELEASE | testnet rehearsal workflow rejects mainnet chain ID |
| J3-P03 | RELEASE | production deploy workflow does not exist during J3 |
| J3-P04 | RELEASE | production asset movement remains impossible from J3 branch |
| J3-P05 | RELEASE | no production signer material introduced during J3 |

## Required invariant suite

The future implementation must express these as stateful invariants where practical:

```text
I1  totalClaimed <= prizeAmount
I2  settlementAuthorized => totalCredited == prizeAmount
I3  settlementAuthorized => totalClaimed + sum(claimable) == prizeAmount
I4  finalized <=> settlementAuthorized && totalClaimed == prizeAmount
I5  payoutSetSealed is monotonic
I6  qualificationResolved is monotonic
I7  settlementAuthorized is monotonic
I8  final qualifier root changes at most once
I9  authorized recipients are subset of frozen payout roster plus only explicitly legal refund recipient
I10 no state transition changes immutable payout/authority/deadline identities
I11 deterministic default at/after deadline requires no live signer once qualifier set is final
I12 terminal long-stop is reachable without privileged signers under its exact preconditions
I13 final qualifier state fixes exactly one default-manifest digest
I14 permissionless paths cannot alter settlement/refund manifest identity
I15 resolver signer set/quorum/code are immutable for active Challenges
I16 EVM not-before deadlines never precede the frozen off-chain millisecond deadline
```

## Coverage law

A production candidate is not ready for external audit because “tests pass.”

Before audit handoff:

- every Critical/High threat in `STAGE_J3_PRODUCTION_VALUE_THREAT_MATRIX_V1.md` maps to at least one gate above;
- every monetary state transition has unit + property coverage;
- all digest/signature boundaries have known-answer vectors;
- all time boundaries have exact -1 / boundary / +1 tests;
- external-token assumptions have mocks plus one controlled native-USDC integration/fork exercise;
- release identity is reproducible independently.

The external auditor may add tests. This matrix is the minimum expected package, not a limit on review.
