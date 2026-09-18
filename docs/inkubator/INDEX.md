# REKT INKUBATOR — AUTHORITY POINTER

**Updated:** 2026-09-17

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
19. `STAGE_F2_IMMUTABLE_SUBMISSION_V1.md` — closed F2 builder-owned immutable submission contract.
20. `STAGE_F3_ARCHIVE_EVIDENCE_V1.md` — F3A provider-independent durable asynchronous archive/evidence contract.
21. `STAGE_F3_ARCHIVE_EVIDENCE_CLOSURE_V1.md` — Stage-F3/Stage-F closure receipt.
22. `STAGE_G_REVEAL_TEST_ARENA_RECEIPTS_V1.md` — Stage-G parent authority.
23. `STAGE_G2_ACCEPTANCE_MANIFEST_V1.md` — closed G2A evaluation-meaning authority.
24. `STAGE_G2B_OBJECTIVE_EXECUTION_V1.md` — closed G2B1 content-addressed execution/result authority.
25. `STAGE_G2B2_TRUSTED_RUNNER_PERSISTENCE_V1.md` — closed G2B2 trusted server-runner + durable qualification bridge.
26. `STAGE_G3_COMPARISON_SELECTION_RECEIPT_TRANSPORT_V1.md` — closed G3 comparison / organizer-selection / receipt-transport authority.
27. `STAGE_G3_COMPARISON_SELECTION_RECEIPT_TRANSPORT_CLOSURE_V1.md` — G3 / Stage-G closure receipt.
28. `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md` — Stage-H threat-model authority and bounded H1–H6 sequence.
29. `STAGE_H1_PRODUCTION_ROUTE_BOUNDARY_V1.md` — closed H1 production-route and privilege-boundary contract.
30. `STAGE_H2_PRIVATE_DATA_RETENTION_V1.md` — closed H2 private-data retention/deletion contract.
31. `STAGE_H2_EGRESS_BACKUP_EVIDENCE_V1.md` — H2 provider/logging/disclosure/backup evidence contract.
32. `STAGE_H3_AUTH_OPERATOR_INCIDENT_V1.md` — closed H3 session/operator/incident hardening contract; closure used an explicit review-gate waiver.
33. `STAGE_H4_VERIFIER_SUPPLY_CHAIN_V1.md` — closed H4 verifier/supply-chain isolation contract; closure used the owner-authorized self-review substitution recorded in PR #115.
34. `STAGE_H6_BACKUP_RESTORE_TRUST_V1.md` — closed H6 backup/restore and final trust contract.
35. `STAGE_H_CLOSURE_V1.md` — Stage-H closure, final hostile-review evidence and integration transition receipt.
36. `STAGE_I_ALPHA_REHEARSAL_V1.md` — active Stage-I preparation authority; rehearsal only, no external-human Alpha authority.
37. `STAGE_I_ALPHA_READINESS_MATRIX_V1.md` — current evidence/gap matrix for Alpha readiness.
38. `ALPHA_CLAIMS_BRAND_POLICY_V1.md` — bounded REKT/Ink affiliation, qualification, AI, security/review and value-state communication authority.
39. `ALPHA_OPERATOR_RUNBOOK_V1.md` — solo-operator failure/recovery authority for Stage-I rehearsal and future Closed Alpha.
40. `REKT_TECHNICAL_FACEPLATE_V1.md` — highest visual execution authority; it may not override product truth/trust/API semantics.

Repository-level agents must also obey root `AGENTS.md` and hydrate from this index before Inkubator implementation.

Older `NORTH_STAR_MVP_V0.md`, `PRODUCT_CONTRACT_MVP_V0.md`, `IMPLEMENTATION_ROADMAP_MVP_V0.md`, `CHALLENGE_OS_NORTH_STAR_V1.md`, `CHALLENGE_CONTRACT_V1.md`, and the older Phase-9 rehearsal documents remain historical/design or reusable evidence ancestry only where they conflict with current authority.

Current forward sequence:

`AUTHORITY LOCK → CHALLENGE/BUILD-CONTRACT PROTOCOL → POSTGRES BRIDGE → COMPILER/BLUEPRINTS/CHAT → REKT CHALLENGE UI → BUILDER CAPSULE/SUBMISSION → REVEAL/TEST ARENA/RECEIPTS → TRUST HARDENING → INTEGRATION → STAGE-I PREP → CLOSED ALPHA/TESTNET → PRODUCTION-VALUE GATES → FULL NORTH STAR`

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
Stage-D Compiler                              CLOSED / PASS / MERGED INTO PLANNING LINEAGE
Stage-E Challenge UI                          CLOSED / PASS / INTEGRATED TO MAIN VIA PR #121
Stage F                                       CLOSED / PASS / INTEGRATED TO MAIN VIA PR #121
Stage G Reveal / Test Arena / Receipts        CLOSED / PASS / INTEGRATED TO MAIN VIA PR #121
Stage H trust hardening                       CLOSED / PASS / INTEGRATED TO MAIN VIA PR #121
H0 authority lock                             CLOSED / PASS / PR #109
H1 production route + privilege boundary      CLOSED / PASS / PR #110
H2 private-data + retention/deletion          CLOSED / PASS / PR #111
H3 auth/operator + incident controls          CLOSED / PASS WITH REVIEW WAIVER / PR #113
H4 verifier + supply-chain isolation          CLOSED / PASS WITH OWNER SELF-REVIEW SUBSTITUTION / PR #115
H5 failure/load + zero-inference              CLOSED / PASS WITH REVIEW WAIVER / PR #116
H6 restore + final trust gate                 CLOSED / PASS / PR #118
Stage-H final hostile review                  PASS / PR #119 CLOSED UNMERGED
Stage E→H integration                         CLOSED / PASS / PR #121 MERGED
Canonical main                                ab9d281086e3a2859274065d3ed9cb3ed5cf2f51
Stage-I prep branch                           ACTIVE / agent/stage-i-alpha-rehearsal-v1
Stage-I claims/brand policy                   ACTIVE AUTHORITY / ALPHA_CLAIMS_BRAND_POLICY_V1.md
Stage-I operator runbook                      ACTIVE AUTHORITY / ALPHA_OPERATOR_RUNBOOK_V1.md
Stage-I deployed rehearsal                    PENDING
Stage-I external-human Alpha                  NOT AUTHORIZED
Production money                              NOT AUTHORIZED
Stage-I prep merge-to-main                    NOT AUTHORIZED
```

## Closure chain

- **G1:** `e2e24ee55a0e81294660055a6a6ed7094f61ddba` — bounded hostile-review repair closed.
- **G2A:** `7bd6182d6d03971d6235931cdbdfd6e2633c8005` — frozen acceptance-manifest authority closed.
- **G2B1:** `9ec1577b1b6a86d2904bed4af6c9e96952f2ac48` — execution identity repair closed. Alternate `19f38e2392beae86cd83bdddbaa9b0540f60e514` is archived on `archive/g2b2-alternate-19f38e-2026-09-16` and is noncanonical.
- **G2B2:** `4331cf6709e15cb12693d0124aad4a885be64eb1` — archive-pending and persisted-command replay P1 repairs closed.
- **G3 / Stage G:** `e6c7e0abeaf1be79a9ac35a697c050f51e81e31b` — comparison/selection/receipt transport closed.
- **H0:** `19c04c4cb26477979c1190a5b9173c27822e3d6a` — threat-model authority repaired and closed after targeted rereview.
- **H1:** `525402d73f03174b29977e256f9aebfd3c14dbce` — canonical funded-Challenge production route inventory/entrypoint parity closed after one P1 repair and targeted rereview.
- **H2:** `12c0acf6539145cce10035f73fa285ba68992b49` — private-data deletion/retention/provider-egress boundary closed after exact-head CI/Auth/Postgres and one independent external hostile review returning `CLEAN_NO_CRITICAL_HIGH`.
- **H3:** `ed91567f98221355ba08bd197a8be389007b892c` — auth/session/operator/incident exact-head gates green; independent-review gate explicitly waived after bounded transport/capacity failures. Do not claim an admissible independent H3 review occurred.
- **H4:** `73c37922574b27c6052d6149ee02c45e42888afd` — verifier/supply-chain isolation closed with owner-authorized self-review substitution. Do not claim independent H4 review.
- **H5:** `b2c67646a65307d05b6aa0fa7392092fd21eb483` — failure/load/concurrency/zero-inference closed with explicit review-transport waiver after exact-head gates passed. Do not claim independent H5 review.
- **H6 / Stage H:** `e67931e6c4cc533ab1f91173f3b3d1fe367b7ac9` — backup/restore/final trust closed after full Stage-H independent hostile review plus repaired exact-head CI/Auth/Postgres verification.
- **Stage-H independent review:** reviewed pre-H base `04365d2d4a20948c15d76d02c566499c5ed5bd57` through `ed16eaec46939e20e30b6fbbcc4466ab8599e444`; run `35232699651`; verdict `CLEAN_NO_CRITICAL_HIGH`; artifact id `10501783369`, SHA-256 `114c57a92e8af3802dda63aaaae9c7c9c18622f02c2cb789bc1abcf5434510c4`.
- **Integration reconciliation:** current-main `c21d01cb5254d8ec653f6bd8b3f9a1084cdc65c2` reconciled into the dedicated integration branch through PR #120 at `22226fe4f4584064c56665427daa62b839d3116a`.
- **Stage E→H main integration:** PR #121 merged verified integration head `a4836d3be76dd3f2f47e7274cba4e62c5fa444bf` into `main`; canonical merge commit `ab9d281086e3a2859274065d3ed9cb3ed5cf2f51`.

## Current Stage-I prep authority

Stage H and E→H integration are closed. The only authorized current engineering action is bounded Stage-I preparation on:

`agent/stage-i-alpha-rehearsal-v1`

Rules:

- preserve the merged Stage-E→H semantics on canonical `main`;
- use the existing `apps/inkubator-lab` runtime as the Inkubator frontend root; do not create `apps/inkubator-web` and never reuse Terminal `apps/web`;
- deploy only to the dedicated `rekt-inkubator-rehearsal` target during Stage-I prep; do not modify the separate `rekt-inkubator-rehearsal-api` or `rekt-inkubator-rehearsal-ui` services;
- reuse still-valid Stage-H and historical bounded rehearsal evidence rather than rerunning it ceremonially;
- create new evidence where Stage-I composition changes: exact deployment, provider rollback, current browser loop, multi-builder competition, degraded-mode behavior and Alpha-facing claims;
- repair only concrete Alpha blockers with the smallest safe diff;
- if a material runtime repair is required, perform ONE focused hostile review of that repair; no broad review loop;
- exact-head CI/Auth/Postgres/Verification/Signal gates must pass before Stage-I prep closure;
- do not invite external humans merely because rehearsal gates pass; Closed Alpha requires a separate explicit owner decision;
- do not merge Stage-I prep to `main` without a later explicit owner decision;
- production money remains Stage-J work and is not authorized.

F1's independent hostile-review requirement was explicitly replaced by user authority on 2026-09-14 with the completed adversarial self-audit plus green exact-head CI/Auth gates. Do not claim an independent F1 review occurred.

H3's independent hostile-review gate was separately and explicitly waived after exact-head implementation evidence passed and bounded reviewer transports failed. H4 used a separately owner-authorized self-review substitution. H5 used a separately explicit review-transport waiver. These are local governance exceptions and do not alter the default bounded-review policy.

Stage-I prep grants no production-money authority, settlement execution, wallet custody/signing/broadcast, arbitrary participant-code execution, hidden tests, LLM judging/scoring, public raw private-source retrieval or external-human Alpha authority.
