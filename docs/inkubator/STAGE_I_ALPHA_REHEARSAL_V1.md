# REKT INKUBATOR — STAGE I ALPHA REHEARSAL V1

**Status:** ACTIVE STAGE-I PREP AUTHORITY  
**Date:** 2026-09-17  
**Base:** merged `main` at `ab9d281086e3a2859274065d3ed9cb3ed5cf2f51`  
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

### I-PREP-1 — governance transition

- record Stage-H/integration closure on the authority pointer;
- record merged `main` commit `ab9d281086e3a2859274065d3ed9cb3ed5cf2f51` as canonical Stage-I base;
- Stage I prep is active;
- external-human Alpha remains a separate owner decision.

### I-PREP-2 — Alpha claims / brand policy

Freeze allowed and forbidden public language for:

- REKT / Ink affiliation and endorsement;
- Alpha/testnet status;
- qualification and organizer selection;
- AI/compiler recommendations;
- security/review/audit claims;
- sponsorship;
- payment/value state.

Authority artifact: `ALPHA_CLAIMS_BRAND_POLICY_V1.md`.

### I-PREP-3 — operator runbook

A solo operator must have bounded recovery instructions for at least:

- GitHub unavailable or compromised;
- model/compiler provider unavailable;
- compiler output suspected wrong;
- DB restore;
- worker retry storm / stuck jobs;
- verifier unavailable;
- suspected private-source exposure;
- archive delay;
- submission dispute;
- receipt correction;
- budget cap reached.

Authority artifact: `ALPHA_OPERATOR_RUNBOOK_V1.md`.

### I-PREP-4 — exact rehearsal deployment

Deploy the Stage-I prep lineage to the existing `rekt-inkubator-rehearsal` service only.

Do not modify the separate `rekt-inkubator-rehearsal-api` or `rekt-inkubator-rehearsal-ui` services.

The deployed revision must be recorded exactly. Deployment must retain Stage-H incident controls and zero-inference behavior.

### I-PREP-5 — browser-level integrated rehearsal

Run one complete rehearsal against the deployed product with 3–6 simulated builders and at least one organizer.

Required evidence:

- organizer can create/compile/accept/freeze a Challenge;
- multiple builder seats can join under the frozen contract;
- builder flow exposes the frozen contract/checks without competitor private-work leakage;
- immutable final submission succeeds;
- archive/evidence state is visible without exposing private object references;
- reveal is synchronized and organizer-safe;
- mandatory criteria execute/observe deterministically;
- missing/failed/disputed criteria cannot be silently treated as pass;
- final qualifier set is derived from recorded qualifications;
- organizer selects only from qualifiers;
- receipt is durable and safe-projected;
- complete loop still works with inference disabled after contract freeze.

### I-PREP-6 — privacy / retention rehearsal

Verify current H2/H6 rules survive the integrated product:

- no source/archive pointer in public reveal, comparison or receipt transport;
- logging/provider egress does not contain protected source/session/credential material;
- terminal private-source purge does not alter durable Challenge/receipt truth;
- restored state cannot resurrect already-purged private source as live/public data.

### I-PREP-7 — cost / degraded-mode rehearsal

Under `PRE_REVENUE_INFRA_CAP_V1.md`:

- no auto-upgrade;
- no uncapped usage;
- inference hard cap/degraded behavior is documented and testable;
- budget exhaustion is `QUEUE / PAUSE / DENY`, never auto-spend;
- core Challenge operation remains valid at USD 0 inference.

### I-PREP-8 — Alpha-ready closure evidence

Before requesting external-human Alpha authority:

- exact-head CI/Auth/Postgres/Verification/Signal gates pass;
- exact deployed revision is recorded;
- full browser rehearsal passes;
- claims policy and operator runbook are present and internally consistent;
- no Critical/High Alpha trust/readiness defect remains;
- remaining Medium/Low issues are explicitly recorded and do not undermine the loop, evidence, privacy, authority or operator recoverability.

## 4. Bounded completion law

`IMPLEMENT → TEST → ONE INDEPENDENT HOSTILE REVIEW OF ANY MATERIAL NEW RUNTIME CHANGE → FIX CRITICAL/HIGH → ONE TARGETED REREVIEW IFF NEEDED → CLOSE`

Docs, deployment wiring, test harnesses and other non-semantic preparation changes do not automatically reopen the full Stage-H hostile-review surface.

If Stage-I prep discovers a material runtime trust defect, repair the smallest possible surface and review that repair only.

## 5. Explicit non-authority

Stage-I prep does **not** authorize:

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

Only after all I-PREP gates close may the owner make a separate decision to authorize a tiny curated external-human Closed Alpha.

The expected closure verdict is:

`STAGE-I PREP CLOSED / ALPHA_READY` or `STAGE-I PREP BLOCKED / <concrete blocker>`.
