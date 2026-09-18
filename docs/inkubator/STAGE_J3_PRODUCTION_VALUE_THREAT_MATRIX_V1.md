# REKT INKUBATOR — STAGE J3 PRODUCTION-VALUE THREAT MATRIX V1

**Status:** ACTIVE  
**Parent authority:** `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`  
**Production-money authority:** NONE

Severity means impact if the control is absent in a real-value launch candidate.

| ID | Threat | Severity | Asset / invariant | Prevention | Detection | Recovery | Residual risk | Required evidence / test |
|---|---|---:|---|---|---|---|---|---|
| J3-T01 | Organizer changes payout address after builders join | Critical | Frozen payout identity | Payout address committed before BUILDING; leaf binds entry digest + canonical order + address; no ordinary DB mutation path | Contract/readback vs frozen terms | Dedicated recovery protocol only; no in-place mutation | Wallet-loss recovery remains hard | Property test: any alternate payout address fails proof/authorization |
| J3-T02 | Web/API compromise redirects prize | Critical | No single compromise redirects settlement | Vault accepts only frozen recipient sets and contract-valid settlement kinds; API never has sweep key | Compare manifest/binding/roots to chain | Stop reconciliation; no admin override | Compromised outcome+organizer could still select among qualifiers | Adversarial test with arbitrary recipient/amount |
| J3-T03 | Organizer + outcome collude before deadline | High | Subjective selection only among qualifiers | Winner must be member of frozen qualifier set; exact prize only | Receipt includes qualifier root + winner | Resolver only for policy breach/dispute, not taste | Colluders can choose any qualifying entry, which is allowed product semantics | Test non-qualifier winner always reverts |
| J3-T04 | Outcome signer alone fabricates qualifier set | Critical | Qualification integrity | Qualifier set requires outcome + organizer or outcome + resolver co-authority | Append-only qualification receipt | Resolver correction/versioned supersession before settlement only | Two-authority collusion remains | Tests for one-signature rejection and co-authority domain binding |
| J3-T05 | Resolver single-key compromise cancels Challenge | Critical | Exceptional cancellation | Production resolver must be threshold / contract-wallet authority; never one EOA | Threshold signer audit log | Key rotation / threshold recovery | Threshold quorum compromise | EIP-1271 threshold integration tests + governance runbook |
| J3-T06 | Signature replay across vaults | Critical | Authorization uniqueness | EIP-712 domain includes chain ID + verifying contract; message binds challenge/terms/binding | Signature digest inspection | None needed if impossible | Chain-id fork semantics | Cross-vault replay property test |
| J3-T07 | Signature replay across chains | Critical | Chain isolation | EIP-712 domain chain ID; deployment allowlist | Reconciliation checks expected chain | Refuse settlement | Chain reconfiguration/fork edge | Cross-chain replay test |
| J3-T08 | ECDSA malleability / invalid signer | High | Signature authenticity | Low-s enforcement, v normalization, zero-address rejection | Revert telemetry | Rotate compromised key if allowed by frozen governance | Wallet implementation variance | Fuzz high-s/invalid-v/zero signer |
| J3-T09 | EIP-1271 wallet returns malformed/adversarial response | High | Contract-wallet authority | Static call exact magic value `0x1626ba7e`; bounded gas strategy; revert/short return = invalid | Signature verification errors | Alternate authorized threshold wallet only via explicit migration policy | Smart-wallet upgrade risk | Mock 1271 wallet suite: valid, invalid, revert, short return, gas grief |
| J3-T10 | Qualifier root substituted after payout set | Critical | Frozen membership | Qualifier digest binds payout-set root + challenge/terms/binding | Receipt/readback | No mutation; deploy new Challenge if corrupted | Co-authority compromise | Root substitution tests |
| J3-T11 | Payout order manipulated to steal remainder | High | Deterministic default economics | Canonical UTF-8 byte ordering frozen before BUILDING; order committed in payout leaf | Compare roster digest | None; bad plan blocks deployment | Unicode/canonicalization ambiguity | Property tests with reordered inputs/non-ASCII IDs |
| J3-T12 | Wrong settlement manifest digest used | Critical | Terms/intention binding | Settlement signature binds manifest digest + qualifier root + kind + recipients digest | Recompute manifest from product authority | Reconciliation hold | Offchain canonicalization bug | Known-answer vectors from J0 manifest to Solidity digest |
| J3-T13 | Wrong terms/binding deployed | Critical | Challenge/terms identity | Constructor immutables; post-deploy readback before accepting funding/build | Deployment verifier | Abandon wrong vault; never migrate active funds silently | Human links wrong vault in UI | Deployment snapshot gate + UI/API vault binding test |
| J3-T14 | Default executes before organizer deadline | Critical | Organizer selection window | Immutable deadline; contract checks `block.timestamp >= deadline` | Chain event monitoring | None; must be impossible | Timestamp granularity | Boundary tests at deadline-1/deadline/deadline+1 |
| J3-T15 | Default requires platform signer and funds lock after platform outage | Critical | Settlement liveness | **Production delta:** once qualifier set is frozen, deterministic default execution is permissionless after deadline | Liveness test with all signer keys unavailable | Anyone calls default path | Gas availability / frozen recipient blacklist | Test default with zero available authority keys after qualifier freeze |
| J3-T16 | Qualification never finalizes and funds lock forever | Critical | Terminal liveness | Immutable recovery deadline + later terminal long-stop committed at deployment | Age/liability monitor | Resolver-threshold recovery window; terminal fallback only to predeclared policy | Terminal refund may disadvantage valid builders if platform died before qualification | Time-warp tests covering unresolved recovery and terminal fallback |
| J3-T17 | Organizer deliberately suppresses qualification to reach refund long-stop | High | Builder fairness | Organizer cannot alone control qualifier finalization; outcome/resolver independence; long-stop is distant and public; dispute/recovery window | Missing-qualification alarms + public timestamps | Resolver threshold can finalize/cancel before terminal fallback | Coordinated multi-authority failure/collusion | Game-theoretic review + scenario test |
| J3-T18 | Pre-build refund abused after builder work starts | Critical | No free organizer option | Immutable entry/build deadlines; pre-build refund only under frozen activation condition before BUILDING | Lifecycle vs chain deadline check | No refund path after BUILDING | Offchain activation evidence correctness | Tests refund legal before boundary, impossible after boundary |
| J3-T19 | No entrants / activation failure leaves funds stuck | High | Pre-build liveness | Explicit pre-build refund semantics or funding delayed until activation | Activation monitor | Frozen refund recipient | Operator outage before activation fact | Recovery-window test |
| J3-T20 | Fee-on-transfer/rebasing token underfunds vault | Critical | Exact prize conservation | One exact allowlisted asset; before/after balance delta must equal prize; rebasing/fee tokens prohibited | Funding delta + token identity check | Funding reverts | Token implementation may change behind proxy | Token proxy/admin risk review + fork/integration test |
| J3-T21 | Token pauses/blacklists recipient | High | Claim liveness | Asset review explicitly models pause/blacklist; pull claims isolate recipients | Failed claim telemetry | Other recipients continue; blocked amount remains claimable; policy for terminal blocked funds frozen before launch | Issuer censorship cannot be eliminated | Blacklisted-recipient simulation/fork test |
| J3-T22 | Malicious ERC-20 false/no return/reentrancy | Critical | Token transfer safety | Exact asset allowlist; safe-call wrapper accepts only supported behavior; checks-effects-interactions + guard | Revert/transfer delta | No generic token rescue | Canonical asset contract risk | Mock token adversarial suite |
| J3-T23 | Reentrancy duplicates claims | Critical | `totalClaimed <= prize` | Claimable zeroed before transfer + nonreentrancy guard | Invariant monitor | None; impossible by design | Malicious token callback | Reentrant token test |
| J3-T24 | Anyone calls `claimFor` and redirects funds | Critical | Frozen recipient | Caller never controls destination; `claimFor(recipient)` transfers only stored claimable for that recipient | Event recipient vs frozen payout | None | Privacy/front-running not economically harmful | Redirect/front-run test |
| J3-T25 | One blocked recipient freezes all payouts | High | Per-recipient isolation | Pull claims; settlement authorization credits independently | Remaining liability per recipient | Other recipients claim normally | Vault remains non-final while one claim blocked | Test one reverting/blacklisted recipient does not block others |
| J3-T26 | Dust/grief token transfer changes prize math | High | Prize accounting | Funding uses delta, liabilities use immutable prize not raw balance | Compare liability to prize | Surplus policy does not touch liability | Surplus can remain stranded | Dust-before/after-funding tests |
| J3-T27 | Admin sweep drains prize | Critical | Custody integrity | No owner/sweep/arbitrary call; external audit asserts absent selectors/state | Bytecode/source review | None | Accidental future feature addition | ABI/bytecode forbidden-surface test |
| J3-T28 | Upgrade key changes settlement law mid-Challenge | Critical | Immutable rules | Prefer non-upgradeable vault; if factory upgradeable, existing vaults remain immutable | Codehash/release registry | Deploy new version for new Challenges only | Factory UI could route new Challenges incorrectly | Codehash/version tests + deployment registry review |
| J3-T29 | Wrong/unreviewed bytecode deployed | Critical | Audited implementation identity | Freeze compiler/settings/source SHA/runtime+creation code hashes; deployment attestation/readback | Explorer/codehash verifier | Do not fund mismatched vault | Metadata/compiler determinism | Reproducible-build test |
| J3-T30 | RPC disagreement marks payout settled incorrectly | Critical | Monetary truth | Multiple observations for terminal facts where practical; DB state `RECONCILING` on disagreement | Provider comparison | Retry/reconcile; never pick convenient provider | Correlated providers | Simulated divergent-provider test |
| J3-T31 | Reorg after inclusion | High | Finality | Chain-specific finality policy; `included != finalized` | Block hash/height tracking | Reconcile until canonical | Deep L2/L1 reorg risk | Reorg simulation + finality policy evidence |
| J3-T32 | Production key leaked in web/API environment | Critical | Signer isolation | No production settlement private key in ordinary app runtime; dedicated signer/threshold wallet | Secret inventory/runtime scans | Revoke/rotate via predeclared authority migration only where safe | Supply-chain compromise of signer system | Architecture review + secret-scan + incident drill |
| J3-T33 | Key loss makes outcome/resolution impossible | High | Liveness | Threshold signers, backup/recovery procedure, role separation | Key-health drill | Threshold recovery | Multiple simultaneous losses | Key-loss tabletop + recovery test |
| J3-T34 | Key rotation silently changes active Challenge authority | Critical | Frozen authority | Active vault authorities immutable; rotation applies through explicit predeclared wallet/threshold mechanism, not DB pointer | Compare chain authority to registry | Existing Challenge follows original authority or audited recovery law | Long-lived active Challenge | Rotation compatibility test |
| J3-T35 | Funder/refund identity conflicts with entrant payout | High | Conflict-of-interest / refund safety | Launch policy rejects organizer/funder refund wallet equal to any entrant payout wallet | Pre-activation validation | Block Challenge activation | Same human controls multiple addresses | Curated identity policy; cannot solve Sybil fully onchain |
| J3-T36 | Personal/private data put onchain | High | Privacy irreversibility | Only opaque digests, deadlines, amounts, authorities/payout addresses | ABI/event/privacy review | Cannot erase chain data | Wallet address is personal data in some contexts | DPIA + event-schema review |
| J3-T37 | Receipt mutated after settlement | High | Economic history | Append-only receipt/superseding correction semantics; chain facts referenced | Hash/audit log | Add correction, never overwrite | Offchain storage compromise | Receipt immutability tests |
| J3-T38 | Platform fee introduces hidden authority/economic mismatch | High | Conservation/product truth | Capped launch starts with fee=0 unless separately frozen/audited; any later fee is explicit manifest/contract law | Conservation check | New version only | Business pressure to bolt fee on later | No-fee ABI/economic invariant at initial production candidate |
| J3-T39 | Production mainnet accidentally enabled by test workflow/config | Critical | Authority boundary | Mainnet chain/token tuple absent from J0/J2 runtime; J3 remains design-only; later production deploy requires distinct explicit workflow/approval | CI grep/config inventory | Abort | Human operator mistake | Negative CI test: testnet workflow rejects mainnet chain ID |
| J3-T40 | Legal/compliance assumption encoded as technical fact | High | Launch governance | Legal/accounting/privacy gates tracked as unresolved external decisions; no self-certification | Readiness matrix | Block production authority | Counsel scope uncertainty | Signed-off external decision records before capped launch |

## Architecture decisions frozen by this matrix

### D1 — deterministic default liveness

After a final qualifier set is frozen and the organizer-selection deadline expires:

- single-qualifier default is permissionless;
- multi-qualifier default is permissionless;
- zero-qualifier refund is permissionless;
- recipient identities and amounts remain fully determined by frozen roots/policy.

No fresh organizer or Inkubator outcome signature is required at execution time.

The signatures used to freeze the qualifier set are the final human/platform authority needed for deterministic default.

### D2 — exceptional resolver

Production resolver is an EIP-1271-compatible threshold authority, not a single EOA.

It may authorize only contract-valid exceptional outcomes to already-frozen refund/payout identities. It has no arbitrary sweep or arbitrary-recipient power.

Exact threshold membership/quorum remains a decision gate.

### D3 — two-tier unresolved liveness

If qualification is not final:

1. `resolution_deadline`: resolver-threshold recovery/cancellation window;
2. later immutable `terminal_long_stop`: permissionless execution of one predeclared fallback.

Current candidate fallback if no final qualifier set exists at terminal long-stop:

`FULL REFUND → immutable refund recipient`

This guarantees terminal liveness but creates a disclosed builder-fairness residual risk if the platform disappears after valid work but before qualification.

This candidate is **not frozen for production** until product/legal hostile review accepts the tradeoff.

### D4 — non-upgradeable challenge vault

Production candidate direction remains one immutable per-Challenge vault implementation/release with no owner, sweep or generic-call surface.

New law ships as a new version for new Challenges.

### D5 — fee zero at first capped production candidate

Platform-fee settlement is excluded from the first production-value vault candidate unless separately specified, threat-modeled and audited.

## J3 blockers still open

- exact resolver threshold/quorum and signer custody;
- exact unresolved terminal long-stop timing/fallback approval;
- pre-build refund/activation semantics;
- final chain + canonical asset tuple;
- token proxy/admin/blacklist risk acceptance;
- chain finality threshold and provider quorum;
- EIP-1271 implementation details;
- authority migration/key-recovery law;
- reproducible deployment/codehash procedure;
- external audit scope/vendor;
- Sweden/EU legal/payment/CASP analysis;
- tax/accounting;
- DPIA/privacy;
- launch eligibility/terms.

Until these are frozen and independently gated:

`PRODUCTION_MONEY = NOT_AUTHORIZED`
