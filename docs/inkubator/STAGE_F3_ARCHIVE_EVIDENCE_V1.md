# Stage F3A — Archive / Evidence Orchestration

**Status:** F3A AUTHORIZED / ACTIVE
**F2:** CLOSED / PASS
**Reviewed exact F2 head:** `f6346cae407d08aafc0c305abe374f5c3aa4a8bb`

## Objective

An accepted immutable F2 submission creates durable asynchronous capture intent in the same PostgreSQL transaction as acceptance:

```text
accepted submission
  → archive state = PENDING
  → idempotent existing outbox job
  → existing FOR UPDATE SKIP LOCKED worker
  → durable capture observation
```

Submission acceptance and archive/evidence capture are separate facts. Capture never rewrites the accepted manifest, accepted timestamp, eligibility, or Challenge state.

## Truth separation

The dedicated `challenge_submission_archives` projection is product evidence state, not a replacement for `challenge_submissions` and not an overload of `outbox_jobs`.

| Capture observation | Durable archive status | Truth meaning |
| --- | --- | --- |
| no observation yet | `PENDING` | capture intent exists; no archive claim |
| valid archive returned | `CAPTURED` | archive existence was observed; digest and opaque internal reference are stored |
| transient/ambiguous platform failure after bounded retries | `PLATFORM_UNAVAILABLE` | unknown or unavailable platform truth; never builder fault |
| explicit trustworthy builder-caused revocation/deletion | `BUILDER_CAUSED_UNAVAILABLE` | causal evidence observation; accepted manifest remains immutable |
| unsupported source structure | `UNSUPPORTED_SOURCE` | source cannot be authoritative capture evidence |

`CAPTURED` and builder-caused unavailability append safe evidence history events. History contains identifiers, source kind, manifest/archive digests, status, and reason codes only. It does not contain source bodies, private archive references, credentials, secrets, or live source content.

## Outage and causality semantics

- A transient capture client/platform error retries through the existing outbox backoff and max-attempt policy.
- After retry exhaustion, the capture state becomes `PLATFORM_UNAVAILABLE`; the outbox job is durably completed because the unavailable observation is terminal.
- Ambiguous absence, generic 404, auth failure, or an untrusted client assertion is never inferred to be builder-caused.
- `BUILDER_CAUSED_UNAVAILABLE` is accepted only as an explicit injected capture-client outcome whose contract asserts trustworthy causality.
- No capture result mutates `challenge_submissions`, `challenge_entries`, Challenge acceptance, or eligibility.

## Privacy and retention boundary

The F3A state stores only immutable lineage, digests, status, reason, timestamps, and an opaque internal archive reference returned by a future private provider. The reference is not exposed through public Challenge views or history. Raw private source is not stored in PostgreSQL, history, logs, or public API responses. Retention, deletion/DSAR policy, encryption, authorized retrieval, and lifecycle deletion remain future bounded platform work.

## Source and provider boundary

The repository has a GitHub ingress/observation substrate, but no compatible private archive or object-storage adapter. F3A therefore defines and exercises the replaceable `ChallengeSubmissionArchiveCaptureClient` boundary with deterministic injected clients. Production GitHub archive and private object-storage wiring is explicit F3B work.

Submodules, Git LFS objects, and external dependencies are not silently promoted to authoritative captured evidence; a capture client must return `UNSUPPORTED_SOURCE` when the immutable source cannot be captured under this contract.

The existing `outbox_jobs`, `FOR UPDATE SKIP LOCKED`, lease, retry, and worker machinery are reused. F3A injected capture operations are bounded deterministic calls compatible with the existing lease window. A future long-running provider must add the smallest job-local renewal support before production wiring; no global worker redesign is authorized.

## Acceptance matrix

| Case | Required result |
| --- | --- |
| accepted submission | one archive state and one idempotent capture job are committed atomically |
| exact F2 replay | same archive state/job; no duplicate rows |
| capture success | `CAPTURED`, archive digest/reference and observed time; safe history; submission unchanged |
| platform outage before deadline | acceptance remains valid; state is pending while retrying, then platform unavailable; no builder fault |
| exhausted platform failure | terminal platform-unavailable evidence; manifest and accepted time remain unchanged |
| explicit builder revocation | distinct builder-caused state and observed evidence event; no manifest rewrite |
| ambiguous absence | platform-unavailable/unknown, never builder-caused |
| private source | no raw content, secret, or private archive location in history/public views/logs |
| unsupported source | no `CAPTURED` state or archive digest is created |

## Exclusions

F3A does not authorize Stage G Reveal, Test Arena UI, qualification, selection, receipts, winner logic, funding, settlement, real money, wallet custody/signing, provider-specific cloud architecture, broad retention/DSAR infrastructure, legal policy, queue rewrite, Mission/World/social refactors, frontend redesign, or model/provider calls.
