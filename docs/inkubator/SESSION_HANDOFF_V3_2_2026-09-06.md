# SESSION HANDOFF

## 0. Handoff metadata

```text
handoff_version: 3.2
generated_at: 2026-09-06T22:50:00+02:00

active_project:
REKT INK(CUBATOR) — Founding-Cohort MVP

active_repository:
CipherCuttle/rekt-terminal

related_repositories:
- CipherCuttle/daemonlink — reuse/reference only; no mutation authority implied
- CipherCuttle/Rektrace — reuse/reference only; no mutation authority implied
- CipherCuttle/FlowMend — reuse/reference only; no mutation authority implied
- Cheevo/SPCM lineage — conceptual/reuse reference; not canonical product authority

active_phase:
INKUBATOR_MVP_SCOPE_AUTHORITY_FREEZE_V0

phase_state:
HOSTILE_REVIEW

handoff_mode:
CLOSE_AUTHORITY_FREEZE → START_PLATFORM_FOUNDATION_V0

source_memory_refresh:
COMPLETE

source_git_refresh:
INCOMPLETE
Reason: this source orchestrator refreshed remote GitHub state directly but did not inspect the user's live local worktree/filesystem.

source_remote_refresh:
COMPLETE

source_evaluator_refresh:
NOT_REQUIRED

freshness_warning:
Remote GitHub state below was current when this handoff was compiled. The receiving orchestrator MUST reconcile live local Git and current remote PR/branch state read-only before mutation. Do not treat this handoff as proof that volatile state is unchanged.
```

---

## 1. Control capsule

### Mission

[V] REKT INK(CUBATOR) is now defined as a persistent multiplayer builder world, not a challenge-submission page and not a generic incubator. The locked founding-cohort MVP is the complete loop `BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER → REPEAT`, with persistent Player identity, Mission/Project command center, truthful evidence/progress, collaboration/Assists, meaningful Cheevos, Ship Receipts, reputation/history, and launch DevKit surfaces.

[V] The canonical product authority now lives under `docs/inkubator/`. The implementation must make the underlying work more legible, social and rewarding without becoming Jira-with-XP, LinkedIn-for-builders, or a fake MMO.

### Current state

1. [V] PR #29 is open/draft/mergeable and remains the first implemented protocol-backed slice, not the full MVP. Its recorded head before the docs freeze is `623e73ebeb8bab22533b8c38362fe9c2c84b2147`.
2. [V] PR #29 implements Round/Player/Ship Receipt schemas, deterministic receipt digesting, generated development-fixture public state, Player/receipt V3 preview, protocol tests, V3 tests, bundle/Lighthouse gates, and claim-discipline (`SUPPLIED`, not fake `PASS`).
3. [V] A docs-only authority freeze was created at commit `65a852f750bac3fed5cd8940b88d26bc37adda31` on `docs/inkubator-mvp-north-star-v0` and opened as draft PR #30 against `feature/inkubator-protocol-v0`.
4. [V] PR #30 was open/draft/mergeable at source refresh and contains 9 canonical Inkubator docs plus 2 historical React Bits documentation corrections, with no runtime/source implementation changes.
5. [V] `docs/inkubator/INDEX.md` defines authority order: North Star → Product Contract → Architecture Constitution → Signal System → DevKit Contract → Current State/Gap → Roadmap → Decision Register.
6. [V] The product/architecture scope now explicitly includes the SDK/CLI/MCP DevKit as launch MVP, while participant-controlled clients remain unable to manufacture `PROVEN` truth, grant Cheevos or approve Ships.
7. [V] Platform-foundation debt is explicitly recorded before broad product implementation: React Bits/public-source/build boundary, deterministic CI, Node 24 LTS target, separate authenticated Inkubator API, Postgres/session/auth/public-projection foundation, GitHub App trust adapter, idempotent background work.
8. [I] The highest-value next uncertainty is no longer product ideation. It is whether the frozen documentation accurately captures all agreed scope/invariants without contradiction; after that, implementation should move to the bounded Platform Foundation phase.

### Current blocker

ONE independent hostile review of the docs-only MVP authority candidate PR #30 has not yet been recorded.

### Immediate next action

Perform exactly ONE independent hostile review of PR #30 against the canonical scope captured in this handoff and the source repository state. Attack omissions, contradictions, authority leakage, accidental scope narrowing/expansion, and any documentation that would cause the next implementation phase to violate the agreed MVP. Do not restart product brainstorming.

### Success condition

Either:

- no Critical/High defect is found and PR #30 is a coherent authority candidate; or
- Critical/High documentation defects are repaired inside this phase, followed by at most ONE targeted re-review of those repairs.

The output must leave one unambiguous authority set for the next orchestrator and one next phase: `PLATFORM_FOUNDATION_V0`.

### Stop / kill condition

Stop and escalate rather than mutate if reconciliation shows material remote/local drift, PR #30 no longer represents the docs-only candidate described here, or a proposed repair would materially redefine the MVP rather than correct documentation of already-agreed decisions.

### Current verdict

```text
PROCEED
```

---

## 2. Phase contract

```text
PHASE:
INKUBATOR_MVP_SCOPE_AUTHORITY_FREEZE_V0

OBJECTIVE:
Freeze the complete founding-cohort MVP, product semantics, visual constitution,
architecture constitution, DevKit contract, gap map, decisions and implementation
order as canonical Git authority before broad implementation continues.

STATE:
HOSTILE_REVIEW

SCOPE:
- docs/inkubator/* canonical authority
- correction of historical Inkubator docs that contradict current authority
- exact current-state/gap mapping
- product/architecture/visual/DevKit invariants
- implementation sequencing and stop rules

OUT_OF_SCOPE:
- product runtime implementation
- auth/database/API implementation
- verifier implementation
- broad UI redesign
- new gameplay/social mechanics beyond recording agreed scope
- merging PR #29 or PR #30 without explicit authority
- changing unrelated REKT Terminal trading/game systems

REQUIRED_GATES:
- canonical docs exist and are mutually coherent
- full agreed MVP is preserved, not reduced to PR #29
- implemented vs proposed state is clearly separated
- trust/build/semantic/system-surface invariants are explicit
- one independent hostile review
- Critical/High findings fixed
- at most one targeted re-review if Critical/High fixes are made
- docs-only diff preserved

HOSTILE_REVIEW_BUDGET:
1

RE_REVIEW_BUDGET:
maximum 1, only if Critical/High repairs are required

FIX_BUDGET:
bounded documentation repair only; no product implementation

EVALUATOR_APPLICABILITY:
NOT_APPLICABLE

EVALUATOR_CONTRACT:
NONE

EVALUATOR_RESULT_REQUIRED_FOR_CLOSURE:
NO

EVALUATOR_EXECUTION_AUTHORITY:
NO

EVALUATOR_RESULT:
NOT_APPLICABLE

EVALUATOR_SCORED_RUN_BUDGET:
0

EVALUATOR_INFRA_RETRY_BUDGET:
0

CLOSURE_CRITERIA:
- hostile review budget consumed exactly once
- no unresolved Critical/High authority defect
- any required targeted re-review completed once
- PR #30 remains documentation-only and coherent
- exact next phase is PLATFORM_FOUNDATION_V0

KILL_CRITERIA:
- fixing PR #30 would require redefining the agreed MVP instead of documenting it
- authority cannot be reconciled with live repo state
- product/runtime changes are required merely to close the docs phase

REOPEN_TRIGGERS:
- new direct evidence that canonical docs materially misstate an agreed invariant
- newly discovered Critical/High contradiction that would cause incorrect continuation
- user explicitly changes the MVP/product authority

DEFERRED_FINDINGS:
all runtime/product implementation, Platform Foundation execution, visual component implementation, social feature implementation, DevKit implementation

NEXT_UNCERTAINTY_AFTER_CLOSURE:
Can the minimum Platform Foundation install clean trust/build/semantic guardrails and prove one Player → Mission → GitHub observation vertical slice without becoming a platform rewrite?
```

Current phase status:

```text
OPEN
```

---

## 3. Authority, scope, and permissions

### Latest operative instruction

[U] The user explicitly approved essentially all decisions in this planning session and asked to preserve the now-locked scope in Git, then requested a v3.2-style handoff that hydrates the next orchestrator in all decisions.

### MUST

- Treat `docs/inkubator/INDEX.md` and its authority order as the canonical product source once PR #30 is accepted/merged.
- Preserve the full founding-cohort MVP; do not silently collapse it to a thin submission MVP.
- Preserve the distinction `CLAIM → OBSERVATION → PROOF`.
- Keep AI/Daemon advisory rather than authoritative.
- Keep private source observations separate from explicit public projections.
- Keep the authenticated Inkubator API trust boundary separate from the existing permissive market-data API.
- Use modular-monolith-first architecture; split processes only for real trust/scaling/availability boundaries.
- Use one Postgres until observed evidence forces another datastore.
- Preserve semantic versions of persisted contracts/events/achievement rules/receipt meaning.
- Make DevKit credentials narrow and scoped; SDK/CLI/MCP can submit claims/context/actions but not grant proof/achievements/Ship approval.
- Preserve the visual `röd tråd`: THE THREAD across BROADCAST / COCKPIT / ARTIFACT modes.
- Preserve performance/a11y discipline and reduced-motion behavior.
- Keep REKT/Chibi as origin culture and distribution/aesthetic DNA, not mandatory subject matter for every build.
- Preserve old REKT Terminal trading/game systems unless a later explicit phase targets them.

### MUST NOT

- Reopen completed V3 visual/performance work merely because more polish is imaginable.
- Treat PR #29 as the complete MVP.
- Build auth into the existing public market API.
- Let participant-controlled SDK/MCP/browser code create authoritative proof, reputation or achievement grants.
- Execute participant repositories in the trusted worker/API.
- Expose private GitHub content by raw-object serialization.
- Add Redis, Kafka, Neo4j, Elasticsearch, a second database, microservices or generalized event-sourcing infrastructure without observed need.
- Migrate to Next.js/Tailwind/Redux/GraphQL merely for convention.
- Build a universal engagement XP economy or reward logins/comments/follows directly.
- Treat likes/follows/comments as proof of meaningful collaboration.
- Turn Inkubator into a task-management backlog product.
- Let React Bits Pro licensed implementation source become a casually committed public dependency boundary.
- Introduce `@latest` build dependencies into the production verification path.
- Merge or publish merely because a candidate commit exists.

### PREFER

- Node 24 LTS; React 19 + Vite 7; Fastify 5; TypeScript strict.
- Base UI for accessible behavior under custom REKT components.
- CSS Modules/custom properties and semantic design tokens; no Tailwind migration.
- TanStack Router for URL state; TanStack Query for server state; XState only for real workflow machines.
- Motion for purposeful DOM transitions; React Bits/Three isolated to atmospheric Broadcast surfaces.
- Storybook + Playwright + axe + existing Lighthouse/bundle budgets.
- PostgreSQL with a thin typed SQL layer; Kysely is the current preferred candidate, but library choice remains subject to a bounded compatibility spike rather than ideology.
- REST/OpenAPI/JSON Schema at boundaries; generated client typing rather than duplicate handwritten DTOs.
- Simple Postgres transactional outbox/worker first; add pg-boss only if its features become necessary.
- GitHub App + Octokit with read-minimal selected-repo permissions and signed/idempotent webhook ingestion.
- Opaque secure server sessions rather than browser-stored JWTs.

### Repository authority matrix

| Resource | Read | Modify | Execute | Network | Commit | Push | Merge/PR | Authority source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CipherCuttle/rekt-terminal` canonical/runtime branches | YES | CONDITIONAL | CONDITIONAL | CONDITIONAL | CONDITIONAL | CONDITIONAL | NO merge unless explicit | current user instruction + phase scope |
| `docs/inkubator-mvp-north-star-v0` / PR #30 | YES | YES for bounded docs repair | NO runtime execution required | YES read-only GitHub | YES if repair needed | YES to same docs branch if repair needed | NO merge unless explicit | current docs phase |
| `feature/inkubator-protocol-v0` / PR #29 | YES | NO by default in docs phase | NO | YES read-only GitHub | NO | NO | NO | frozen PR #29 scope |
| daemonlink/RekTrace/FlowMend reference repos | YES read-only when relevant | NO | NO | YES read-only GitHub | NO | NO | NO | reuse research only |

Unknown mutation authority defaults to NO.

---

## 4. Evidence register

| ID | Claim | Status | Observed at | Evidence pointer | Freshness/conflict |
| --- | --- | --- | --- | --- | --- |
| E01 | PR #29 is open/draft and is the protocol/receipt implementation slice | [V] | 2026-09-06 source refresh | GitHub PR #29 metadata/body | volatile; receiver refresh |
| E02 | PR #29 recorded head before docs work is `623e73e...` | [V] | 2026-09-06 | GitHub PR #29 metadata | volatile; receiver refresh |
| E03 | docs authority candidate commit is `65a852f...` | [V] | 2026-09-06 22:42 CEST | GitHub branch `docs/inkubator-mvp-north-star-v0` | handoff branch is based on this candidate |
| E04 | PR #30 is docs-only, 11 files, and was mergeable/draft | [V] | 2026-09-06 source refresh | GitHub PR #30 metadata + compare | volatile; receiver refresh |
| E05 | `docs/inkubator/INDEX.md` defines authority order and full-MVP shorthand | [V] | 2026-09-06 | file on docs branch | stable at candidate SHA |
| E06 | v3.2 handoff compiler requires state/provenance/authority/phase/stopping rules rather than chronological summary | [V] | 2026-09-06 | recovered pinned v3.2 compiler from prior saved artifact | compiler frozen unless real continuation failure |
| E07 | user approves the broad Player/Mission/Daemon/Assist/Cheevo/Ship/DevKit MVP direction | [U] | this session | direct user instructions | product intent, now documented in Git |
| E08 | local worktree state is unknown to this source orchestrator | [?] | 2026-09-06 | no local filesystem bootstrap performed | receiver MUST reconcile read-only |

---

## 5. Repository snapshot

| Project | Path | Worktree | Branch | HEAD | Status | Upstream | Observed at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REKT Terminal remote implementation slice | remote GitHub | unknown local | `feature/inkubator-protocol-v0` | `623e73ebeb8bab22533b8c38362fe9c2c84b2147` at last explicit PR snapshot | PR #29 open/draft | base `concept/inkubator-dossier-polish-v2` | 2026-09-06 |
| Inkubator authority candidate | remote GitHub | unknown local | `docs/inkubator-mvp-north-star-v0` | `65a852f750bac3fed5cd8940b88d26bc37adda31` | PR #30 open/draft/mergeable at last refresh | base `feature/inkubator-protocol-v0` | 2026-09-06 22:42 CEST |
| This handoff artifact | remote GitHub | N/A | handoff branch containing this file | resolve live | point-in-time checkpoint only | based on docs candidate | 2026-09-06 22:50 CEST |

Material frozen artifacts:

- `docs/inkubator/INDEX.md`
- `docs/inkubator/NORTH_STAR_MVP_V0.md`
- `docs/inkubator/PRODUCT_CONTRACT_MVP_V0.md`
- `docs/inkubator/ARCHITECTURE_CONSTITUTION_V0.md`
- `docs/inkubator/REKT_SIGNAL_SYSTEM_V0.md`
- `docs/inkubator/DEVKIT_CONTRACT_V0.md`
- `docs/inkubator/CURRENT_STATE_AND_GAP_V0.md`
- `docs/inkubator/IMPLEMENTATION_ROADMAP_MVP_V0.md`
- `docs/inkubator/DECISION_REGISTER_V0.md`

Historical references only:

- `docs/INKUBATOR_REACT_BITS_REBUILD_PLAN.md`
- `docs/REACT_BITS_PRO_SWAP.md`

Do not infer local clean/dirty status from remote GitHub.

---

## 6. Remote state

```text
REMOTE_STATE_STATUS:
COMPLETE_AT_SOURCE_SNAPSHOT

REMOTE_QUERY_METHOD:
GitHub connector/API read-only inspection

REMOTE_BRANCH_OR_PR:
PR #29 / feature/inkubator-protocol-v0
PR #30 / docs/inkubator-mvp-north-star-v0

REMOTE_HEAD_OR_MERGE_SHA:
PR #29 head at recorded snapshot: 623e73ebeb8bab22533b8c38362fe9c2c84b2147
PR #30 authority candidate before this handoff branch: 65a852f750bac3fed5cd8940b88d26bc37adda31

REMOTE_OBSERVED_AT:
2026-09-06

REMOTE_AUTHORITY:
read-only factual evidence; not merge authority
```

---

## 7. Active decisions and invariants

| ID | Decision / invariant | Status | Rationale | Revisit trigger |
| --- | --- | --- | --- | --- |
| D01 | MVP is the complete founding-cohort loop, not thin profiles/submissions | ACTIVE | user explicitly approved full loop | explicit product-scope change with evidence |
| D02 | First 8–10 users should experience the whole psychological/product loop | ACTIVE | learn from real cohort while preserving complete value proposition | founding cohort evidence falsifies the loop |
| D03 | Persistent Player survives Rounds; Project can survive Rounds | ACTIVE | enables history/reputation/world continuity | user changes product identity |
| D04 | Command Center is the logged-in killer surface | ACTIVE | answers goal/state/blocker/next move/who can help | usability evidence contradicts it |
| D05 | THE THREAD is the cross-surface visual grammar | ACTIVE | creates the requested visual `röd tråd` | user testing shows confusion/monotony not repairable within grammar |
| D06 | Visual modes = BROADCAST / COCKPIT / ARTIFACT | ACTIVE | coherence without identical composition | evidence shows modes fail core usability |
| D07 | Acid green means real/current/actionable/proven signal, not decoration | ACTIVE | semantic truth color | accessibility/brand redesign explicitly supersedes it |
| D08 | Daemon answers what changed / where are we / blocker / next move; AI advisory only | ACTIVE | useful feedback without fake authority | deterministic product contract changes |
| D09 | Progress is dimension/state based, not fake precision percentage | ACTIVE | avoids false mathematical certainty | later measured model earns explicit semantics |
| D10 | `CLAIM → OBSERVATION → PROOF` is mandatory | ACTIVE | protects product trust and DevKit anti-cheat | explicit architecture/product contract revision |
| D11 | Assists represent materially useful help; raw comments/follows do not earn rank | ACTIVE | social network around creation rather than engagement farming | cohort evidence falsifies mechanism |
| D12 | Multiple contextual leaderboards; no universal XP | ACTIVE | reduce gaming and preserve multiple valuable archetypes | explicit reputation redesign |
| D13 | Cheevos celebrate meaningful state transitions, not screen time | ACTIVE | gamification serves building, not clicks | user research contradicts reward model |
| D14 | Graveyard/resurrection/build replay are in product direction; implementation timing follows roadmap | ACTIVE / later slice | turn failure/history into culture | MVP scheduling changes |
| D15 | SDK + CLI + MCP are launch pillars | ACTIVE | plugs actual builder workflow into the world | clear launch-cost evidence forces explicit deferral |
| D16 | Participant clients cannot create PROVEN, grant achievement, approve Ship, change rank | ACTIVE | existential trust boundary | never casually revisit |
| D17 | Modular monolith first; separate hostile verifier trust zone later | ACTIVE | smallest systems surface with real security separation | observed scaling/security need |
| D18 | Separate authenticated Inkubator API from market API | ACTIVE | different trust model | only revisit with formal threat-model evidence |
| D19 | One Postgres; normal state + append-oriented history; not full event sourcing | ACTIVE | sufficient scale and simpler operations | observed bottleneck |
| D20 | Private GitHub source → explicit public projection | ACTIVE | privacy/trust boundary | never casually revisit |
| D21 | GitHub App primary technical sensor; selected repo, least privilege | ACTIVE | low-friction evidence with narrow access | integration requirements change |
| D22 | Never execute participant repos in trusted process | ACTIVE | arbitrary-code boundary | dedicated sandbox phase only |
| D23 | Platform Foundation is a floor, not a platform project | ACTIVE | prevent architecture scope creep | actual blocker requires expansion |
| D24 | Reuse daemonlink/RekTrace/FlowMend primitives, not whole deployment stacks | ACTIVE | leverage existing work without architectural transplantation | detailed spike proves direct reuse cleaner |

---

## 8. Work ledger

### Completed

Item: V3 public concept/design baseline

Change: Six-beat REKT broadcast dossier with controlled React Bits roles, real media fallbacks and performance discipline.

Evidence: frozen predecessor checkpoint `ad709826adf0660e6d331a67c3073fb0219b7d8c` as recorded in PR #29 lineage.

Verification: prior closed V3 design/performance phase.

Remaining caveat: licensed React Bits/public-source/build handling requires Platform Foundation cleanup.

---

Item: Protocol + Ship Receipt vertical slice

Change: executable JSON Schema Round/Player/Ship Receipt contracts, deterministic digest, fixture compiler, V3 protocol preview, Player seam, truthful evidence labels.

Evidence: PR #29 and recorded CI run in its body.

Verification: recorded protocol 6/6, React 13/13, build/budget PASS, Lighthouse 99/100/100/100.

Remaining caveat: PR #29 remains draft/unmerged unless live state has since changed.

---

Item: Product/architecture brainstorming consolidation

Change: transformed broad ideation into explicit product/UX/architecture/SDK decisions.

Evidence: canonical docs candidate `65a852f...`.

Verification: docs compare showed 9 new canonical docs + 2 historical corrections, no runtime source changes.

Remaining caveat: one hostile docs review still required.

---

Item: v3.2 session handoff

Change: this point-in-time continuation checkpoint adapted from the frozen high-fidelity v3.2 compiler.

Evidence: this document.

Verification: receiver must reconcile volatile Git/PR state rather than trusting it blindly.

Remaining caveat: local worktree state unknown.

### In progress

- PR #30 authority-freeze hostile review/closure.

### Deferred findings

Finding: React Bits Pro implementation-source/public-repo and CI build-input boundary.
Severity: High platform-foundation concern, not a docs-scope implementation defect.
Why it does NOT block the current docs phase: the authority docs explicitly record it as F0 cleanup; no runtime change is authorized in this phase.
Target phase/backlog: `PLATFORM_FOUNDATION_V0 / F0`.

Finding: current CI uses mutable/latest-style build tooling and write-capable generated commits.
Severity: High platform-foundation concern.
Why it does NOT block the current docs phase: accurately recorded as required next-phase work.
Target phase/backlog: `PLATFORM_FOUNDATION_V0 / F0`.

Finding: current market API trust model is unsuitable for auth/private Inkubator state.
Severity: High architecture boundary.
Why it does NOT block the docs phase: frozen decision is to create a separate authenticated Inkubator API.
Target phase/backlog: `PLATFORM_FOUNDATION_V0 / F1`.

### Failed attempts worth preserving

Attempt: create isolated handoff branch through connector.
Observed result: multiple inert duplicate branch refs were accidentally created from the same docs candidate SHA while loading connector actions.
Supported cause/hypothesis: source orchestrator tool-call setup error; no files/commits were added to those duplicate refs.
Lesson: receiver should use the branch containing `docs/inkubator/SESSION_HANDOFF_V3_2_2026-09-06.md`; duplicate empty refs are not authority.
Retry condition: none. Delete inert duplicate refs later if convenient; do not let branch cleanup block product work.

---

## 10. Closure analysis

```text
Are all frozen phase acceptance criteria satisfied?
NO — hostile review not yet recorded.

Has the allocated independent hostile review occurred?
NO.

Were all Critical/High findings fixed?
NOT YET APPLICABLE; no review findings yet.

If Critical/High fixes occurred, has the single permitted targeted re-review occurred?
NOT APPLICABLE.

Do any unresolved Medium findings actually falsify the phase objective?
NONE ESTABLISHED.

Is there any valid reopen trigger?
NO; phase is still OPEN.

Would another verification cycle resolve a genuinely new uncertainty?
Only the one hostile docs review. Additional broad review after that would not be justified absent Critical/High repair.

Has an immutable candidate commit been created if required?
YES — docs authority candidate 65a852f750bac3fed5cd8940b88d26bc37adda31.

External evaluator applicability?
NOT_APPLICABLE.
```

Closure verdict:

```text
KEEP OPEN
```

Reason: consume the single hostile docs review; do not add more verification layers.

---

## 11. Continuation-critical technical context

### Canonical product loop

```text
BECOME
→ DECLARE
→ BUILD
→ PROVE
→ HELP
→ SHIP
→ REMEMBER
→ REPEAT
```

Durable model:

```text
PLAYER
→ MISSION
→ PROJECT
→ EVIDENCE
→ PROGRESS / NEXT MOVE
→ ASSIST / PARTY
→ SHIP
→ REPUTATION / HISTORY
```

Foundational conceptual verbs:

```text
DECLARE / BUILD / PROVE / HELP / SHIP / PULL
```

### Product surfaces

```text
WORLD
public Broadcast / discovery / Round / active builders / ships / signals

COMMAND
personal cockpit; Mission, next move, Thread, blocker, party, activity

PROJECT ROOM
shared build context; goal, milestones, updates, help, evidence, collaborators

PLAYER
persistent identity + current mission + career/ship/assist history

SHIP / ARTIFACT
quiet artifact-first presentation + receipt/evidence/history

OPS
boring operator surface for rounds, moderation, webhook/job/evidence inspection
```

### Visual constitution

```text
THE THREAD
is the continuity grammar across Round, Mission, Project, Player career,
Ship evidence, Graveyard/Resurrection and Build Replay.

MODES
BROADCAST = expressive atmosphere
COCKPIT   = calm operational instrument
ARTIFACT  = quiet, artifact dominant

SIGNAL TRUTH
UNKNOWN / CLAIMED / ACTIVE / PROVEN / ATTENTION / BLOCKED / STALE
```

### Daemon

Purpose:

```text
WHAT CHANGED?
WHERE ARE WE?
WHAT IS BLOCKED?
WHAT IS THE NEXT MOVE?
```

Daemon may summarize/recommend/propose. It may not grant proof, authoritative progress, Cheevos, Ship approval, permissions or public exposure of private data.

### Social/reputation

- follow Player and watch Project are discovery primitives;
- comments/reactions remain social context, not reputation currency;
- `ASSIST` is the material-help primitive;
- accepted Assists can contribute to reputation;
- multiple contextual leaderboards: shippers, assists, collaboration, comeback, proven pulls, etc.;
- no universal engagement XP;
- Player traits/archetypes should emerge from behavior where possible;
- Help Beacon / distress signal makes stalled work discoverable;
- spectators can test builds and produce external-use evidence;
- dead projects may enter Graveyard and later be resurrected with lineage.

### DevKit

Launch target:

```text
@rekt-ink/protocol
@rekt-ink/sdk
@rekt-ink/cli
@rekt-ink/mcp
@rekt-ink/react (small badge/embed surface)
```

Example intended UX:

```text
npx @rekt-ink/cli init
rekt status
rekt mission
rekt next
rekt update
rekt beacon
rekt claim
rekt ship
rekt doctor
```

MCP resources/tools should expose Mission/project context and safe player actions to coding agents, but no operator/proof authority.

DevKit invariant:

```text
more integration ≠ more authority over truth
```

### Architecture target

```text
WEB
  ↓
INKUBATOR API  ─── GitHub App adapter
  ↓
POSTGRES
  ↓
OUTBOX / SMALL WORKER

Future hostile URL/build verification:
ISOLATED VERIFIER
NO DB CREDS
NO GITHUB PRIVATE KEY
NO REPO WRITE
narrow evidence result only
```

`apps/api` existing market API remains a separate trust domain.

### Platform Foundation sequence

```text
F0 BUILD/TRUST CLEANUP
React Bits boundary
Node 24
pinned deterministic read-only CI
no @latest production verification path

F1 IDENTITY/DATA BOUNDARY
dedicated inkubator-api
Postgres
opaque secure sessions
deny-default resource authorization
public/private projections

F2 CONTRACT/EVENT SPINE
versioned JSON Schema/OpenAPI
normal state tables + append-oriented history
transactional outbox
idempotent small worker

F3 GITHUB APP
selected repo / read-minimal permissions
signed webhook
GitHub delivery dedupe
one normalized repo observation

F4 VERTICAL PROOF
Player → Mission → GitHub repo → observation → safe project state

STOP PLATFORM WORK
return to visible product slices
```

### Library/tool direction

Current preferred stack to validate, not ideology:

```text
Node 24 LTS
TypeScript strict
npm workspaces
React 19
Vite 7
Fastify 5
PostgreSQL
Kysely candidate
Base UI
CSS Modules + CSS custom properties
TanStack Router
TanStack Query
XState selectively
Motion selectively
React Bits/Three Broadcast-only
Lucide + custom Ink glyphs
Storybook
Vitest/Testing Library
Playwright
axe-core
Lighthouse/bundle budgets
Octokit / GitHub App
OpenAPI 3.1 + JSON Schema 2020-12 boundary contracts
```

Explicitly avoid until evidence requires:

```text
Redis
Kafka
Neo4j
graph DB
Elasticsearch
microservices
full event sourcing
Next.js migration
Tailwind migration
Redux/global-state cathedral
GraphQL
arbitrary participant repo execution
universal XP economy
```

---

## 12. Recommended continuation

### PLAN

1. Bootstrap from this handoff and the canonical docs candidate.
2. Reconcile current local Git and remote PR #29/#30 state read-only.
3. Perform exactly one independent hostile review of PR #30.
4. Repair only Critical/High documentation defects that materially threaten continuation correctness.
5. If C/H repairs occur, perform one targeted re-review only.
6. Close the authority-freeze phase when criteria pass.
7. Do not merge without explicit authority.
8. After docs authority is merged/otherwise made canonical, begin `PLATFORM_FOUNDATION_V0` as a fresh bounded implementation phase.

### CHANGESET

For the current phase:

```text
Only docs/inkubator/* and directly conflicting historical Inkubator docs may change.
No runtime/product source implementation.
```

Protected state:

- PR #29 implementation scope and verified evidence;
- V3 six-beat predecessor behavior/performance discipline;
- unrelated REKT Terminal trading/game packages;
- canonical docs decision set unless the hostile review finds a concrete C/H continuation defect.

### VERIFY

REQUIRED GATES:

```text
- live Git/remote reconciliation
- one hostile docs review
- no unresolved Critical/High continuation defect
- one targeted re-review only if C/H repair occurred
- docs-only diff remains docs-only
- full MVP remains preserved
- one unambiguous next phase remains PLATFORM_FOUNDATION_V0
```

OPTIONAL / DEFERRED CHECKS:

```text
- prose polish
- extra architecture research
- additional design reviews
- implementation spikes
- new libraries
- extra handoff documents
```

These must not become closure requirements.

### VERDICT

```text
PROCEED
```

### Rollback

If a docs repair causes material scope confusion, restore the PR #30 candidate to the last coherent authority commit and reapply only the smallest correction. Do not modify PR #29 to repair docs-phase problems.

### Information-gain justification

The one hostile review resolves a new uncertainty: whether the Git authority candidate faithfully preserves the agreed product/architecture/visual/DevKit decisions without contradiction. Once that is answered, another broad review would mostly add confidence rather than change the next decision.

---

## 13. Immediate next action

```text
READ docs/inkubator/INDEX.md AND ALL EIGHT AUTHORITY DOCUMENTS,
RECONCILE LIVE GIT/PR STATE READ-ONLY,
THEN PERFORM EXACTLY ONE INDEPENDENT HOSTILE REVIEW OF PR #30.
```

Do not begin Platform Foundation mutation before the authority candidate is reconciled and its bounded docs review is complete.

---

## 14. Risks and rollback

```text
Highest-risk live assumption:
That the docs candidate fully captures every scope decision from this planning session without an omission that materially changes implementation.

Main risk to existing WIP:
Accidentally modifying/reopening PR #29 or unrelated REKT Terminal systems while trying to establish the next architecture foundation.

Main scope-creep risk:
Platform Foundation becoming a generalized platform rewrite; additional databases/services/queues/security abstractions being added because they are imaginable rather than necessary.

Main verification gap:
PR #30 has not yet consumed its single independent hostile review.

Rollback:
Preserve PR #29 and V3 predecessor branches; docs-phase changes are isolated. Revert only the bounded docs candidate if necessary rather than rewriting implementation history.
```

Explicit anti-scope checks:

- no verification recursion;
- no review recursion;
- no documentation-of-documentation loop;
- no generalized event infrastructure;
- no microservice decomposition without trust/scale evidence;
- no DevKit authority creep;
- no AI-authority creep;
- no engagement-farming incentives;
- no silent private→public data flow;
- no React Bits licensed-source/public-repo contradiction left unresolved beyond Foundation F0.

---

## 15. Receiver bootstrap directive

The receiving orchestrator MUST:

```text
1. Read this handoff in full.
2. Read docs/inkubator/INDEX.md.
3. Read, in authority order:
   NORTH_STAR_MVP_V0.md
   PRODUCT_CONTRACT_MVP_V0.md
   ARCHITECTURE_CONSTITUTION_V0.md
   REKT_SIGNAL_SYSTEM_V0.md
   DEVKIT_CONTRACT_V0.md
   CURRENT_STATE_AND_GAP_V0.md
   IMPLEMENTATION_ROADMAP_MVP_V0.md
   DECISION_REGISTER_V0.md
4. Retrieve only relevant persistent project memory when available.
5. Inspect the active local repository read-only before mutation.
6. Query remote GitHub PR #29 and #30 state read-only because it materially affects continuation.
7. Keep LOCAL GIT STATE, REMOTE GITHUB STATE, HANDOFF STATE and MEMORY STATE separate.
8. Report only MATERIAL drift.
9. Reconcile; do not re-verify completed phases.
10. Preserve PR #29's completed implementation evidence and scope.
11. Consume exactly the remaining docs hostile-review budget.
12. Confirm mutation, execution, network, commit, push and merge authority separately.
13. Do not infer merge authority from an open/mergeable PR.
14. Continue using PLAN → CHANGESET → VERIFY → VERDICT.
```

Minimum read-only local Git preflight:

```text
git rev-parse --show-toplevel
git status --porcelain=v2 --branch
git branch --show-current
git rev-parse HEAD
git log -1 --decorate --oneline
git remote -v
git worktree list --porcelain
git diff --name-status
git diff --cached --name-status
git ls-files --others --exclude-standard
```

Do not use `git fetch` merely as bootstrap if a read-only GitHub query can establish remote state.

Mandatory preflight verdict before mutation:

```text
MEMORY_CHECK:
GIT_PREFLIGHT:
REMOTE_STATE_CHECK:
DRIFT_STATUS:

ACTIVE_PHASE:
PHASE_STATE:
PHASE_REOPEN_TRIGGER_PRESENT:

MUTATION_AUTHORITY:
SAFE_TO_PLAN:
SAFE_TO_MUTATE:
```

---

## 16. Anti-loop directive

Apply aggressively:

```text
A hypothetical product flaw is not evidence that the locked MVP must expand.

A possible extra library is not a required dependency.

A possible extra service is not a required service.

A possible extra database is not a required database.

A possible extra security layer is not automatically useful security.

A possible additional review is not a required review.

A cleaner document is not necessarily a more truthful document.

A possible SDK feature is not launch scope unless it supports the frozen DevKit contract.

A possible leaderboard metric is not permission to build universal XP.

An AI capability is not authority merely because it can infer something.

A participant-controlled event is not PROOF merely because it arrived through the SDK.

A public UI need is not permission to expose private GitHub observations.

A visually cool effect is not allowed without a named semantic job.

A candidate commit is not phase closure or merge authority.

Closed work remains closed until a real reopen trigger exists.
```

When tempted to add architecture, ask:

```text
What observed bottleneck, trust boundary or required product behavior forces this system now?
```

If none:

```text
DO NOT ADD IT.
```

When tempted to reopen brainstorming, ask:

```text
What current canonical decision is contradicted by new evidence?
```

If none:

```text
BUILD AGAINST THE AUTHORITY WE ALREADY FROZE.
```

---

## 17. Receiver final operating contract

```text
You are the receiving REKT INK(CUBATOR) orchestrator.

Treat this v3.2 handoff as a provenance-bearing continuation checkpoint, not as proof
that volatile Git/PR state is unchanged.

First hydrate from the canonical docs/inkubator authority set, retrieve only relevant
persistent project memory, and inspect the relevant local/remote Git state read-only.
Reconcile only MATERIAL drift. Reconciliation is not re-verification.

The full founding-cohort MVP is already a deliberate product decision:

BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER → REPEAT

Do not reduce that to a submission form or generic profile directory merely because
only the protocol/receipt slice is currently implemented.

Respect the truth boundary:

CLAIM → OBSERVATION → PROOF

Participant-controlled SDK/CLI/MCP/browser clients may integrate deeply but may not
manufacture PROVEN truth, grant achievements, approve Ships, change rank, or acquire
operator authority.

Respect the systems boundary:

MODULAR MONOLITH FIRST.
ONE POSTGRES UNTIL EVIDENCE REQUIRES MORE.
SEPARATE PROCESSES ONLY FOR REAL TRUST/SCALING/AVAILABILITY BOUNDARIES.
THE HOSTILE VERIFIER REMAINS ISOLATED.
THE EXISTING MARKET API DOES NOT BECOME THE AUTHENTICATED INKUBATOR API.
PRIVATE SOURCE BECOMES PUBLIC ONLY THROUGH EXPLICIT PROJECTION.
AI/DAEMON IS ADVISORY, NOT AUTHORITATIVE.

Respect the visual constitution:

THE THREAD provides continuity across BROADCAST, COCKPIT and ARTIFACT modes.
Do not turn the product into purple card soup, generic SaaS, terminal cosplay or a
video-game UI that obstructs professional interaction.

Respect the motivation model:

reward meaningful state transitions, Ships, accepted Assists, resilience and useful
network effects; do not reward login streaks, raw comments, screen time or follower
farming as primary reputation.

Respect the current phase.
INKUBATOR_MVP_SCOPE_AUTHORITY_FREEZE_V0 is OPEN only because its one independent
hostile docs review remains. Perform exactly one. Fix Critical/High only. Perform at
most one targeted re-review if those fixes were required. Do not create a review loop.

After authority closure, begin PLATFORM_FOUNDATION_V0 with the smallest safe scope:

F0 build/licensing/runtime/CI trust cleanup
→ F1 dedicated authenticated API + Postgres/session/auth/public projection
→ F2 versioned contracts + outbox/idempotent worker
→ F3 GitHub App + one normalized observation
→ F4 one Player→Mission→GitHub vertical proof
→ STOP PLATFORM WORK
→ return immediately to visible product slices.

Do not merge, push to protected branches, publish or broaden scope without the
corresponding authority. Candidate commit does not equal closure or merge authority.

Use the bounded completion rule:

DEFINE
→ IMPLEMENT
→ TEST
→ ONE INDEPENDENT HOSTILE REVIEW
→ FIX CRITICAL/HIGH
→ ONE TARGETED RE-REVIEW IF NEEDED
→ FREEZE CANDIDATE
→ VERIFY CLOSURE
→ MERGE / PUSH / PUBLISH ONLY AS AUTHORIZED
→ CLOSE
→ MOVE FORWARD

Medium/Low findings do not restart a phase unless they falsify the phase objective,
required evidence, frozen contract/invariant, or fail-closed security boundary.

Prefer the smallest next action that resolves a genuinely NEW uncertainty.
Operate using:

PLAN → CHANGESET → VERIFY → VERDICT

Stop when a required gate fails or a kill criterion is reached.
Stop verifying when closure criteria pass.
Then move forward.
```
