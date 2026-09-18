# REKT INKUBATOR — STAGE J3 PRODUCTION-VALUE DECISIONS V1

**Status:** ACTIVE / TECHNICAL DECISIONS  
**Date:** 2026-09-18  
**Parent:** `STAGE_J3_PRODUCTION_VALUE_READINESS_V1.md`  
**Threat matrix:** `STAGE_J3_PRODUCTION_VALUE_THREAT_MATRIX_V1.md`  
**Production-money authority:** NONE

This document freezes the technical decisions that can be made before external audit/legal review.

## D1. Production-candidate chain

Technical production candidate:

- network: Ink mainnet;
- chain ID: `57073`;
- gas asset: ETH;
- primary public RPC reference: `https://rpc-gel.inkonchain.com`;
- secondary public RPC reference: `https://rpc-qnd.inkonchain.com`;
- explorer: `https://explorer.inkonchain.com`.

Authority sources checked 2026-09-18:

- https://docs.inkonchain.com/general/network-information
- https://docs.inkonchain.com/tools/rpc

This is a technical candidate lock, not mainnet deployment authority.

## D2. Production-candidate asset

Technical production candidate:

- asset: Circle-issued native USDC;
- Ink mainnet token: `0x2D270e6886d130D724215A266106e6832161EAEd`;
- decimals: 6;
- bridged `USDC.e` is not accepted by the initial production candidate.

Circle authority source checked 2026-09-18:

- https://developers.circle.com/stablecoins/usdc-contract-addresses

Ink currently also documents the distinct bridged `USDC.e` address:

- `0xF1815bd50389c46847f0Bda824eC8da914045D14`
- https://docs.inkonchain.com/useful-information/ink-contracts

The allowlist is exact address + chain ID. Symbol/name are never sufficient identity.

Before external audit freeze, record the token implementation/proxy/admin/blacklist/pause behavior and the exact runtime/proxy identity relevant to the launch date.

## D3. Test asset for the next contract-candidate rehearsal

Circle currently lists Ink testnet USDC at:

`0xFabab97dCE620294D2B0b0e46C68964e326300Ac`

Source:

- https://developers.circle.com/stablecoins/usdc-contract-addresses

A later production-candidate test stage may use this testnet token to exercise realistic USDC behavior.

J3 itself does not deploy or move it.

## D4. Finality law

Do not use an arbitrary confirmation count as monetary finality.

Ink is OP Stack. Production reconciliation recognizes the OP Stack safety levels:

`latest/unsafe → safe → finalized`

A settlement may appear in product UX as submitted/included earlier, but:

`SETTLED == transaction success in a block that is FINALIZED`

Production evidence algorithm:

1. fetch transaction receipt from provider A and B;
2. require both providers to agree on success, transaction hash, block number and block hash;
3. fetch each provider's `finalized` L2 head;
4. require the receipt block to be at or below both finalized heads and canonical by block hash;
5. only then record terminal `FINALIZED`;
6. any disagreement, missing receipt, reorg or provider lag keeps the rail in `RECONCILING`.

Initial provider pair may use independent Ink-supported RPC providers such as Gelato + QuickNode; production credentials/SLA selection is later operations work.

Relevant specifications:

- https://specs.optimism.io/protocol/derivation.html
- https://docs.inkonchain.com/tools/rpc

## D5. Deterministic post-deadline settlement

Once a final qualifier set is frozen:

- organizer winner remains possible only before the organizer-selection deadline;
- at/after the deadline, deterministic default requires **no fresh organizer, outcome or resolver signature**;
- any caller may execute;
- contract derives/validates exact recipients and amounts from the frozen qualifier/payout state.

Cases:

- 1 qualifier → full prize;
- 2–3 qualifiers → equal split with canonical payout-order remainder;
- 0 qualifiers → full refund to immutable refund recipient.

The human/platform authority ended when the qualifier set was frozen.

This is the required production delta from J1.

## D6. Pre-build activation refund

Production candidate adds an immutable `activation_deadline`.

Law:

- funding may occur before BUILDING;
- payout set must be sealed before the Challenge enters BUILDING;
- if `activation_deadline` passes and the payout set was never sealed, anyone may trigger full refund to immutable refund recipient;
- once payout set is sealed, this unactivated refund path is permanently disabled;
- ordinary organizer/API authority cannot refund after builder identities have been frozen.

This gives J0 `REFUND_PRE_BUILD` a deterministic on-chain meaning without an admin sweep.

## D7. Unresolved qualification recovery

Production candidate uses two later deadlines:

- `resolution_deadline`;
- `terminal_long_stop`.

If a qualifier set is not final by the normal qualification/review window:

### Recovery window

Until `resolution_deadline`, an exceptional resolver threshold may execute only explicitly permitted recovery actions.

The resolver cannot name arbitrary recipients outside the frozen payout set/refund recipient and cannot exceed the prize.

### Terminal long-stop

At/after `terminal_long_stop`, if no final qualifier set exists and no settlement is authorized, anyone may execute the predeclared terminal fallback.

Candidate terminal fallback:

`FULL REFUND → immutable refund recipient`

This is the only currently unresolved *policy* decision in this mechanism. It guarantees liveness but creates a builder-fairness residual risk if valid work exists and all qualification/recovery authority disappears.

The mechanism is frozen. For the first capped candidate, use these **provisional audit inputs**:

- `activation_deadline = build_start`;
- `resolution_deadline = organizer_selection_deadline + 72 hours`;
- `terminal_long_stop = organizer_selection_deadline + 30 days`.

These durations are not production authority and may be changed once before external audit freeze. Any change after builders join would require a new Challenge/version.

Recovery authority law:

- before `resolution_deadline`, normal recovery qualifier freeze requires outcome + resolver;
- at/after `resolution_deadline`, if and only if no qualifier set exists, the 2-of-3 resolver threshold may freeze one recovery qualifier set from the already-frozen payout roster, binding a durable recovery-evidence digest;
- an existing qualifier set is never replaceable by this path;
- at/after `terminal_long_stop`, if no qualifier set exists and no settlement is authorized, anyone may trigger full refund to the immutable refund recipient.

The terminal refund tradeoff still requires product/legal hostile review before production contract freeze.

## D8. Resolver authority

Production resolver is not an EOA.

Contract interface:

- resolver address MAY be a smart-contract account;
- signature verifier supports ERC-1271;
- exact magic value: `0x1626ba7e`;
- invalid/reverting/malformed response fails closed.

Operational launch direction:

- threshold smart wallet;
- quorum: **2-of-3** for the first capped candidate;
- at least two distinct security principals must be required to form a quorum;
- no ordinary web/API credential can form a resolver quorum;
- resolver address is independent from organizer and outcome authorities.

The vault does not hardcode a particular wallet vendor.

ERC-1271 authority:

- https://eips.ethereum.org/EIPS/eip-1271

## D9. Outcome and organizer authority

All authority addresses support the same abstract signature-verifier interface:

- EOA → strict low-s ECDSA;
- contract account → ERC-1271.

For the first production candidate:

- organizer authority is the frozen organizer wallet (EOA or ERC-1271 wallet);
- outcome authority is an isolated Inkubator **EOA signing key** kept outside the ordinary web/API runtime; it has no unilateral fund-moving path;
- resolver is the 2-of-3 ERC-1271 threshold wallet;
- qualifier-set freeze requires outcome + organizer in the normal path, or outcome + resolver in recovery;
- exceptional architecture review must decide whether resolver-threshold-only qualification recovery is allowed after `resolution_deadline`.

No active Challenge changes an immutable authority address through a database update.

If the outcome EOA is lost, the timed resolver recovery path is the liveness mechanism; the vault does not silently replace the outcome address. Contract-wallet authorities may rotate underlying owners only under their own audited threshold governance and that configuration is monitored as economic authority.

## D10. Deployment law

Preferred production candidate:

- non-upgradeable Challenge vault instances;
- no owner;
- no sweep;
- no arbitrary call;
- no arbitrary recipient;
- no yield/swap/bridge;
- no arbitrary token;
- no fee in the initial capped candidate.

Audit freeze records:

- exact source commit;
- Foundry version;
- Solidity version;
- EVM target;
- optimizer/settings;
- creation bytecode hash;
- runtime bytecode hash;
- constructor ABI/schema;
- supported chain/token tuple;
- deployment tool/factory identity;
- explorer verification procedure.

Current proven toolchain candidate inherited from J1/J2:

- Foundry `v1.8.3`;
- Solidity `0.8.37`;
- EVM `prague`;
- optimizer enabled, `200` runs;
- Solidity bytecode metadata hash disabled (`bytecode_hash = "none"`);
- FFI disabled.

Preferred first candidate uses direct deployment from a pinned script rather than adding a privileged factory. The deployer has gas-only deployment capability and is not a vault settlement authority.

If a factory is used, factory privilege cannot alter already-deployed Challenge vault code or settlement state.

## D11. Claim / issuer-censorship law

USDC issuer controls may pause/freeze addresses. The vault cannot eliminate this external risk.

Therefore:

- claims remain pull-based and per recipient;
- one blocked recipient does not block others;
- failed claim does not redirect funds;
- blocked claim remains an unresolved liability;
- no administrator may sweep a blocked builder's prize;
- any eventual legally required blocked-funds process requires a separately frozen policy/version and external legal review.

## D12. No platform fee in first production candidate

Initial production-candidate conservation remains:

`DEPOSITED = CLAIMED + CLAIMABLE`

No platform fee, skim or fee recipient is added to the first audited vault.

A fee requires a new explicit economic/contract version and review.

## Native USDC issuer-control acceptance

Circle's EVM USDC design is externally administered: it is upgradeable, pausable and blacklistable.

The Inkubator production candidate **accepts this as an external asset dependency**, not as a property we control.

Consequences:

- the vault never claims censorship resistance;
- a Circle pause can halt funding/claims;
- blacklisting can make an individual recipient unable to receive/transfer USDC;
- Circle may upgrade token implementation behind the canonical proxy;
- Inkubator must monitor token pause/blacklist/proxy-implementation changes;
- a blocked recipient's claim remains owed and cannot be redirected by an Inkubator administrator;
- launch terms/legal review must address issuer-control edge cases.

Authority references checked 2026-09-18:

- https://github.com/circlefin/stablecoin-evm
- https://github.com/circlefin/stablecoin-evm/blob/master/doc/tokendesign.md

## Remaining J3 decisions

Before J3 can close:

1. product/legal hostile review must accept or replace the terminal no-qualification refund fallback;
2. freeze the production signer custody/runbook details for the outcome key and resolver 2-of-3 wallet;
3. freeze reproducible build/deployment hash procedure and verification commands;
4. build the production-candidate property/adversarial test plan;
5. build the external audit package;
6. bounded hostile review of the complete J3 architecture.

External legal/accounting/privacy gates remain outside J3 technical closure and still block production money.
