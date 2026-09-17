# REKT INKUBATOR — FUNDED CHALLENGE SURVIVOR PLAN V1.1

**Status:** RED-TEAMED PLANNING AUTHORITY / NO IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-13  
**Branch:** `plan/inkubator-challenge-os-v1`  
**Implementation authority:** NONE  
**Production-money authority:** NONE  
**Merge authority:** NONE

This document records the V1 architecture/mechanism changes required after hostile review. Where it conflicts with the earlier V1 mechanism, architecture, or verification documents, **this V1.1 survivor plan wins**. The original product purpose remains unchanged.

## 1. What survives

The core product survives:

`POST → FUND → BUILD → SUBMIT → PICK → PAY → RECEIPT`

A small bounded group competes against frozen criteria for a funded prize. Qualification is objective, organizer selection is subjective among qualifiers, losing work remains builder-owned, payout triggers the agreed winning-rights transfer, and terminal facts produce a durable receipt.

The implementation direction also survives: dedicated Inkubator frontend, stateless Fastify modular monolith, PostgreSQL, durable outbox/workers, GitHub App integration, isolated verifier, canonical protocol/hashing, private object storage, measured horizontal scale, and a later independent Challenge Vault boundary.

## 2. Material corrections required before implementation

### A. V1 launches curated, not fully open

V1 is a curated marketplace. Self-service public challenge creation and unrestricted builder admission are not launch assumptions.

Pilot/public-beta admission may require:
- approved organizer;
- approved builder identity anchored to stable GitHub user ID;
- one eligible account per human under the pilot policy;
- one payout wallet per builder per Challenge;
- organizer/funder wallet cannot also be an entrant payout wallet;
- maximum one active Challenge for unproven builders.

The protocol can prove one account/one wallet seat. It cannot prove global humanity. Therefore the equal-split ghost fallback is authorized only while the admission process provides adequate Sybil resistance. A fully open marketplace is a later gate, not a V1 assumption.

### B. Challenge semantics are versioned forever

Every Challenge stores immutable `mechanism_version`, `settlement_policy_version`, `ip_terms_version`, and canonical `terms_digest`.

A rolling deploy may not silently change the rules of an active Challenge. New mechanism versions apply only to newly created Challenges. API/workers must continue supporting every version with active liabilities until those Challenges are terminal.

### C. Normative references freeze too

The terms digest covers more than form fields. Any normative attachment/reference used to decide qualification must be snapshotted or content-addressed before `ENTRY_OPEN`, including reference files, fixtures, design images, acceptance examples and evaluator/test-harness versions.

Mutable external URLs may be informational, but cannot be authoritative qualification requirements unless their referenced content is frozen.

V1 does not use undisclosed secret tests to add hidden acceptance requirements.

### D. Public reads are pure

Public GETs never perform lifecycle mutations or acquire economic row locks merely because a deadline passed.

User-facing phase may be derived from frozen timestamps for display. Durable state advancement is attempted by workers and, where required before a write, by one idempotent transactional `advanceIfDue` path.

This prevents a viral deadline from converting read traffic into a lock stampede.

### E. Seat acquisition has complete preflight

A seat can only become valid when the builder is eligible, authenticated, has accepted the frozen terms and has a bound payout wallet. Project/repository linkage may follow if the Challenge permits it.

Seat acquisition uses a single short PostgreSQL transaction with resource authorization, Challenge-row concurrency control, unique `(challenge_id,builder_id)` and `(challenge_id,payout_address)` constraints, and a bounded lock timeout. Final capacity is authoritative in the transaction; cached slot counts are advisory UI only.

### F. Global policy breach is not a second hidden DONE WHEN

Organizer qualification authority is limited to frozen `DONE WHEN` criteria.

Fraud, malware/credential theft, intentionally falsified evidence, rights violations, sanctions/illegal-use concerns, and other platform-policy breaches are a separate resolver/moderation path. They cannot be invented by the organizer as post-hoc product requirements.

### G. V1 rejects dependency-heavy Challenges

The launch product accepts bounded tasks whose result can be evaluated from frozen artifacts/evidence. Challenges requiring mutable organizer-private APIs, continuing consulting, broad production access, hidden organizational knowledge or long-lived operational ownership are rejected or deferred.

Organizer/platform dependency outages never become automatic builder failure. Material outages enter extension/resolution policy.

### H. Submission acceptance and snapshot capture are separate

Deadline correctness depends on an immutable manifest accepted by PostgreSQL before the authoritative deadline, not on an asynchronous worker finishing an archive upload before the deadline.

A submission records the Challenge/entry/terms digest, immutable commit/source reference, version, artifact digest/evidence references and DB acceptance timestamp. Snapshot/archive capture may complete asynchronously.

If GitHub/object storage is unavailable after an otherwise valid accepted submission, that is evidence pending, not automatic builder failure. If the builder intentionally revokes/deletes required source after acceptance and before capture, the recorded revocation/deletion timing may become a builder-caused evidence failure.

Git submodules/LFS/external source dependencies are unsupported as authoritative V1 source unless each dependency is separately frozen.

### I. Private source retention is bounded

Do not permanently retain every losing private repository.

Private source snapshots are encrypted at rest, access audited, unavailable to public routes, and retained only for a documented evaluation/dispute window plus legally required buffer. Losing source is then deleted by lifecycle policy while minimal non-source receipt facts/digests remain. Winner source is transferred/retained according to the winning delivery terms and legal policy.

Retention periods, DSAR/export, erasure/pseudonymisation, account deletion during active liabilities and backup deletion behavior must be documented before public launch.

### J. Legacy routes are not merely hidden — they are absent

The production funded-Challenge app must not register legacy Mission/Round/World/social/help/assist/devkit/development endpoints merely because their code remains in the repository.

Create an explicit production route assembly/feature boundary that registers only the V1 product surface plus required auth/GitHub/health operations. Test/dev routes remain impossible in production. This reduces attack surface and product drift.

### K. Rate limits survive horizontal scaling

Do not rely on per-process memory counters for sensitive business flows.

Use edge/IP protection for coarse abuse and durable per-account/per-Challenge constraints for scarce/economic actions such as auth initiation, seat acquisition, wallet binding, submission finalize, appeal and selection. PostgreSQL may enforce low-volume business quotas/uniqueness initially; a shared rate-limit store is introduced only when measured traffic requires it.

### L. Idempotency is command-scoped

Economic mutation identity is scoped by actor + operation + client request ID (or equivalent server-issued command ID), not by an unqualified globally reusable string.

Persist the semantic result long enough for retries. External jobs are at-least-once; exactly-once business effects come from idempotent downstream keys, uniqueness constraints, reconciliation and contract invariants.

### M. Worker leases support long jobs

The existing `SKIP LOCKED` PostgreSQL queue pattern remains valid. Long archive/reconciliation jobs need per-job lease durations or lease heartbeats/renewal so a slow healthy worker is not mistaken for a dead worker and duplicated after a fixed short lease.

Queue jobs remain idempotent even with lease renewal.

### N. PgBouncer compatibility is explicit

When transaction pooling is enabled, application correctness must not depend on session-level PostgreSQL state, temporary tables, `LISTEN/NOTIFY`, or session-level advisory locks. Transaction-scoped locks are acceptable inside the transaction that owns them. Re-run all concurrency tests through the same pooling mode used in production.

## 3. Settlement authority correction

Once a real Challenge Vault exists there are two explicit authorities, not one ambiguous truth system:

- **PostgreSQL:** product workflow authority — terms, entries, submissions, qualification, appeals, selection intent, receipts/projections.
- **Chain/Vault:** monetary custody/execution authority — funded amount and whether payout/refund actually finalized.

PostgreSQL may not mark a real-money settlement terminal merely because a transaction was submitted. `SETTLED` requires finalized on-chain evidence under the chain-specific finality policy. Reorgs/RPC disagreement keep settlement pending/reconciling.

A terms/Challenge identifier mismatch between application state and vault state blocks progression.

## 4. Production settlement trust model

The normal web/API/worker environment never possesses authority to redirect arbitrary locked prize funds.

Preferred direction for the later audited vault phase:

1. organizer funds exact supported asset/amount against a Challenge/terms commitment;
2. entrant payout addresses are frozen before BUILDING;
3. normal winner selection is bound to the authorized Challenge outcome;
4. payout execution is permissionless where possible: anyone may trigger payment to the already-frozen authorized recipient, so the winner need not own gas;
5. default/dispute settlement uses a separately protected high-trust authority (for example a multisig/threshold signer) that can authorize only contract-valid settlement manifests, not arbitrary withdrawals;
6. per-recipient settlement is isolated so one blocked recipient does not freeze unrelated recipients;
7. a long-stop emergency escape rule is committed before real-money launch so funds cannot remain locked forever if Inkubator disappears;
8. contract design should prefer simple/non-upgradeable or narrowly governed code over a broad upgrade key; exact architecture requires a fresh threat model and audit.

The exact emergency/default rule is a **mainnet blocker** and must be economically and legally reviewed before contract freeze.

## 5. Wallet binding

Use a standard EVM signing format rather than an ad-hoc string. The binding flow should include domain/origin, address, Ink chain ID, nonce, issued/expiry time and a resource/request identifier, with EOA and EIP-1271 contract-wallet verification as applicable.

Payout address becomes immutable for an active Challenge except through a dedicated recovery flow with stronger proof and audit. An ordinary database update cannot redirect an active payout.

## 6. On-chain privacy minimisation

Do not place GitHub IDs, names, source, descriptions, private evidence or other unnecessary personal data on-chain.

On-chain data should be the minimum necessary for custody and enforceability: opaque Challenge identifier/commitment, supported asset/amount, required deadlines/state commitments and payout addresses/settlement facts as technically necessary.

A DPIA/privacy review is required before public mainnet use. Off-chain identity mappings and source follow documented retention/deletion rules.

## 7. Receipt correction model

A filed receipt is append-only. If a later legitimate correction is required, create a versioned/superseding correction record; never mutate historical economic evidence in place.

Public receipt projections expose only fields justified by product purpose. Public profile aggregation should distinguish real competitive outcomes from self/collusive/noncompetitive receipts and should not rely on one opaque reputation score.

## 8. Notifications are operational, not authority

Before a funded public Challenge, organizers must have at least one verified out-of-band notification channel suitable for review/appeal deadlines. Pilot notification can be manual; scalable launch should use a notification adapter (for example verified email) without making message delivery part of economic correctness.

Missed/spam-filtered notification never extends a frozen deadline by itself; the deterministic Challenge policy remains authoritative.

## 9. Privacy/security posture

V1 must maintain a data inventory and retention matrix for GitHub identity, wallet address, public Challenge content, private source snapshots, evidence, audit history and receipts.

No third-party analytics or scripts are required for launch. User-generated rich text is rendered through a strict safe subset; active HTML/script is not trusted. Public Challenge links/attachments are treated as untrusted content.

Resolver/admin functions use separate authorization and stronger authentication. Resolver conflict-of-interest/self-resolution is forbidden and privileged actions are fully audited.

## 10. Load/capacity correction

Capacity is measured by arrival rate and critical-path throughput, not vague virtual-user counts.

Measure separately:
- edge/CDN public-read RPS and cache-hit ratio;
- origin public-read RPS;
- authenticated read RPS;
- mutation TPS;
- seat/submission burst contention;
- webhook deliveries/sec;
- worker jobs/sec and oldest-job age;
- DB transactions/sec, lock wait and connection saturation;
- verifier concurrency;
- object/archive bytes/sec;
- settlement reconciliation latency.

Expected business conflicts such as `409 seat_taken` and intentional `429 rate_limited` are not counted as server availability failures. 5xx/timeouts/invariant failures are.

Load gates run through the real reverse proxy/CDN and production-equivalent DB pooling mode. A scale step is accepted only with documented headroom above the observed peak profile and zero economic invariant violations.

## 11. Additional mandatory tests

Add to the earlier verification plan:

- hot public GETs at deadline cause zero Challenge write/lock amplification;
- mixed old/new deployment cannot change an active Challenge mechanism version;
- normative attachment/reference mutation cannot change frozen qualification meaning;
- organizer account/wallet cannot occupy a builder seat;
- duplicate payout wallet within one Challenge is rejected;
- cross-instance sensitive-flow limits/constraints remain effective;
- idempotency key reuse by another actor/operation cannot alias an economic command;
- long worker job lease renewal does not duplicate a healthy job;
- accepted-before-deadline submission remains eligible when snapshot capture is delayed by platform/GitHub outage;
- builder-caused source revocation after submission is distinguishable from platform outage;
- losing private source lifecycle deletion actually executes and backups follow retention policy;
- production route inventory contains no legacy/dev/test endpoints;
- settlement stays pending through unfinalized/reorged chain state;
- RPC disagreement blocks terminal settlement rather than choosing an arbitrary provider;
- payout recovery cannot be invoked by ordinary API authority;
- emergency vault escape path conserves funds and triggers no unintended IP transfer;
- rolling secret/key rotation preserves webhook/auth behavior;
- account deletion/pseudonymisation preserves only legally/product-necessary receipt facts.

## 12. Product validation gate moves before substantial implementation

Before significant frontend/backend implementation, run at least three concierge Challenge simulations with real organizer problems and real candidate builders using the frozen V1.1 rules.

Measure:
- can organizer produce objective frozen criteria without consulting-project scope;
- will at least the activation minimum of credible builders actually reserve a seat at the proposed prize;
- can submissions be evaluated without hidden requirements;
- dispute/appeal frequency;
- organizer willingness to pay the proposed fee;
- builder willingness to compete again after losing.

If the core mechanism fails this test, change the mechanism before building scale infrastructure.

## 13. Non-technical real-money launch blockers

Production USDC remains independently blocked on:
- Swedish/EU crypto/payment-service legal analysis, including MiCA/PSD implications;
- AML/sanctions/financial-crime obligations if applicable;
- tax/VAT/invoicing/accounting treatment of organizer fees and builder prizes;
- cross-border IP/consumer/business terms and dispute wording;
- privacy/DPIA/retention obligations;
- minimum age/entity eligibility policy;
- smart-contract threat model and external security review/audit.

Do not implement heavyweight KYC/financial-compliance infrastructure until counsel determines the actual obligations, but do not launch around the question.

## 14. Survivor release sequence

```text
P0  concierge mechanism validation
P1  versioned pure protocol/state machine + property tests
P2  additive Postgres model + concurrency/idempotency
P3  production route assembly + auth/authorization hardening
P4  immutable submission/snapshot + bounded private-source retention
P5  production frontend
P6  qualification/appeal/resolution + notifications
P7  security/load/chaos/restore/privacy gates
P8  curated mock/testnet pilot
P9  vault trust model + emergency exit + audit + legal/compliance
P10 capped real-money launch
P11 measured public expansion
```

Every phase uses the bounded completion rule:

`IMPLEMENT → TEST → ONE HOSTILE REVIEW → FIX CRITICAL/HIGH → ONE TARGETED REREVIEW IF NEEDED → CLOSE → MOVE FORWARD`.

## 15. Final survivor verdict

The funded-Challenge concept survives hostile review **only as a deliberately bounded, curated, versioned marketplace first**. It does not survive if V1 is treated as an immediately open anonymous contest market, if public reads mutate state, if mutable external references define requirements, if every private losing repo is retained forever, if legacy APIs remain exposed, if the web server controls prize funds, or if PostgreSQL is allowed to invent monetary settlement independently of finalized chain facts.

The product can grow substantially without changing its core architecture if these boundaries are frozen now.