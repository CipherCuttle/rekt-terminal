# REKT INKUBATOR — STAGE H1 PRODUCTION ROUTE + PRIVILEGE BOUNDARY V1

**Status:** USER-AUTHORIZED / IMPLEMENTATION ACTIVE  
**Date:** 2026-09-16  
**Branch:** `agent/stage-h1-production-route-boundary-v1`  
**Base / H0 closure:** `19c04c4cb26477979c1190a5b9173c27822e3d6a`  
**Parent authority:** `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`  
**Production-money authority:** NONE  
**Merge authority:** NONE

## 0. Objective

H1 removes historical Inkubator surfaces from the funded-Challenge production runtime and makes production route composition one explicit, mechanically enforced authority.

Target:

```text
HISTORICAL buildApp() COMPATIBILITY SURFACE
  !=
FUNDED-CHALLENGE PRODUCTION SURFACE

server.ts ─┐
           ├→ buildFundedChallengeProductionApp() → exact allowlisted API routes
render.ts ─┘
```

The historical `buildApp()` may remain as compatibility/dev/test substrate. It is no longer a production entrypoint authority.

## 1. Frozen H1 invariants

1. `server.ts` and `render-server.ts` use the same canonical production builder.
2. Production does not register historical WORLD / Mission / Project / social / Help / Assist / reputation / DevKit / development-auth routes.
3. Production exposes only the currently authorized funded-Challenge routes plus minimum session identity/logout, required GitHub integration and health.
4. Route drift fails closed mechanically at app startup; an unexpected or missing API route is a startup error.
5. Dev/test bootstrap routes are absent even if `ALLOW_DEV_AUTH` is configured elsewhere.
6. Organizer-only Challenge operations remain organizer-only in their existing Stage-E/G handlers and stores. H1 does not create resolver/admin authority.
7. No generic admin/resolver/moderation mutation surface exists in the H1 production manifest.
8. H1 does not reinterpret Challenge, qualification, selection, receipt, session or GitHub semantics.
9. The combined Render static fallback may serve frontend assets, but unknown `/v1/*` and `/health` requests may never fall through to the SPA.
10. H1 grants no H2, Stage-I or production-money behavior until its bounded closure gate passes.

## 2. Canonical production surface

Always registered:

- `GET /health`
- `GET /v1/me`
- `DELETE /v1/session`
- Stage-E Challenge read / deterministic compiler / Build-Contract preview + persist
- Stage-G reveal
- G2B trusted module catalog + organizer qualification command
- G3 qualifier comparison + organizer selection + safe receipt transport

When GitHub is configured:

- GitHub OAuth login/install/callback routes;
- GitHub installation reconciliation;
- authenticated repository listing;
- exact-byte authenticated GitHub webhook ingestion.

`/openapi.json` is intentionally not part of H1 production authority because the historical OpenAPI document contains surfaces outside the funded-Challenge allowlist. A future production contract may expose an OpenAPI document only when its route inventory is generated from the same current authority.

## 3. Explicitly forbidden production families

The route manifest rejects, among others:

- `/v1/dev*`
- `/v1/devkit*`
- `/v1/discover*`
- `/v1/world*`
- `/v1/rounds*`
- `/v1/missions*`
- `/v1/projects*`
- `/v1/players*`
- `/v1/help-beacons*`
- `/v1/assists*`
- `/v1/comments*`
- `/v1/tester-requests*`
- `/v1/ship*`
- `/v1/reputation*`
- `/v1/admin*`
- `/v1/resolver*`
- `/v1/moderation*`

This is an absence requirement, not a UI-hiding requirement.

## 4. Privileged-operation inventory

The current production privileged Challenge operations are:

| Route | Authority |
| --- | --- |
| `POST /v1/challenges/:challengeId/build-contract` | Challenge organizer |
| `GET /v1/challenges/:challengeId/reveal-arena` | Challenge organizer |
| `POST /v1/challenges/:challengeId/test-arena/entries/:entryId/qualify` | Challenge organizer |
| `GET /v1/challenges/:challengeId/qualifier-comparison` | Challenge organizer |
| `POST /v1/challenges/:challengeId/selection` | Challenge organizer |

Existing Stage-E/G handlers and durable stores remain the authorization/lifecycle authority. H1 adds no resolver/admin role and no generic privileged row-update mechanism.

## 5. Implementation changes

H1 adds:

- `production-route-manifest.ts` — exact API allowlist, forbidden prefixes and privileged-operation inventory;
- `production-app.ts` — one canonical funded-Challenge Fastify builder;
- startup route capture + exact inventory assertion after Fastify plugin registration;
- production-safe session identity/logout;
- production GitHub login/reconcile/repository/webhook composition;
- identical Stage-E/G route registration for standalone API and combined Render runtime;
- unit regression proving allowlist fail-closed behavior, legacy-route absence, unauthenticated privileged-route rejection and entrypoint parity.

H1 changes no database schema and no Challenge protocol semantics.

## 6. Verification gate

Before hostile review, exact H1 head must pass:

- repository CI;
- Inkubator Auth Foundation / Inkubator verification when path-triggered;
- TypeScript typecheck;
- Inkubator API unit tests including `production-route-boundary.test.mjs`;
- canonical production build;
- product-boundary verification.

Focused acceptance:

1. production app boots with GitHub disabled and enabled;
2. exact route inventory passes in both modes;
3. adding an unapproved legacy route makes inventory verification fail;
4. removing an expected production route makes inventory verification fail;
5. historical `/v1/world/signals` is 404 from production;
6. unauthenticated organizer selection fails 401;
7. no admin/resolver/moderation production route is allowlisted;
8. both production entrypoints delegate to `buildFundedChallengeProductionApp()` rather than `buildApp()` or independent Stage route composition.

Existing Stage-E/G tests remain evidence that authenticated non-organizers fail organizer-only operations with 403 and that durable organizer/lifecycle authority remains in the existing stores.

## 7. Bounded completion

```text
IMPLEMENT H1
→ TEST EXACT HEAD
→ ONE independent hostile review
→ fix Critical/High only
→ ONE targeted rereview only if Critical/High fixes were required
→ CLOSE H1
→ H2 AUTHORIZED
```

Review focus:

- any legacy/dev/test route still reachable in production;
- entrypoint route mismatch;
- manifest bypass / unobserved plugin routes;
- accidental removal of required Challenge/auth/GitHub behavior;
- generic admin/resolver authority;
- mutation origin/webhook authentication regression;
- SPA fallback swallowing API misses.

Medium/Low findings do not reopen H1 unless they invalidate route absence, privilege separation, entrypoint parity or fail-closed route inventory.

## 8. Explicit exclusions

H1 does not authorize or implement:

- H2 private-data retention/deletion work;
- H3 session revocation/step-up implementation;
- H4 verifier/supply-chain implementation;
- H5 load/lease/zero-inference implementation;
- H6 restore work;
- arbitrary participant-code execution;
- hidden tests;
- LLM judging/scoring;
- settlement execution;
- production money;
- wallet custody/signing/broadcast;
- Stage I external-human Alpha;
- merge.
