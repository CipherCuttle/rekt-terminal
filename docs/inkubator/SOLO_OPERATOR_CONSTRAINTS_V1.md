# REKT INKUBATOR — SOLO OPERATOR CONSTRAINTS V1

**Status:** USER-AUTHORIZED PLANNING INVARIANT / NOT IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-13  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`

## 1. Operating assumption

Until revenue/team capacity explicitly changes this document, REKT Inkubator must be designed to be safely understandable and operable by **one primary human operator assisted by coding/reasoning agents**.

This is a first-class architecture constraint, not a temporary inconvenience.

The system fails this constraint if normal operation implicitly requires separate full-time roles for product management, DevOps, security, moderation, support, blueprint maintenance, compiler supervision and Challenge operations.

## 2. Operator-load law

> **Normal success paths should not require operator attention. The human manages exceptions, not machinery.**

Every feature must declare whether it creates recurring operator work.

Prefer:

```text
NORMAL PATH
→ deterministic automation
→ visible user state
→ self-service recovery where safe

EXCEPTION
→ bounded operator queue
→ reason + evidence + recommended action
```

Reject designs where the operator routinely needs to:

- inspect database rows;
- replay jobs manually;
- reconcile ordinary provider state by hand;
- interpret raw logs to answer normal user questions;
- manually approve normal submissions;
- watch cloud billing dashboards to prevent runaway spend;
- repeatedly explain hidden system semantics;
- maintain duplicate truth across GitHub and Inkubator;
- babysit AI agents or evaluation jobs.

## 3. Operator budget is a product metric

Record, where practical:

```text
operator_interventions_per_challenge
operator_minutes_per_challenge
manual_recovery_events
manual_moderation_events
manual_compiler_repairs
support_questions_per_challenge
```

A feature that reduces cloud cost but creates recurring operator burden may be rejected as more expensive.

Before wider community beta, ordinary healthy Challenges should require approximately zero platform-operator intervention after launch.

## 4. Architecture consequence

Prefer:

- one modular API;
- one canonical PostgreSQL database;
- one small worker/outbox system;
- one isolated verifier;
- one canonical Compiler state document/schema;
- one replaceable chat/model adapter;
- external builder infrastructure rather than platform-hosting every workload.

Do not create separate services for compiler, chat, receipts, notifications, evaluation orchestration or profiles until measured isolation/scale/reliability evidence justifies them.

Every additional deployable service must justify:

```text
failure boundary gained
security boundary gained
scaling need
operator cost added
observability/recovery cost added
```

## 5. Compiler simplicity constraint

The early Challenge Compiler is one structured state model with multiple deterministic transformations, not a collection of autonomous agents.

Conceptual shape:

```text
CompilerState {
  intent
  project_class
  known[]
  assumed[]
  unknown[]
  requirements
  production_envelope
  risk_profile
  blueprint_candidates[]
  architecture
  acceptance[]
  preferences[]
  findings[]
  unresolved_decisions[]
}
```

Operations such as classification, requirement derivation, blueprint matching, contract linting and spec attack operate over this state.

The language model is an adapter around this model, not a second state machine.

## 6. Blueprint maintenance constraint

Do not launch with a giant architecture catalog.

Initial target: approximately **five exceptionally maintained blueprint families**, expanding only when actual Challenge demand requires it.

Candidate initial families:

1. static/public web;
2. stateful web application;
3. read-only Web3 application;
4. transaction-capable Web3 application;
5. bot/automation;

A sixth API/service blueprint may be added if needed by the first Challenge corpus.

Every supported blueprint should have:

- explicit applicability/exclusions;
- reference architecture;
- security/risk profile;
- production-envelope assumptions;
- acceptance modules;
- known failure modes;
- example compiled Challenge;
- version/health state;
- maintained canary/reference build where it materially improves confidence.

Ten weak blueprints are worse than five strong ones.

## 7. Alpha cutline

The first integrated REKT Alpha is deliberately ambitious but finite.

### Required Alpha product

```text
Challenge Compiler
+ ~5 strong blueprints
+ Live Impact Negotiation
+ Break My Spec
+ versioned Build Contract
+ REKT Challenge creation/display
+ Builder Capsule / rekt check
+ GitHub/source integration
+ immutable submission
+ blind submission/reveal
+ objective acceptance where appropriate
+ Test Arena
+ qualification vs organizer preference separation
+ durable Receipt / delivery facts
+ operator exception surface
```

### Explicitly post-Alpha unless promoted by a blocking need

- Challenge DNA;
- Build Flight Recorder;
- broad Builder Passport product;
- Prize Boosting;
- sponsor campaign suite;
- Challenge Doctor;
- Blueprint Tournaments;
- Sentry launch integration;
- ERC-8004;
- x402;
- agent hosting;
- arbitrary hostile-code sandbox platform;
- teams/guilds;
- broad social feed/features;
- sophisticated realtime presence;
- multi-chain settlement;
- hosted participant runtime.

These remain North Star capabilities, not lost ideas.

## 8. Product-language constraint

The operator should not need to teach users internal architecture.

Public vocabulary remains bounded:

```text
Challenge
Builder
Build
Done When
Prize
Check
Submit
Review
Winner
Receipt
```

Internal Player/Project/Mission/Evidence/Ship machinery may support this experience without leaking into every screen.

## 9. Support-by-design rule

Before adding documentation or operator support for recurring confusion, ask whether the product can remove the confusion itself.

Prefer:

- explicit state;
- clear reason codes;
- self-service retry where safe;
- visible assumptions;
- visible contract version;
- actionable errors;
- one-click diagnostic bundle without secrets;
- recovery paths that do not require database surgery.

Documentation is not a substitute for understandable state machines.

## 10. Focus / context-switch constraint

Only one major forward product stage is active at a time.

Exploratory branches may exist, but they do not become parallel implementation programs unless the current stage is explicitly paused/superseded.

For each active stage maintain:

```text
OBJECTIVE
IN SCOPE
OUT OF SCOPE
ACCEPTANCE GATES
KNOWN BLOCKERS
NEXT ACTION
```

Do not simultaneously run broad frontend redesign, compiler architecture, agent arena, settlement system and social-product expansion as co-equal priorities.

## 11. Agent-development constraint

Coding/reasoning agents amplify implementation capacity but do not remove ownership complexity.

Therefore:

- agents may implement/review bounded changes;
- canonical decisions live in Git, not agent memory;
- schemas/tests/fixtures carry more authority than prose when executable;
- no agent may silently expand phase scope;
- no repeated review loops beyond the bounded completion policy;
- every phase should end in a state another agent can continue from without reconstructing hidden reasoning.

## 12. Kill criteria

Stop and simplify a feature/subsystem if:

- healthy operation repeatedly requires manual intervention;
- only one specific chat/model/provider can understand its state;
- it creates a second source of truth;
- it requires another always-on service without a demonstrated boundary/scale need;
- it adds recurring maintenance disproportionate to user value;
- failures cannot be diagnosed without reading raw DB/log state;
- the operator cannot explain its authority/failure model succinctly;
- keeping it working depends on remembering undocumented decisions.

## 13. Verdict

```text
PRIMARY_OPERATOR_COUNT              = 1
NORMAL_OPERATION                    = SELF_SERVICE / AUTOMATED
OPERATOR_ROLE                       = EXCEPTION HANDLER
DEPLOYMENT_STYLE                    = MODULAR_MONOLITH FIRST
COMPILER_ARCHITECTURE               = ONE STRUCTURED STATE MODEL
INITIAL_BLUEPRINT_TARGET            = ~5
ALPHA_SCOPE                         = FROZEN ABOVE
PARALLEL_MAJOR_PRODUCT_PROGRAMS     = 1
HUMAN_ATTENTION                     = SCARCE CORE RESOURCE
```
