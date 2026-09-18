# REKT INKUBATOR — ALPHA OPERATOR RUNBOOK V1

**Status:** STAGE-I PREP AUTHORITY  
**Date:** 2026-09-17  
**Parent:** `STAGE_I_ALPHA_REHEARSAL_V1.md`

## 1. Purpose

Give one operator a bounded, fail-closed recovery path for the failure modes required before external-human Alpha.

Operator law:

> **Contain first. Preserve evidence. Never repair an incident by rewriting frozen Challenge truth. Resume only after the concrete failure is bounded and the relevant verification is green.**

Stage-I prep and Closed Alpha still have no production-money authority.

## 2. Universal incident sequence

For any trust-impacting incident:

1. classify the affected surface: identity/GitHub, compiler/model, database, workers/archive, verifier, private source, submission/evaluation, receipt/history, or budget;
2. stop the smallest risky mutation surface that can worsen the incident;
3. preserve canonical DB/history/outbox evidence and relevant deployment/revision identifiers;
4. revoke compromised sessions/provider credentials where applicable;
5. do not edit frozen Build Contracts, accepted manifests, qualification facts, selections or receipt history in place;
6. repair the smallest concrete defect;
7. run the relevant exact-head and rehearsal gate;
8. explicitly record the recovery and re-enable decision.

If unauthorized mutation is plausible, use the Stage-H write-freeze control:

`INKUBATOR_INCIDENT_WRITE_FREEZE=1`

If GitHub integration is the suspect boundary, also use:

`INKUBATOR_INCIDENT_DISABLE_GITHUB=1`

These are deployment-time controls; they are not runtime admin endpoints.

## 3. GitHub unavailable

### Trigger

OAuth, repository reconciliation, webhook delivery or archive-source access fails because GitHub is unavailable or degraded.

### Immediate action

- keep the core funded-Challenge product available where it does not require new GitHub interaction;
- do not invent repository observations or archive completion;
- leave affected archive/reconciliation work pending/retryable;
- if repeated provider retries create load, pause the affected worker path rather than widening rate limits or changing truth semantics.

### Verify before resume

- GitHub auth/reconciliation returns valid provider identity;
- webhook signature path is healthy;
- pending jobs replay idempotently;
- no duplicate seat/submission/archive/qualification facts were created.

## 4. GitHub compromise / credential compromise

### Trigger

Suspected client secret, webhook secret, App private key, provider account, installation ownership or OAuth/session compromise.

### Immediate action

1. set `INKUBATOR_INCIDENT_DISABLE_GITHUB=1`;
2. if unauthorized product mutation is plausible, also set `INKUBATOR_INCIDENT_WRITE_FREEZE=1`;
3. redeploy/restart and verify GitHub routes are absent while safe reads and session revocation remain available;
4. revoke affected user sessions/account sessions;
5. rotate the compromised provider credential at GitHub and the deployment secret store;
6. preserve webhook/history/outbox evidence.

### Resume gate

- callback, webhook and reconciliation verification pass with the new credentials;
- provider numeric identity and installation ownership checks still fail closed;
- old bearer/provider credentials no longer work.

## 5. Model/compiler provider unavailable

### Trigger

Provider outage, quota exhaustion, timeout or hard inference budget cap.

### Immediate action

- switch to/degrade toward zero-inference operation;
- do not block already-frozen Challenge lifecycle operations that do not need inference;
- do not silently switch to an unapproved provider or a more expensive uncapped tier;
- communicate that compiler assistance is unavailable rather than manufacturing an answer.

### Resume gate

- provider health is restored under the configured cost/data-handling policy;
- deterministic compiler state remains canonical;
- no model output directly mutated frozen authority during outage/recovery.

## 6. Compiler output suspected wrong

### Trigger

A proposed architecture, assumption, acceptance criterion, risk profile or explanation appears materially incorrect before lock.

### Immediate action

- do not freeze the suspect contract;
- retain the structured compiler state and evidence that produced the proposal;
- mark the affected decision unresolved/needs-human-decision through the supported compiler state rather than editing downstream frozen records.

If the error is discovered after a contract was already frozen:

- do not mutate the frozen contract in place;
- stop progression if the contract is unsafe or materially misleading;
- use the versioned contract/change path authorized by the protocol, or cancel/recreate under explicit product semantics if no valid amendment path exists.

### Resume gate

- the corrected deterministic state/contract passes the compiler/property/contract checks;
- organizer explicitly accepts the corrected version.

## 7. Database restore

### Trigger

Canonical DB loss/corruption or a recovery drill.

### Immediate action

- isolate the restore target;
- keep external effects disabled;
- use only an expected backup with valid signed provenance, integrity, freshness and allowed retention state;
- do not point a restore directly at production external side effects.

### Required verification

- Challenge → contract → submission → qualification → decision → receipt lineage is coherent;
- append-only facts remain immutable;
- already-purged private source is not resurrected as live/public data;
- restore credentials remain distinct from ordinary application credentials.

### Resume gate

Only after the H6 restore verification closes cleanly may the restored state replace or become the canonical Alpha environment.

## 8. Worker retry storm / stuck jobs

### Trigger

Rapid retry growth, oldest-job age increasing, repeated lease loss, duplicate archive/evaluation attempts or connection saturation.

### Immediate action

- stop or scale down the affected worker execution path; do not auto-scale spend;
- preserve job rows, dedupe keys, lease metadata and downstream durable effects;
- keep public reads pure;
- do not manually mark jobs complete merely to clear the queue.

### Diagnosis

Check whether failure is:

- downstream provider outage;
- DB exhaustion/lock contention;
- expired/renewal-failed lease;
- deterministic bad payload;
- process crash after durable side effect;
- budget/quota exhaustion.

### Resume gate

- same payload replay produces the same semantic result;
- changed payload under the same idempotency key conflicts;
- stale workers cannot commit after lease loss;
- queue age/retry rate returns to bounded values.

## 9. Verifier unavailable

### Trigger

Verifier service outage, network isolation failure or trust-boundary uncertainty.

### Immediate action

- fail closed for criteria/evidence that require verifier output;
- do not auto-pass, substitute organizer preference, use hidden ad-hoc testing or run participant code inside the application API;
- keep unrelated Challenge operations available where safe.

If verifier isolation itself may be compromised, enable write freeze if accepting new verifier-derived authority could worsen the incident.

### Resume gate

- SSRF/target/redirect/body/time boundaries are verified;
- application credentials are absent from verifier context;
- the exact verifier revision is known and allowed.

## 10. Suspected private-source exposure

### Trigger

Source/archive pointer, object URL, raw evidence, token, cookie or protected provider payload may have escaped its intended boundary.

### Immediate action

1. enable write freeze if further mutation/egress could increase exposure;
2. disable GitHub if the exposure involves GitHub credentials/source access;
3. revoke affected sessions/provider credentials;
4. remove/disable the leaking projection/log/egress path without rewriting canonical digests/history;
5. preserve evidence of what may have been exposed and to whom;
6. rotate exposed secrets immediately.

### Resume gate

- public/API/log/provider negative-disclosure tests pass;
- retention/purge behavior remains correct;
- no safe projection exposes private archive/source internals.

## 11. Archive delay / archive provider failure

### Trigger

Submission is accepted but asynchronous archive capture remains `PENDING` or fails.

### Immediate action

- keep the canonical immutable submission identity intact;
- do not select a different submission or ask the builder to resubmit merely to chase archive success;
- retry through the bounded idempotent archive path;
- do not qualify if the frozen acceptance path requires archive evidence that is unavailable.

### Resume gate

- archive reaches one terminal durable state;
- replay cannot change accepted submission identity;
- private archive reference remains non-public.

## 12. Submission dispute

### Trigger

Builder/organizer disputes what was submitted, finality, deadline ordering, archive state or qualification input.

### Immediate action

- preserve accepted manifest/digest, event ordering, deadline facts, archive facts and qualification evidence;
- do not mutate the final submission or qualification record;
- do not expose a generic resolver/admin mutation route;
- if no production dispute resolver is authorized, record the issue externally/operator-side and freeze the affected Challenge from further discretionary progression if necessary.

### Resolution law

Use only evidence already permitted by the frozen protocol. A future resolver role requires separate authority; organizer self-resolution is not a substitute.

## 13. Receipt correction

### Trigger

A durable receipt contains a factual projection error that the protocol supports correcting.

### Immediate action

- never update/delete the existing receipt in place;
- use the append-only correction mechanism;
- bind the correction to its predecessor, reason, authority and evidence references;
- do not use a correction to rewrite qualification, selection or payment facts that were actually true at the time.

### Resume gate

Receipt lineage remains coherent and the correction is safe-projected.

## 14. Budget cap reached

### Trigger

Compiler inference, evaluation, storage or platform budget reaches its configured/human-authorized limit.

### Immediate action

Apply the pre-revenue budget law:

`QUEUE / PAUSE / DENY`

Never:

`AUTO-UPGRADE / AUTO-SPEND`

- disable/degrade optional inference first;
- keep core Challenge truth and already-frozen lifecycle operations valid where they can operate at zero inference;
- do not weaken acceptance or privacy semantics to save cost;
- record operator intervention and the resource that exhausted its budget.

### Resume gate

- explicit budget is available again or load has fallen within the current cap;
- no plan/tier was auto-upgraded;
- no hidden retry loop remains.

## 15. External-human Alpha entry check

Before inviting anyone outside the operator/test harness, verify:

- incident write freeze works;
- GitHub disable works;
- session/account revocation works;
- zero-inference core path works;
- DB restore rehearsal is current;
- worker replay/lease fencing is current;
- verifier fail-closed behavior is current;
- private-source negative disclosure/purge behavior is current;
- receipt correction is append-only;
- budget exhaustion is queue/pause/deny;
- the operator knows the exact deployed revision and can roll back/disable the affected integration without rewriting product truth.
