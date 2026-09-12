# REKT INKUBATOR — Pre-Revenue Infrastructure Cap V1

**Status:** PLANNING INVARIANT / NOT IMPLEMENTATION AUTHORITY UNTIL MERGED

**Parent:** `CHALLENGE_OS_NORTH_STAR_V1.md`

**Date:** 2026-09-13

## 1. Invariant

Before collected platform revenue, sponsor funding, grants or explicit user-approved infrastructure budget exists:

> **Recurring Inkubator infrastructure cash spend is capped at USD $0.**

This includes Challenge OS and Agent Arena work.

Provider credits and free tiers may be used. They are not treated as recurring cash spend, but the product must degrade safely when they run out.

The default response to quota exhaustion is:

`QUEUE / PAUSE / DENY`

Never:

`AUTO-UPGRADE / AUTO-SPEND`.

---

## 2. Why this is a product constraint

The pre-revenue product must prove that organizers/builders value programmable Challenges before infrastructure scale is purchased.

This constraint deliberately forces Inkubator to be an orchestrator of existing builder infrastructure rather than prematurely becoming:

- an agent hosting provider;
- an LLM inference provider;
- a CI farm;
- a sandbox cloud;
- a storage platform;
- a general deployment platform.

If Challenge OS is only useful when Inkubator pays to host every participant workload continuously, the V1 thesis is too infrastructure-heavy.

---

## 3. Pre-revenue operating model

### Inkubator hosts

- product frontend;
- small authenticated API;
- canonical database;
- Challenge/Mission/Project/evidence state;
- lightweight workers within free/credit limits;
- small artifact/evaluation metadata;
- safe remote endpoint probes;
- Challenge orchestration.

### Builders/sponsors host/pay for

- participant deployed apps/agents;
- model/API usage;
- provider-specific agent runtime;
- gas/onchain transactions;
- token launches;
- high-volume storage/bandwidth unique to an entry;
- optional commercial APIs used by the build.

### Free/credit-backed platform work may include

- practice checks through public GitHub Actions where suitable;
- free-tier database/API/static hosting;
- free object-storage allowance;
- isolated final-evaluation credits;
- sponsor-provided provider/model credits.

---

## 4. No always-on participant hosting

Pre-revenue Inkubator must not host every entrant agent/app continuously.

Preferred pattern:

```text
BUILDER DEPLOYS ARTIFACT
        ↓
INKUBATOR STORES LOCATOR + PROVENANCE
        ↓
SAFE PROBE / TEST
        ↓
OBSERVATION
```

For hidden evaluation requiring isolated code execution:

```text
EVALUATION REQUEST
        ↓
EPHEMERAL SANDBOX
        ↓
RUN BOUNDED SCENARIO
        ↓
CAPTURE RESULT
        ↓
DESTROY SANDBOX
```

No idle participant compute remains alive after the evaluation.

---

## 5. LLM cost law

Pre-revenue platform-funded model inference budget:

`USD $0`.

Allowed:

- builder BYOK;
- builder-hosted/local model;
- sponsor-provided key/credits with explicit Challenge budget;
- free provider credits where terms permit.

Not allowed:

- silently routing all entrant traffic through an Inkubator-paid model account;
- uncapped agent loops;
- hidden retry storms;
- platform-funded inference as a prerequisite for ordinary Challenge participation.

If a Challenge needs standardized funded inference for fairness, that Challenge may only go LIVE after an explicit funded budget exists.

---

## 6. Evaluation budget law

Every Challenge contract must declare hard resource limits before LIVE.

Minimum:

```text
max_entries
max_practice_attempts_per_entry
max_final_attempts_per_entry
max_eval_runtime_seconds
max_concurrent_evals
platform_cash_compute_usd
platform_llm_usd
on_budget_exhaustion
```

Pre-revenue defaults:

```text
platform_cash_compute_usd = 0
platform_llm_usd = 0
max_concurrent_evals = 1
on_budget_exhaustion = QUEUE
```

Where provider credits are available, record the credit-backed allowance separately from cash budget.

Evaluation must refuse to start if the platform cannot bound the worst-case resource exposure.

---

## 7. Provider strategy

Provider choices are replaceable implementation details.

Current planning examples include:

- current Render/free web/API rehearsal capacity;
- free/scale-to-zero Postgres provider such as Neon;
- object storage free allowance such as Cloudflare R2;
- public GitHub Actions for builder-controlled practice checks;
- sandbox provider credits such as Daytona/E2B for final bounded evaluations.

No vendor above is permanent authority.

The architecture must preserve provider substitution and never encode a free-tier promise into product semantics.

---

## 8. Free-tier failure behavior

The product must assume free providers can sleep, throttle, change quotas or revoke credits.

Required UX:

- clearly distinguish Challenge state from provider availability;
- show evaluation as `QUEUED`, `UNAVAILABLE` or `PAUSED`, not failed proof;
- preserve submitted artifacts/entry state when runner quota disappears;
- never downgrade observed/proven history because a current provider is unavailable;
- allow operator to resume jobs after capacity returns;
- never require database surgery to recover from quota exhaustion.

---

## 9. Cash-spend unlock

Paid infrastructure is unlocked only by an explicit budget decision tied to one or more of:

- collected sponsor payment;
- collected platform revenue;
- grant;
- provider sponsorship/credits with known limits;
- explicit owner-approved exception.

The unlock must state:

```text
budget amount
budget owner
purpose
provider/resource
start/end period
hard cap
expected unit economics
rollback/disable path
```

A usage spike or viral Challenge is **not** authority to spend.

---

## 10. First paid dollars priority

When paid infra becomes justified, spend in this order unless evidence says otherwise:

1. **reliable canonical DB / API** — reduce sleep/availability problems;
2. **isolated final evaluation capacity** — protect the differentiating product value;
3. **observability/backups** — preserve operations/evidence;
4. **higher evaluation concurrency** — improve organizer/builder experience;
5. **sponsor-funded standardized inference** where a Challenge needs it;
6. **optional hosted participant runtime** only if users will pay for it.

Do not spend first on decorative realtime infrastructure, high-volume telemetry or permanent agent fleets.

---

## 11. Unit economics telemetry

Even while cash spend is zero, Challenge OS should record enough resource accounting to estimate:

```text
entries per Challenge
evaluations per entry
sandbox seconds per evaluation
bytes stored per entry
endpoint probes per entry
model tokens if sponsor/BYOK telemetry contract permits
cost estimate per EvaluationRun
cost estimate per accepted Ship
```

This is operational accounting, not public leaderboard data.

Do not collect private provider/token usage without an explicit contract.

---

## 12. Scaling gates

### Gate 0 — $0 bootstrap

- free tiers/credits;
- builder-hosted artifacts;
- BYOK models;
- capped Challenges;
- bounded final evals;
- queue instead of scaling.

### Gate 1 — first funded Challenge

Unlock only the resources needed for that Challenge's committed reliability/evaluation budget.

### Gate 2 — repeat sponsor/revenue

Pay for stable baseline API/DB + evaluation capacity and establish real unit economics.

### Gate 3 — demonstrated demand

Only after repeated organizer demand consider:

- reserved runner pool;
- higher concurrency;
- hosted participant runtimes;
- platform-funded inference packages;
- private enterprise Challenges.

Scale follows revenue/evidence, not optimism.

---

## 13. Explicitly forbidden pre-revenue shortcuts

- running hostile participant code on a maintainer laptop;
- giving sandbox workers production secrets;
- auto-upgrading cloud plans;
- keeping all participant agents alive 24/7;
- uncapped platform-paid inference;
- one shared unrestricted third-party API key for all contestants;
- treating provider credits as infinite capacity;
- accepting a cloud bill merely because a Challenge is popular;
- silently degrading truth semantics to fit free infrastructure.

---

## 14. Architecture implication

The platform should optimize for:

> **orchestration + verification + durable evidence**

rather than:

> **owning all execution.**

This is strategically useful even after revenue: participant-hosted/bring-your-own infrastructure keeps Challenge OS interoperable and reduces lock-in while paid isolated evaluation remains the high-value trust boundary.

---

## 15. Kill / reopen conditions

Reopen the $0 cash cap when any of these becomes true:

1. a sponsor/customer pays for a Challenge and reliable paid capacity is part of the agreed service;
2. free-tier limitations prevent a validated paid conversion;
3. security requires replacing a free component with a paid isolated boundary;
4. provider credits end during an already-funded obligation;
5. the owner explicitly approves a bounded exception with hard cap.

Do not reopen because:

- paid infrastructure looks more professional;
- free tiers are annoying;
- a new cloud service looks cool;
- predicted future scale might need it;
- the team wants to eliminate all queues before revenue.

---

## 16. Verdict

`PRE_REVENUE_RECURRING_INFRA_CASH_CAP_USD = 0`

`PLATFORM_FUNDED_LLM_BUDGET_USD = 0`

`PARTICIPANT_RUNTIME = BYO_BY_DEFAULT`

`FINAL_EVALUATION = EPHEMERAL + BOUNDED`

`QUOTA_EXHAUSTION = QUEUE_OR_PAUSE`

`AUTO_SPEND = FORBIDDEN`

`SCALING = REVENUE_OR_EXPLICIT_FUNDED_AUTHORITY`
