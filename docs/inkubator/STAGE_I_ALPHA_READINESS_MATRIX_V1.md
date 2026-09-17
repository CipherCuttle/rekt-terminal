# REKT INKUBATOR — STAGE I ALPHA READINESS MATRIX V1

**Status:** CLOSED / ALPHA_READY PREP EVIDENCE  
**Date:** 2026-09-17  
**Closure evidence recorded:** 2026-09-18 CEST  
**Parent:** `STAGE_I_ALPHA_REHEARSAL_V1.md`  
**Canonical integrated base:** `main` merge `ab9d281086e3a2859274065d3ed9cb3ed5cf2f51`  
**Runtime product candidate:** `6d4520d7f25756e51572ec2e8b3c8ad9ef019d04`

This matrix answers one question: what still has to be proven before the owner can make a separate decision to invite a tiny external-human Closed Alpha?

| Gate | Evidence | Current state |
| --- | --- | --- |
| Stage E→H integrated on `main` | PR #121 merged; exact integration CI/Auth/Postgres/Verification/Signal + funded-Challenge rehearsal passed | PASS |
| Trust/reputation threat model | `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`; Stage H closed | PASS |
| Claims / REKT brand policy | `ALPHA_CLAIMS_BRAND_POLICY_V1.md` | PASS — DOC AUTHORITY CREATED |
| Data inventory / retention / provider egress | H2 retention + egress evidence; H6 restore/privacy closure; Stage-I deployed safe projections preserve the boundary | PASS — INHERITED + DEPLOYED SPOT CHECK |
| Operator runbook | H3 incident controls plus `ALPHA_OPERATOR_RUNBOOK_V1.md` covering required Alpha scenarios | PASS — DOC AUTHORITY CREATED |
| Failure/load/concurrency/zero-inference | Stage-H H5 closure + exact deployed pre-money loop with `inference_calls_required: 0`; deployed degraded transport remains fail-closed | PASS |
| Cost law / no auto-spend | `PRE_REVENUE_INFRA_CAP_V1.md`; exact rehearsal moved no real value and required no inference for the core loop | PASS — POLICY + REHEARSAL |
| Exact rehearsal deployment | Render `rekt-inkubator-rehearsal` only; exact product revision `6d4520d7f25756e51572ec2e8b3c8ad9ef019d04`; exact restore deploy `dep-dam6aagu01pc73egltvg` reached LIVE | PASS |
| Deployment rollback / known-good restore | Real rehearsal target was deliberately moved to the bounded OIDC bootstrap revision and then restored by exact revision pin + Render deploy to previously green `6d4520d7...`; the authoritative run crossed the restore gate only after `/health` was good and the shim route disappeared | PASS — REAL TARGET KNOWN-GOOD RESTORE |
| Full browser Challenge loop | Actions run `35279658585`, job `105400972043`: Playwright-authenticated organizer/builders exercised the complete pre-money Challenge loop through selection; Challenge `5a698df3-4387-4c99-bc4b-b612e780aacd`; receipt/history transport was checked with zero settlement receipts because settlement execution remained unauthorized | PASS — PRE-MONEY THROUGH SELECTION |
| Multi-builder competition | Same authoritative run: 3 distinct builder identities, 3 entries, 3 immutable submissions, 3 qualifications; separate DOM composition Challenge `0d9ba5d4-3a30-4265-99db-173a00146775` confirmed 3 distinct builder contexts/entries | PASS |
| Deployed zero-inference path | Full loop recorded `inference_calls_required: 0`, `hidden_tests: 0`; frozen lifecycle remained coherent without inference | PASS |
| Deployed privacy projection | Reveal contained no private archive reference; public Challenge/History projections remained bounded; browser submit credential stayed outside durable browser storage; raw browser/traffic capture was not collected; disposable sessions were revoked | PASS |
| Deployed operator recovery spot checks | Stage-H H3/H4/H5/H6 incident/verifier/lease/restore evidence remains ancestral; Stage-I exact deployment additionally proved operator surface fail-closed, browser-local transport degradation fail-closed, asynchronous archive pending/retry recovery, exact known-good restore, and bounded TEST-only/no-auto-spend operation | PASS — REUSED INVARIANTS + DEPLOYED COMPOSITION CHECKS |
| External-human Closed Alpha authority | separate explicit owner progression decision after all prep gates close | NOT AUTHORIZED |
| Production money / real settlement | Stage J only after independent gates | NOT AUTHORIZED |

## Authoritative Stage-I closure evidence

- runtime product SHA: `6d4520d7f25756e51572ec2e8b3c8ad9ef019d04`;
- authoritative Actions run: `35279658585`, job `105400972043`, attempt 2 — PASS;
- full-loop Challenge: `5a698df3-4387-4c99-bc4b-b612e780aacd`;
- browser/degraded composition Challenge: `0d9ba5d4-3a30-4265-99db-173a00146775`;
- full-loop verdict: `PASS_PRE_MONEY_THROUGH_SELECTION`;
- browser/degraded verdict: `PASS_STAGE_I_BROWSER_AND_DEGRADED_COMPOSITION`;
- builder count: `3`;
- immutable final submissions: `3`, external bearer transport only;
- browser immutable-submission attempts: `0`;
- qualifications: `3`;
- settlement receipts: `0` by design because settlement execution was not authorized;
- real value moved: `false`;
- operator fail-closed: `true`;
- degraded fail-closed: `true`;
- disposable sessions revoked: yes;
- closure artifact: `10526578867`;
- closure artifact SHA-256: `3933ff59371046330ffa86699df8d48a62f727002214418952ac740416136056`.

Durable receipt protocol semantics are inherited from the integrated Stage-G/Stage-H lineage. Stage I checked the safe receipt/history transport in its authorized pre-money state; it did not fabricate a settlement receipt or exercise a money path.

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

## Historical deployment gap — closed

`PHASE_9_REHEARSAL_MATRIX_V0.md` recorded `P9-H11` as blocked because no truthful real deployment/rollback target existed at that time.

Stage I closed the modern equivalent on the dedicated `rekt-inkubator-rehearsal` service. The separate `rekt-inkubator-rehearsal-api` and `rekt-inkubator-rehearsal-ui` services were not part of this rehearsal.

## Current verdict

`STAGE-I PREP = CLOSED / ALPHA_READY`

This verdict means the bounded **pre-money Stage-I preparation gates** are closed. It does not authorize external-human invitations, merge to `main`, production money, settlement execution, custody/signing/broadcast, hidden tests, arbitrary participant-code execution, or LLM judging/scoring.
