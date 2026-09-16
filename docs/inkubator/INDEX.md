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
19. `STAGE_F2_IMMUTABLE_SUBMISSION_V1.md` — closed F2 builder-owned immutable submission contract over existing Stage-B/C law.
20. `STAGE_F3_ARCHIVE_EVIDENCE_V1.md` — F3A provider-independent durable asynchronous archive/evidence contract.
21. `STAGE_F3_ARCHIVE_EVIDENCE_CLOSURE_V1.md` — Stage-F3/Stage-F closure receipt covering F3A orchestration and F3B GitHub→private-R2 provider wiring.
22. `STAGE_G_REVEAL_TEST_ARENA_RECEIPTS_V1.md` — Stage-G parent authority.
23. `STAGE_G2_ACCEPTANCE_MANIFEST_V1.md` — closed G2A frozen evaluation-meaning authority.
24. `STAGE_G2B_OBJECTIVE_EXECUTION_V1.md` — closed G2B1 content-addressed execution/result authority contract.
25. `STAGE_G2B2_TRUSTED_RUNNER_PERSISTENCE_V1.md` — closed G2B2 trusted server-runner + durable qualification bridge.
26. `STAGE_G3_COMPARISON_SELECTION_RECEIPT_TRANSPORT_V1.md` — closed G3 comparison / organizer-selection / safe receipt-transport authority.
27. `STAGE_G3_COMPARISON_SELECTION_RECEIPT_TRANSPORT_CLOSURE_V1.md` — G3 and Stage-G closure receipt / verification evidence.
28. `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md` — Stage-H trust/reputation threat-model authority and bounded H1–H6 sequence.
29. `REKT_TECHNICAL_FACEPLATE_V1.md` — highest visual execution authority; it may not override product truth/trust/API semantics.

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
Stage H trust hardening                       USER-AUTHORIZED / H0 P1 REPAIRS APPLIED / PR #109
H0 authority lock                             EXACT-HEAD VERIFY + TARGETED REREVIEW NEXT
H1 production route + privilege boundary      BLOCKED UNTIL H0 PASS
H2 private-data + retention/deletion          NOT YET AUTHORIZED BY H1
H3 auth/operator + incident controls          NOT YET AUTHORIZED BY H2
H4 verifier + supply-chain isolation          NOT YET AUTHORIZED BY H3
H5 failure/load + zero-inference              NOT YET AUTHORIZED BY H4
H6 restore + final trust gate                 NOT YET AUTHORIZED BY H5
Stage I external-human Alpha                  NOT AUTHORIZED
Production money                              NOT AUTHORIZED
Merge authority                               NONE
```

**G1 closure:** exact head `e2e24ee55a0e81294660055a6a6ed7094f61ddba` passed Inkubator Auth Foundation #534 and CI #1612. The single hostile review found one P1 combined-Render-runtime wiring defect; that defect was repaired on the exact head, the one allowed targeted Codex rereview found no major issues, and the review thread is resolved. G1 is closed/pass without merge.

**G2A closure:** exact head `7bd6182d6d03971d6235931cdbdfd6e2633c8005` passed final CI #1637 and Inkubator Verification #631 after its bounded review/repair cycle. G2A freezes content-addressed automated/human criterion meaning in the Build Contract's existing `normative_references` without creating a second contract law.

**G2B1 closure:** exact head `9ec1577b1b6a86d2904bed4af6c9e96952f2ac48` passed CI #1662 and Inkubator Verification #640. The independent hostile review found one P1 execution-identity defect; the repair bound execution identity to the canonical digest of the complete protocol-selected submission manifest, the single targeted rereview found no major issues, and the review thread is resolved. The accidental later alternate G2B2 head `19f38e2392beae86cd83bdddbaa9b0540f60e514` is preserved on `archive/g2b2-alternate-19f38e-2026-09-16`; the G2B1 branch was restored to this closure SHA so PR #106 again stacks cleanly from canonical G2B1.

**G2B2 closure:** reviewed implementation/repair head `4331cf6709e15cb12693d0124aad4a885be64eb1` passed CI #1702 and Inkubator Auth Foundation #550 including the full Postgres suite. The independent hostile review found two P1s: archive `PENDING` could be bypassed by a non-archive binding mix, and an interrupted execution-evidence append could become unrecoverable after lifecycle advance. Repairs moved the final-submission `PENDING` gate before all binding dispatch and restored exact persisted-command replay through existing `recordChallengeQualification()`. Focused unit/Postgres regressions passed, both P1 threads were resolved, and the single targeted Codex rereview of commit `4331cf6709` found no major issues. G2B2 is closed/pass without merge.

**G3 / Stage-G closure:** exact reviewed implementation head `e6c7e0abeaf1be79a9ac35a697c050f51e81e31b` passed CI #1729 and Inkubator Auth Foundation #562 including the full Postgres suite. G3 projects only durable final qualifiers into organizer comparison, keeps frozen preferences non-normative, fixes organizer selection to existing `SELECTION` authority, preserves exact-command replay through the existing Stage-C store/DB lifecycle boundary, proves concurrent choices collapse to one durable selection, and exposes only a privacy-bounded read-only projection of existing durable receipts/corrections. The single independent Codex hostile review found no major issues, so no targeted rereview was required. G3 and Stage G are closed/pass without merge.

**Stage-H authority:** user authorization on 2026-09-16 activates only the authority lock and bounded H1→H6 sequence in `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`. The first independent hostile review of H0 found five P1 omissions: external compiler-provider egress, promoted-blueprint content identity/provenance, stolen-session revocation/step-up authentication, long-job lease renewal/fencing, and backup confidentiality/integrity/provenance. All five are now explicitly bound into T1/T2/T4/T9/T10 and their owning H2/H3/H4/H5/H6 exit gates. H0 requires exact-head verification plus the single bounded targeted rereview of those repairs before H1 may begin.

**Execution verdict:** repair H0 only. Do not broaden Stage H or start H1 early. If exact-head verification is green and the single targeted rereview finds no Critical/High defect in the five repairs, close H0 and begin H1: canonical production route inventory plus privilege-boundary enforcement.

Current dependency order remains stacked and unmerged. Stage-E PR #97, Stage-F1 PR #98, Stage-F2 PR #100, Stage-F3A PR #101, Stage-F3B PR #102, G1 PR #103, G2A PR #104, G2B1 PR #105, G2B2 PR #106, G3 PR #107 and Stage-H authority PR #109 must not be merged out of order without explicit merge authority.

F1's independent hostile-review requirement was explicitly replaced by user authority on 2026-09-14 with the completed adversarial self-audit plus green exact-head CI/Auth evidence. Do not claim an independent F1 review occurred. That waiver does not alter the default bounded-review policy used for later slices.

The existing `apps/inkubator-lab` runtime remains the Inkubator frontend root; do not create `apps/inkubator-web` and never reuse Terminal `apps/web`. Historical WORLD/COMMAND/PROJECT/PLAYER/SHIP surfaces remain parked compatibility substrate unless a bounded migration explicitly promotes them.

Stage-H authority grants no production-money authority, settlement execution, wallet custody/signing/broadcast, arbitrary participant-code execution, hidden tests, LLM judging/scoring, public raw private-source retrieval, Stage-I external-human Alpha, or merge.
