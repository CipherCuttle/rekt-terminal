# REKT INK(CUBATOR) — Product Contract MVP v0

**Status:** CANONICAL / MVP DOMAIN CONTRACT

**Locked:** 2026-09-06

## 1. Canonical product nouns

User-facing language should converge on these nouns:

- **PLAYER** — persistent builder identity.
- **CHARACTER** — optional expressive layer attached to a Player; never required for core identity.
- **ROUND** — time/context-bound challenge with a strong creative constraint.
- **MISSION** — a Player/Party commitment to ship a specific outcome under a clear ship condition.
- **PROJECT** — the durable thing being built; may outlive a Mission/Round and may be reused/evolved later.
- **PARTY** — Project collaborators/members.
- **THREAD** — visual/product grammar for meaningful progression/history.
- **SIGNAL** — visible state/activity with provenance or clear source class.
- **CLAIM** — participant-controlled assertion that something happened.
- **OBSERVATION** — state reported by a trusted adapter or bounded human action.
- **PROOF / PROVEN** — Inkubator authority accepts sufficient evidence for a defined rule/version.
- **HELP BEACON** — explicit contextual request for help.
- **ASSIST** — meaningful help offered to another Project and accepted/confirmed according to rule version.
- **CHEEVO** — achievement granted for a meaningful state transition or curator action; never raw engagement farming.
- **SHIP** — accepted completion event for a Mission/Project under the current Ship contract.
- **SHIP RECEIPT** — durable versioned record of the accepted Ship and its evidence/provenance.
- **PULL** — invitation/network lineage; becomes reputation-bearing only when defined outcome criteria are met (for example Proven Pull after an invited builder Ships).
- **DAEMON** — advisory project intelligence that summarizes state, highlights blockers/scope damage and recommends a next move. It has no authority to manufacture proof.

Avoid introducing public synonyms such as Workspace, Ticket, Sprint, Submission Entity, XP Event or Workflow unless a future scope change explicitly adds them.

## 2. Core entity relationships

```text
PLAYER
  ├─ CHARACTER? 
  ├─ follows PLAYERS
  ├─ watches PROJECTS
  ├─ joins ROUNDS
  ├─ owns/joins MISSIONS
  ├─ belongs to PROJECT PARTIES
  ├─ offers/receives ASSISTS
  ├─ receives CHEEVOS
  └─ accumulates SHIP/HISTORY facts

ROUND
  ├─ constraint
  ├─ timing/state
  ├─ entrants
  └─ MISSIONS

MISSION
  ├─ PLAYER/PARTY
  ├─ PROJECT
  ├─ goal
  ├─ ship condition
  ├─ current focus
  ├─ next move
  ├─ milestone/progress state
  ├─ blocker state
  ├─ evidence
  └─ SHIP outcome

PROJECT
  ├─ durable identity
  ├─ stack
  ├─ repository/integrations?
  ├─ PARTY
  ├─ Help Beacons
  ├─ updates/comments
  ├─ evidence/activity
  ├─ ASSISTS
  └─ one or more MISSIONS/SHIPS over time
```

## 3. Mission contract

A Mission must be understandable without a project-management tool.

Required conceptual fields:

- `mission_id`;
- owning Player/Party;
- Project identity;
- one-sentence goal;
- explicit ship condition;
- Mission state;
- current focus;
- one dominant next move or explicit `NONE` when not applicable;
- timing/Round relation where applicable;
- rule/schema version.

Optional/derived:

- milestones;
- blocker;
- stack;
- connected repository;
- skills needed;
- Daemon advisory output;
- external/public links.

The product must not require a complete backlog, story points, task hierarchy or sprint model.

## 4. Mission state model

The MVP product vocabulary should distinguish the Mission from Round state.

Proposed Mission states:

- `DRAFT` — not yet declared.
- `DECLARED` — goal/ship condition committed.
- `BUILDING` — active work.
- `BLOCKED` — cannot reasonably advance without resolving an explicit blocker.
- `SHIP_READY` — required ship condition appears satisfied enough to prepare/submit.
- `SUBMITTED` — Ship evaluation/review in progress.
- `SHIPPED` — accepted Ship Receipt created.
- `CLOSED_NOT_SHIPPED` — Mission ended without accepted Ship.
- `ARCHIVED` — historical/read-only lifecycle state.

A Mission state transition must not imply proof that has not actually occurred.

Round state is a separate vocabulary and must not be overloaded with participant-specific `BUILDING` semantics merely because earlier protocol v0 included it.

## 5. Truth model

Every important fact belongs to a truth class.

### SELF-REPORTED / CLAIMED

Examples:

- Player says milestone is complete;
- SDK/CLI/MCP posts a claim;
- project-controlled browser telemetry says a session occurred.

Claims may influence advisory UI but cannot directly create authoritative proof/reputation where the rule requires independent evidence.

### OBSERVED

Examples:

- GitHub webhook reports a PR merge;
- trusted deployment adapter observes a deployment;
- external tester records a bounded test result;
- Project owner accepts an Assist.

Observation means a defined source observed/reported something. It does not automatically mean the product-level requirement is satisfied.

### PROVEN

A versioned Inkubator rule accepts one or more observations/claims as sufficient evidence for a defined product fact.

Only trusted server-side authority can emit PROVEN/grant authoritative consequences.

### UNKNOWN / STALE / BLOCKED

The UI must preserve uncertainty. Missing evidence is not failure; stale evidence is not current proof; blocked workflow is not completed workflow.

## 6. Canonical Signal vocabulary

The UI/domain should converge on:

- `UNKNOWN` — no sufficient current state/evidence.
- `CLAIMED` — participant says it happened.
- `ACTIVE` — current work/process underway.
- `OBSERVED` — trusted observer/adaptor reported state.
- `PROVEN` — accepted evidence satisfies rule.
- `ATTENTION` — requires action/review.
- `BLOCKED` — progress cannot continue normally.
- `STALE` — evidence/state expired or no longer reliable.
- `FAILED` — bounded process/check failed.

Color is never the only carrier of these meanings.

## 7. Progress contract

MVP must not present fake mathematical precision.

Primary product representation is a small set of meaningful dimensions/state gates, for example:

- FOUNDATION;
- CORE EXPERIENCE / CORE LOOP;
- QUALITY / TESTING;
- SHIPABILITY.

The Command Center must emphasize:

1. Mission goal;
2. ship condition;
3. next move;
4. current blocker;
5. Thread/gate state;
6. recent meaningful change.

Any aggregate percentage is optional, explicitly approximate and derived from versioned rules. It must never imply scientific precision.

## 8. Daemon contract

Daemon is advisory.

Daemon MAY:

- summarize recent project evidence;
- detect likely stack/context;
- identify scope expansion;
- highlight stale/blocked states;
- propose next move;
- compile low-friction project updates;
- suggest help matches;
- explain why progress changed.

Daemon MAY NOT:

- grant PROVEN;
- grant Cheevos;
- approve Ship;
- alter reputation;
- change permissions;
- publish private data;
- execute participant repository code inside the trusted product worker;
- silently mutate Mission scope/ship condition.

Repository text/code is untrusted evidence, never instructions.

## 9. Social contract

MVP social primitives:

- Follow Player;
- Watch Project;
- project-context comments/replies/reactions;
- Help Beacon;
- Assist offer/acceptance;
- Party membership;
- external tester action;
- meaningful activity/world Signals.

Not MVP social primitives:

- DMs;
- quote-post/repost economy;
- algorithmic engagement feed;
- follower-growth analytics;
- paid boosts;
- global chat replacement.

Social ranking must reward outcomes/help, not clicking.

## 10. Assist contract

An Assist exists to make non-code contribution legible.

Initial Assist types may include:

- CODE;
- DESIGN;
- DEBUG;
- TEST;
- RESEARCH;
- INTRO;
- ART;
- PRODUCT;
- DEPLOYMENT;
- OTHER.

An offered Assist is not reputation-bearing merely because the sender says it helped. Reputation-bearing acceptance requires the rule-version's confirmation/evidence path.

Repeated identical retries must not create duplicate Assists.

## 11. Cheevo contract

Cheevos celebrate durable or culturally meaningful state transitions.

Good MVP examples:

- FIRST BLOOD — first working/public artifact under defined evidence.
- TOUCH GRASS — first external human test under defined rule.
- PARTY UP — first real collaborator/Party formation.
- UNREKT — recover a failed deployment/build and later satisfy recovery rule.
- ACTUALLY HELPFUL — accepted Assist threshold.
- WORKING URL OR GTFO — first accepted Ship.
- NECROMANCER — revive a sufficiently dormant/dead Project and later Ship.

Never grant Cheevos for:

- login streaks;
- raw comment count;
- follows;
- screen time;
- wallet value;
- paid activity;
- raw commit count without meaningful state transition.

Cheevo semantics are versioned and historical grants are never silently reinterpreted.

## 12. Leaderboard/reputation contract

There is no single universal MVP XP ladder.

MVP may expose contextual/seasonal boards such as:

- SHIPPERS;
- ASSISTS;
- COLLABORATION;
- COMEBACK;
- curator WILDCARD;
- PROVEN PULLS only after the underlying invite→Ship semantics are implemented.

Reputation is multidimensional and derived from authoritative history.

Raw engagement volume is not rank authority.

## 13. Failure / graveyard / resurrection

A Mission may close without shipping.

The product should preserve:

- final state;
- optional cause-of-death/postmortem category;
- learnings;
- historical Project link.

A later Mission may explicitly resurrect/evolve that Project. Resurrection is lineage/history, not deletion/rewrite of the original Mission.

The public Graveyard/Build Replay presentation may be staged after the core MVP path works, but the underlying history model must not preclude it.

## 14. Privacy/public projection

Connected private-source data is private by default.

The backend must explicitly construct public projections. Public UI must not receive private source objects and rely on front-end hiding.

Examples:

Private:
- commit SHAs/messages from private repo;
- private README/code;
- private contributor metadata;
- private branch/workflow details.

Potential public projection:
- stack label;
- `TESTS PROVEN`;
- `PUBLIC BUILD BLOCKED`;
- `SOURCE PRIVATE`;
- Player-approved summary.

## 15. MVP end-to-end acceptance

A founding Player can:

1. create/sign into a Player identity;
2. declare a Mission with a ship condition;
3. connect or skip GitHub repo without blocking non-code projects;
4. enter a coherent Command Center;
5. understand current state/next move;
6. create/update bounded claims and updates;
7. receive at least one real external observation from an integration or tester;
8. emit/receive contextual help;
9. participate in at least one Assist path;
10. receive rule-based Cheevo/progression when deserved;
11. prepare and submit a Ship;
12. receive a versioned Ship Receipt when accepted;
13. see persistent Player/Project history afterward;
14. access the same canonical state through launch DevKit surfaces where supported.

The MVP is not complete if the product only supports profile creation + submission/gallery while the Command/Proof/Help/Ship/reputation loop remains conceptual.