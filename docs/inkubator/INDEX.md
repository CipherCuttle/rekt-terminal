# REKT INKUBATOR — AUTHORITY POINTER

**Updated:** 2026-09-15

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
18. `STAGE_F_BUILDER_CAPSULE_V1.md` — Stage-F Builder Capsule / immutable-submission / asynchronous-archive authority.
19. `STAGE_F2_IMMUTABLE_SUBMISSION_V1.md` — closed F2 builder-owned immutable submission contract over existing Stage-B/C law.
20. `STAGE_F3_ARCHIVE_EVIDENCE_V1.md` — F3A provider-independent durable asynchronous archive/evidence contract.
21. `STAGE_F3_ARCHIVE_EVIDENCE_CLOSURE_V1.md` — Stage-F3/Stage-F closure receipt covering F3A orchestration and F3B GitHub→private-R2 provider wiring.
22. `STAGE_G_REVEAL_TEST_ARENA_RECEIPTS_V1.md` — Stage-G parent authority; G1 synchronized reveal is closed/pass.
23. `STAGE_G2_ACCEPTANCE_MANIFEST_V1.md` — active G2A authority; freezes exact automated/human criterion bindings before any Test Arena execution.
24. `REKT_TECHNICAL_FACEPLATE_V1.md` — highest visual execution authority; it may not override product truth/trust/API semantics.

Repository-level agents must also obey root `AGENTS.md` and hydrate from this index before Inkubator implementation.

Older `NORTH_STAR_MVP_V0.md`, `PRODUCT_CONTRACT_MVP_V0.md`, `IMPLEMENTATION_ROADMAP_MVP_V0.md`, `CHALLENGE_OS_NORTH_STAR_V1.md` and `CHALLENGE_CONTRACT_V1.md` remain historical/design ancestry only where they conflict with current authority.

Current forward sequence:

`AUTHORITY LOCK → CHALLENGE/BUILD-CONTRACT PROTOCOL → POSTGRES BRIDGE → COMPILER/BLUEPRINTS/CHAT → REKT CHALLENGE UI → BUILDER CAPSULE/SUBMISSION → REVEAL/TEST ARENA/RECEIPTS → TRUST HARDENING → CLOSED ALPHA/TESTNET → PRODUCTION-VALUE GATES → FULL NORTH STAR`

Current implementation state:

```text
North Star / roadmap                          LOCKED
Survivor mechanism/trust                      LOCKED
REKT visual authority                         LOCKED
Solo-operator constraint                      LOCKED
Bootstrap budget                              LOCKED
Alpha cutline                                 LOCKED
Third-party substrate/adoption boundary       LOCKED
Stage-B protocol                              CLOSED / AUTHORITY
Stage-C Postgres bridge                       CLOSED / PASS
Stage-D Compiler                              CLOSED / PASS / MERGED
Stage-E Challenge UI                          CLOSED / PASS / PR #97 / UNMERGED DEPENDENCY
Stage-F1 Builder Capsule                      CLOSED / PASS BY EXPLICIT GOVERNANCE WAIVER / PR #98
Stage-F2 Immutable Submission                 CLOSED / PASS / PR #100 / UNMERGED
Stage-F3 Archive / Evidence                   CLOSED / PASS / PR #101 + PR #102 / UNMERGED
Stage F                                       CLOSED / PASS / STACKED
Stage G Reveal / Test Arena / Receipts        USER-AUTHORIZED / ACTIVE / STACKED AFTER F3
G1 synchronized reveal + Arena input          CLOSED / PASS / PR #103 / UNMERGED
G2A frozen acceptance manifest                AUTHORIZED / CURRENT
G2B objective Test Arena execution            SEQUENCED AFTER G2A
G3 comparison / selection / receipt transport SEQUENCED AFTER G2B
Stage H trust hardening                       NOT AUTHORIZED BY G2A
Production money                              NOT AUTHORIZED
Merge authority                               NONE
```

**G1 closure:** exact head `e2e24ee55a0e81294660055a6a6ed7094f61ddba` passed Inkubator Auth Foundation #534 and CI #1612. The single hostile review found one P1 combined-Render-runtime wiring defect; that defect was repaired on the exact head, the one allowed targeted Codex rereview found no major issues, and the review thread is resolved. G1 is closed/pass without merge.

**Execution verdict:** G2A is the current bounded implementation slice. Freeze Test Arena evaluation meaning before execution by introducing one content-addressed `inkubator.acceptance-manifest/1.0` artifact referenced through the existing Build Contract `normative_references`. Every frozen mandatory criterion must have exactly one declared binding: either versioned/content-addressed automated execution with frozen fixture/config lineage, or explicit human observation instructions. Optional criteria, preferences, compiler-only module proposals, hidden tests and post-hoc operator choices may not become qualification law. Do not execute participant code or record qualification in G2A; G2B owns execution and result persistence through existing `computeQualification()` / `recordChallengeQualification()` law.

Current dependency order remains stacked and unmerged. Stage-E PR #97, Stage-F1 PR #98, Stage-F2 PR #100, Stage-F3A PR #101, Stage-F3B PR #102 and G1 PR #103 must not be merged out of order without explicit merge authority.

F1's independent hostile-review requirement was explicitly replaced by user authority on 2026-09-14 with the completed adversarial self-audit plus green exact-head CI/Auth evidence. Do not claim an independent F1 review occurred. That waiver does not alter the default bounded-review policy used for later slices.

The existing `apps/inkubator-lab` runtime remains the Inkubator frontend root; do not create `apps/inkubator-web` and never reuse Terminal `apps/web`. Historical WORLD/COMMAND/PROJECT/PLAYER/SHIP surfaces remain parked compatibility substrate unless a bounded migration explicitly promotes them.

G2A grants no authority for participant-code execution, qualification mutation, hidden tests, LLM judging, winner selection mutation, settlement execution, production money, wallet custody/signing/broadcast, public raw private-source retrieval, archive retention/DSAR infrastructure, Stage-H implementation or merge.
