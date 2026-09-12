# PHASE PACKET

## Identity
- Phase: PHASE 8 — DEVKIT LAUNCH SURFACE
- Canonical base SHA: `a89def729379f5efff5e3d9bb17bab4a4dd88155`
- Objective: expose the existing canonical Inkubator world through a bounded public protocol/SDK/CLI/MCP surface without creating a second truth system or raising participant authority.
- Active branch: `feature/inkubator-devkit-launch-surface-v0`
- Authorized paths:
  - `docs/agent-packets/INKUBATOR_DEVKIT_V0.md`
  - `docs/inkubator/DEVKIT_*`
  - `packages/inkubator-protocol/**`
  - `packages/sdk/**`
  - `packages/cli/**`
  - `packages/mcp/**`
  - `apps/inkubator-api/src/app.ts`
  - `apps/inkubator-api/src/contract-phase8.ts`
  - `apps/inkubator-api/src/database.ts`
  - `apps/inkubator-api/src/devkit*.ts`
  - `apps/inkubator-api/src/generate-client.ts`
  - `apps/inkubator-api/src/migrations.ts`
  - `apps/inkubator-api/src/migrations/018-phase8-devkit-credentials.ts`
  - `apps/inkubator-api/test/**/phase8-*`
  - `apps/inkubator-lab/src/generated/inkubator-api-client.ts`
  - `package.json`
  - `package-lock.json`
  - `.github/workflows/*devkit*`
- Forbidden paths:
  - Phase-7 Cheevo/reputation semantics except additive generated transport changes required by Phase 8
  - Ship acceptance/verifier authority
  - operator/admin authority
  - unrelated REKT Terminal trading/game surfaces
  - Phase 9 launch rehearsal work

## Frozen product / authority brief

Canonical authorities:
- `docs/inkubator/IMPLEMENTATION_ROADMAP_MVP_V0.md`
- `docs/inkubator/DEVKIT_CONTRACT_V0.md`
- `docs/inkubator/ARCHITECTURE_CONTRACT_V0.md`

Hard invariant:

> More integration must never grant more authority over truth.

DevKit credentials are Player-authority credentials. They may read canonical Player/Project/Mission state and submit bounded claims/updates/help/assist/Ship-preparation actions. They may not create PROOF, grant Cheevos/reputation, approve Ships, moderate Players or change Round/operator/verifier authority.

## Packaging decision

The existing `packages/inkubator-protocol` implementation is the seed of the public protocol package. It must be promoted/reused, not copied into a competing protocol definition.

Launch target remains:
- `@rekt-ink/protocol`
- `@rekt-ink/sdk`
- `@rekt-ink/cli` (`rekt`)
- `@rekt-ink/mcp`

`@rekt-ink/react` remains optional and is not required to close Phase 8.

## Transport decision

One OpenAPI 3.1 document remains the HTTP source of truth.

```text
OpenAPI 3.1
    ↓
generated typed transport
    ↓
small hand-designed SDK
    ↓
CLI + MCP
```

The browser app may keep cookie sessions. CLI/MCP use scoped opaque bearer credentials. Bearer support must be additive and must not weaken browser CSRF/origin behavior.

## Credential scopes

Allowed Player scopes:
- `player:read`
- `project:read`
- `mission:read`
- `claim:write`
- `update:write`
- `beacon:write`
- `assist:write`
- `ship:prepare`

Forbidden scopes/methods include:
- `proof:write`
- `achievement:grant`
- `ship:approve`
- `reputation:write`
- `player:moderate`
- `round:admin`

Tokens must be opaque, hash-at-rest, revocable, expiring and rate bounded.

## MCP decision

Use the current stable official MCP TypeScript v2 server line and stdio transport. MCP publishes only the bounded Player tools/resources from `DEVKIT_CONTRACT_V0.md`; no operator/proof tools may be registered or discoverable.

## Required command surface

- `rekt init`
- `rekt status`
- `rekt next`
- `rekt update`
- `rekt beacon`
- `rekt claim`
- `rekt ship`
- `rekt doctor`

Local `.rekt/` data is locator/config/cache only. Deleting it must not alter canonical server state. Raw credential persistence in `.rekt/` is forbidden in v0; use host/environment credential injection.

## Acceptance criteria

1. Web, SDK, CLI and MCP read the same canonical Mission/Command projection.
2. SDK is a domain wrapper over generated transport, not duplicated handwritten HTTP types.
3. DevKit bearer credentials are scoped, revocable, expiring and rate bounded.
4. Public SDK/CLI/MCP expose no participant path to PROVEN, reputation/Cheevo minting or Ship approval.
5. Retried bounded mutations use existing request-id/idempotency semantics; SDK generates request IDs when caller omits one.
6. SDK does not retry indefinitely and does not retry 429 responses automatically.
7. CLI local deletion leaves canonical server state untouched.
8. MCP operator/proof authority is absent from discovery and invocation surfaces.
9. Public package exports are deliberate; generated/internal paths are not public compatibility promises.
10. Publication workflow is OIDC/Trusted-Publishing/provenance shaped and does not require a long-lived npm publish token.

## Hostile gates

- `SDK-H01` participant cannot create PROVEN evidence.
- `SDK-H02` Player credential cannot grant achievement/approve Ship.
- `SDK-H03` browser SDK entry cannot access server credential path.
- `SDK-H04` duplicate mutation request ID creates one logical action.
- `SDK-H05` old protocol fixtures remain readable after SDK/protocol promotion.
- `SDK-H06` unexported generated/internal SDK paths are not public package exports.
- `SDK-H07` release workflow uses approved source + npm provenance/OIDC path.
- `SDK-H08` MCP Player surface cannot discover operator-only authority.
- `SDK-H09` rate-limited action fails boundedly without retry storm.
- `SDK-H10` deleting CLI/MCP local state changes no canonical Inkubator state.

## Verification order

1. protocol tests;
2. API typecheck/build/generated-client freshness;
3. SDK typecheck/build/unit tests;
4. CLI build/unit tests;
5. MCP build/unit tests;
6. Phase-8 Postgres integration / hostile tests;
7. ONE independent hostile review;
8. fix Critical/High only;
9. ONE targeted rereview only if Critical/High repair was required.

The repository's known pre-existing foundation/governance CI mismatch is not Phase-8 product authority and must not be silently broadened into this phase.

## Forbidden changes
- no second Mission database or local authoritative progress state;
- no universal API key spanning Player/operator/verifier authority;
- no proof/achievement/approval mutation endpoints for DevKit;
- no unbounded retries;
- no wildcard package exports;
- no npm publish from a developer laptop as canonical release path;
- no Phase-9 scope expansion.

## Stop condition

Stop when Phase-8 acceptance/hostile tests pass and the bounded review policy closes. Do not merge without explicit user authority.

## Completion report
- CHANGESET
- VERIFY
- REVIEW
- DEVIATIONS
- VERDICT
