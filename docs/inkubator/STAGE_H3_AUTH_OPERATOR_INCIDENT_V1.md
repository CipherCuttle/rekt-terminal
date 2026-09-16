# REKT Inkubator — Stage H3 Auth / Operator / Incident Hardening V1

**Status:** ACTIVE IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-16  
**Parent:** `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1.md`  
**Base authority:** H2 CLOSED/PASS at `12c0acf6539145cce10035f73fa285ba68992b49`  
**Merge authority:** NONE

## 1. Objective

H3 contains account/session compromise and gives the solo operator bounded incident controls without creating a generic administrator product surface.

The stage invariant is:

`STOLEN OR STALE AUTHORITY CAN BE REVOKED; INCIDENT RESPONSE MAY STOP NEW MUTATION WITHOUT REWRITING CANONICAL CHALLENGE HISTORY.`

H3 does not redesign identity. GitHub's stable numeric user id remains the provider identity authority already established by the auth foundation.

## 2. Reachable privilege inventory

Current funded-Challenge production authority remains intentionally narrow:

- ordinary authenticated player — own account/integration operations allowed by existing routes;
- Challenge organizer — only the explicit organizer operations frozen by the H1 production route manifest;
- GitHub webhook — exact-signature provider ingress when GitHub integration is enabled.

There is no production `admin`, `resolver` or `moderation` role/route. Historical/domain `resolveChallengeAppeal()` remains parked substrate and must not be exposed by H3. Its existing organizer/entrant conflict checks do not grant it production authority. A future production resolver requires a separately frozen role, conflict and step-up contract before route registration.

## 3. Session containment

H3 freezes these rules:

1. Session tokens remain opaque random bearer values; only hashes are durable.
2. Session-specific logout revokes the presented token immediately.
3. Account-wide logout revokes every live session for the authenticated player.
4. Successful GitHub provider reauthentication revokes every prior player session before issuing the replacement session.
5. A revoked or expired session cannot resolve an actor on a later request.
6. Security-sensitive GitHub reconciliation requires a valid session created within the H3 fresh-auth window of 10 minutes.
7. The GitHub installation OAuth completion flow performs provider OAuth again and then requires the stable numeric GitHub identity to match the currently authenticated player; that provider reauthentication is the step-up credential for installation completion.

No client-provided timestamp or privilege claim establishes freshness.

## 4. Incident controls

Two strict deployment-time flags are authorized:

- `INKUBATOR_INCIDENT_WRITE_FREEZE=1`
- `INKUBATOR_INCIDENT_DISABLE_GITHUB=1`

Values other than `0`, `1` or absence fail configuration loading.

### Write freeze

When write freeze is enabled:

- normal read routes remain available;
- all POST/PUT/PATCH/DELETE funded-Challenge mutations fail closed with `503 incident_write_freeze`;
- `DELETE /v1/session` and `DELETE /v1/sessions` remain available so compromised credentials can still be revoked;
- GitHub routes are not registered, including state-mutating OAuth callbacks and webhook ingress.

This is intentionally a restart/deployment control, not a mutable admin endpoint. Recovery therefore requires an explicit operator configuration change and process replacement, which leaves a deploy/audit trail and avoids creating a new runtime superuser surface.

### GitHub-only disable

`INKUBATOR_INCIDENT_DISABLE_GITHUB=1` removes GitHub OAuth, repository, reconciliation and webhook routes while leaving the funded-Challenge core route set intact. It is the first action for suspected GitHub client secret, webhook secret, private-key or provider-account compromise.

## 5. Rotation / compromise drills

### Stolen REKT session

1. Use account-wide session revocation for the affected player.
2. Verify captured old bearer tokens fail actor resolution.
3. Reauthenticate through GitHub to issue one fresh replacement session if access should continue.
4. Preserve history events and Challenge records; do not rewrite canonical Challenge truth as part of auth recovery.

### GitHub provider credential compromise

1. Set `INKUBATOR_INCIDENT_DISABLE_GITHUB=1`; use write freeze as well if unauthorized mutation is plausible.
2. Restart/redeploy and verify GitHub routes are absent while health/core reads and session revocation remain available.
3. Rotate the affected GitHub client secret, webhook secret and/or App private key at the provider and deployment secret store.
4. Replace deployment configuration.
5. Re-enable GitHub only after exact callback/webhook/reconciliation verification succeeds with the new credentials.
6. Treat historical provider deliveries and canonical Challenge history as evidence; do not edit them to hide the incident.

### Suspected authority abuse

1. Enable write freeze.
2. Revoke affected sessions/account sessions.
3. Preserve DB/history/outbox evidence.
4. Classify the affected Challenge operations and verify immutable digests/receipts before recovery.
5. Re-enable mutation only after the concrete authority defect is understood and bounded repair evidence is green.

## 6. Fail-closed requirements / tests

H3 must prove at minimum:

- replay after token-specific revocation fails;
- replay after account-wide revocation fails for every previously live session;
- successful GitHub reauthentication invalidates the previous bearer session and leaves the fresh replacement valid;
- stale-but-otherwise-valid sessions cannot run GitHub reconciliation;
- fresh sessions cross the freshness gate but retain all downstream authority checks;
- write freeze blocks Challenge mutation and webhook/provider mutation paths while logout/account revocation remains possible;
- GitHub disable removes the complete GitHub production route family;
- production route inventory still contains no admin/resolver/moderation surface;
- both production entrypoints use identical incident controls.

## 7. Explicit non-authority

H3 does not authorize:

- a generic admin dashboard or admin API;
- a production appeal resolver route/role;
- H4 verifier/network/supply-chain isolation;
- H5 worker/load/failure hardening;
- H6 backup restore execution;
- Stage-I external-human Alpha;
- settlement execution, wallet custody/signing/broadcast or production money;
- arbitrary participant-code execution, hidden tests or LLM judging/scoring;
- merge.

## 8. Closure gate

`IMPLEMENT → EXACT-HEAD CI/AUTH/POSTGRES → ONE INDEPENDENT HOSTILE REVIEW → FIX CRITICAL/HIGH ONLY → AT MOST ONE TARGETED REREVIEW IF NEEDED → H3 CLOSED/PASS`

H4 remains unauthorized until H3 closes under that gate.
