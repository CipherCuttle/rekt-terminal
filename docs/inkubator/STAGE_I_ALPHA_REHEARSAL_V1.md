# REKT INKUBATOR — STAGE I ALPHA REHEARSAL V1

**Status:** CLOSED / ALPHA_READY PREP  
**Date:** 2026-09-17  
**Closure evidence recorded:** 2026-09-18 CEST  
**Base:** merged `main` at `ab9d281086e3a2859274065d3ed9cb3ed5cf2f51`  
**Runtime product candidate:** `6d4520d7f25756e51572ec2e8b3c8ad9ef019d04`  
**Branch:** `agent/stage-i-alpha-rehearsal-v1`  
**External-human Alpha authority:** NONE  
**Production-money authority:** NONE  
**Merge authority:** NONE

## 1. Objective

Prove that the merged Stage-E→H product behaves as one usable REKT Inkubator system in the rehearsal environment before any external human is invited.

Stage I prep is an integration/product-readiness stage, not a new architecture stage.

Target loop:

`IDEA → COMPILE → LOCK → JOIN → BUILD → CHECK → SUBMIT → REVEAL → TEST → PICK → RECEIPT`

The rehearsal must use mock/synthetic or testnet-only value semantics. It must not invoke production settlement, wallet custody/signing/broadcast, arbitrary participant-code execution, hidden tests or LLM judging/scoring.

## 2. Permanent invariants

- frozen Build Contract remains product authority;
- inference is advisory only and core Challenge operation works with inference unavailable;
- qualification is objective against the frozen mandatory criteria;
- organizer preference may select only among final qualifiers;
- private source/archive internals never become public reveal/receipt data;
- retries cannot manufacture alternate accepted truth;
- no external value rail is invoked in Stage-I prep;
- no broad redesign or speculative feature expansion is authorized.

## 3. Stage-I preparation gates

### I-PREP-1 — governance transition — CLOSED / PASS

- Stage-H/integration closure is recorded;
- merged `main` commit `ab9d281086e3a2859274065d3ed9cb3ed5cf2f51` is the canonical Stage-I base;
- external-human Alpha remains a separate owner decision.

### I-PREP-2 — Alpha claims / brand policy — CLOSED / PASS

Frozen authority artifact: `ALPHA_CLAIMS_BRAND_POLICY_V1.md`.

It covers allowed/forbidden public language for REKT / Ink affiliation and endorsement, Alpha/testnet status, qualification and organizer selection, AI/compiler recommendations, security/review/audit claims, sponsorship, and payment/value state.

### I-PREP-3 — operator runbook — CLOSED / PASS

Authority artifact: `ALPHA_OPERATOR_RUNBOOK_V1.md`.

The runbook covers GitHub unavailable/compromised, model/compiler provider unavailable, suspected compiler error, DB restore, worker retry storms, verifier unavailable, private-source exposure, archive delay, submission dispute, receipt correction and budget exhaustion. Stage-H H3/H4/H5/H6 evidence remains the trust baseline; Stage-I composition added deployed fail-closed/degraded and archive-retry checks without rewriting those invariants.

### I-PREP-4 — exact rehearsal deployment — CLOSED / PASS

Only the existing `rekt-inkubator-rehearsal` Render service was used.

The separate `rekt-inkubator-rehearsal-api` and `rekt-inkubator-rehearsal-ui` services were not part of the Stage-I rehearsal.

Exact runtime product revision:

`6d4520d7f25756e51572ec2e8b3c8ad9ef019d04`

Authoritative exact-restore deploy:

`dep-dam6aagu01pc73egltvg`

The real rehearsal target was deliberately moved through the bounded temporary OIDC bootstrap revision and restored by exact revision pin + Render deploy to the previously green product candidate. The authoritative workflow proceeded only after the bootstrap route disappeared and `/health` confirmed the restored product.

### I-PREP-5 — browser-level integrated rehearsal — CLOSED / PASS

Authoritative workflow:

- run `35279658585`;
- job `105400972043`;
- attempt 2;
- exact runtime product SHA `6d4520d7f25756e51572ec2e8b3c8ad9ef019d04`.

Full-loop Challenge:

`5a698df3-4387-4c99-bc4b-b612e780aacd`

Verdict:

`PASS_PRE_MONEY_THROUGH_SELECTION`

Observed composition:

- one organizer + three distinct disposable builder identities;
- POST → COMPILE → LOCK → TEST-only mock FUND;
- three JOINs and three canonical Builder Capsules;
- normal worker transition to BUILDING;
- three Challenge-bound final-submission credentials;
- three immutable final submissions over external bearer transport;
- normal worker transition to QUALIFICATION;
- synchronized organizer-safe reveal;
- three objective qualifications = QUALIFIED;
- normal worker transition to SELECTION;
- comparison contained three final qualifiers;
- deterministic organizer selection from qualifiers only;
- receipt/history transport checked in the authorized pre-money state;
- `receipts: 0` because settlement execution remained unauthorized;
- `real_value_moved: false`;
- `inference_calls_required: 0`;
- `hidden_tests: 0`.

Separate real-DOM closure Challenge:

`0d9ba5d4-3a30-4265-99db-173a00146775`

Verdict:

`PASS_STAGE_I_BROWSER_AND_DEGRADED_COMPOSITION`

It confirmed:

- three distinct builder Chromium contexts and three distinct entries;
- actual `CHALLENGE → MY BUILD` DOM traversal for builders;
- organizer `REVIEW → HISTORY → OPERATOR` DOM traversal;
- browser immutable-submission POST attempts = `0`;
- operator surface fails closed;
- injected browser-local transport degradation fails closed without inventing private state.

Durable receipt protocol semantics remain inherited from the integrated Stage-G/Stage-H lineage. Stage I did not fabricate a payment/settlement receipt to make the pre-money rehearsal look complete.

### I-PREP-6 — privacy / retention rehearsal — CLOSED / PASS

The integrated product preserved H2/H6 privacy and retention rules:

- reveal did not expose private archive references;
- public Challenge and History surfaces remained safe projections;
- no raw browser or traffic capture was collected by the Stage-I harness;
- disposable session material existed only for the bounded runner lifecycle and all sessions were revoked;
- browser submit credentials remain memory-only React state rather than localStorage;
- degraded UI explicitly refuses to guess or substitute private entry data;
- H2 private-retention and H6 restore/privacy evidence remains ancestral and unchanged.

### I-PREP-7 — cost / degraded-mode rehearsal — CLOSED / PASS

Under `PRE_REVENUE_INFRA_CAP_V1.md`:

- no auto-upgrade or auto-spend was introduced;
- the exact core loop required zero inference after freeze;
- the rehearsal used TEST-only value and moved no real value;
- degraded transport remained fail-closed;
- Stage-H H5 zero-inference/load/failure evidence remains ancestral;
- budget law remains `QUEUE / PAUSE / DENY`, never `AUTO-UPGRADE / AUTO-SPEND`.

### I-PREP-8 — Alpha-ready closure evidence — CLOSED / PASS

- exact-head CI/Auth/Postgres/Verification/Signal gates passed on runtime candidate `6d4520d7...`;
- exact deployed revision was recorded and restored successfully on the real rehearsal target;
- full multi-builder pre-money Challenge loop passed;
- actual DOM composition and degraded/fail-closed checks passed;
- claims policy and operator runbook are present and internally consistent;
- no Critical/High Alpha trust/readiness blocker remains;
- no product-runtime change was introduced by the final closure harness/docs tranche.

Closure proof artifact:

- artifact id: `10526578867`;
- SHA-256: `3933ff59371046330ffa86699df8d48a62f727002214418952ac740416136056`.

## 4. Bounded completion law

`IMPLEMENT → TEST → ONE INDEPENDENT HOSTILE REVIEW OF ANY MATERIAL NEW RUNTIME CHANGE → FIX CRITICAL/HIGH → ONE TARGETED REREVIEW IFF NEEDED → CLOSE`

Docs, deployment wiring, test harnesses and other non-semantic preparation changes do not automatically reopen the full Stage-H hostile-review surface.

Stage-I runtime repair received bounded review before the final product candidate. The later closure tranche changed rehearsal harness/docs only and did not alter product runtime semantics.

## 5. Explicit non-authority

Stage-I prep closure does **not** authorize:

- inviting external testers;
- public/community Alpha promotion;
- production money or real prize settlement;
- wallet custody/signing/broadcast;
- production resolver/admin expansion;
- arbitrary participant-code execution;
- hidden acceptance criteria;
- LLM judging/scoring authority;
- Stage J;
- merge to `main`.

## 6. Exit verdict

`STAGE-I PREP CLOSED / ALPHA_READY`

This is a **pre-money/test-only preparation verdict**. It means the owner may now make a separate explicit decision about whether to authorize a tiny curated external-human Closed Alpha.

It does not itself grant that authority, and it does not grant merge or production-money authority.
