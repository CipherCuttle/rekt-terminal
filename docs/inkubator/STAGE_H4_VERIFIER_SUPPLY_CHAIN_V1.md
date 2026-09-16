# REKT INKUBATOR — STAGE H4 VERIFIER / SUPPLY-CHAIN ISOLATION V1

**Status:** IMPLEMENTED / CLOSURE GATE OPEN  
**Date:** 2026-09-16  
**Branch:** `agent/stage-h4-verifier-supply-chain-v1`  
**Parent closure:** H3 `ed91567f98221355ba08bd197a8be389007b892c` (`CLOSED/PASS_WITH_REVIEW_WAIVER`)  
**Parent authority:** `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md` T2 + T11  
**Merge authority:** NONE

## 1. Objective

H4 closes the bounded supply-chain and verifier-isolation risks required before H5. It does not redesign the Compiler, Test Arena or ship verifier. It promotes the already-frozen Stage-D blueprint registry and G2B2 trusted-module registry into explicit provenance inventories, and hardens the existing public-HTTPS verifier against special-address SSRF and unbounded requester stalls.

The H4 invariant is:

> **ONLY PINNED TRUSTED COMPILER AND RUNNER DEFINITIONS MAY EXECUTE UNDER THEIR PROMOTED IDENTITIES; PROMOTION PROVENANCE IS EXPLICIT, AND VERIFIER EGRESS IS RESTRICTED TO BOUNDED PUBLIC HTTPS TARGETS.**

## 2. Compiler blueprint provenance

Stage D already fail-closes deterministic CompilerState replay against the exact five blueprint `id@version` identities and canonical SHA-256 content digests. H4 preserves those digests unchanged and adds a machine-readable promotion inventory at:

`packages/inkubator-protocol/compiler/provenance/blueprints.v1.json`

Each promoted blueprint records:

- blueprint ID + version;
- repository source path;
- exact Git blob SHA-1 of the promoted source bytes;
- canonical semantic SHA-256 already used by the Stage-D pinned registry;
- promotion authority + exact H4 parent commit.

H4 tests recompute both Git object identity and canonical content identity from repository bytes. A same-ID/version semantic substitution therefore requires an explicit provenance change and still fails the existing Stage-D pinned-registry replay boundary until the registry is deliberately versioned/promoted.

## 3. Trusted objective-test module provenance

The G2B2 trusted fact runner remains intentionally tiny:

- `submission-lineage-integrity@1.0.0`;
- `archive-capture-integrity@1.0.0`.

Their frozen module descriptor digests remain unchanged. H4 does **not** rewrite those digests because active/frozen Challenge acceptance manifests may already bind them.

Instead H4 adds:

`apps/inkubator-api/provenance/trusted-test-modules.v1.json`

The inventory binds:

- runner engine version;
- exact runner source path;
- exact runner source Git blob SHA-1;
- each promoted module ID/version/content digest;
- promotion authority + parent commit.

The regression test compares the runtime `trustedTestModuleCatalog()` against the promoted inventory and recomputes the Git blob identity of the runner implementation. Changing executor semantics under the same runner engine without an explicit provenance promotion therefore fails CI while historical module digests remain stable.

The trusted fact runner still executes no participant code, loads no caller-selected module, and accepts no non-empty config or fixture references. Its inputs remain bounded canonical Challenge/submission/archive facts.

## 4. Ship-verifier isolation and egress policy

`apps/inkubator-verifier` is a separate verifier boundary with intentionally narrow outbound network authority. H4 does **not** remove network access because its product purpose is to verify a submitted public deployment URL.

The allowed egress shape remains:

- HTTPS only;
- port 443 only;
- no URL credentials;
- hostname required; direct IP literals rejected;
- all DNS answers must be acceptable public addresses;
- connection pinned to a vetted resolved address while TLS SNI + `Host` remain the original hostname;
- every redirect is normalized and re-resolved, including same-host redirects;
- redirect count capped at 3;
- response body capped at 256 KiB;
- per-hop deadline capped at 3 seconds;
- total verification budget capped at 8 seconds;
- output remains an observation and cannot mint Challenge truth directly.

H4 extends the blocked-address policy to cover IPv4 special relay space plus IPv6 translation/tunnel/current non-global/special-use ranges that could otherwise encode or route toward non-public targets. This includes NAT64, 6to4, the current Dummy IPv6 prefix, SRv6 SID space, deprecated IPv4-compatible/site-local space, unique-local, link-local and multicast ranges. Cloud metadata/link-local targets remain rejected before any request.

A bounded H4 self-audit found that the first implementation did not cover current non-global `100:0:0:1::/64` and `5f00::/16`, nor deprecated `::/96` IPv4-compatible and `fec0::/10` site-local space. Those ranges now fail closed before any request. This self-audit repair is implementation evidence only and does **not** count as the independent hostile review required by the H4 closure gate.

The HTTPS requester has an absolute watchdog in addition to socket-idle timeout, and the verifier wraps requester execution in its own bounded deadline. A peer or requester that never settles therefore becomes `UNAVAILABLE/TIMEOUT` rather than holding verifier work indefinitely.

## 5. Credential isolation

The verifier process continues to bind only its local verifier service and refuses startup when platform credentials are present. H4 extends the explicit denylist to include the GitHub webhook secret and OpenRouter API key in addition to existing DB/GitHub/session/private-key classes.

This is defense in depth, not permission for the verifier to receive any application credential. The architecture expectation remains `NO_PLATFORM_SECRETS`.

## 6. H4 executable evidence

H4 adds/extends executable evidence for:

1. exact five-blueprint promotion provenance;
2. same-ID/version blueprint substitution changing semantic identity;
3. trusted-runner implementation Git-object provenance;
4. runtime trusted-module catalog exactly matching promoted module ID/version/digests;
5. cloud metadata target rejection before request;
6. NAT64/6to4/current non-global/deprecated private/link-local address rejection;
7. DNS rebinding and redirect re-resolution;
8. response-size and redirect bounds;
9. stalled requester deadline;
10. verifier credential-environment rejection.

Existing Stage-D compiler substitution tests and G2/G3 Test Arena regressions remain mandatory regression evidence.

## 7. Scope exclusions

H4 does not authorize:

- participant/arbitrary code execution;
- hidden tests;
- LLM judging/scoring;
- new compiler blueprints or semantic changes to existing blueprints;
- H5 load/concurrency/worker lease work;
- H6 backup restore/final trust gate;
- Stage-I external-human Alpha;
- production money, custody, signing, transaction broadcast or settlement execution;
- merge.

## 8. Closure gate

H4 closes only after:

1. exact-head package/API/verifier tests pass;
2. repository CI and Inkubator auth/Postgres verification required by the current stack are green on the exact H4 head;
3. one independent hostile review examines T2/T11 Critical/High risk on that exact head;
4. any Critical/High finding is repaired and exact-head verification rerun;
5. at most one targeted rereview is used if such a repair was required.

Until then, H5 is not authorized.
