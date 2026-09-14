# REKT INKUBATOR — AUTHORITY POINTER

**Updated:** 2026-09-14

Forward product strategy and staged roadmap are governed by:

1. `REKT_INKUBATOR_NORTH_STAR_V2.md` — highest product-strategy and forward-roadmap authority.
2. `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` — highest near-term funded-Challenge mechanism/trust authority.
3. `FUNDED_CHALLENGE_PRODUCT_LOCK_V1.md` — launch-product identity/economic UX where compatible with the two authorities above.
4. `SOLO_OPERATOR_CONSTRAINTS_V1.md` — one-human operating-capacity, modular-monolith, initial-blueprint and Alpha-cutline constraints.
5. `PRE_REVENUE_INFRA_CAP_V1.md` — bootstrap budget authority.
6. `THIRD_PARTY_SUBSTRATE_LOCK_V1.md` — authoritative external/open-source substrate boundary.
7. `PREIMPLEMENTATION_READINESS_V1.md` — stage-specific planning/readiness gates.
8. `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md` — canonical Challenge/Build-Contract protocol semantics.
9. `STAGE_B_PROPERTY_TEST_MATRIX_V1.md` — Stage-B adversarial/property acceptance contract.
10. `STAGE_C_POSTGRES_DOMAIN_BRIDGE_V1.md` — closed Stage-C persistence/concurrency contract.
11. `STAGE_C_INTEGRATION_TEST_MATRIX_V1.md` — closed Stage-C Postgres acceptance contract.
12. `STAGE_D_COMPILER_ENGINE_V1.md` — deterministic compiler/CompilerState/blueprint authority contract.
13. `STAGE_D_COMPILER_GAUNTLET_V1.md` — Stage-D deterministic/sensitivity acceptance contract.
14. `STAGE_D_PROVIDER_BENCHMARK_V1.md` — replaceable-provider benchmark contract; model output remains untrusted proposal input.
15. `CURRENT_STATE_MIGRATION_MAP_V1.md` — preserve/adapt/park map and product-boundary migration decisions.
16. `STAGE_E_CHALLENGE_UI_V1.md` — closed Stage-E Challenge UI authority.
17. `STAGE_E_CHALLENGE_UI_CLOSURE_V1.md` — Stage-E closure receipt and verification evidence.
18. `STAGE_F_BUILDER_CAPSULE_V1.md` — active Stage-F authority; F1 Builder Capsule is closed by the explicit 2026-09-14 governance waiver recorded in that document.
19. `STAGE_F2_IMMUTABLE_SUBMISSION_V1.md` — current authorized F2 implementation contract: builder-owned immutable submission over existing Stage-B/C law.
20. `REKT_TECHNICAL_FACEPLATE_V1.md` — highest visual execution authority; it may not override product truth/trust/API semantics.

Repository-level agents must also obey root `AGENTS.md` and hydrate from this index before Inkubator implementation.

Older `NORTH_STAR_MVP_V0.md`, `PRODUCT_CONTRACT_MVP_V0.md`, `IMPLEMENTATION_ROADMAP_MVP_V0.md`, `CHALLENGE_OS_NORTH_STAR_V1.md` and `CHALLENGE_CONTRACT_V1.md` remain historical/design ancestry only where they conflict with current authority.

Current forward sequence:

`AUTHORITY LOCK → CHALLENGE/BUILD-CONTRACT PROTOCOL → POSTGRES BRIDGE → COMPILER/BLUEPRINTS/CHAT → REKT CHALLENGE UI → BUILDER CAPSULE/SUBMISSION → REVEAL/TEST ARENA/RECEIPTS → TRUST HARDENING → CLOSED ALPHA/TESTNET → PRODUCTION-VALUE GATES → FULL NORTH STAR`

Current implementation state:

```text
North Star / roadmap                         LOCKED
Survivor mechanism/trust                     LOCKED
REKT visual authority                        LOCKED
Solo-operator constraint                     LOCKED
Bootstrap budget                             LOCKED
Alpha cutline                                LOCKED
Third-party substrate/adoption boundary      LOCKED
Stage-B protocol                             CLOSED / AUTHORITY
Stage-C Postgres bridge                      CLOSED / PASS
Stage-D Compiler                             CLOSED / PASS / MERGED
Stage-E Challenge UI                         CLOSED / PASS / PR #97 / UNMERGED DEPENDENCY
Stage-F1 Builder Capsule                     CLOSED / PASS BY EXPLICIT GOVERNANCE WAIVER / PR #98
Stage-F2 Immutable Submission                AUTHORIZED / ACTIVE IMPLEMENTATION
Stage-F3 Archive / Evidence                  SEQUENCED AFTER F2
Stage G Reveal / Test Arena / Receipts       NOT AUTHORIZED
Production money                             NOT AUTHORIZED
Merge authority                              NONE
```

**Execution verdict:** Stage F2 is the current authorized implementation slice. Reuse the existing DevKit, SDK, CLI, Stage-B `SubmissionManifest`, Stage-C `acceptChallengeSubmission()`, PostgreSQL clock, idempotency and immutable submission storage. Do not invent parallel submission/domain authority. Stage-E PR #97 remains an unmerged dependency; Stage-F work must not merge ahead of it without explicit merge authority.

F1's independent hostile-review requirement was explicitly replaced by user authority on 2026-09-14 with the completed adversarial self-audit plus green exact-head CI/Auth evidence. Do not claim an independent F1 review occurred. That waiver does not alter the default bounded-review policy for F2.

The existing `apps/inkubator-lab` runtime remains the Inkubator frontend root; do not create `apps/inkubator-web` and never reuse Terminal `apps/web`. Historical WORLD/COMMAND/PROJECT/PLAYER/SHIP surfaces remain parked compatibility substrate unless a bounded migration explicitly promotes them.

No funding, production-money, wallet custody/signing/broadcast, reveal/Test Arena, qualification, selection or Stage-G authority is granted by Stage F2.
