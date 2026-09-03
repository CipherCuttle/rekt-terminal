/**
 * CAREER_TUNING_HARNESS_V0 — deterministic aggregation + artifact digest.
 */
import { NON_UNLOCK_ACTION_VALUE, TRACKED_SKILLS } from './config.mjs';

/**
 * BOUNDED_EXPECTED_ACTIONS_TO_UNLOCK (the FINDING 2 primary metric).
 *
 * For every record in `records` (the FULL seed set for a policy — never a
 * survivor subset): value = accepted actions at unlock if the skill unlocked,
 * else `NON_UNLOCK_ACTION_VALUE` (`MAX_ACTIONS + 1`). Returns the arithmetic
 * mean. This combines unlock probability and unlock speed into one number and
 * is immune to survivor bias. Lower = faster in expectation.
 */
export function boundedExpectedActionsToUnlock(records, skill) {
  if (records.length === 0) return null;
  let sum = 0;
  for (const record of records) {
    sum += record.reached[skill] && record.unlocks[skill]
      ? record.unlocks[skill].actions
      : NON_UNLOCK_ACTION_VALUE;
  }
  return round(sum / records.length);
}

/** Descriptive-only: median accepted actions among the runs that DID unlock. */
export function conditionalMedianActionsToUnlock(records, skill) {
  const reached = records.filter((record) => record.reached[skill] && record.unlocks[skill]);
  if (reached.length === 0) return null;
  const sorted = reached.map((record) => record.unlocks[skill].actions).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(sortedNumbers, q) {
  if (sortedNumbers.length === 0) return null;
  if (sortedNumbers.length === 1) return sortedNumbers[0];
  const position = (sortedNumbers.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedNumbers[lower];
  const weight = position - lower;
  return sortedNumbers[lower] * (1 - weight) + sortedNumbers[upper] * weight;
}

function round(value, places = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function stats(numbers) {
  if (numbers.length === 0) return { n: 0, mean: null, median: null, p90: null, min: null, max: null };
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    n: sorted.length,
    mean: round(sum / sorted.length),
    median: round(quantile(sorted, 0.5)),
    p90: round(quantile(sorted, 0.9)),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
  };
}

/** Per-agent aggregate over its runs. */
export function aggregateAgent(records) {
  const n = records.length;
  const rate = (predicate) => round(records.filter(predicate).length / n);

  const unlockRate = {};
  const actionsToUnlock = {};
  const tradesToUnlock = {};
  const boundedExpectedActionsToUnlockBySkill = {};
  const conditionalMedianActionsToUnlockBySkill = {};
  for (const skill of TRACKED_SKILLS) {
    const reached = records.filter((record) => record.reached[skill]);
    unlockRate[skill] = round(reached.length / n);
    actionsToUnlock[skill] = stats(reached.map((record) => record.unlocks[skill].actions));
    tradesToUnlock[skill] = stats(reached.map((record) => record.unlocks[skill].trades));
    // PRIMARY metric — full-seed-set mean, non-unlock = MAX_ACTIONS + 1.
    boundedExpectedActionsToUnlockBySkill[skill] = boundedExpectedActionsToUnlock(records, skill);
    // DESCRIPTIVE only — never used to replace the frozen primary criterion.
    conditionalMedianActionsToUnlockBySkill[skill] = conditionalMedianActionsToUnlock(records, skill);
  }

  return {
    runs: n,
    // Non-enumerable raw records for gate evaluation; stripped before the
    // receipt is serialised (see sim-career-agents.mjs `stripInternal`).
    _records: records,
    unlockRate,
    actionsToUnlock,
    tradesToUnlock,
    boundedExpectedActionsToUnlock: boundedExpectedActionsToUnlockBySkill,
    conditionalMedianActionsToUnlock: conditionalMedianActionsToUnlockBySkill,
    wipeProbability: rate((record) => record.wiped),
    liquidationRate: rate((record) => record.marginLiquidated),
    accountResetRate: rate((record) => typeof record.accountResets === 'number' && record.accountResets > 0),
    riskBudgetViolationRate: rate((record) => record.riskBudgetViolations > 0),
    riskBudgetViolationTotal: records.reduce((sum, record) => sum + record.riskBudgetViolations, 0),
    unverifiedRiskRate: rate((record) => record.unverifiedRiskTrades > 0),
    unverifiedRiskTotal: records.reduce((sum, record) => sum + record.unverifiedRiskTrades, 0),
    stopWideningRate: rate((record) => record.stopWidenCount > 0),
    stopWideningTotal: records.reduce((sum, record) => sum + record.stopWidenCount, 0),
    receiptFrequency: stats(records.map((record) => record.receiptsAwarded)),
    tradesClosed: stats(records.map((record) => record.tradesClosed)),
    actionsAccepted: stats(records.map((record) => record.actionsAccepted)),
    actionsRejected: stats(records.map((record) => record.actionsRejected)),
    maxAccountDrawdownBps: stats(records.map((record) => record.maxAccountDrawdownBps)),
    tuningMaxAccountDrawdownBps: stats(
      records
        .map((record) => record.tuningMaxAccountDrawdownBps)
        .filter((value) => value !== null && value !== undefined),
    ),
    finalEquityFrac: stats(records.map((record) => record.finalEquityFrac)),
    careerScore: 'NOT_IMPLEMENTED',
  };
}

export function aggregateByRegime(records) {
  const byRegime = {};
  for (const record of records) {
    (byRegime[record.regimeId] ??= []).push(record);
  }
  const out = {};
  for (const [regimeId, group] of Object.entries(byRegime).sort(([a], [b]) => a.localeCompare(b))) {
    out[regimeId] = {
      runs: group.length,
      unlockRate: Object.fromEntries(
        TRACKED_SKILLS.map((skill) => [skill, round(group.filter((record) => record.reached[skill]).length / group.length)]),
    ),
      wipeProbability: round(group.filter((record) => record.wiped).length / group.length),
      finalEquityFrac: stats(group.map((record) => record.finalEquityFrac)),
    };
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* canonical serialisation + digest                                            */
/* -------------------------------------------------------------------------- */

/** Deterministic canonical JSON: sorted keys, bigint -> "bigint:<n>". Mirrors
 *  `packages/sim/src/replay.ts`'s canonical form. */
export function canonicalJson(value) {
  if (typeof value === 'bigint') return `"bigint:${value.toString()}"`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

/** FNV-1a 64-bit over the canonical form — same algorithm as
 *  `stableReplayDigest` in `packages/sim`. */
export function digestOf(value) {
  const input = canonicalJson(value);
  let hash = 14695981039346656037n;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `FNV1A64-${hash.toString(16).padStart(16, '0')}`;
}
