import {createDatabase} from './database.js';
import {runOneJob} from './jobs.js';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const db = createDatabase(requireValue('DATABASE_URL'));
const pollMs = parsePositiveInt('INKUBATOR_WORKER_POLL_MS', 500, 50, 60_000);
const leaseMs = parsePositiveInt('INKUBATOR_WORKER_LEASE_MS', 30_000, 1_000, 300_000);
const retryBaseMs = parsePositiveInt('INKUBATOR_WORKER_RETRY_BASE_MS', 1_000, 100, 60_000);
const shipVerifierUrl = process.env.INKUBATOR_VERIFIER_URL?.trim();
const shipVerifierClient = shipVerifierUrl ? createShipVerifierClient(shipVerifierUrl) : undefined;
let stopping = false;

process.once('SIGTERM', () => {
  stopping = true;
});
process.once('SIGINT', () => {
  stopping = true;
});

try {
  while (!stopping) {
    try {
      const result = await runOneJob(db, {leaseMs, retryBaseMs, ...(shipVerifierClient ? {shipVerifierClient} : {})});
      if (result.status === 'idle') await sleep(pollMs);
    } catch (error) {
      console.error('inkubator worker iteration failed', error);
      await sleep(pollMs);
    }
  }
} finally {
  await db.destroy();
}
