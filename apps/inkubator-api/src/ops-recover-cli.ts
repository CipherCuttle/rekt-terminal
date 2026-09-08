import {createDatabase} from './database.js';
import {runOneJob} from './jobs.js';
import {reconcileShipAcceptances} from './ship-acceptance.js';
import {createShipVerifierClient} from './ship-verifier-client.js';

function requireValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parsePositiveInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

const db = createDatabase(requireValue('DATABASE_URL'));
const leaseMs = parsePositiveInt('INKUBATOR_WORKER_LEASE_MS', 30_000, 1_000, 300_000);
const retryBaseMs = parsePositiveInt('INKUBATOR_WORKER_RETRY_BASE_MS', 1_000, 100, 60_000);
const shipVerifierUrl = process.env.INKUBATOR_VERIFIER_URL?.trim();
const shipVerifierClient = shipVerifierUrl ? createShipVerifierClient(shipVerifierUrl) : undefined;

try {
  const result = await runOneJob(db, {leaseMs, retryBaseMs, ...(shipVerifierClient ? {shipVerifierClient} : {})});
  await reconcileShipAcceptances(db);
  process.stdout.write(`${JSON.stringify({
    schema_version: 'inkubator.ops.recovery.v1',
    action: 'RUN_ONE_DUE_JOB',
    result,
  })}\n`);
} finally {
  await db.destroy();
}
