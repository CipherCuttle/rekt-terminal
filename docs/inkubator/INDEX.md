# REKT INKUBATOR — AUTHORITY POINTER

**Updated:** 2026-09-16

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
33. `STAGE_H4_VERIFIER_SUPPLY_CHAIN_V1.md` — active H4 verifier/supply-chain isolation contract.
34. `REKT_TECHNICAL_FACEPLATE_V1.md` — highest visual execution authority; it may not override product truth/trust/API semantics.

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
Stage G Reveal / Test Arena / Receipts        CLOSED / PASS / STACKED / UNMERGED
G1 synchronized reveal + Arena input          CLOSED / PASS / PR #103 / UNMERGED
G2A frozen acceptance manifest                CLOSED / PASS / PR #104 / UNMERGED
G2B1 execution authority contract             CLOSED / PASS / PR #105 / UNMERGED
G2B2 trusted runner + qualification persist   CLOSED / PASS / PR #106 / UNMERGED
G3 comparison / selection / receipt transport CLOSED / PASS / PR #107 / UNMERGED
Stage H trust hardening                       USER-AUTHORIZED / ACTIVE
H0 authority lock                             CLOSED / PASS / PR #109 / UNMERGED
H1 production route + privilege boundary      CLOSED / PASS / PR #110 / UNMERGED
H2 private-data + retention/deletion          CLOSED / PASS / PR #111 / UNMERGED
H3 auth/operator + incident controls          CLOSED / PASS WITH REVIEW WAIVER / PR #113 / UNMERGED
H4 verifier + supply-chain isolation          CLOSED / PASS WITH OWNER AUTHORIZED SELF-REVIEW / PR #115 / UNMERGED
H5 failure/load + zero-inference              AUTHORIZED / IMPLEMENTATION ACTIVE
H6 restore + final trust gate                 NOT YET AUTHORIZED BY H5
Stage I external-human Alpha                  NOT AUTHORIZED
Production money                              NOT AUTHORIZED
Merge authority                               NONE
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
- **H3:** `ed91567f98221355ba08bd197a8be389007b892c` — auth/session/operator/incident implementation and exact-head CI/Auth/Postgres were green; the independent-review gate was explicitly waived by the user after bounded reviewer-capacity attempts failed. Do not claim an admissible H3 hostile review occurred.
- **H4:** `73c37922574b27c6052d6149ee02c45e42888afd` — verifier/supply-chain isolation closed with owner-authorized self-review; PR #115 remains unmerged.

## Current H4 authority

`STAGE_H4_VERIFIER_SUPPLY_CHAIN_V1.md` is current. H4 may implement only the T2/T11 surface:

- promoted compiler-blueprint content identity + promotion provenance without silently changing Stage-D semantics;
- trusted-module/runner provenance checks while preserving frozen Challenge module digests;
- isolated verifier public-HTTPS target/egress policy;
- DNS/IP rebinding, metadata/special-address, redirect, response-size and timeout fail-closed regressions;
- verifier credential-isolation evidence.

H4 must not authorize participant/arbitrary code execution, hidden tests, LLM judging/scoring, H5/H6 work, Stage-I external-human Alpha, production money, settlement execution, wallet custody/signing/broadcast or merge.

**Execution verdict:** implement and verify H4 only. Do not start H5 until H4 exact-head verification and the single independent hostile review close under the bounded policy.

Current dependency order remains stacked and unmerged. Stage-E PR #97, Stage-F1 PR #98, Stage-F2 PR #100, Stage-F3A PR #101, Stage-F3B PR #102, G1 PR #103, G2A PR #104, G2B1 PR #105, G2B2 PR #106, G3 PR #107, H0 PR #109, H1 PR #110, H2 PR #111 and H3 PR #113 must not be merged out of order without explicit merge authority. H4 is stacked directly on exact H3 closure `ed91567f98221355ba08bd197a8be389007b892c` and remains unmerged.

F1's independent hostile-review requirement was explicitly replaced by user authority on 2026-09-14 with the completed adversarial self-audit plus green exact-head CI/Auth evidence. Do not claim an independent F1 review occurred. That waiver does not alter the default bounded-review policy used for later slices.

H3's independent hostile-review gate was separately and explicitly waived by the user after implementation was exact-head green and bounded external-review attempts failed for capacity/provider reasons. Do not generalize that exception to H4 or later slices.

The existing `apps/inkubator-lab` runtime remains the Inkubator frontend root; do not create `apps/inkubator-web` and never reuse Terminal `apps/web`. Historical WORLD/COMMAND/PROJECT/PLAYER/SHIP surfaces remain parked compatibility substrate unless a bounded migration explicitly promotes them.

Stage-H authority grants no production-money authority, settlement execution, wallet custody/signing/broadcast, arbitrary participant-code execution, hidden tests, LLM judging/scoring, public raw private-source retrieval, Stage-I external-human Alpha, or merge.
