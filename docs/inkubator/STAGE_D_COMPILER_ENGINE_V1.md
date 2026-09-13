# REKT INKUBATOR — STAGE D COMPILER ENGINE V1

**Status:** ACTIVE IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-13  
**Parent authorities:** `REKT_INKUBATOR_NORTH_STAR_V2.md`, `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`, `PREIMPLEMENTATION_READINESS_V1.md`

## 1. Objective

Stage D establishes the deterministic compiler kernel that sits between fuzzy organizer intent and the Stage-B Build Contract protocol.

The compiler may produce **candidates**. It does not freeze Challenges and it does not become economic/product authority.

Canonical dependency direction:

```text
human input / provider proposal
  -> CompilerProposal (untrusted structured input)
  -> deterministic CompilerState
  -> versioned causal consequences + blueprint candidates
  -> Build Contract candidate
  -> Stage-B validation
  -> organizer acceptance
  -> Stage-B hash/freeze
```

The reverse dependency is forbidden: Stage-B protocol code must not depend on an LLM, provider, compiler adapter, network call or model availability.

## 2. Stage-D authority boundary

Stage D owns only compiler semantics and fixtures required to make engineering consequences legible and replayable.

It may:

- validate structured compiler proposals;
- preserve Known / Assumed / Unknown with provenance;
- apply versioned deterministic causal rules;
- derive a Production Envelope, risk/quality profiles and acceptance modules;
- select/exclude versioned blueprint candidates by inspectable rules;
- surface contradictions and material unknowns as unresolved decisions;
- emit a Stage-B-valid Build Contract candidate when CompilerState is `READY`.

It may not:

- freeze a Build Contract;
- invent or override Stage-B lifecycle/economic semantics;
- silently reconcile contradictory organizer/model claims;
- treat model/provider output as deterministic or organizer authority;
- require inference for operation of an already-frozen Challenge;
- add production wallet signing, private-key custody, transaction broadcast or real-money execution.

## 3. CompilerProposal boundary

Provider/chat integrations must terminate at `CompilerProposal`.

Allowed input provenance is:

```text
SOURCE
MODEL_PROPOSAL
ORGANIZER_ACCEPTED
```

`DETERMINISTIC_RULE` is reserved for compiler-owned derived facts and cannot be forged by a provider proposal.

Unknown/extra top-level proposal fields fail closed. In particular a provider cannot submit authoritative `risk_profile`, `selected_blueprint`, `causal_facts`, `status` or Build Contract lifecycle/economic authority.

## 4. CompilerState V1

Canonical schema:

`packages/inkubator-protocol/schema/compiler-state.schema.json`

V1 contains:

- source intent;
- project fingerprint;
- Known / Assumed / Unknown ledger;
- normalized requirement facts with provenance;
- Production Envelope;
- risk and quality profiles;
- blueprint candidates + selected blueprint when deterministic and unique;
- causal facts with rule IDs;
- sensitivity points;
- outcome/delivery contract candidates;
- preferences and reference-architecture candidate;
- acceptance plan;
- questions, findings and unresolved decisions;
- `READY | NEEDS_DECISION | UNSUPPORTED` status.

Compiler output must be deterministic for semantically identical structured input. Input ordering is not allowed to change output semantics.

## 5. Blueprint contract

Canonical schema:

`packages/inkubator-protocol/schema/compiler-blueprint.schema.json`

A blueprint is versioned product substrate, not an active-Challenge mutable default. It declares:

- ID/version/health;
- applicability (`required_true`, `any_true`, `excluded_true`);
- default assumptions;
- required questions;
- causal sensitivity points;
- reference architecture;
- supported Production Envelope;
- baseline risk profile;
- acceptance modules;
- known limits.

Initial V1 seed families are intentionally small:

```text
WEB_STATIC
WEB_CRUD
WEB_REALTIME
WEB3_READ_APP
WEB3_TRANSACTION_APP
```

Do not add dozens of blueprint documents before the gauntlet demonstrates a real coverage gap.

## 6. Causal rule format

Canonical rules live as exported structured data in `src/compiler.mjs` (`CAUSAL_RULES`). Each rule has:

```text
id
when: requirement key + exact value
effects[]
```

Supported effect classes include deterministic facts, risk/quality escalation, questions, findings, unsupported boundaries, sensitivity points and acceptance modules.

Rules are:

- versioned by stable rule IDs;
- inspectable;
- replayable;
- applied in stable ID order;
- provider-independent;
- forbidden from silently overriding contradictory source facts.

Contradictory requirement values produce `NEEDS_DECISION`.

## 7. Readiness law

`UNSUPPORTED` wins when a deterministic rule identifies a boundary the current product does not support. V1 explicitly fails closed on platform custody of private keys.

`NEEDS_DECISION` applies when material contradictions, material `UNKNOWN`s, blocking questions, or zero/multiple matching active blueprints remain.

`READY` requires no unsupported boundary and no unresolved decision. `READY` does not itself freeze anything.

## 8. Build Contract bridge

`buildBuildContractCandidate()` combines a `READY` CompilerState with caller-supplied Stage-B authority/economic/scheduling fields, strips compiler-only provenance from Stage-B criteria/knowledge, and delegates readiness validation to the existing Stage-B validator.

The result remains an unfrozen candidate with no `terms_digest`. Stage-B freeze semantics remain the only authority that can create the canonical frozen terms digest.

## 9. Provider / low-cost chat boundary

No provider SDK/API is part of this first kernel changeset.

Future adapters implement conceptually:

```text
interpretIntent(text/context) -> CompilerProposal
```

not:

```text
compileChallenge(text) -> authoritative BuildContract
```

Provider output is untrusted, schema-validated input. Model choice is replaceable substrate and is never product authority.

D-GATE-5 remains open until at least two low-cost providers are benchmarked on the same structured tasks for intent extraction, question selection, schema validity, explanation quality, injection resistance, latency and cost.

## 10. Exit condition

Stage D is closable only when executable tests prove:

1. the same structured input produces the same deterministic consequences;
2. meaningful requirement mutations produce justified architecture/contract/risk deltas;
3. irrelevant presentation wording does not create architecture/economic deltas;
4. provider/model proposals cannot forge deterministic or frozen authority;
5. Stage-B protocol tests remain green;
6. production money and Stage-E UI remain unauthorized.
