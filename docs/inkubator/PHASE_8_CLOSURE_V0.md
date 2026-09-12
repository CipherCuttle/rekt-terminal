# REKT INK(CUBATOR) — Phase 8 Closure v0

**Phase:** PHASE 8 — DEVKIT LAUNCH SURFACE

**Status:** CLOSED / PASS

**Closed:** 2026-09-08

**Canonical Phase-7 base:** `a89def729379f5efff5e3d9bb17bab4a4dd88155`

**Broad-review candidate:** `b187ebddcbd42d01aa6a5dbd2c7148b3bbc3de66`

**Reviewed repair candidate:** `a3eeffba1ee9a3955af5c7e6372820acf136e709`

**PR:** #43 — draft / open / unmerged

## Objective closed

Expose the canonical Inkubator world through public protocol, SDK, CLI and MCP surfaces without creating a second truth system or raising participant authority.

## Delivered

- public `@rekt-ink/protocol` lineage from the existing protocol seed;
- generated OpenAPI transport plus bounded TypeScript domain SDK;
- browser/cookie root SDK entry with no DevKit bearer-token path;
- server-only bearer client under `@rekt-ink/sdk/server`;
- `rekt` CLI surface;
- bounded MCP bridge;
- scoped, opaque, hash-at-rest, expiring, revocable DevKit credentials;
- one DB-serialized Player-wide DevKit rate budget shared across credentials;
- request-id/idempotency behavior;
- npm OIDC / Trusted-Publishing / provenance-shaped release workflow;
- generated-client freshness gate before publication;
- DevKit quickstart and hostile tests SDK-H01..SDK-H10.

## Verification

Repair verification workflow run `34211195400` completed successfully.

Verified:

- API typecheck/build: PASS;
- generated transport freshness: PASS;
- migration 018: PASS;
- SDK/CLI/MCP builds: PASS;
- DevKit package hostile tests: PASS;
- focused Phase-8 authority regression: 1/1 PASS;
- token-rotation rate-limit falsification: PASS;
- release freshness/provenance gate: PASS;
- full Postgres integration: 35/35 PASS.

## Review

Broad hostile review budget: `1 / 1 USED`.

Broad review found three P1 defects:

1. SDK-H03 browser root could accept bearer credentials;
2. SDK-H09 rate limiting was token-local and bypassable by credential rotation;
3. SDK-H07 publish path could release stale generated transport.

All three were repaired on `a3eeffba1ee9a3955af5c7e6372820acf136e709`.

Targeted rereview budget: `1 / 1 USED`.

Targeted Codex rereview reviewed exact `a3eeffba1e` and reported no major issues. The three original review threads are resolved with repair evidence.

## Authority result

The hard invariant remains intact:

> More integration must never grant more authority over truth.

Participant SDK/CLI/MCP surfaces cannot create PROVEN evidence, grant Cheevos/reputation, approve Ships, moderate Players or acquire Round/operator/verifier authority.

## Deviations / launch notes

- PR #43 remains intentionally draft/open/unmerged. Phase closure does not grant merge authority.
- The controlled npm publication path is implemented and verified. Actual registry publication/release timing remains a launch operation; no developer-laptop publication is canonical.
- Existing unrelated/pre-existing CI/deployment failures do not alter the verified Phase-8 product authority.

## Verdict

`PHASE_8 = CLOSED / PASS`

`SAFE_TO_MERGE_PR_43 = NO — explicit user merge authority still required`

`NEXT_PHASE = PHASE 9 — FOUNDING-COHORT REHEARSAL`

Phase 9 must start from the Phase-8 closure branch head and may not reopen Phase-8 implementation absent evidence that invalidates a frozen invariant or Phase-8 closure evidence.
