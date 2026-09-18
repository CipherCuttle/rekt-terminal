# REKT Inkubator — Stage H2 Egress / Logging / Backup Evidence V1

**Status:** H2 IMPLEMENTATION EVIDENCE — NOT H2 CLOSURE  
**Date:** 2026-09-16  
**Parent H2 authority:** `STAGE_H2_PRIVATE_DATA_RETENTION_V1.md`  
**Merge authority:** NONE

## 1. Production provider egress

The funded-Challenge production assembly does not import or construct a model/provider HTTP adapter. `/v1/compiler/compile` runs the deterministic compiler over an already-structured `CompilerProposal`; it does not call an external model. Therefore the current production provider-egress allowlist is intentionally empty.

Any future provider-backed production interpretation path must use the H2 privacy-bound wrapper and may send only the explicit `inkubator.compiler-provider-outbound/1.0` envelope with data class `ORGANIZER_INTENT`. Extra structural fields fail closed before network egress. In particular Challenge source references, evidence references, archive references, cookies/session material and arbitrary headers are not provider input classes.

The privacy-bound wrapper additionally requires an explicit runtime data-policy declaration:

- retention: `ZERO_DATA_RETENTION`;
- training: `DISALLOWED`;
- request logging: `DISALLOWED`;
- a non-empty policy/provenance reference.

Provider HTTP error bodies are redacted before they become application/benchmark error strings.

This is a data-flow boundary, not a claim that a remote provider is trustworthy. Policy claims must be re-verified before enabling a provider for real participant/organizer data.

## 2. Historical Stage-D provider inventory

Stage-D provider execution was benchmark evidence, not production authority.

| Route | Frozen Stage-D evidence | H2 status |
| --- | --- | --- |
| OpenRouter → DeepInfra → Mistral Small 3.2 | provider pinned; fallbacks disabled; `data_collection=deny`; `zdr=true`; benchmark doc records no-training/zero-retention routing rationale | HISTORICAL BENCHMARK ONLY. Not automatically production-authorized. A future real-data call must satisfy the H2 wrapper and re-verify provider policy. |
| OpenRouter → Google AI Studio → Gemini 3.1 Flash-Lite | provider pinned; fallbacks disabled; benchmark config does **not** freeze equivalent `data_collection=deny` + `zdr=true` controls | NOT ELIGIBLE FOR PRIVATE/PRODUCTION EGRESS under H2 without a new verified data-policy record. |

The old benchmark runner remains historical measurement substrate over a frozen adversarial corpus. Its existence does not grant production code permission to send Challenge submissions, archives, evidence, credentials or private repository material to a model provider.

## 3. Logging / telemetry inventory

The H1 production builder constructs Fastify with `logger: false`. `server.ts` and `render-server.ts` both use that same builder and do not add request/body logging. H2 therefore does not introduce a parallel logger merely to redact it.

Frozen rule for future observability:

- log opaque ids/digests, status classes and bounded reason codes;
- never log submission manifests, source/evidence/archive references, cookies, session tokens, OAuth tokens, provider request bodies, provider response bodies, archive bytes or repository installation credentials;
- errors crossing provider/storage boundaries must use bounded error classes rather than echoed remote bodies.

Enabling request/body tracing later requires explicit privacy review and negative tests before it may enter production.

## 4. API disclosure inventory

The unauthenticated `GET /v1/challenges/:challengeId` projection is aggregate Challenge state only and does not project submission manifests or archive/source pointers.

Stage-G reveal intentionally exposes final source reference/live URL to the **organizer only** after the synchronized reveal gate. The route requires a valid session, organizer identity and a revealable lifecycle state, and sends `cache-control: no-store`. H2 does not reinterpret Stage-G reveal law as public disclosure.

The H2 test suite locks both properties: the public aggregate projection cannot leak sentinel private submission material, and the production route assembly remains provider-network-free/logging-disabled.

## 5. Backup / restore boundary

No application-managed `pg_dump`, PITR or backup-restore implementation is present in the current Inkubator repository surface. H2 therefore makes no false claim that backup deletion or restore provenance has been demonstrated.

The required backup contract is frozen now and executable proof remains assigned to H6:

1. backups containing restricted manifests/private material are encrypted at rest;
2. backup credentials are distinct from ordinary application credentials;
3. backup access is least-privilege and auditable;
4. retention/expiry is documented and bounded;
5. backup integrity and freshness are verifiable before restore;
6. restore provenance is recorded;
7. a restore cannot silently republish source material whose live retention window has expired or whose operational pointers have been purged.

Until H6 proves those properties against the chosen deployment substrate, REKT Inkubator must not claim tested backup/privacy restoration guarantees.

## 6. Evidence law

H2 closes only after the complete H2 branch passes exact-head CI/Auth/Postgres and ONE independent hostile review. Critical/High findings may be repaired, followed by at most ONE targeted rereview. This document grants no H3, Alpha, settlement, wallet-custody, production-money or merge authority.
