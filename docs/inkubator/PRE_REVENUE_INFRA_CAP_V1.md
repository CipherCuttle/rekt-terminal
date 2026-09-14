# REKT INKUBATOR — Bootstrap Infrastructure Budget V2

**Status:** USER-AUTHORIZED PLANNING INVARIANT / NOT IMPLEMENTATION AUTHORITY  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`  
**Date:** 2026-09-13

This supersedes the prior `$0 pre-revenue` cash invariant. The product remains frugal, but zero spend is no longer allowed to create worse engineering or excessive operator burden.

## 1. Budget invariant

```text
ABSOLUTE OWNER-FUNDED MONTHLY CEILING     USD 100
NORMAL MONTHLY OPERATING TARGET           <= USD 50
EXPECTED EARLY OPERATING RANGE            USD 10–25
RESERVED HEADROOM                         >= USD 50 where practical
AUTO-UPGRADE                              FORBIDDEN
UNCAPPED USAGE                            FORBIDDEN
VIRAL TRAFFIC                             NOT SPEND AUTHORITY
```

The goal is not to consume the budget. The goal is to buy simplicity/reliability when a small paid service materially reduces operator burden or security risk.

## 2. Human-time beats tiny cash savings

A paid service is justified inside the normal target when it clearly saves repeated maintenance/debugging, improves security/isolation, or removes a fragile free-tier dependency.

Bad optimization:

> save $7/month while creating hours of recurring manual work.

Preferred optimization:

> keep the system simple enough for one operator to understand and recover.

## 3. Early deployment topology

Prefer a boring modular architecture:

```text
REKT INKUBATOR WEB
        ↓
ONE MODULAR API
        ↓
POSTGRESQL
        ↓
POSTGRES OUTBOX / JOBS
        ↓
ONE SMALL WORKER

SEPARATE ISOLATED VERIFIER
```

Do not split compiler/chat/challenge/receipt/notification/evaluation orchestration into separate services without measured operational need.

No Redis, Kafka, service mesh, Kubernetes, permanent runner fleet or hosted participant runtime merely for perceived scale/professionalism.

## 4. Platform vs participant costs

Inkubator may fund within the monthly cap:

- web/API baseline;
- canonical DB;
- lightweight worker;
- small object/evidence storage;
- monitoring/backups where justified;
- bounded compiler inference;
- safe endpoint verification;
- small notification volume.

Builders/sponsors remain responsible by default for:

- participant app/runtime hosting;
- project-specific commercial APIs;
- high-volume storage/bandwidth unique to their build;
- gas/onchain transactions;
- model/runtime costs intrinsic to the submitted product.

## 5. LLM budget law

Low-cost platform-funded inference is explicitly allowed for the Challenge Compiler because it is a product feature and current small-model economics make bounded use affordable.

Required controls:

- model/provider replaceable;
- structured project state instead of replaying full transcripts;
- hard per-call/per-session token limits;
- hard monthly compiler-inference sub-budget;
- no recursive autonomous agent loops;
- no hidden retry storms;
- no paid inference required for core Challenge lifecycle correctness;
- graceful degraded mode when inference budget/provider is unavailable.

Initial planning target:

```text
COMPILER INFERENCE NORMAL TARGET   <= USD 10/month
COMPILER INFERENCE HARD CAP        explicit/configurable
CORE CHALLENGE OPERATION           works at USD 0 inference
```

## 6. Per-Challenge resource budget

Each Challenge/evaluation path must still be bounded before it begins.

Track where applicable:

```text
max_entries
max_practice_attempts_per_entry
max_final_attempts_per_entry
max_eval_runtime_seconds
max_concurrent_evals
platform_compute_budget_usd
platform_llm_budget_usd
storage_budget
on_budget_exhaustion
```

Default exhaustion behavior:

`QUEUE / PAUSE / DENY`

Never:

`AUTO-UPGRADE / AUTO-SPEND`

## 7. Spend priority

If a dollar is spent, prefer this order unless evidence says otherwise:

1. reliable canonical database / API;
2. backups / observability / recovery capability;
3. security/isolation boundaries;
4. bounded compiler inference;
5. final-evaluation capacity when the product needs it;
6. higher concurrency only after measured need;
7. hosted participant runtime only after customers will pay for it.

Do not spend first on decorative realtime infrastructure, permanent agent fleets, analytics vanity stacks or speculative scaling.

## 8. Unit economics telemetry

Record enough operational accounting to answer:

```text
monthly baseline platform cost
cost per compiled Challenge
model tokens per compile/session
entries per Challenge
evaluations per entry
storage bytes per Challenge
probe/evaluation count
operator interventions per Challenge
operator minutes per Challenge
```

The last two are first-class economics. A feature that saves $5 but creates two hours of manual work is not cheaper.

## 9. Scaling gates

### Bootstrap

Owner-funded, <= $100 hard cap, <= $50 normal target.

### Closed Alpha

Keep the same hard cap unless the owner explicitly changes it. Prefer queue/degraded operation over emergency scaling.

### Revenue/sponsor stage

New spend requires explicit budget tied to revenue, grant, sponsor funding or owner decision, with purpose, period, hard cap and rollback path.

### Demonstrated demand

Only after repeated real demand consider reserved evaluation runners, higher concurrency, platform-funded inference packages or hosted participant runtimes.

## 10. Forbidden shortcuts

- running hostile participant code on the maintainer laptop;
- storing production-value secrets in developer machines when avoidable;
- giving verifier/evaluation workers broad production credentials;
- auto-upgrading cloud plans;
- uncapped model/tool loops;
- one unrestricted shared third-party key for entrants;
- treating free credits as permanent architecture;
- degrading truth semantics to stay inside a provider quota;
- adding services whose main benefit is architectural aesthetics.

## 11. Verdict

```text
BOOTSTRAP_MONTHLY_HARD_CAP_USD       = 100
BOOTSTRAP_NORMAL_TARGET_USD          = 50
EXPECTED_EARLY_SPEND_USD             = 10–25
AUTO_SPEND                           = FORBIDDEN
CORE_OPERATION_REQUIRES_PAID_LLM     = NO
DEPLOYMENT_STYLE                     = MODULAR_MONOLITH_FIRST
HUMAN_TIME                           = FIRST_CLASS_COST
SCALING                              = EVIDENCE / REVENUE / EXPLICIT AUTHORITY
```
