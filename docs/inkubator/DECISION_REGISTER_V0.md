# REKT INK(CUBATOR) — Decision Register v0

**Status:** CANONICAL / LOCKED DECISIONS + REOPEN CRITERIA

**Locked:** 2026-09-06

This register prevents previously settled questions from silently reopening every session. It does not stop evidence-driven changes; it requires changes to be explicit.

## Product decisions

| Decision | Status | Reopen only if |
| --- | --- | --- |
| MVP is the complete founding-cohort Player→Mission→Command→Proof→Help→Ship→History loop | **BUILD / LOCKED** | real cohort evidence shows the loop itself is wrong |
| First cohort is intentionally small (roughly 8–10) and gets the whole product loop | **BUILD / LOCKED** | operational/security reality makes one part unsafe to expose |
| REKT/Chibi provide origin culture/aesthetic/distribution, not mandatory project subject matter | **LOCKED** | explicit brand/IP strategy changes |
| INK(CUBATOR) owns zero→working artifact; official Ink programs, if any, are separate and never promised | **LOCKED** | an explicit official partnership/contract changes the relationship |
| Command Center is the core logged-in surface | **BUILD** | user testing shows another surface consistently better answers what/where/next/help |
| One dominant Next Move is a core UX principle | **BUILD** | testing shows it obscures rather than reduces complexity |
| Mission tracks ship progress, not a full backlog/task manager | **LOCKED** | founding users cannot succeed without internal task management and external integrations are insufficient |
| Player/Project persist across Rounds | **LOCKED** | product moves away from persistent-world thesis |
| Failure remains history; later resurrection may link rather than rewrite | **BUILD MODEL / UI MAY STAGE** | data model proves unnecessarily costly before use |

## Truth/gamification decisions

| Decision | Status | Reopen only if |
| --- | --- | --- |
| `CLAIM → OBSERVATION → PROOF` is the authoritative truth model | **LOCKED** | a stronger model is documented without weakening participant-cheat resistance |
| Participant-controlled SDK/MCP cannot create PROVEN | **LOCKED / KILL INVARIANT** | never without redefining proof itself |
| No editable/universal XP score in MVP | **LOCKED** | cohort evidence shows a need and anti-gaming semantics are defined first |
| Cheevos reward meaningful state transitions, not engagement volume | **LOCKED** | never for raw login/comment/follow/screen-time farming |
| Assists are the primary reputation-bearing help primitive | **BUILD** | users cannot understand/use it or a simpler evidence-bearing social primitive outperforms it |
| Contextual/seasonal boards beat one universal hierarchy | **BUILD** | cohort evidence strongly supports another model without engagement gaming |
| Cosmetics/status may express earned history without pay-to-win | **ALLOW / STAGE** | it creates harmful incentives or brand incoherence |

## Social decisions

| Decision | Status |
| --- | --- |
| Follow Player | **BUILD MVP** |
| Watch Project | **BUILD MVP** |
| Project-context comments/replies/reactions | **BUILD MVP, plain text first** |
| Help Beacon | **BUILD MVP** |
| Assist | **BUILD MVP** |
| Party/collaborators | **BUILD MVP** |
| External tester request/action | **BUILD MVP** |
| DMs | **DEFER** |
| Algorithmic global engagement feed | **KILL FOR MVP** |
| Reposts/quote-post economy | **DEFER/KILL UNLESS PRODUCT EVIDENCE** |
| Paid boosts | **KILL** |
| Fine-grained surveillance presence | **KILL** |

## Visual/UX decisions

| Decision | Status |
| --- | --- |
| Shared visual grammar is `FRAME / SIGNAL / THREAD / PORTRAIT / EVENT / ARTIFACT` | **LOCKED v0** |
| Three modes: BROADCAST / COCKPIT / ARTIFACT | **LOCKED v0** |
| Thread is the cross-product "röd tråd" | **LOCKED v0** |
| Acid green is scarce and semantic (proof/current/actionable) | **LOCKED** |
| V3 remains visual ancestry; do not generic-dashboard rewrite it | **LOCKED** |
| React Bits/Three effects have named atmospheric jobs only | **LOCKED** |
| Game language sits on top of familiar web interaction behavior | **LOCKED** |
| Five golden screens must prove design coherence before broad feature styling | **BUILD** |

## Frontend/tooling decisions

| Decision | Status | Notes |
| --- | --- | --- |
| React 19 + Vite 7 | **KEEP** | existing foundation |
| Node 24 LTS target | **ADOPT PLATFORM FOUNDATION** | replace current loose `>=20` |
| Base UI under custom `Ink*` wrappers | **ADOPT** | unstyled accessible primitives |
| CSS Modules + semantic custom properties | **ADOPT** | no Tailwind migration for convention |
| TanStack Router | **ADOPT WHEN AUTH APP ROUTING LANDS** | URL state only |
| TanStack Query | **ADOPT WHEN SERVER STATE LANDS** | server/cache state only |
| XState v5 | **SELECTIVE** | only complex workflows such as Mission/Ship state machines |
| Motion | **SELECTIVE** | state/navigation/ceremony, not atmosphere |
| React Bits Pro | **KEEP ONLY UNDER COMPLIANT LICENSE/PRIVATE BUILD BOUNDARY** | F0 cleanup required |
| R3F/Three | **KEEP BROADCAST ONLY** | never Command critical path by default |
| Storybook | **ADOPT** | executable visual system |
| Playwright + axe + visual snapshots | **ADOPT** | quality gates |
| Lucide + custom Ink glyphs | **ADOPT** | mundane vs domain icon split |
| Redux | **AVOID** | no demonstrated need |
| giant Zustand global store | **AVOID** | local/server/workflow state already partitioned |
| Next.js migration | **AVOID** | no problem solved today |
| Tailwind migration | **AVOID** | current visual identity would pay unnecessary rewrite cost |

## Backend/data decisions

| Decision | Status |
| --- | --- |
| Separate authenticated `inkubator-api` from existing market API trust zone | **LOCKED** |
| Fastify 5 | **KEEP/ADOPT** |
| PostgreSQL as one canonical DB | **LOCKED UNTIL BOTTLENECK** |
| Kysely as target thin SQL layer | **ADOPT AFTER FOUNDATION SPIKE** |
| Normal current-state tables + append-oriented history | **LOCKED** |
| Full event sourcing | **KILL** |
| Transactional outbox | **BUILD** |
| Simple Postgres job runner first | **BUILD** |
| pg-boss | **DEFER UNTIL QUEUE FEATURES JUSTIFY IT** |
| Redis | **DEFER/AVOID** |
| BullMQ | **DEFER/AVOID** |
| Kafka | **KILL FOR FORESEEABLE MVP** |
| Neo4j/graph DB | **KILL FOR MVP** |
| Elasticsearch/Algolia | **DEFER** |
| Vector DB | **DEFER UNTIL REAL RETRIEVAL REQUIREMENT** |

## Integration/security decisions

| Decision | Status |
| --- | --- |
| GitHub App over broad OAuth/PAT model | **LOCKED** |
| Minimum read permissions + repo selection initially | **LOCKED** |
| GitHub webhook signature + delivery dedupe | **LOCKED** |
| Private source → explicit public projection | **LOCKED / KILL INVARIANT** |
| Trusted worker never executes participant repository code | **LOCKED** |
| Arbitrary URL/build verifier is isolated trust zone | **LOCKED** |
| Server-side secure session cookies for browser MVP | **TARGET** |
| Resource-specific deny-by-default authorization | **LOCKED** |
| AI/Daemon advisory-only | **LOCKED** |
| Operator/OPS surface required before founding cohort | **BUILD** |
| Moderation seam required before social launch | **BUILD** |

## Build/release decisions

| Decision | Status |
| --- | --- |
| `npm ci` in production verification | **LOCKED** |
| floating critical `@latest` tools in release CI | **KILL** |
| CI writes generated source/build output back to source branch | **KILL FOR PRODUCTION PIPELINE** |
| minimum workflow permissions | **LOCKED** |
| Actions pinned immutably for release/security-sensitive paths | **TARGET** |
| short-lived/OIDC deploy credentials where supported | **TARGET** |
| public SDK publishing through npm Trusted Publishing/provenance | **TARGET** |
| release provenance is useful only if verified/used | **LOCKED PRINCIPLE** |
| Nix/Bazel/hermetic-build platform | **DEFER** | only if normal pinned npm/Vite build cannot meet reproducibility contract |

## DevKit decisions

| Decision | Status |
| --- | --- |
| TypeScript SDK at launch | **BUILD MVP** |
| `rekt` CLI at launch | **BUILD MVP** |
| MCP bridge at launch | **BUILD MVP** |
| tiny React/embed surface | **BUILD IF IT STAYS SMALL** |
| Python/Go SDKs | **DEFER** |
| generated transport + hand-designed domain wrapper | **LOCKED APPROACH v0** |
| package SemVer separated from domain semantic versions | **LOCKED** |
| browser/server package authority separated | **LOCKED** |
| one God API key | **KILL** |
| mutation idempotency | **LOCKED** |
| local CLI/MCP authoritative state | **KILL** |

## Reuse decisions

| Source | Decision |
| --- | --- |
| DaemonLink | **PORT PRINCIPLES/SELECT CODE** — bounded repo insight, receipts, dedupe, provenance; do not transplant Python topology wholesale |
| RekTrace | **PORT PRINCIPLES/SELECT CODE** — heartbeat, status, HTTP probe, observable outcomes |
| Cheevo | **PORT PRODUCT IDEA** — meaningful achievements; historical code not assumed authoritative |
| SPCM concept | **PORT LINEAGE IDEA** — decision/diff/test/outcome history; do not create dependency on unclear standalone system |
| FlowMend | **PORT UX/OPS IDEAS** — timelines, idempotency, job/audit concepts |

## Deferred idea bank — still compatible with North Star

These are not rejected; they are not MVP launch dependencies unless explicitly promoted:

- World graph/constellation;
- Build Replay;
- Graveyard/resurrection rich public UI;
- Rivalries;
- guilds/squads;
- REKT Radio/world narrator;
- richer AI Scope Surgeon/Mission Compiler;
- public telemetry SDK;
- onchain/EAS attestations;
- Farcaster distribution;
- safe richer artifact embeds;
- audio layer;
- sophisticated realtime presence.

## Decision-change protocol

To change a locked decision, add/update a canonical document and state:

1. prior decision;
2. evidence/problem;
3. new decision;
4. affected invariants/contracts;
5. compatibility/migration impact;
6. whether old behavior remains supported.

Do not reopen settled decisions because a new library, agent or design reference makes another approach look fashionable.