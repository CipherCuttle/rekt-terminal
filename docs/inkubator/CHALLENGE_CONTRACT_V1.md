# REKT INKUBATOR — Challenge Contract V1

**Status:** PLANNING CONTRACT / NOT IMPLEMENTATION AUTHORITY UNTIL MERGED

**Parent:** `CHALLENGE_OS_NORTH_STAR_V1.md`

**Date:** 2026-09-13

## 1. Purpose

Define the smallest versioned contract needed to launch, enter, evaluate and close programmable Challenges without creating a second Mission/Ship truth system.

The contract must support:

1. ordinary software Build Challenges;
2. deployed Agent Challenges;
3. hidden-evaluation Agent Arenas.

If these cannot share this contract without bespoke domain forks, stop and narrow the abstraction.

---

## 2. New domain nouns

### Challenge

Organizer-authored immutable-after-LIVE program defining eligibility, artifact expectations, evaluators, judging, budgets and lifecycle.

### ChallengeEntry

Binding between one Challenge and one participating Player/Party + existing Mission + Project.

### EvaluationRun

One immutable attempt of one versioned evaluator configuration against one ChallengeEntry/artifact snapshot.

No new parallel Project, Mission, evidence, Ship or reputation stores are authorized.

---

## 3. Authority model

### Challenge author/organizer may

- create DRAFT Challenge;
- define brief and entry constraints;
- configure allowed evaluator types;
- configure practice/final attempt budgets;
- define rubric/scoring and reward description;
- ARM and publish Challenge;
- record human judging where contract allows;
- close Challenge according to lifecycle.

### Challenge author/organizer may not

- silently edit LIVE rules;
- fabricate GitHub observations;
- fabricate evaluator pass results;
- mark participant-controlled claims PROVEN;
- mutate Ship Receipts;
- mint reputation outside versioned Challenge/Ship rules;
- weaken platform trust boundaries for a specific sponsor.

### Participant may

- join eligible Challenge;
- bind/create Mission + Project;
- connect source;
- submit claims/updates;
- request Help/Test;
- trigger allowed practice/final evaluations within budget;
- prepare/submit Ship.

### Participant may not

- select hidden final cases;
- change evaluator version;
- alter scoring rules after LIVE;
- create a passing EvaluationRun directly;
- approve own final outcome;
- mint PROVEN evidence.

---

## 4. Canonical lifecycle

### Challenge state

```text
DRAFT
ARMED
LIVE
ENTRY_LOCKED
FINAL_EVALUATION
CLOSED
CANCELLED
```

Allowed high-level transitions:

```text
DRAFT → ARMED → LIVE → ENTRY_LOCKED → FINAL_EVALUATION → CLOSED
DRAFT → CANCELLED
ARMED → DRAFT
ARMED → CANCELLED
LIVE → CANCELLED   # exceptional, visible terminal state with reason
```

No direct `DRAFT → LIVE` in the final UX; ARMED exists to expose the exact frozen candidate before publication.

### Entry state

```text
JOINED
BUILDING
READY_FOR_EVAL
FINALIZING
SUBMITTED
ACCEPTED
NOT_ACCEPTED
WITHDRAWN
```

Entry state is not Mission state. It reflects Challenge participation only.

Mission remains the operational builder state and single source of canonical `next_move`.

### Evaluation state

```text
QUEUED
RUNNING
PASS
FAIL
ERROR
UNAVAILABLE
CANCELLED
```

PASS remains OBSERVED evaluation state. It is never equivalent to PROVEN Ship acceptance.

---

## 5. Versioning / freeze law

Every Challenge has:

- `challenge_id` — stable identity;
- `contract_version` — semantic version of the Challenge contract instance;
- `contract_hash` — immutable digest of the normalized frozen LIVE contract;
- `evaluator_versions` — version IDs for each evaluator;
- `amendment_history` — visible list of post-LIVE amendments.

At transition to LIVE:

1. normalize contract;
2. validate schema;
3. resolve evaluator references;
4. calculate hash;
5. persist immutable snapshot;
6. expose the frozen rules publicly/appropriately to entrants.

A post-LIVE change that affects eligibility, scoring, final evaluator behavior, deadlines or required artifact semantics creates an explicit amendment/version. Never overwrite the prior contract.

---

## 6. Conceptual contract shape

Illustrative only; exact wire schema should be frozen separately before implementation.

```yaml
schema_version: challenge.contract.v1
challenge_id: CH-001
contract_version: 1

title: Build a Useful Ink Agent
summary: Build an agent that performs a useful task on Ink.

organizer:
  authority_id: ORG-001
  display_name: REKT Inkubator

lifecycle:
  opens_at: 2026-10-01T00:00:00Z
  entry_locks_at: 2026-10-08T00:00:00Z
  final_evaluation_starts_at: 2026-10-08T00:00:00Z
  closes_at: 2026-10-09T00:00:00Z

eligibility:
  team_size_min: 1
  team_size_max: 3
  invite_only: false

entry:
  repository_required: true
  artifact_kind: AGENT
  deployment_required: true

requirements:
  - key: source_connected
    evaluator: github-source-v1
  - key: endpoint_live
    evaluator: remote-a2a-v1
  - key: external_test
    evaluator: external-human-test-v1

evaluation:
  practice:
    suite: ink-agent-practice-v1
    attempts_per_entry: 20
  final:
    suite: ink-agent-hidden-v1
    attempts_per_entry: 2
    hidden: true

judging:
  method: HYBRID
  automated_weight: 60
  human_weight: 40

capabilities:
  mcp: OPTIONAL
  a2a: REQUIRED
  erc8004: OPTIONAL
  sentry_launch: OPTIONAL
  x402: OPTIONAL

resource_budget:
  platform_cash_compute_usd: 0
  platform_llm_usd: 0
  max_entries: 50
  max_concurrent_final_evals: 1
  eval_timeout_seconds: 300
  on_budget_exhaustion: QUEUE

reward:
  description: Winner + featured Ship receipt
```

---

## 7. Artifact kinds V1

Start with a deliberately small set:

```text
WEB_ARTIFACT
API_SERVICE
AGENT
OTHER_REMOTE_ARTIFACT
```

Do not create dozens of artifact classes before real Challenges require them.

An artifact kind affects evaluator compatibility, not truth authority.

---

## 8. Evaluator contract

Every evaluator definition must declare:

```text
evaluator_id
version
kind
input_contract
output_contract
trust_level
execution_zone
timeout
network_policy
attempt_cost_class
practice_or_final_eligibility
```

### Evaluator kinds V1

```text
GITHUB_OBSERVATION
REMOTE_ENDPOINT
PROTOCOL_CONFORMANCE
EXTERNAL_HUMAN_TEST
HUMAN_RUBRIC
SANDBOXED_TASK        # deferred until isolated runner exists
```

### Evaluator output envelope

Conceptual:

```yaml
schema_version: challenge.evaluation.result.v1
run_id: ER-001
challenge_id: CH-001
entry_id: CE-001
evaluator_id: remote-a2a-v1
evaluator_version: 1
artifact_snapshot:
  git_sha: abc123
  artifact_url: https://...
status: PASS
started_at: ...
finished_at: ...
metrics:
  latency_ms: 430
observations:
  - endpoint responded
  - required method succeeded
provenance:
  execution_zone: REMOTE_ENDPOINT
  runner_version: verifier-v2
```

This envelope is append-oriented/immutable after completion except for administrative correction metadata that never rewrites original observed facts.

---

## 9. Practice and final evaluation

### Practice

Purpose: builder feedback.

May expose:

- visible cases;
- logs;
- annotations;
- failure reasons;
- remediation hints;
- GitHub Check results.

Practice results may influence Next Move but cannot determine a hidden final result unless contract explicitly says practice == final.

### Final

Purpose: competition/acceptance result.

Requirements:

- exact suite version frozen;
- hidden inputs unavailable to participant/client bundle;
- strict attempt count;
- immutable artifact snapshot per attempt;
- no participant-selected scorer;
- bounded execution cost;
- audit trail.

Where randomness is used, record seed or reproducibility metadata unless secrecy/fairness requires delayed disclosure.

---

## 10. Scoring models V1

Support only these initially:

### PASS_FAIL

All required gates pass.

### WEIGHTED_METRICS

Deterministic normalized metrics with frozen weights.

### HUMAN_RUBRIC

Versioned judge rubric with explicit categories.

### HYBRID

Automated eligibility/metrics + human rubric.

Avoid arbitrary user-supplied code as scoring logic in V1.

Avoid LLM-only scoring as authoritative final judgment.

---

## 11. GitHub integration

GitHub is a source/evidence adapter and feedback surface.

Challenge OS should be able to publish Challenge status back into the builder workflow through GitHub Checks where permissions permit.

Example:

```text
REKT / CHALLENGE
✓ source connected
✓ build observed
✓ practice suite
✗ public endpoint
○ external tester
○ final evaluation
```

A GitHub Check is presentation of canonical Challenge/evaluator state, not a second state machine.

Public-repo GitHub Actions may be used for participant-visible practice tests where economically/operationally appropriate, but final Challenge authority cannot rely on participant-controlled CI alone.

---

## 12. Agent contract direction

For Agent Challenges, prefer interoperable remote interfaces over requiring one framework.

### A2A

Preferred initial agent-to-arena interaction candidate for task/message lifecycle and capability discovery.

### MCP

Primary role remains builder/coding-agent access to Inkubator Mission/Challenge context and bounded actions.

Do not conflate:

- `MCP = coding/tool context into Inkubator`
- `A2A/HTTP = deployed Challenge agent interaction`

An Agent Challenge may optionally require both, but each has a distinct job.

---

## 13. Optional onchain/Ink adapters

Potential capability adapters:

```text
ERC8004_IDENTITY
SENTRY_AGENT_LAUNCH
X402_PAYMENT
INK_RPC / contract interaction
```

Rules:

1. optional unless Challenge explicitly requires capability;
2. capability existence is OBSERVED, not quality proof;
3. token/market performance is excluded from score by default;
4. participant/sponsor pays gas/provider costs pre-revenue;
5. Inkubator stores only minimum necessary identifiers/provenance;
6. adapter failure must not corrupt canonical Mission/Ship state.

---

## 14. Resource budget contract

Every Challenge must carry explicit resource limits even when all values are zero/free-tier backed.

Minimum fields:

```text
max_entries
max_practice_attempts_per_entry
max_final_attempts_per_entry
max_eval_runtime_seconds
max_eval_memory_mb          # when sandboxed
max_eval_cpu                # when sandboxed
max_concurrent_evals
platform_cash_compute_usd
platform_llm_usd
on_budget_exhaustion
```

Allowed `on_budget_exhaustion` V1:

```text
QUEUE
PAUSE_CHALLENGE
DENY_NEW_EVALS
```

Forbidden:

```text
AUTO_UPGRADE
AUTO_SPEND
```

Pre-revenue defaults:

```text
platform_cash_compute_usd = 0
platform_llm_usd = 0
max_concurrent_evals = 1
```

---

## 15. Execution trust zones

```text
ZONE 0 — TRUSTED PRODUCT
API / DB / authority / receipts

ZONE 1 — SAFE ADAPTERS
GitHub metadata, provider APIs, remote endpoint verifier

ZONE 2 — HOSTILE EXECUTION
sandboxed participant code/agent tasks
```

ZONE 2 must never receive trusted production credentials.

Result ingestion from ZONE 2 is narrow and schema-validated.

---

## 16. Challenge Kit V1 direction

A Challenge Kit is packaging, not a new truth system.

May include:

- starter repo/template;
- SDK examples;
- environment docs;
- mock/practice fixtures;
- GitHub workflow;
- MCP config/example;
- A2A agent-card example;
- optional Ink/Sentry/ERC-8004 adapters;
- practice evaluator specification.

A Kit version is pinned by the Challenge but builders may deviate unless contract explicitly requires a component.

---

## 17. Result / winner model

A Challenge result must be derivable from frozen contract evidence.

Potential result facts:

```text
ENTRY_ACCEPTED
ENTRY_NOT_ACCEPTED
RANK
CATEGORY_WIN
JUDGE_AWARD
AUTOMATED_SCORE
HUMAN_SCORE
```

Result facts are append-oriented and versioned.

If an organizer overrides an automated result, record:

- who;
- when;
- why;
- prior result;
- resulting authoritative decision.

Never silently rewrite evaluator output.

---

## 18. Ship relationship

ChallengeEntry submission does not replace Ship.

Preferred relationship:

```text
ChallengeEntry
   ↓
prepare Ship
   ↓
artifact + evidence snapshot
   ↓
final evaluation / review
   ↓
accepted Ship Receipt
   ↓
Challenge result references Ship Receipt
```

This preserves the existing durable artifact/evidence boundary.

An accepted Challenge outcome without a corresponding accepted Ship should be exceptional and explicitly modeled if ever needed.

---

## 19. Player history relationship

Challenge results enrich existing Player history with durable facts such as:

```text
entered Challenge X
shipped accepted entry
external tester on Y
accepted Assist on Z
category winner
arena result
```

No universal XP.

No editable skill score.

No popularity/follower metric as default reputation authority.

---

## 20. Open questions before implementation

These must be resolved in planning/research before C1 code freezes:

1. Can one Project enter multiple Challenges simultaneously, or must entries bind separate Missions?
2. May one ChallengeEntry include multiple Projects/artifacts in V1?
3. Exact organizer authority model: Player-owned, operator-created, organization entity, or phased path?
4. Exact amendment policy after LIVE: which changes require participant re-consent?
5. Exact hidden-evaluation secrecy/storage boundary.
6. Exact dispute/appeal mechanism for human or automated results.
7. Exact method for cost attribution per EvaluationRun.
8. Whether Challenge results require accepted Ship in all V1 templates.
9. How Challenge cancellation affects existing Ships and builder history.
10. Which Agent protocol subset is mandatory for first arena.

Default bias: choose the smallest rule that keeps the first three Challenge templates coherent.

---

## 21. Contract kill criteria

Do not implement this contract if:

- it duplicates Mission or Ship state;
- Challenge-specific evaluator logic must be hardcoded throughout product modules;
- organizer rule edits can rewrite entrant history;
- participant clients can create PASS/PROVEN results directly;
- final hidden evaluator data must be exposed to web clients;
- evaluator execution requires trusted product secrets;
- cost cannot be bounded before a run starts;
- a provider-specific integration becomes mandatory core truth;
- normal Build Challenge, Agent Challenge and Arena cannot share the core contract.

---

## 22. Verdict

`CHALLENGE_CONTRACT = VERSIONED + FROZEN_AT_LIVE`

`ENTRY = BINDING_TO_EXISTING_MISSION_PROJECT`

`EVALUATION_RUN = IMMUTABLE_OBSERVATION`

`PASS != PROVEN`

`SHIP = DURABLE_ACCEPTANCE_BOUNDARY`

`FINAL_EVAL = HIDDEN_WHERE_NEEDED + BOUNDED`

`PARTICIPANT_CODE = HOSTILE`

`PROVIDER_ADAPTERS = OPTIONAL`

`CASH_SPEND = EXPLICITLY_BUDGETED`

`PRE_REVENUE_DEFAULT_CASH_BUDGET = 0`
