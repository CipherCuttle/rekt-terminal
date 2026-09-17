# REKT Inkubator — Stage H2 Private Data Retention V1

**Status:** IMPLEMENTATION ACTIVE — FIRST RETENTION BOUNDARY IMPLEMENTED, H2 NOT CLOSED  
**Date:** 2026-09-16  
**Parent:** H1 reviewed closure `525402d73f03174b29977e256f9aebfd3c14dbce`  
**Branch:** `agent/stage-h2-private-data-retention-v1`  
**Merge authority:** NONE  
**Production-money authority:** NONE

## Invariant

> Private builder/source material is disposable; Challenge truth is durable.

H2 must minimize private material at trust boundaries without mutating frozen Challenge law, qualification, selection, receipt lineage, or the digest identity of an accepted submission.

## Field / storage retention matrix

| Surface | Examples | Class | H2 rule |
| --- | --- | --- | --- |
| Challenge protocol truth | challenge/entry/submission ids, terms digest, manifest digest, archive digest/status, qualification, decision, receipt lineage | DURABLE_PROTOCOL | Retain. These facts remain sufficient to prove what was accepted/adjudicated after private bytes are removed. |
| Accepted submission manifest | immutable source kind/reference, artifact digest, evidence refs, optional live URL as originally accepted | RESTRICTED_DURABLE_EVIDENCE / ACTIVE-LIABILITY HOLD | Keep immutable while it remains protocol evidence; never expose through public projections, logs or provider egress. H2 does not silently rewrite `manifest_json` while preserving its old digest. |
| Captured private source bytes | R2 source archive | PRIVATE_EPHEMERAL | Eligible for lifecycle purge only after `RECEIPT_FILED`; deletion must complete before DB metadata claims purge. Missing object is idempotent success. |
| Archive operational pointers | `challenge_submission_archives.source_reference`, `archive_reference` | PRIVATE_EPHEMERAL | Replace with a non-secret purge tombstone after object deletion. Preserve manifest/archive digests, status and observed facts. |
| Frozen GitHub archive lineage | repository id + installation id in `challenge_submission_archive_sources` | PRIVATE_EPHEMERAL | Delete at the same terminal purge boundary. The accepted manifest digest/archive digest remain durable truth. |
| Archive capture outbox | durable job payload | PRIVATE_EPHEMERAL | Persist only `{schema_version, submission_id}`. Source/evidence/live URL data are reconstructed from canonical restricted submission state at execution time. Legacy payloads are minimized when replayed/purged. |
| Capture/purge history | safe ids, source kind, digests, availability/purge state | DURABLE_PROTOCOL / AUDIT | Append only. Never include source refs, archive refs, evidence refs or object keys. |
| Session/OAuth/provider credentials | cookies, tokens, OAuth state, provider secrets | SECRET | Never enter H2 queue/event/provider/log payloads. |

## Purge law

The first H2 purge primitive is intentionally internal; H3 has not yet authorized a public/admin purge mutation surface.

A submission may be purged only when:

1. its archive state is terminal (not `PENDING`);
2. its Challenge is `RECEIPT_FILED`;
3. any captured private object has been deleted through a reference-scoped deletion client;
4. the DB transaction then replaces redundant operational pointers with the non-secret purge tombstone, deletes frozen GitHub repository/installation lineage, minimizes the archive outbox payload, and appends a sanitized purge event.

If external object deletion fails, DB pointers are not changed and no purge event is filed. If object deletion succeeds but the later transaction fails, retry is safe because the object-store deleter treats an already-missing object as success.

Exact replay is idempotent through the purge history dedupe key. A stale archive job cannot recapture after purge because terminal/tombstoned archive state exits before manifest reconstruction or capture-client invocation.

## Why the accepted manifest is not rewritten in this slice

`challenge_submissions.manifest_json` is the immutable accepted submission authority whose `manifest_digest` is used throughout later Challenge evidence. Replacing individual private-looking fields in-place while retaining the original digest would manufacture an object that no longer hashes to its claimed identity.

Therefore H2 distinguishes **source bytes / operational access pointers**, which are lifecycle-deletable, from the **restricted immutable manifest**, which remains under an active-liability hold and must be protected from public/API/log/provider projection. Any future policy that removes the manifest body itself needs an explicit tombstone/content-addressed authority design rather than an in-place rewrite.

## Backup semantics frozen for H2/H6

Backups containing restricted manifests or private source objects must be encrypted at rest, use least-privilege/audited access with credentials separated from ordinary application credentials, and expire on a documented lifecycle. A restore must not silently republish a private object already purged from live storage. H6 owns the executable restore/provenance proof; H2 owns this retention requirement.

## Remaining H2 work before closure

This first changeset establishes the deletion/outbox boundary only. H2 remains open until all of the following are implemented and verified:

- provider/compiler outbound field allowlist + negative protected-data egress tests;
- provider retention/logging/training inventory for every enabled provider;
- application log/telemetry redaction contract + tests;
- backup confidentiality/access/lifecycle evidence bound to the retention matrix;
- route/public projection negative disclosure coverage;
- exact-head CI/Auth/Postgres verification and one bounded hostile review of the completed H2 surface.

No H3, Stage I, settlement execution, wallet custody, production money or merge authority is granted by this document.
