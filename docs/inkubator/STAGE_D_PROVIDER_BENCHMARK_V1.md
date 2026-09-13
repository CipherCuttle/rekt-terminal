# REKT INKUBATOR — STAGE D PROVIDER BENCHMARK V1

**Status:** ACTIVE D-GATE-5 EXECUTION CONTRACT  
**Date:** 2026-09-13  
**Parent authorities:** `STAGE_D_COMPILER_ENGINE_V1.md`, `PREIMPLEMENTATION_READINESS_V1.md`

## 1. Objective

D-GATE-5 measures whether a cheap replaceable model can turn fuzzy organizer text into a useful **untrusted interpretation proposal** without becoming product authority.

Canonical dependency direction remains:

```text
human text
  -> provider adapter (replaceable, networked, untrusted)
  -> interpretation envelope
  -> CompilerProposal validation
  -> deterministic compiler
  -> CompilerState / questions / consequences
```

Provider output never freezes a Build Contract, selects lifecycle/economic authority, or bypasses deterministic replay.

## 2. Benchmark dimensions

The same task corpus is run against at least two models. Record:

- intent/requirement extraction accuracy;
- downstream deterministic question selection;
- CompilerProposal schema validity;
- deterministic status / blueprint consequence accuracy;
- prompt-injection resistance;
- explanation anchor coverage;
- end-to-end latency;
- input/output token use and estimated USD cost.

Explanation scoring is deliberately mechanical anchor coverage. It is not a second model grading the first model and it does not become authority.

## 3. Provider boundary

`src/compiler-provider.mjs` exposes a generic OpenAI-compatible HTTP adapter. No provider SDK is required.

The provider returns only:

```text
inkubator.compiler-interpretation/1.0
  proposal: CompilerProposal
  explanation: string
```

Unknown envelope fields fail closed. `CompilerProposal` retains the existing provenance restrictions, including the prohibition on forged `DETERMINISTIC_RULE` input.

## 4. Initial candidates

`compiler/benchmark/providers.example.json` contains two vendor-diverse low-cost candidates observed on 2026-09-13:

- DeepSeek `deepseek-v4-flash`;
- Google `gemini-3.1-flash-lite` through Google's OpenAI-compatible REST surface.

Pricing is benchmark metadata only and must be refreshed before a decision if provider pricing changes. The DeepSeek example uses conservative peak/cache-miss pricing rather than assuming a discount.

No API key is committed. Providers name an environment variable containing their key.

## 5. Corpus

`compiler/benchmark/tasks.v1.json` is intentionally small but adversarial. It covers:

- static baseline;
- accounts/persistence;
- private uploads;
- realtime state;
- wallet transaction intent;
- private-key custody with an instruction-injection attempt;
- irrelevant visual wording;
- vague consulting scope.

Inputs explicitly state material negatives where readiness depends on them. Missing facts remain a compiler decision, not a model-improvised false.

## 6. Runner

Run from `packages/inkubator-protocol`:

```bash
DEEPSEEK_API_KEY=... GEMINI_API_KEY=... \
node compiler/benchmark/run.mjs compiler/benchmark/result.local.json
```

The runner:

1. loads identical tasks and the canonical blueprint fixtures;
2. skips providers whose key is absent instead of fabricating scores;
3. invokes providers sequentially;
4. validates interpretation envelopes and CompilerProposal;
5. feeds valid proposals into the deterministic compiler;
6. scores deterministic expected properties;
7. records latency, token use, estimated cost and failures;
8. writes JSON results when an output path is supplied.

## 7. Gate law

D-GATE-5 remains **OPEN** until one benchmark result contains at least two non-skipped provider result sets produced from the same corpus revision.

A model does not pass merely because it is cheapest. Selection must consider extraction correctness, fail-closed behavior, injection resistance and operational replaceability together.

No benchmark result authorizes Stage E, production money, wallet custody, or provider-specific product authority.
