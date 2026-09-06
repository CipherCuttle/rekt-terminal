# REKT INK(CUBATOR) — DevKit Contract v0

**Status:** CANONICAL / MVP SDK-CLI-MCP AUTHORITY CONTRACT

**Locked:** 2026-09-06

## Purpose

The DevKit exists to plug a builder's real work into the Inkubator world with minimal friction while preserving one invariant:

> **More integration must never grant more authority over truth.**

Participant-controlled SDK/CLI/MCP code can submit claims, context and bounded social/product actions. It cannot mint PROVEN truth, grant reputation or approve Ships.

## 1. Launch package surface

Target public developer surface:

```text
@rekt-ink/protocol   public schemas/types/semantic constants
@rekt-ink/sdk        typed domain-oriented TypeScript client
@rekt-ink/cli        `rekt` command-line experience
@rekt-ink/mcp        coding-agent bridge
@rekt-ink/react      optional tiny embed/hooks surface
```

Package boundaries may be adjusted during Platform Foundation if smaller packaging reduces complexity without changing this authority model.

The existing private `@rekt-ink/inkubator-protocol` is the seed for the public contract package; do not create a second divergent protocol definition.

## 2. Desired launch experience

A builder should be able to reach something close to:

```bash
npx @rekt-ink/cli init
rekt status
rekt next
rekt update
rekt beacon
rekt claim
rekt ship
rekt doctor
```

The web app, CLI and MCP must report the same canonical Mission state.

Deleting local CLI/MCP state must lose no authoritative product state.

## 3. SDK truth classes

### CLAIM

Participant-controlled assertion.

Example:

```ts
await ink.claim.milestone({
  milestone: 'core-loop',
  state: 'complete'
})
```

This may create `CLAIMED` state.

### OBSERVATION

Trusted server adapter or bounded human action reports state.

Examples:

- GitHub PR merged;
- deployment observer succeeds;
- tester reports outcome;
- Project owner accepts an Assist.

### PROOF

Inkubator server authority applies a versioned rule to sufficient evidence and emits PROVEN/authoritative consequence.

Public DevKit must not expose participant methods equivalent to:

```text
prove()
grantAchievement()
approveShip()
setRank()
moderatePlayer()
changeRoundAuthority()
```

## 4. Public SDK API philosophy

Expose a small domain-shaped surface, not raw endpoint sprawl.

Illustrative shape:

```ts
ink.player.me()

ink.mission.current()
ink.mission.status()
ink.mission.claim(...)

ink.project.update(...)

ink.beacon.create(...)
ink.beacon.list(...)

ink.assist.offer(...)

ink.ship.prepare(...)
```

The exact v1 API is frozen only after the OpenAPI/domain spike. Every exported method becomes a compatibility promise; keep v1 intentionally small.

## 5. Generated transport, hand-designed ergonomics

Preferred architecture:

```text
OpenAPI 3.1
    ↓
generated TypeScript transport/types
    ↓
small hand-designed @rekt-ink/sdk domain wrapper
```

Do not manually duplicate HTTP request/response types.

Do not expose generated transport internals as the main developer experience.

## 6. Package public boundary

Use deliberate package exports.

Conceptual surface:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/server.js",
    "./protocol": "./dist/protocol.js"
  }
}
```

Avoid wildcard exports that turn internal directory structure into permanent public API.

## 7. Browser vs server authority

Browser-safe SDK:

- read canonical public/player-authorized state;
- submit explicitly self-reported/public-telemetry data only where the product contract allows it;
- never contain server/project secret authority.

Server/CLI/MCP surfaces:

- may use scoped credentials;
- may perform bounded Player-authorized mutations;
- still cannot create PROVEN/reputation/approval authority.

Build tests must prevent browser code from importing privileged server entrypoints or bundling known secret material.

## 8. Credential classes

Do not use one universal API key.

Conceptual credential classes:

- browser session credential;
- CLI user credential;
- MCP user credential;
- project automation token;
- GitHub installation/user token managed by server;
- operator credential;
- verifier service credential.

Project/automation token scopes may include:

```text
player:read
project:read
mission:read
claim:write
update:write
beacon:write
assist:write
ship:prepare
```

They must not include:

```text
proof:write
achievement:grant
ship:approve
reputation:write
player:moderate
round:admin
```

Tokens should be revocable and limited in duration/scope appropriate to their use.

## 9. MCP contract

MCP exists to give coding agents safe access to canonical Mission context and bounded Player actions.

Useful resources:

```text
inkubator://mission/current
inkubator://project/current
inkubator://mission/ship-condition
inkubator://project/activity
inkubator://player/profile
```

Useful read tools:

- get_mission_status;
- get_next_move;
- get_ship_condition;
- get_project_status;
- list_help_beacons;
- get_activity.

Useful bounded write tools:

- claim_milestone;
- post_project_update;
- create_help_beacon;
- offer_assist;
- prepare_ship.

Tools that must not exist for Player authority:

- grant_achievement;
- mark_proven;
- approve_ship;
- change_reputation;
- moderate_player;
- grant_admin;
- rewrite_round.

Dangerous/irreversible actions must require explicit user-visible intent/confirmation appropriate to the host/client.

MCP never stores a second canonical Mission database.

## 10. CLI local-state invariant

`rekt` may keep locators/config/cache such as:

```json
{
  "project": "P006",
  "mission": "M007",
  "api": "https://..."
}
```

but it must not become the source of truth for:

- progress;
- achievements;
- Mission state;
- Assists;
- Ship state;
- reputation.

Hard invariant:

> Delete `.rekt/` and all canonical Inkubator state remains correct on the server.

## 11. Idempotency

Every externally retried mutation must define idempotency behavior.

Examples:

- `claim_milestone` repeated with same semantic/idempotency key creates one logical claim;
- `offer_assist` network retry creates one logical offer;
- `prepare_ship` retry cannot create duplicate Ship authority.

SDK/CLI should generate/request idempotency keys automatically where callers do not need to manage them manually.

Retries must be bounded and respect rate-limit/backoff responses.

## 12. Resource/budget controls

DevKit must not create an accidental DoS/economic-abuse surface.

Server enforces bounded:

- request payload size;
- update/comment/beacon frequency;
- active Help Beacons;
- repo reconciliation jobs;
- AI/Daemon expensive actions;
- verifier attempts;
- concurrent project jobs;
- token scopes/expiry.

SDK must not retry indefinitely or hide server rate-limit errors.

## 13. Protocol versioning

Package version and protocol meaning are separate.

Example:

```text
@rekt-ink/sdk@2.7.1
supports:
  event.v1
  mission.v2
  receipt.v1
```

A patch/minor SDK release must not silently reinterpret old protocol/history.

Breaking public SDK API follows SemVer once v1 is declared stable.

Domain semantic changes follow the Architecture/Product Contract version rules regardless of package SemVer.

## 14. Publication and provenance

Public npm packages should be published through controlled CI using npm Trusted Publishing/OIDC where available, without a long-lived npm publish token.

Release packages should have provenance tied to the approved public source/workflow where the tooling supports it.

Do not publish from a developer laptop as the canonical production release path.

## 15. Embed surface

A small React/browser surface may expose truthful project/world integration such as:

```text
● BUILDING IN ROUND 000
◆ NEEDS TESTERS
✓ SHIPPED // R000-006
```

Clicking should link to canonical Inkubator Project/Ship history.

Embeds are presentation/read surfaces. They do not become a privileged proof channel.

## 16. Future public telemetry

If the product later exposes browser/project telemetry keys for facts such as sessions/plays, classify that source as participant-controlled/self-reported unless independently corroborated.

Do not let a public key create authoritative Cheevos/proof simply because the SDK call came from deployed code.

This is deferred from DevKit v0 unless a founding-cohort Project clearly needs it.

## 17. DevKit hostile tests

Before launch:

- `SDK-H01` participant cannot create PROVEN evidence;
- `SDK-H02` Player credential cannot grant achievement/approve Ship;
- `SDK-H03` browser bundle cannot access server credential path;
- `SDK-H04` duplicate mutation idempotency key creates one domain action;
- `SDK-H05` old protocol fixtures remain readable after SDK upgrade;
- `SDK-H06` unexported SDK internals cannot be imported through supported package paths;
- `SDK-H07` release package provenance resolves to approved source/workflow;
- `SDK-H08` MCP Player token cannot discover/invoke operator-only authority;
- `SDK-H09` rate-limited action fails boundedly without retry storm;
- `SDK-H10` deleting CLI/MCP local state does not alter canonical Inkubator state.

## 18. DevKit launch kill criteria

DevKit is not launch-ready if any are true:

1. participant-controlled client can create PROOF;
2. one token spans Player and operator authority;
3. retrying mutation can duplicate reputation/Ship state;
4. upgrading SDK can silently change historical semantics;
5. web, CLI and MCP can disagree about canonical Mission state.

## 19. Launch demo target

The ideal 60-second demonstration is truthful and end-to-end:

1. Player enters Round;
2. `rekt init` links Project/Mission;
3. World shows Player entered;
4. MCP reads current Mission/next move;
5. developer pushes real work;
6. GitHub observation changes state;
7. `rekt beacon tester` emits Help Beacon;
8. another Player tests/assists;
9. Thread advances through accepted evidence;
10. `rekt ship` prepares bounded Ship flow;
11. accepted Ship Receipt appears;
12. Project embed links back to the verified history.

The wow factor comes from one canonical world reacting to real work, not from giving the SDK magical authority.