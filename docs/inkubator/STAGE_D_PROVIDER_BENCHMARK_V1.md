# REKT INKUBATOR — STAGE D PROVIDER BENCHMARK V1

**Status:** D-GATE-5 EVIDENCE COMPLETENESS PASS — EXECUTION COMPLETE  
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

## 5. Provider lineage

The initial candidate set in `compiler/benchmark/providers.example.json` is historical benchmark metadata, not provider authority.

A free-only OpenRouter preflight was retained as negative evidence: zero-price/no-fallback constraints held, but the tested free routes were not reliable enough for D-GATE-5 completion. Free-model roulette stopped rather than weakening the gate.

The durable bounded configuration is `compiler/benchmark/providers.openrouter-stable.json` and pins:

- Mistral Small 3.2 24B through OpenRouter to DeepInfra;
- Gemini 3.1 Flash-Lite through OpenRouter to Google AI Studio.

The stable configuration requires explicit runtime authorization and a bounded aggregate budget. Mistral additionally requires no fallback, denied data collection and zero-data-retention routing constraints. Pricing is benchmark metadata only and must be refreshed before any future paid execution.

No API key is committed. The stable OpenRouter routes use `OPENROUTER_API_KEY` at runtime.

## 6. Corpus

`compiler/benchmark/tasks.v1.json` contains ten adversarial cases covering:

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

From `packages/inkubator-protocol`, the benchmark runner consumes a provider config plus the frozen task corpus and writes a receipt/result artifact when requested.

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

## 8. Gate closure evidence

D-GATE-5 evidence completeness passed on 2026-09-13. One frozen corpus digest was completed by two pinned providers without granting either provider semantic authority.

Canonical evidence:

- execution head: `b91c42d4c130878317471a43815eff32954386ad`;
- workflow run: `34782172374`;
- artifact: `stage-d-paid-benchmark-v3-b91c42d4c130878317471a43815eff32954386ad`;
- artifact ID: `10324978024`;
- artifact digest: `sha256:f9a8ef9fc24e424b52a3c00154c669e51d89e3f3e2a374d734beb559c760a38a`;
- frozen corpus digest: `2f5b19ff4fd6cfc61b8e50a81d96632aa75d7cab16a3a2f8820b922281b4b3d7`;
- provider-config digest: `1fd480cf3b3b005370bf5e50eb49e1d71a99600531c9f28bb7fdc64fbf121b5f`;
- Mistral / DeepInfra: `COMPLETED`, 10/10 tasks, 3/10 strict full-scorecard passes, reported cost `$0.001828825`;
- Gemini / Google AI Studio: `COMPLETED`, 10/10 tasks, 2/10 strict full-scorecard passes, reported cost `$0.010542`;
- successful run total: `$0.012370825`;
- final benchmark-attempt accounting: `$0.041049683` under the authorized `$0.15` aggregate ceiling.

The weak strict-scorecard counts are evidence **against** model authority, not evidence of a semantic winner. `d_gate_5_evidence_ready = true` means the evidence-completeness gate is satisfied; provider selection remains a separate human decision.

The prior paid benchmark authorization is consumed. Additional paid model calls require fresh explicit authorization.

No benchmark result authorizes production money, wallet custody, signing/broadcast, or provider-specific product authority. Stage-E work remains subject to the Stage-D integrated closure and Stage-E planning gates.
