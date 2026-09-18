# REKT INKUBATOR — Challenge OS North Star V1

**Status:** USER-AUTHORIZED PLANNING CANDIDATE / NOT IMPLEMENTATION AUTHORITY UNTIL MERGED

**Date:** 2026-09-13

## 0. Scope-amendment intent

This document proposes a deliberate product evolution from a general persistent builder world into a **programmable Challenge OS for things that actually run**.

It does not delete the existing Player / Mission / Project / Evidence / Assist / Ship / History architecture. It gives those systems a clearer primary game board and organizer-facing value proposition.

The existing North Star remains preserved where compatible. If this plan is merged as authority, the following product objective becomes primary:

> **Organizers launch executable challenges; builders join, build in their normal tools, receive truthful feedback and human help, deploy real software or agents, prove that what they made works, Ship it, and accumulate a durable record of what they actually built.**

No code implementation is authorized by this planning document alone.

---

## 1. Product thesis

REKT Inkubator is not primarily a dashboard, hackathon submission form, task manager, token launchpad, social feed, or generic agent host.

It is a **Challenge OS**.

A Challenge defines:

- what should be built;
- who may enter;
- what counts as a valid artifact;
- what evidence can be observed;
- what evaluation is run;
- what human judgment is required;
- when a Ship is accepted;
- what reward or recognition follows.

The product must make one promise to each side.

### Organizer promise

> **Launch a challenge and get running, inspectable, evaluated artifacts out the other side — not a pile of slides and dead repos.**

### Builder promise

> **Pick a challenge worth building, keep working where you already work, get useful feedback/help/testing, know what matters next, and leave with a trustworthy record of what you actually shipped.**

---

## 2. Core loop

```text
CHALLENGE
   ↓
JOIN
   ↓
ENTRY
   ↓
MISSION + PROJECT
   ↓
BUILD NORMALLY
GitHub / IDE / coding agent
   ↓
OBSERVE REAL WORK
   ↓
FEEDBACK / NEXT MOVE
   ↓
HELP / TEST / REPAIR
   ↓
EVALUATE
   ↓
SHIP
   ↓
RECEIPT / RESULT
   ↓
BUILDER HISTORY
   ↓
NEXT CHALLENGE
```

The interface should teach this loop through causal state changes rather than exposing internal nouns as equal destinations.

---

## 3. Domain relationship to existing Inkubator

Challenge OS extends the current domain rather than replacing it.

### Preserve

- **PLAYER** — durable builder identity/history;
- **MISSION** — operational state for what the builder is currently trying to complete;
- **PROJECT** — source/artifact locus;
- **EVIDENCE** — claims, observations, proof lineage;
- **HELP / ASSIST / EXTERNAL TEST** — meaningful human collaboration;
- **SHIP** — bounded submission/verification/receipt authority;
- **REPUTATION/HISTORY** — durable outcomes, not engagement XP;
- **DEVKIT** — GitHub/CLI/MCP bridge into the same canonical state.

### Add

- **CHALLENGE** — organizer-authored frozen contract + lifecycle;
- **CHALLENGE ENTRY** — binding of Player/Party + Mission + Project to one Challenge;
- **EVALUATION RUN** — immutable attempt/result against a versioned evaluator configuration.

### Round relationship

A `Round` remains a cohort/season/community container. A Challenge may belong to a Round, but Challenge correctness must not depend on a Round existing.

Do **not** overload Round into the executable challenge contract.

---

## 4. Challenge lifecycle

```text
DRAFT
  ↓
ARMED
  ↓
LIVE
  ↓
ENTRY_LOCKED
  ↓
FINAL_EVALUATION
  ↓
CLOSED
```

Rules:

1. DRAFT may be edited freely by Challenge authority.
2. ARMED is a final preview state; destructive changes require explicit confirmation.
3. At LIVE, the Challenge contract is frozen by version/hash.
4. Post-LIVE rule changes are explicit amendments with visible version history.
5. ENTRY_LOCKED prevents new entries while preserving already-authorized evaluation activity.
6. FINAL_EVALUATION uses the frozen final evaluator configuration.
7. CLOSED preserves entries, results, Ships and receipts.

A silent rule edit after LIVE is a product-truth defect.

---

## 5. Truth model

Challenge OS inherits the existing invariant:

`CLAIMED != OBSERVED != PROVEN`

Examples:

- Builder says “my agent works” → **CLAIMED**.
- GitHub workflow passes → **OBSERVED**.
- Remote endpoint responds correctly → **OBSERVED**.
- External tester records a result → **OBSERVED**.
- Sandbox scenario passes → **OBSERVED**.
- Human judge records a score → **OBSERVED judgment**.
- Challenge authority accepts the result under the frozen contract → **PROVEN Challenge outcome / accepted Ship**.

Participant-controlled code, SDK, MCP, AI, Sentry, ERC-8004 or external deployment providers may never mint PROVEN Challenge authority directly.

AI may summarize, classify, suggest and score as an observation where explicitly configured; AI is never sole authoritative proof.

---

## 6. Initial Challenge families

The abstraction is considered useful only if it can support these three materially different first-party templates without bespoke domain forks.

### A. BUILD CHALLENGE

Example: `BUILD A WEIRD USEFUL INK TOOL`.

Typical requirements:

- connected GitHub repository;
- working public artifact/URL;
- challenge-specific checks;
- external human test;
- bounded human rubric.

Purpose: validate the ordinary software path.

### B. AGENT CHALLENGE

Example: `BUILD AN INK AGENT`.

Typical requirements:

- connected source;
- live HTTP/A2A endpoint;
- protocol/conformance check;
- challenge scenario evaluation;
- external tester;
- optional MCP endpoint;
- optional ERC-8004 registration;
- optional Sentry launch;
- optional x402/payment capability.

Purpose: validate deployed-agent interoperability without making tokens mandatory.

### C. AGENT ARENA

Example: `REKT SECURITY AGENT ARENA`.

Typical requirements:

- standardized agent interface;
- practice suite;
- hidden final suite;
- bounded attempts;
- isolated execution or safe remote interaction;
- deterministic/declared scoring;
- durable evaluation receipts.

Purpose: validate that Inkubator can evaluate live behavior rather than only collect submissions.

---

## 7. Evaluation is the moat

Challenge hosting itself is commodity.

The strategic differentiator is:

> **A Challenge can understand and evaluate what the participant actually built.**

Supported evaluator families should remain composable and versioned:

1. `GITHUB_OBSERVATION`
   - commit/PR/workflow/deployment facts;
2. `REMOTE_ENDPOINT`
   - public URL, API behavior, latency, schema, health;
3. `PROTOCOL_CONFORMANCE`
   - MCP/A2A/other declared protocol behavior;
4. `EXTERNAL_HUMAN_TEST`
   - another Player performs a bounded test and records result;
5. `HUMAN_RUBRIC`
   - usefulness, creativity, UX or other subjective dimensions;
6. `SANDBOXED_TASK`
   - isolated challenge scenarios against participant code/agent; deferred until the trust zone is ready.

Evaluation output is observation. Challenge/Ship acceptance remains separate trusted authority.

---

## 8. Practice versus final evaluation

Where automated evaluation is used, Challenge contracts should support:

```text
PRACTICE EVALUATION
- visible cases
- useful development feedback
- repeatable within budget

FINAL EVALUATION
- hidden/private cases where appropriate
- bounded attempts
- frozen suite version
- determines final result
```

This reduces gaming/overfitting against only visible cases.

Final-suite contents must not leak through public APIs, logs or client bundles.

---

## 9. Product surfaces under Challenge OS

The existing surfaces remain rendering/ownership boundaries but should stop acting like five equally important concepts.

### WORLD

Primary question:

> **What challenge or useful activity around me is worth joining/acting on?**

Challenge-first content:

- live/upcoming challenges;
- challenge activity;
- builds needing help/testers;
- notable Ships/results;
- active arena events where appropriate.

### COMMAND

Primary question:

> **What do I need to do next to complete my current Challenge entry?**

Must show:

- current Challenge;
- what the builder is shipping;
- what changed;
- where the entry is relative to completion;
- one dominant Next Move;
- contextual Help/Test/Ship actions.

### PROJECT

Primary question:

> **What is actually happening with this entry/build?**

Owns source, evidence, collaborators, tests, evaluator history and artifact trajectory.

### PLAYER

Primary question:

> **What has this builder actually built, helped test and shipped across Challenges?**

This is proof-of-build history, not a generic social profile or scalar trust score.

### SHIP

Primary question:

> **What artifact exists, what was observed/evaluated, and what was actually accepted?**

Owns submission, verifier/evaluator lineage, final Challenge result and immutable receipt.

---

## 10. Challenge capabilities are cartridges, not core truth

Challenge contracts may opt into capability adapters.

Initial examples:

- GitHub source observation;
- remote HTTP verifier;
- A2A agent interface;
- MCP integration;
- ERC-8004 identity;
- Sentry launch;
- x402/payment;
- starter repositories/kits;
- sandbox evaluator.

Capabilities must never silently alter Challenge scoring or truth.

Specifically:

- an ERC-8004 identity does not prove agent quality;
- a Sentry launch does not imply Challenge success;
- token market performance does not contribute to Challenge score by default;
- x402 revenue does not imply technical correctness;
- participant-controlled deployment metadata is not PROVEN merely because it is onchain.

---

## 11. PRE-REVENUE INFRA CAP = $0

Challenge OS V1 is designed under a hard bootstrapping constraint:

> **Before platform revenue/sponsorship exists, recurring Inkubator infrastructure cash spend is capped at $0.**

This is a product/architecture invariant, not a temporary budgeting preference.

### Required consequences

- use free tiers / provider credits where safe;
- builders host their own deployed artifacts/agents;
- platform-funded LLM inference = `$0`;
- model/API usage is BYOK unless a sponsor funds a Challenge budget;
- participant gas/token launch/provider costs are participant/sponsor costs;
- practice checks prefer participant GitHub Actions or other external free compute;
- final evaluations are bounded by credits/quotas;
- no always-on participant agent hosting;
- no auto-scaling that can create unapproved cash spend;
- quota exhaustion results in queue/pause/deny, **never silent paid upgrade**.

A paid infrastructure tier may be enabled only after explicit budget authority tied to collected revenue, sponsor funding, grants/credits or an explicit user-approved exception.

See `PRE_REVENUE_INFRA_CAP_V1.md` for the detailed invariant.

---

## 12. Safety / trust architecture

Participant repositories, builds, endpoints and agents are hostile inputs.

Three evaluation levels:

```text
LEVEL 0 — NO EXECUTION
metadata, GitHub observations, human tests

LEVEL 1 — REMOTE ENDPOINT
safe public-network probing of builder-hosted services

LEVEL 2 — SANDBOX EXECUTION
hostile participant code in isolated ephemeral environment
```

Level 2 may never run in the trusted Inkubator API/worker process or on a maintainer workstation as a cost-saving shortcut.

The sandbox runner must have:

- no Inkubator production secrets;
- no GitHub App private key;
- no canonical DB write credentials;
- bounded CPU/memory/time/output;
- restricted network by default;
- ephemeral filesystem;
- signed/versioned result ingestion where feasible.

---

## 13. Organizer value / commercial direction

The likely payer is the Challenge organizer/sponsor rather than the individual builder.

Possible paid organizer value later:

- challenge creation/hosting;
- branded Challenge Kits;
- evaluator configuration;
- participant analytics;
- review queues;
- hidden final evaluation;
- higher evaluation concurrency;
- funded model/compute credits;
- private-company challenges;
- export/API access;
- durable Challenge outcome report.

Do not build a monetization subsystem before at least one organizer demonstrates willingness to pay for programmable evaluation and working outputs.

---

## 14. Builder value / retention thesis

A builder should return because Inkubator creates four kinds of value:

1. **ORIENTATION** — what am I trying to Ship and what matters next?
2. **CONTINUITY** — real work in GitHub/deployments is observed without maintaining a duplicate project manager.
3. **HUMAN LEVERAGE** — Help/Assist/Test brings useful people into the build at the right moment.
4. **DURABLE PROOF** — Challenge results and Ships become a credible history of things that actually worked.

If founding users do not value at least two of these materially, the Challenge OS thesis must be reconsidered rather than defended by sunk cost.

---

## 15. Initial implementation sequence — planning only

```text
C0  AUTHORITY AMENDMENT
C1  CHALLENGE CONTRACT + LIFECYCLE
C2  JOIN / ENTRY → existing Mission + Project
C3  EVALUATION V1: GitHub + endpoint + human test/rubric
C4  CHALLENGE-FIRST UX / IA
C5  SEPARATE EVAL RUNNER / SANDBOX PROVIDER
C6  AGENT CHALLENGE + A2A CONFORMANCE
C7  AGENT ARENA / PRACTICE + HIDDEN FINAL SUITES
C8  CHALLENGE KITS
C9  OPTIONAL ERC-8004 / SENTRY / x402 ADAPTERS
C10 PROOF-OF-BUILD RECEIPT HARDENING
C11 ORGANIZER PRODUCT / PAID INFRA UNLOCK
```

Do not skip directly to C5–C9 because they are exciting. The Challenge Contract + basic evaluation must first prove organizer/builder value.

---

## 16. First architecture test

The Challenge abstraction passes only if the same core domain can represent these three without bespoke forks:

1. normal web/software Build Challenge;
2. deployed Agent Challenge;
3. hidden-evaluation Agent Arena.

If each requires unrelated state machines, evaluation semantics or authority models, pause and narrow the abstraction before implementation.

---

## 17. Product success test

Challenge OS is supported by evidence when:

- a new visitor can explain the product as “build something for a challenge and prove it works” without learning internal surface names;
- an organizer can define one bounded Challenge without developer intervention;
- builders can join and reach useful Mission/Project state quickly;
- GitHub/external work updates Challenge progress without duplicate manual tracking;
- Help/Test creates real collaboration;
- evaluation feedback materially improves builds;
- accepted Ships are meaningfully more trustworthy than ordinary submission links;
- at least one organizer asks to run another Challenge or offers money/sponsorship to do so;
- builders care about their resulting Challenge/Ship history.

---

## 18. Kill criteria

Reject or narrow the thesis if:

- Challenge creation is only a prettier Devpost page;
- most evaluation is manual link-checking with no programmable advantage;
- builders must duplicate GitHub work into Inkubator forms;
- organizer value depends primarily on token speculation;
- the platform must host participant workloads continuously to be useful;
- pre-revenue operation requires recurring cash infrastructure spend;
- Challenge logic creates a second truth system beside Mission/Ship/evidence;
- AI or participant-controlled code can manufacture PROVEN outcomes;
- every Challenge needs custom backend code;
- users still cannot say why Inkubator exists after joining a Challenge.

---

## 19. Research anchors

Planning references used to shape this direction:

- Challenge-prize design: Nesta challenge-prize guidance;
- competition/evaluation patterns: Kaggle public/private evaluation and competition formats;
- organizer/submission baseline: Devpost hackathon platform model;
- developer feedback loops: GitHub Checks / Actions;
- agent interoperability: A2A protocol;
- agent/tool context: MCP;
- agent evaluation: UK AISI Inspect;
- policy/schema direction: JSON Schema, with OPA deferred unless complexity proves need;
- software supply-chain evidence: in-toto / Sigstore as future receipt-hardening references;
- onchain agent identity: ERC-8004;
- Ink-native optional launch capability: Sentry / Ink MCP;
- payment capability: x402;
- sandbox/isolation references: Docker only for trusted development, stronger isolated provider/microVM boundary for hostile public code.

External products/protocols are references and optional adapters, not product authority.

---

## 20. Verdict

`PRODUCT_DIRECTION = CHALLENGE_OS`

`PRIMARY_VALUE = WORKING_EVALUATED_ARTIFACTS`

`PRIMARY_BUILDER_LOOP = CHALLENGE → BUILD → FEEDBACK/HELP → EVALUATE → SHIP → HISTORY`

`PRIMARY_ORGANIZER_LOOP = DEFINE → LAUNCH → OBSERVE → EVALUATE → ACCEPT → REVIEW OUTCOMES`

`EVALUATION = STRATEGIC_MOAT`

`TOKENS = OPTIONAL_CAPABILITY`

`PARTICIPANT_HOSTING = BYO_BY_DEFAULT`

`PRE_REVENUE_RECURRING_INFRA_CASH_CAP_USD = 0`

`IMPLEMENTATION_AUTHORITY = NONE`

`MERGE_AUTHORITY = NONE`
