# INKUBATOR OPS RECOVERY V0

Status: PHASE-9 SUPPORTED OPERATOR RUNBOOK

## Purpose

Recover one due or stale Inkubator outbox job through the product's existing lease/retry machinery without editing database rows by hand.

## Command

From the repository root after the API build:

```bash
DATABASE_URL=... npm run ops:recover -w @rekt-ink/inkubator-api
```

Use the same server-side environment as the worker. If Ship verification jobs may be due, also provide the normal `INKUBATOR_VERIFIER_URL`.

The command emits one JSON receipt with schema `inkubator.ops.recovery.v1` and exits. One invocation processes at most one due/reclaimable job, then runs the normal Ship-acceptance reconciliation pass.

## Authority boundary

This is an OPS process surface, not a participant API, SDK, CLI or MCP capability.

It does **not**:

- reset `attempts`;
- increase `max_attempts`;
- resurrect terminal `failed` jobs;
- bypass leases;
- mint evidence, proof, Cheevos, reputation or Ship approval;
- expose a network admin endpoint;
- require an operator to issue SQL updates.

A just-crashed job remains `running` until its normal lease expires. Before lease expiry the command may truthfully return `idle`; after expiry, the existing worker claim path may reclaim it if `attempts < max_attempts`.

Terminal `failed` jobs are deliberately fail-closed. Investigate the cause instead of resetting canonical job history. A future terminal-replay mechanism would require separate explicit authority.

## Bounded recovery drill

1. Confirm the normal worker is stopped or unhealthy.
2. Preserve the incident context; do not mutate `outbox_jobs` manually.
3. Wait at least the configured `INKUBATOR_WORKER_LEASE_MS` after the abandoned claim.
4. Run `ops:recover` once.
5. Inspect the JSON receipt: `succeeded`, `retry`, `failed`, `lost_lease`, or `idle` are all explicit outcomes.
6. Restore the normal worker after the underlying dependency is healthy.

Phase 9 verifies the crash/reclaim path by killing a process after it has acquired a real job lease, then using this command to recover the job after lease expiry. The test reads job state for evidence but performs no manual outbox-row repair.
