# REKT INKUBATOR — PREIMPLEMENTATION READINESS V1

**Status:** PLANNING GATE / NOT IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-13  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`

This document exists to prevent two opposite failures:

1. starting implementation while core contracts are still ambiguous;
2. continuing to produce planning documents after the next bounded implementation step is already clear.

The rule is simple:

> **Plan until the next stage has an executable contract, then build it. Do not plan the entire North Star in implementation-level detail before Stage B exists.**

## 1. Current repo mapping

The current repository already provides the intended homes for much of the next work.

### Canonical protocol

Existing:

```text
packages/inkubator-protocol/
  schema/
    player.schema.json
    round.schema.json
    ship-receipt.schema.json
  src/
  test/
```

Stage B should extend this package additively with Challenge / Build Contract schemas and pure state logic rather than inventing a second protocol package.

### Product backend

Existing:

```text
apps/inkubator-api/
```

It already contains auth/authorization, database, contracts, GitHub integration, jobs/outbox and current product routes. Stage C should add a bounded Challenge domain module rather than place more unrelated logic into the large existing `app.ts` / `contract.ts` files.

Target shape should be modular within the same deployable API, for example:

```text
apps/inkubator-api/src/challenge/
  repository
  service
  routes
  projections
  commands
```

Exact filenames remain implementation decisions.

### Verifier

Existing:

```text
apps/inkubator-verifier/
```

Retain as an isolated trust boundary. Do not fold hostile URL/network verification back into the API for deployment simplicity.

### Design lab

Existing:

```text
apps/inkubator-lab/
```

Use for Compiler/Challenge/Test-Arena visual calibration and states, not as production truth.

### Production frontend

There is currently no dedicated `apps/inkubator-web` directory in this planning branch. Before Stage E implementation, explicitly decide whether to create a dedicated Challenge frontend app or promote an existing authenticated Inkubator surface. Do not accidentally mix the trading terminal `apps/web` product with Inkubator merely because it already exists.

### Builder tooling

Existing:

```text
packages/cli
packages/sdk
packages/mcp
```

Stage F should extend these rather than create parallel Challenge-specific client stacks.

## 2. Planning gates before Stage B code

Only the following must be resolved before protocol implementation begins.

### B-GATE-1 — canonical Challenge noun/state set

Freeze the minimal pure-domain concepts:

```text
Challenge
ChallengeEntry
BuildContract
OutcomeContract
ProductionEnvelope
DeliveryContract
Preference
NormativeReference
SubmissionManifest
Qualification
Selection
Receipt
```

Avoid importing every historical Mission/Ship noun into the new public contract.

### B-GATE-2 — lifecycle + invariant table

For every state transition specify:

- legal previous state;
- actor/authority;
- required facts;
- authoritative timestamp source;
- resulting immutable facts;
- idempotency identity;
- illegal/rejected cases.

### B-GATE-3 — versioning/digest law

Freeze what contributes to:

- `mechanism_version`;
- Build Contract digest;
- normative reference digests;
- submission digest;
- receipt/correction lineage.

### B-GATE-4 — explicit Stage-B acceptance suite

Before coding, write the exact properties/tests Stage B must pass. Examples:

- terms cannot mutate after freeze;
- illegal transitions reject;
- preference never changes qualification;
- new mechanism version does not reinterpret old Challenge;
- no IP-transfer fact before successful settlement fact when money is eventually used;
- submission identity is immutable;
- receipt correction appends rather than overwrites.

**When B-GATE-1..4 are satisfied, stop planning Stage B and implement it.**

## 3. Planning gates before Compiler Stage D

Do not fully design these before Stage B unless doing so changes the Stage-B protocol.

Required before Stage D:

### D-GATE-1 — CompilerState schema

One structured state model covering intent, known/assumed/unknown, project class, requirements, production envelope, risk profile, blueprint candidates, architecture, acceptance, preferences, findings and unresolved decisions.

### D-GATE-2 — blueprint contract

Define one blueprint schema before authoring the initial ~5 families.

### D-GATE-3 — causal rule format

Define how requirement changes create consequences without model improvisation.

### D-GATE-4 — compiler gauntlet corpus

Create 100–200 synthetic cases over time, beginning with a smaller seed corpus. Store expected properties rather than one canonical stack.

Mutations should include:

- add/remove accounts;
- add/remove persistence;
- read-only → transaction capable;
- add uploads;
- add email notifications;
- add realtime;
- 1k users → 100k/1m users;
- add private keys/custody;
- add mutable private dependency;
- vague/unbounded consulting request.

Expected assertions include:

- must ask about identity;
- must require persistence;
- must reject/flag custody;
- must not add a database;
- must change risk tier;
- must become unsupported/needs narrowing;
- unrelated architectural decisions must remain stable.

### D-GATE-5 — cheap-model benchmark

Benchmark at least two replaceable low-cost models against the same structured tasks. Score intent extraction, question selection, schema validity, explanation quality, prompt-injection resistance, latency and cost.

Do not make provider choice product authority.

## 4. Planning gates before Stage E UI

### E-GATE-1 — final Alpha information architecture

Required public surfaces only:

```text
Discover
Compiler / Create
Challenge
My Build
Review / Test Arena
Receipt / History
Operator Exceptions
```

Historical WORLD / COMMAND / PLAYER / PROJECT / SHIP surfaces may contribute components/data but do not automatically remain top-level navigation.

### E-GATE-2 — canonical screen states

For every launch surface define:

```text
normal
loading
empty
error
unavailable/stale
unauthorized
mobile
reduced-motion
```

### E-GATE-3 — no fake instrumentation

Every Faceplate display/micrographic that presents state must map to real data or be clearly decorative.

## 5. Planning gates before external-human Alpha

These are mandatory, but do not block Stage B protocol implementation.

### H-GATE-1 — Trust & Reputation Threat Model

Create `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1` before Alpha.

### H-GATE-2 — claims/brand policy

Freeze allowed public language around:

- REKT affiliation/identity;
- `production ready` / security language;
- qualification;
- AI recommendations;
- prize/payment state;
- audits/reviews;
- sponsorship/official endorsement.

### H-GATE-3 — data inventory + retention matrix

For identity, GitHub data, private source, artifacts, evidence, logs, receipts, model prompts and backups, define collection purpose, access, retention/deletion, public/private projection and recovery behavior.

### H-GATE-4 — operator runbooks

At minimum:

- GitHub integration unavailable/compromised;
- model provider unavailable;
- compiler output suspected wrong;
- database restore;
- worker stuck/retry storm;
- verifier unavailable;
- private-source exposure suspicion;
- submission dispute;
- receipt correction;
- budget cap reached.

### H-GATE-5 — failure/chaos matrix

Automate or rehearse deadline races, duplicate requests, worker crash-after-commit, provider outage, GitHub revocation, archive delay, DB connection exhaustion and zero-inference mode.

## 6. Cost/operation readiness

`PRE_REVENUE_INFRA_CAP_V1.md` now defines the owner-funded bootstrap ceiling.

Before deploying a new provider/service record:

```text
purpose
monthly expected cost
hard cost cap
failure behavior
whether product correctness depends on it
operator burden
exit/replacement path
```

No provider is architecture authority.

## 7. Documents/artifacts worth creating next

Prioritized planning backlog:

1. **Stage-B protocol contract + property-test matrix** — do next; directly unlocks implementation.
2. **Current-state migration/ownership map** — map existing DB/routes/Ship/Player/Project/Mission to Challenge use, preserve vs park vs adapt.
3. **CompilerState + blueprint schema** — before Compiler implementation.
4. **Compiler Gauntlet seed corpus** — executable fixtures, not prose.
5. **Trust & Reputation Threat Model** — before Alpha, earlier if it changes protocol choices.
6. **Brand/Claims policy** — before any public REKT-branded Alpha promotion.
7. **Data retention matrix** — before accepting private external source.
8. **Operator runbooks + exception surface contract** — before Alpha.
9. **Cost dashboard/ledger contract** — before external use can create variable costs.

Everything else is optional until one of these reveals a concrete gap.

## 8. Planning anti-goals

Do not create:

- detailed implementation specs for K-stage North Star features years before use;
- dozens of blueprint documents before the blueprint schema exists;
- separate architecture docs that repeat the same authority in different words;
- fake precision in timelines/cost/prize estimates;
- unresolved “TBD” lists without owner/stage/reopen condition;
- parallel roadmaps for old and new product identities.

## 9. Planning completion rule

Stage A planning is complete enough to move toward Stage B when:

```text
North Star locked                         YES
Funded Challenge survivor mechanism       YES
Visual authority                          YES
Solo-operator constraint                  YES
Bootstrap budget                          YES
Alpha cutline                             YES
Stage-B nouns/lifecycle/versioning         NEXT
Stage-B property-test matrix               NEXT
```

After the two `NEXT` items are frozen, additional broad ideation is not a prerequisite for Stage B implementation.

The highest-value next planning work is therefore **not another vision pass**. It is a precise Stage-B protocol contract and adversarial property-test matrix tied to the existing `packages/inkubator-protocol` package.
