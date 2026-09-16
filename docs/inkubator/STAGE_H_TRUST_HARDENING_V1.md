# REKT INKUBATOR — STAGE H TRUST HARDENING V1

**Status:** USER-AUTHORIZED / H0 AUTHORITY LOCK
**Date:** 2026-09-16
**Parent authority:** `REKT_INKUBATOR_NORTH_STAR_V2.md`
**Mechanism/trust authority:** `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`
**Threat-model authority:** `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`
**Base:** Stage-G closure head `04365d2d4a20948c15d76d02c566499c5ed5bd57`
**Production-money authority:** NONE
**Merge authority:** NONE

Stage H hardens the already-built integrated Challenge loop before external-human Alpha. It does not reopen the Challenge mechanism, create a second authority system, or authorize production-value rails.

The permanent trust doctrine remains:

> **No single compromise or mistake should be able to silently alter Challenge rules, expose all private work, fabricate evidence, choose a winner or redirect settlement.**

And the communication doctrine remains:

> **Never claim more certainty than the evidence supports.**

---

## 1. Objective

Close the external-human precondition:

`INTEGRATED STAGE-G LOOP → EXPLICIT TRUST MODEL → MINIMAL PRODUCTION SURFACE → PRIVACY/OPSEC CONTROLS → FAILURE/RESTORE PROOF → HOSTILE REVIEW → ALPHA-READY TRUST POSTURE`

Stage H is successful only when the current implementation has no known Critical/High trust defect inside the Alpha scope and the failure behavior is explicit, rehearsed and fail-closed.

This is not a generic security cleanup. Every Stage-H change must map to a frozen threat, trust boundary, privacy rule, operational failure, or launch claim in `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`.

---

## 2. Repository-grounded starting facts

The Stage-G closure branch exposes two immediate Stage-H route-assembly concerns that must be resolved before external Alpha:

1. `apps/inkubator-api/src/server.ts` and `apps/inkubator-api/src/render-server.ts` both begin from `buildApp(...)`, while `buildApp(...)` still registers historical Phase-7 reputation, Phase-8 DevKit and older Player/Project/Mission/social/Ship route families. Survivor V1.1 requires the production funded-Challenge app to register only the intended V1 product surface plus required auth/GitHub/health operations.
2. The two runtime entrypoints do not currently compose exactly the same Challenge route set: `server.ts` registers Stage-E Challenge product routes plus G1/G2B/G3, while `render-server.ts` registers G1/G2B/G3 but not the Stage-E Challenge product route registrar.

These observations are not authorization to delete historical substrate. Historical code may remain in-repo and reusable. Stage H must instead create one explicit production route assembly so legacy/dev/test routes are absent from the production Inkubator surface while test/development compatibility remains intentional and testable.

No other issue is promoted to Critical/High merely because it is listed in a planning document. Stage-H severity comes from concrete exploitability/impact against the frozen Alpha trust boundaries.

---

## 3. H gates

The preimplementation gates from `PREIMPLEMENTATION_READINESS_V1.md` are now Stage-H blocking gates.

### H-GATE-1 — Trust & Reputation Threat Model

Authority artifact:

`docs/inkubator/INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`

It must define:

- assets and authorities;
- principals and attacker classes;
- trust boundaries;
- permanent invariants;
- threat register with severity and controls;
- prompt/model boundaries;
- private-source boundaries;
- organizer/builder/operator/resolver boundaries;
- GitHub/OAuth/session boundaries;
- evidence/receipt correction boundaries;
- dependency/blueprint provenance boundaries;
- incident severity and closure rules.

### H-GATE-2 — Claims / brand policy

The threat-model authority must freeze what the product may and may not claim about:

- REKT/Ink affiliation or endorsement;
- `qualified`, `tested`, `validated`, `secure`, `production ready` and similar trust language;
- AI/compiler recommendations;
- payment/settlement state;
- audit/security-review state;
- sponsorship/official status.

No UI copy may imply stronger authority than the underlying evidence.

### H-GATE-3 — Data inventory + retention matrix

The Stage-H authority must define purpose, sensitivity, access, public projection, retention/deletion and recovery behavior for at least:

- Player/account identity;
- sessions and auth state;
- GitHub identity/install/repository metadata;
- provider tokens/secrets;
- private source snapshots;
- immutable submission manifests;
- artifacts/evidence;
- audit/history;
- Challenge receipts/corrections;
- compiler/model prompts and outputs;
- backups.

Private losing source must have an executable deletion lifecycle. Backups must not become an undeletable shadow archive.

### H-GATE-4 — Operator runbooks

At minimum:

- GitHub unavailable;
- GitHub/OAuth compromise suspected;
- model unavailable;
- compiler output suspected wrong;
- DB restore;
- worker retry storm;
- verifier unavailable/compromised;
- suspected private-source exposure;
- account takeover;
- submission/evidence dispute;
- receipt correction;
- budget cap reached.

Runbooks must preserve the solo-operator invariant: normal healthy Challenges should not require manual intervention.

### H-GATE-5 — Failure / chaos matrix

Automate or rehearse, as appropriate:

- deadline races;
- duplicate commands and crash-after-commit replay;
- worker lease expiry/retry storm;
- GitHub revocation/outage;
- object/archive delay/failure;
- DB connection exhaustion;
- restore from backup;
- verifier outage/timeout/hostile URL behavior;
- cross-instance rate-limit/uniqueness behavior;
- zero-inference mode;
- stale/mixed deployment version behavior;
- private-source deletion including backup lifecycle.

---

## 4. Stage-H implementation slices

Only one slice is active at a time.

### H1 — production route assembly + authority convergence

Objective:

`ONE EXPLICIT PRODUCTION ROUTE ASSEMBLY / NO LEGACY-ROUTE LEAK / ENTRYPOINT PARITY`

Required outcomes:

- define a canonical allowlisted funded-Challenge production route registrar/assembly;
- `server.ts` and `render-server.ts` consume the same Challenge production assembly rather than drifting independently;
- legacy Player/Project/Mission/social/help/assist/devkit/development route families are absent from production funded-Challenge assembly unless an authority document explicitly promotes a required route;
- health/OpenAPI/auth/GitHub/Challenge routes are explicitly classified rather than inherited accidentally;
- test/development-only routes stay possible only behind explicit non-production assembly/config;
- a route-inventory test fails if a forbidden route appears in production;
- no Stage-B/C/G authority semantics change.

H1 is the first implementation slice after H0 closes.

### H2 — privileged/auth/private-source abuse controls

Objective:

`COMPROMISED OR MALICIOUS ACCOUNT ≠ SILENT PLATFORM AUTHORITY`

Required outcomes:

- sensitive mutations have durable actor/operation-scoped idempotency and appropriate cross-instance abuse controls;
- resolver/admin authority is separate from ordinary organizer/builder capability;
- self-resolution/conflict-of-interest is fail-closed;
- auth/session/GitHub credential handling is secret-safe and rotation-compatible;
- private-source access is explicit, audited and unavailable to public routes;
- no normal web/API path gains arbitrary source-export or settlement-redirection power.

Do not introduce a shared rate-limit service unless measured need earns it; PostgreSQL/edge controls may satisfy low-volume Alpha constraints.

### H3 — retention, audit, correction and operator exception surface

Objective:

`PRIVATE DATA EXPIRES / AUTHORITY HISTORY DOES NOT`

Required outcomes:

- implement the frozen retention/deletion matrix;
- losing private-source deletion executes and is observable without exposing source;
- backups have documented expiry/deletion behavior;
- immutable receipts/history remain append-only with correction lineage;
- privileged actions emit durable audit facts;
- operator exception state has bounded reason/evidence/action rather than DB surgery;
- public projections remain minimal and purpose-bound.

### H4 — verifier / dependency / restore isolation

Objective:

`UNTRUSTED INPUT OR PROVIDER FAILURE CANNOT BECOME PLATFORM TRUTH`

Required outcomes:

- verifier remains an isolated trust boundary with bounded network behavior and fail-closed timeouts;
- blueprint/acceptance-module provenance is content-addressed and active Challenges never inherit silent dependency upgrades;
- provider/model outage leaves deterministic core Challenge operation usable;
- DB backup/restore drill proves authority conservation and idempotent recovery;
- worker restart/reconciliation cannot duplicate economic/product authority;
- zero-inference operation test passes for core frozen-Challenge flows.

### H5 — production-equivalent load/chaos + trust closure

Objective:

`REALISTIC FAILURE PRESSURE / ZERO AUTHORITY VIOLATIONS`

Required outcomes:

- production-equivalent PostgreSQL/pooling mode;
- measured seat/submission/selection contention;
- authenticated/public read and mutation load profiles;
- worker/verifier/object-store failure drills;
- no public GET write/lock amplification;
- intentional 409/429 conflicts distinguished from 5xx/timeouts/invariant failure;
- documented headroom for the closed-Alpha cohort;
- one independent hostile review of the Stage-H closure head;
- fix Critical/High only, one targeted rereview only if needed.

---

## 5. Frozen Stage-H non-goals

Stage H does **not** authorize:

- production money or USDC custody;
- wallet signing/approval/broadcast;
- Challenge Vault implementation;
- KYC/AML/compliance infrastructure before legal obligations are known;
- arbitrary hostile participant-code sandboxing;
- hidden acceptance tests;
- LLM judging/scoring;
- open anonymous marketplace admission;
- new social/feed systems;
- agent hosting;
- multi-chain settlement;
- rewriting Stage-B/C/G semantics;
- replacing the modular-monolith architecture without measured evidence;
- merging the stacked PR chain.

Production-value/legal/security gates remain independent Stage-J blockers even after Stage H passes.

---

## 6. Severity / closure law

### Critical

A defect can directly and plausibly allow one compromise/mistake to:

- alter frozen Challenge law;
- expose broad private source/evidence;
- fabricate authoritative qualification/selection/receipt facts;
- bypass organizer/builder/resolver authorization;
- redirect or invent settlement authority;
- erase/overwrite immutable authority history;
- execute participant-controlled code/network behavior in a privileged trust domain without the frozen boundary.

### High

A defect materially weakens a frozen trust boundary, creates a repeatable cross-tenant/privacy leak, makes authority recovery ambiguous, or makes normal Alpha operation depend on unsafe manual intervention.

### Medium / Low

Do not restart a bounded slice unless the issue invalidates the slice objective, evidence, a frozen invariant, or fail-closed behavior.

Stage-H completion policy:

`IMPLEMENT → TEST → ONE INDEPENDENT HOSTILE REVIEW → FIX CRITICAL/HIGH → ONE TARGETED REREVIEW ONLY IF CRITICAL/HIGH FIXES WERE NEEDED → CLOSE → MOVE FORWARD`

No review loops.

---

## 7. Acceptance evidence required at Stage-H closure

Stage H cannot close on prose alone. Closure evidence must include:

1. exact production route inventory proving forbidden legacy/dev/test routes absent;
2. auth/privileged-action matrix;
3. private-source access + deletion tests;
4. claims/projection tests for public trust language where machine-enforceable;
5. audit/correction lineage tests;
6. provider/GitHub/verifier outage tests;
7. backup/restore drill receipt;
8. cross-instance/retry/concurrency tests;
9. zero-inference core-flow test;
10. production-equivalent load/chaos report;
11. exact-head CI/Auth/product-boundary verification;
12. bounded independent hostile review receipt.

---

## 8. H0 verdict

H0 authority work is complete only when:

- this Stage-H execution contract exists;
- `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md` freezes the threat/claims/data/runbook/failure contract;
- `INDEX.md` points to both;
- root `AGENTS.md` no longer tells receiving agents that Stage D is the active Inkubator phase;
- exact-head repository verification is green;
- one bounded hostile review of the H0 authority lock finds no Critical/High planning contradiction, or those findings are repaired under the normal bounded review rule.

Until H0 closes, do not begin H1 implementation.
