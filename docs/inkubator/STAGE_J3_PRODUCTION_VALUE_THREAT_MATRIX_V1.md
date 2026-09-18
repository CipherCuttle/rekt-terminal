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
| J3-T05 | Resolver single-key compromise cancels Challenge | Critical | Exceptional cancellation | Resolver is a minimal non-upgradeable ERC-1271 verifier with immutable 3-signer set and immutable 2-of-3 quorum; no mutable wallet governance | Threshold signer audit log + codehash | Remaining fixed quorum or terminal long-stop; new verifier only for new Challenges | Two signer compromises | EIP-1271 threshold integration tests + immutable-config/codehash tests |
| J3-T06 | Signature replay across vaults | Critical | Authorization uniqueness | EIP-712 domain includes chain ID + verifying contract; message binds challenge/terms/binding | Signature digest inspection | None needed if impossible | Chain-id fork semantics | Cross-vault replay property test |
| J3-T07 | Signature replay across chains | Critical | Chain isolation | EIP-712 domain chain ID; deployment allowlist | Reconciliation checks expected chain | Refuse settlement | Chain reconfiguration/fork edge | Cross-chain replay test |
| J3-T08 | ECDSA malleability / invalid signer | High | Signature authenticity | Low-s enforcement, v normalization, zero-address rejection | Revert telemetry | Rotate compromised key if allowed by frozen governance | Wallet implementation variance | Fuzz high-s/invalid-v/zero signer |
| J3-T09 | EIP-1271 wallet returns malformed/adversarial response | High | Contract-wallet authority | Static call exact magic value `0x1626ba7e`; bounded gas strategy; revert/short return = invalid | Signature verification errors | Alternate authorized threshold wallet only via explicit migration policy | Smart-wallet upgrade risk | Mock 1271 wallet suite: valid, invalid, revert, short return, gas grief |
| J3-T10 | Qualifier root substituted after payout set | Critical | Frozen membership | Qualifier digest binds payout-set root + challenge/terms/binding | Receipt/readback | No mutation; deploy new Challenge if corrupted | Co-authority compromise | Root substitution tests |
| J3-T11 | Payout order manipulated to steal remainder | High | Deterministic default economics | Canonical UTF-8 byte ordering frozen before BUILDING; order committed in payout leaf | Compare roster digest | None; bad plan blocks deployment | Unicode/canonicalization ambiguity | Property tests with reordered inputs/non-ASCII IDs |
| J3-T12 | Wrong settlement manifest digest used | Critical | Terms/intention binding | Organizer winner signatures bind manifest; qualifier freeze also binds/stores exact default manifest; pre-build/terminal refund manifest digests are immutable at deployment; permissionless paths accept no caller-selected manifest | Recompute manifest from product authority and compare stored digest | Reconciliation hold | Offchain canonicalization bug before freeze | Known-answer vectors + tests that alternate permissionless manifest input is impossible |
| J3-T13 | Wrong terms/binding deployed | Critical | Challenge/terms identity | Constructor immutables; post-deploy readback before accepting funding/build | Deployment verifier | Abandon wrong vault; never migrate active funds silently | Human links wrong vault in UI | Deployment snapshot gate + UI/API vault binding test |
| J3-T14 | Default executes before organizer deadline | Critical | Organizer selection window | Immutable deadline; all Build Contract ms→EVM not-before deadlines use `ceil(ms/1000)`; contract checks `block.timestamp >= deadline` | Chain event monitoring | None; must be impossible | Timestamp granularity | Exact-second/+1ms/+999ms known-answer conversion plus deadline-1/deadline/deadline+1 |
| J3-T15 | Default requires platform signer and funds lock after platform outage | Critical | Settlement liveness | **Production delta:** qualifier freeze commits exact default manifest digest; after deadline execution is permissionless and uses only frozen digest/roots | Liveness test with all signer keys unavailable | Anyone calls default path | Gas availability / frozen recipient blacklist | Test default with zero available authority keys and no caller-controlled manifest after qualifier freeze |
| J3-T16 | Qualification never finalizes and funds lock forever | Critical | Terminal liveness | Immutable recovery deadline + later terminal long-stop committed at deployment | Age/liability monitor | Resolver-threshold recovery window; terminal fallback only to predeclared policy | Terminal refund may disadvantage valid builders if platform died before qualification | Time-warp tests covering unresolved recovery and terminal fallback |
| J3-T17 | Organizer deliberately suppresses qualification to reach refund long-stop | High | Builder fairness | Organizer cannot alone control qualifier finalization; outcome/resolver independence; long-stop is distant and public; dispute/recovery window | Missing-qualification alarms + public timestamps | Resolver threshold can finalize/cancel before terminal fallback | Coordinated multi-authority failure/collusion | Game-theoretic review + scenario test |
| J3-T18 | Pre-build refund abused after builder work starts | Critical | No free organizer option | Immutable activation/build deadline uses ceiling conversion; pre-build refund only under frozen activation condition and immutable pre-build-refund manifest | Lifecycle vs chain deadline check | No refund path after payout roster/build activation | Offchain activation evidence correctness | X001ms/X999ms conversion + refund legal at boundary and impossible once payout set sealed |
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
| J3-T34 | Key rotation silently changes active Challenge authority | Critical | Frozen authority | Outcome/organizer addresses are immutable; resolver verifier signer set/quorum/code are immutable; no active resolver rotation | Compare chain authority + resolver runtime/config to release registry | New authority/verifier only for new Challenges; active Challenge uses original or timed fallback | Long-lived active Challenge / organizer-owned smart-wallet semantics | Tests prove resolver config has no mutation surface and old Challenge remains unchanged |
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

The qualifier-set authorization also freezes the exact default settlement manifest digest. Permissionless default uses that stored digest and accepts no caller-selected manifest.

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

### D6 — deadline conversion is monotonic-safe

Every Build Contract millisecond deadline that creates a not-before EVM permission uses `ceil(ms/1000)`. Relative recovery/long-stop offsets start from the already-ceiled organizer deadline.

### D7 — permissionless receipt identity is frozen

- default manifest digest freezes with qualifier set;
- pre-build refund manifest digest is immutable at deployment;
- terminal refund manifest digest is immutable at deployment;
- permissionless paths never accept caller-selected manifest identity.

## J3 blockers still open

- external audit reviewer/vendor selection;
- external legal/payment/CASP analysis;
- tax/accounting;
- DPIA/privacy;
- launch eligibility/terms.

Technical J3 architecture is otherwise frozen subject to the targeted rereview of the three repaired High findings.

Until these are frozen and independently gated:

`PRODUCTION_MONEY = NOT_AUTHORIZED`
