# REKT INK(CUBATOR) — Decision Register v0

**Status:** CANONICAL / LOCKED DECISIONS + REOPEN CRITERIA

**Locked:** 2026-09-06

This register prevents previously settled questions from silently reopening every session. It does not stop evidence-driven changes; it requires changes to be explicit.

**2026-09-08 surface/signal amendment:** [Surface Purpose V1](REKT_SURFACE_PURPOSE_V1.md) freezes primary presentation ownership; [Signal Grammar V1](REKT_SIGNAL_GRAMMAR_V1.md) constrains actual generated projections. These govern conflicting earlier surface, color, geometry, motion and renderer guidance, including historical guidance in the Current State/Gap map. Backend/domain invariants are unchanged. G1–G3 below record the controlled changes; no production UI build resumes through this amendment.

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
| Thread is the cross-product "röd tråd": durable causal/temporal continuity, not a mandatory literal rail | **LOCKED / G3 CLARIFICATION** |
| ACID GREEN = PROVEN ONLY; earlier proof/current/actionable overload superseded | **LOCKED / G2** |
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

## Surface purpose + signal grammar amendments — 2026-09-08

Author-supplied decisions from the completed research/red-team process, reconciled against the generated client and runtime at approved PROJECT head 063eface55a75dda773647ece5df97eda847ed99. The documentation branch starts from that head; later WORLD descendants are evidence only.

### G1 — WORLD RADAR SUPERSESSION

- PRIOR: Instrument OS V1 designated Radar a canonical WORLD primitive and network-radar direction.
- EVIDENCE: current WorldSignalView and public discovery contracts contain no canonical spatial/graph relationship data. Candidate d781bf21c1ebcb438a5b083a8f496114118bdd80 used arbitrary/hash-derived project geometry; technical checks passed but visual review rejected the implied spatial relations.
- NEW: semantic-free radar is prohibited for production WORLD. WORLD uses temporal/event semantics until a future canonical relationship projection justifies spatial geometry. Decorative structure remains allowed when it does not masquerade as information.
- BASELINE GAP: the approved repository still contains legacy LiveWorld hash-positioned radar geometry and continuous sweep behavior. This is noncompliant legacy implementation evidence, not a permitted production exception; removal or hard-blocking requires a later authorized source pass.
- IMPACT: frontend purpose/visual authority only; no backend invariant, public contract or truth ceiling changes. The rejected visual behavior is not supported production direction; existing source is untouched in this docs pass.
- OPEN: WORLD final topology remains unresolved pending A/B/C: PURE SIGNAL TAPE; NOW / DISPATCH + SIGNAL TAPE; RECEIVER / EXPRESSIVE ARRIVAL + SIGNAL TAPE. All share a truthful temporal backbone; no Signal Tape composition is frozen as winner.
- EXPERIMENT BOUNDARY: f6a87546e3e6588db812744797a6e795d9672a58 is the isolated synthetic physics comparison, not production authority. Real collision physics showed no clear added value; Matter production inclusion is not justified.

### G2 — ACID GREEN

- PRIOR: proof/current/actionable shared acid green in the visual register and Signal System V0.
- PROBLEM: epistemic proof and ordinary interaction/current state shared one color.
- NEW: ACID GREEN = PROVEN ONLY. Current/actionable state uses hierarchy, locus, typography, geometry, focus/affordance and glyphs, without borrowing proof-green.
- BASELINE GAP: legacy visible surfaces may still use acid green for buttons, active state or ambient accents. Those uses are noncompliant with G2 and remain an implementation sweep item; this docs amendment does not silently grandfather them.
- IMPACT: visual semantic sweep required as future implementation work; no source/token changes here. Backend proof mechanisms remain unchanged. Earlier green-for-current/actionable behavior is superseded, not an allowed compatibility mode.

### G3 — THREAD CLARIFICATION

- PRIOR: Thread is the cross-product "röd tråd"; rail examples and ThreadRail primitives suggested a literal rendering.
- EVIDENCE: the locked register defines continuity without requiring a horizontal rail; surface continuity includes mission gates, project causes, public time, builder history and Ship lineage.
- CLARIFICATION: THREAD = durable causal/temporal continuity. A literal horizontal rail is not required; a truthful rail remains one valid rendering.
- IMPACT: no backend invariant or contract change. Preserve Thread semantics and compatible material identity; do not force a common topology across surfaces.

The approved PROJECT head remains frozen. PLAYER/SHIP navigation prominence is OPEN and their builds are not authorized. The WORLD composition experiment is authorized as the next bounded comparison, not implemented here. This amendment does not invoke or resume the formal Phase-9 broad hostile review.
