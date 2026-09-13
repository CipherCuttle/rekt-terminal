# REKT INKUBATOR — STAGE D PROVIDER BENCHMARK V1

**Status:** ACTIVE D-GATE-5 EXECUTION CONTRACT  
**Date:** 2026-09-13  
**Parent authorities:** `STAGE_D_COMPILER_ENGINE_V1.md`, `PREIMPLEMENTATION_READINESS_V1.md`

## 1. Objective

D-GATE-5 measures whether cheap replaceable models can turn fuzzy organizer text into useful **untrusted interpretation proposals** without becoming product authority.

Canonical direction remains:

```text
human text
  -> provider adapter (replaceable, networked, untrusted)
  -> interpretation envelope
  -> CompilerProposal validation
  -> deterministic compiler
  -> CompilerState / questions / consequences
```

Provider output never freezes a Build Contract, selects lifecycle/economic authority, or bypasses deterministic replay.

## 2. Provider authority law

Every semantic item emitted by a provider — requirements, knowledge, outcome criteria and delivery criteria — MUST carry `MODEL_PROPOSAL` provenance.

A provider may not emit `SOURCE`, `ORGANIZER_ACCEPTED`, or `DETERMINISTIC_RULE` provenance. The adapter also requires `proposal.source_intent` to exactly equal the organizer text supplied to the call.

Therefore a good extraction normally remains `NEEDS_DECISION` until a human/source-authority step accepts meaning. Benchmarking extraction quality must never self-promote model output into contract authority.

## 3. Benchmark dimensions

The same corpus is run against at least two models. Record:

- requirement extraction accuracy, including penalties for extra semantics;
- deterministic question selection accuracy, including penalties for extra/missing questions;
- CompilerProposal/envelope validity;
- deterministic status and blueprint consequence accuracy;
- provider-authority safety;
- exact source-intent preservation;
- prompt-injection resistance;
- explanation anchor coverage;
- end-to-end latency;
- input/output token use and estimated USD cost.

Explanation scoring is deterministic anchor coverage. It is not a second model grading the first model and it is not product authority.

## 4. Provider boundary

`src/compiler-provider.mjs` exposes a generic OpenAI-compatible HTTP adapter. No provider SDK is required.

The provider returns only:

```text
inkubator.compiler-interpretation/1.0
  proposal: CompilerProposal      # MODEL_PROPOSAL semantics only
  explanation: string             # informational only
```

Unknown envelope fields fail closed. Provider attempts to claim source/human/deterministic provenance fail validation.

## 5. Initial candidates

`compiler/benchmark/providers.example.json` contains two vendor-diverse low-cost candidates observed on 2026-09-13:

- DeepSeek `deepseek-v4-flash`;
- Google `gemini-3.1-flash-lite` through Google's OpenAI-compatible REST surface.

Pricing is benchmark metadata only and must be refreshed before a provider decision if pricing changes. The DeepSeek example uses conservative peak/cache-miss pricing rather than assuming a discount.

No API key is committed. Providers name an environment variable containing their key.

## 6. Corpus

`compiler/benchmark/tasks.v1.json` begins with ten adversarial cases covering:

- static baseline;
- accounts/persistence;
- private uploads;
- realtime state;
- notifications;
- wallet transaction intent;
- private-key custody plus instruction injection;
- irrelevant visual wording;
- 100x traffic;
- vague consulting scope.

Inputs state material negatives where readiness/blueprint selection depends on them. Missing facts remain unresolved rather than silently becoming false.

## 7. Runner

From `packages/inkubator-protocol`:

```bash
DEEPSEEK_API_KEY=... GEMINI_API_KEY=... \
node compiler/benchmark/run.mjs compiler/benchmark/result.local.json
```

The runner:

1. loads identical tasks and canonical blueprint fixtures;
2. records a SHA-256 digest of the exact corpus and provider config;
3. skips providers whose key is absent instead of fabricating scores;
4. invokes providers sequentially;
5. validates interpretation envelopes and MODEL_PROPOSAL-only provenance;
6. feeds valid proposals into the deterministic compiler;
7. scores expected properties and authority safety;
8. records latency, token use, estimated cost and failures;
9. writes JSON results when an output path is supplied.

CI tests adapter/scoring behavior using fake HTTP responses only. CI performs no paid model calls.

## 8. Gate law

D-GATE-5 remains **OPEN** until a single benchmark result contains at least two providers that each completed every task on the same recorded corpus digest.

A provider does not pass merely because it completed the run or is cheapest. Per-task pass requires exact expected requirement/question sets, explanation anchors, status/blueprint consequence, source-intent preservation, injection resistance and provider-authority safety.

Provider selection remains a separate human decision considering correctness, fail-closed behavior, cost, latency and replaceability.

No benchmark result authorizes Stage E, production money, wallet custody, or provider-specific product authority.
