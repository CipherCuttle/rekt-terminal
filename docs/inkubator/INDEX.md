# REKT INKUBATOR — AUTHORITY POINTER

**Updated:** 2026-09-14

Forward product strategy and staged roadmap are governed by:

1. `REKT_INKUBATOR_NORTH_STAR_V2.md` — highest product-strategy and forward-roadmap authority.
2. `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` — highest near-term funded-Challenge mechanism/trust authority.
3. `FUNDED_CHALLENGE_PRODUCT_LOCK_V1.md` — launch-product identity/economic UX where compatible with the two authorities above.
4. `SOLO_OPERATOR_CONSTRAINTS_V1.md` — one-human operating-capacity, modular-monolith, initial-blueprint and Alpha-cutline constraints.
5. `PRE_REVENUE_INFRA_CAP_V1.md` — bootstrap budget authority: $100/month absolute ceiling, <=$50 normal target, human time treated as a first-class cost, bounded paid compiler inference allowed.
6. `THIRD_PARTY_SUBSTRATE_LOCK_V1.md` — authoritative adoption boundary for external/open-source substrate: what Inkubator owns, what may be adopted/adapted, version/fallback/removal requirements, and the locked anydoc → Compiler → design profile → Archify → Builder Capsule → deterministic Test Arena composition.
7. `PREIMPLEMENTATION_READINESS_V1.md` — stage-specific planning gates and the explicit rule for when to stop planning and begin implementation.
8. `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md` — canonical pure Challenge/Build-Contract protocol semantics implemented in `packages/inkubator-protocol`.
9. `STAGE_B_PROPERTY_TEST_MATRIX_V1.md` — adversarial/property acceptance contract for Stage B.
10. `STAGE_C_POSTGRES_DOMAIN_BRIDGE_V1.md` — closed Stage-C additive persistence/concurrency contract for the Postgres Challenge bridge.
11. `STAGE_C_INTEGRATION_TEST_MATRIX_V1.md` — closed Stage-C Postgres adversarial/integration acceptance contract.
12. `STAGE_D_COMPILER_ENGINE_V1.md` — deterministic compiler/CompilerState/blueprint/authority-boundary contract.
13. `STAGE_D_COMPILER_GAUNTLET_V1.md` — Stage-D sensitivity/determinism acceptance contract and seed-corpus rules.
14. `STAGE_D_PROVIDER_BENCHMARK_V1.md` — D-GATE-5 replaceable-provider benchmark contract; provider/model output remains untrusted interpretation input only.
15. `CURRENT_STATE_MIGRATION_MAP_V1.md` — preserve/adapt/park map for existing Terminal/Inkubator apps, protocol, GitHub, Ship, historical Mission/World/social systems and the resolved Stage-E frontend decision.
16. `STAGE_E_CHALLENGE_UI_V1.md` — locked Alpha IA, canonical surface states, no-fake-instrumentation rules, frontend-root decision and Stage-E closure criteria.
17. `REKT_TECHNICAL_FACEPLATE_V1.md` — highest visual execution authority; it may not override product truth, privacy, mechanism or API semantics.

Repository-level agents must also obey root `AGENTS.md`, which requires Inkubator work to hydrate from this index before implementation.

Older `NORTH_STAR_MVP_V0.md`, `PRODUCT_CONTRACT_MVP_V0.md`, `IMPLEMENTATION_ROADMAP_MVP_V0.md`, `CHALLENGE_OS_NORTH_STAR_V1.md` and `CHALLENGE_CONTRACT_V1.md` remain historical/design ancestry. Their implemented substrate may be reused, but they do not control forward strategy where they conflict with the authorities above.

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
Stage-B nouns/lifecycle/version contract      IMPLEMENTED / AUTHORITY
Stage-B property-test matrix                  IMPLEMENTED / GREEN AT CLOSURE
Current-state migration map                   LOCKED
Stage-C Postgres bridge contract              CLOSED / PASS
Stage-C integration-test matrix               CLOSED / PASS
Stage-C implementation                        CLOSED / PASS
Stage-D Compiler engine                       IMPLEMENTED
Stage-D compiler gauntlet                     D-GATE-4 PASS
Stage-D provider benchmark                    D-GATE-5 EVIDENCE COMPLETENESS PASS
Stage-D integrated closure                    CLOSED / PASS / MERGED
Stage-E Alpha IA                              E-GATE-1 LOCKED
Stage-E canonical surface states              E-GATE-2 LOCKED
Stage-E no-fake-instrumentation               E-GATE-3 LOCKED
Stage-E frontend root                         apps/inkubator-lab / PROMOTE+REFACTOR
Stage-E REKT Compiler / Challenge UI          AUTHORIZED / IN PROGRESS
Production money                              NOT AUTHORIZED
```

**Execution verdict:** Stage A is complete enough; Stage B and Stage C are closed; Stage D is `CLOSED / PASS` and merged into this planning authority. Stage E is now authorized and in progress under `STAGE_E_CHALLENGE_UI_V1.md`. The existing `apps/inkubator-lab` runtime is the explicit production frontend root for Stage E; do not create a parallel `apps/inkubator-web`, and never reuse Terminal `apps/web`. The historical `WORLD / COMMAND / PROJECT / PLAYER / SHIP` shell is parked from the forward product IA and may remain only as lab/legacy evidence. Do not tune providers or spend more model budget. Missing Challenge-first transport must render truthfully unavailable rather than substituting parked legacy routes.

The substrate lock does not authorize later stages by itself. It exists so agents do not rebuild commodity document parsing, visualization, design-token tooling, builder planning or deterministic quality gates unnecessarily, and do not accidentally delegate Challenge/economic authority to those tools.

No production-money authority is granted by this index.
