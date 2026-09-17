# REKT INKUBATOR — STAGE I ALPHA READINESS MATRIX V1

**Status:** ACTIVE / EVIDENCE MATRIX  
**Date:** 2026-09-17  
**Parent:** `STAGE_I_ALPHA_REHEARSAL_V1.md`  
**Canonical integrated base:** `main` merge `ab9d281086e3a2859274065d3ed9cb3ed5cf2f51`

This matrix answers one question: what still has to be proven before the owner can make a separate decision to invite a tiny external-human Closed Alpha?

| Gate | Evidence | Current state |
| --- | --- | --- |
| Stage E→H integrated on `main` | PR #121 merged; exact integration CI/Auth/Postgres/Verification/Signal + funded-Challenge rehearsal passed | PASS |
| Trust/reputation threat model | `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`; Stage H closed | PASS |
| Claims / REKT brand policy | `ALPHA_CLAIMS_BRAND_POLICY_V1.md` | PASS — DOC AUTHORITY CREATED |
| Data inventory / retention / provider egress | H2 retention + egress evidence; H6 restore/privacy closure | PASS — INHERITED STAGE-H EVIDENCE |
| Operator runbook | H3 incident controls plus `ALPHA_OPERATOR_RUNBOOK_V1.md` covering required Alpha scenarios | PASS — DOC AUTHORITY CREATED |
| Failure/load/concurrency/zero-inference | Stage-H closure evidence + integrated zero-inference backend rehearsal | PASS AT BACKEND / DEPLOYED REHEARSAL STILL REQUIRED |
| Cost law / no auto-spend | `PRE_REVENUE_INFRA_CAP_V1.md` | PASS AS POLICY |
| Exact rehearsal deployment | Existing Render service `rekt-inkubator-rehearsal`; Stage-I branch/revision must be deployed and recorded | PENDING |
| Deployment rollback / known-good restore | Historical Phase-9 H11 was blocked; must now prove provider-supported known-good rollback on the real rehearsal target | PENDING |
| Full browser Challenge loop | deployed `IDEA → COMPILE → LOCK → JOIN → BUILD → CHECK → SUBMIT → REVEAL → TEST → PICK → RECEIPT` | PENDING |
| Multi-builder competition | 3–6 simulated builders in one deployed rehearsal | PENDING |
| Deployed zero-inference path | disable/unavailable inference after freeze; core loop must remain coherent | PENDING |
| Deployed privacy projection | no private archive/source pointer in reveal/comparison/receipt/log-visible product surfaces | PENDING |
| Deployed operator recovery spot checks | GitHub disable/write freeze or equivalent bounded rehearsal, verifier fail-closed, archive delay/retry, budget degradation | PENDING |
| External-human Closed Alpha authority | separate explicit owner progression decision after all prep gates close | NOT AUTHORIZED |
| Production money / real settlement | Stage J only after independent gates | NOT AUTHORIZED |

## Reuse rule

Do not rerun historical evidence merely for ceremony.

Reuse Stage-E→H and older bounded rehearsal evidence when:

- the invariant is unchanged;
- the relevant code remains ancestral to the deployed revision;
- the evidence still exercises the current production assembly;
- Stage-I composition does not introduce a new boundary that invalidates it.

Run new evidence specifically where Stage I changes the composition:

- real deployed revision;
- browser traversal of the current integrated Challenge product;
- multi-builder orchestration on one Challenge;
- deployment rollback/recovery;
- operator-visible degraded/failure behavior;
- current Alpha-facing copy/claims.

## Known historical deployment gap

`PHASE_9_REHEARSAL_MATRIX_V0.md` recorded `P9-H11` as blocked because no truthful real deployment/rollback target existed at that time.

That blocker is no longer structurally unavoidable: the current Render workspace contains the dedicated `rekt-inkubator-rehearsal` service. Stage I prep should close the modern equivalent of H11 on that service without touching the separate `-api` or `-ui` services.

## Current verdict

`STAGE-I PREP = ACTIVE`

The remaining critical path is:

`EXACT RENDER DEPLOY → KNOWN-GOOD ROLLBACK PROOF → DEPLOY CURRENT CANDIDATE → FULL BROWSER/MULTI-BUILDER REHEARSAL → DEGRADED/PRIVACY SPOT CHECKS → ALPHA_READY DECISION`
