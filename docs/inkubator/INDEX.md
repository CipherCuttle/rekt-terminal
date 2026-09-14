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
16. `STAGE_E_CHALLENGE_UI_V1.md` — closed Stage-E Alpha IA, canonical surface states, no-fake-instrumentation rules, frontend-root decision and retained Stage-E authority invariants.
17. `STAGE_E_CHALLENGE_UI_CLOSURE_V1.md` — Stage-E closure receipt, hostile-review repairs and exact-head verification evidence.
18. `STAGE_F_BUILDER_CAPSULE_V1.md` — active Stage-F authority for Builder Capsule, immutable submission sequencing and bounded F1/F2/F3 completion.
19. `STAGE_F2_IMMUTABLE_SUBMISSION_V1.md` — locked F2 transport/tooling plan; implementation remains blocked until F1 formally closes or that gate is explicitly replaced.
20. `REKT_TECHNICAL_FACEPLATE_V1.md` — highest visual execution authority; it may not override product truth, privacy, mechanism or API semantics.

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
Stage-D Compiler engine                       CLOSED / PASS / MERGED
Stage-D compiler gauntlet                     D-GATE-4 PASS
Stage-D provider benchmark                    D-GATE-5 EVIDENCE COMPLETENESS PASS
Stage-E Alpha IA                              E-GATE-1 PASS / CLOSED
Stage-E canonical surface states              E-GATE-2 PASS / CLOSED
Stage-E no-fake-instrumentation               E-GATE-3 PASS / CLOSED
Stage-E frontend root                         apps/inkubator-lab / PROMOTE+REFACTOR
Stage-E REKT Compiler / Challenge UI          CLOSED / PASS
Stage-E closure receipt                       CLOSED / PASS / PR #97 / UNMERGED
Stage-F                                       AUTHORIZED / IN PROGRESS
Stage-F1 Builder Capsule                      IMPLEMENTED / EXACT-HEAD GREEN / INDEPENDENT REVIEW PENDING / PR #98
Stage-F2 immutable submission contract        LOCKED / IMPLEMENTATION BLOCKED UNTIL F1 CLOSURE
Stage-F3 archive/evidence capture             SEQUENCED AFTER F2
Stage-G Reveal/Test Arena/Receipts            NOT AUTHORIZED
Production money                              NOT AUTHORIZED
```

**Execution verdict:** Stage A is complete enough; Stage B and Stage C are closed; Stage D is `CLOSED / PASS`; Stage E is `CLOSED / PASS` under `STAGE_E_CHALLENGE_UI_V1.md` plus `STAGE_E_CHALLENGE_UI_CLOSURE_V1.md`. Stage F is the active roadmap stage. F1 is implemented and exact-head green but remains formally open because the required independent hostile review is unavailable. F2 is now fully specified so there is no further planning prerequisite once that gate is satisfied or explicitly replaced. F3 follows F2. Stage G and production money remain unauthorized.

The existing `apps/inkubator-lab` runtime remains the forward Inkubator frontend root; do not create a parallel `apps/inkubator-web`, and never reuse Terminal `apps/web`. The historical `WORLD / COMMAND / PROJECT / PLAYER / SHIP` shell remains parked from the forward product IA and may remain only as lab/legacy evidence. Missing later-stage Challenge transports must continue to render truthfully unavailable rather than substituting parked legacy routes.

Stage F evolves existing CLI/SDK/MCP, DevKit auth, Stage-B `SubmissionManifest` law, and Stage-C Challenge persistence. Do not invent a second token system, submission store, project-management state machine, qualification authority, or archive authority.

The substrate lock does not authorize later stages by itself. It exists so agents do not rebuild commodity document parsing, visualization, design-token tooling, builder planning or deterministic quality gates unnecessarily, and do not accidentally delegate Challenge/economic authority to those tools.

No production-money authority is granted by this index.