import {createHash} from 'node:crypto';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readSchema(name) {
  return JSON.parse(fs.readFileSync(new URL(`../schema/${name}`, import.meta.url), 'utf8'));
}

const ajv = new Ajv2020({allErrors: true, strict: true});
addFormats(ajv);

const validateRound = ajv.compile(readSchema('round.schema.json'));
const validatePlayer = ajv.compile(readSchema('player.schema.json'));
const validateReceipt = ajv.compile(readSchema('ship-receipt.schema.json'));

function assertSchema(validate, value, label) {
  if (validate(value)) return value;
  const detail = validate.errors
    ?.map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join('; ') ?? 'unknown schema error';
  throw new Error(`${label} schema invalid: ${detail}`);
}

export function assertRound(round) {
  return assertSchema(validateRound, round, 'round');
}

export function assertPlayer(player) {
  return assertSchema(validatePlayer, player, 'player');
}

export function assertReceipt(receipt) {
  return assertSchema(validateReceipt, receipt, 'receipt');
}

// Deterministic protocol canonicalization profile v0.1.
// Records intentionally permit only JSON primitives; non-integer numbers are rejected
// so digest stability does not depend on floating-point serialization edge cases.
export function canonicalizeV0(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    invariant(Number.isSafeInteger(value), 'protocol numbers must be safe integers');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeV0).join(',')}]`;
  invariant(value && typeof value === 'object', 'unsupported protocol value');
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeV0(value[key])}`).join(',')}}`;
}

export function digestRecord(record) {
  return createHash('sha256').update(canonicalizeV0(record), 'utf8').digest('hex');
}

export function compilePublicState({mode = 'production', rounds, players, receipts}) {
  invariant(Array.isArray(rounds) && Array.isArray(players) && Array.isArray(receipts), 'rounds, players and receipts must be arrays');
  rounds.forEach(assertRound);
  players.forEach(assertPlayer);
  receipts.forEach(assertReceipt);

  const roundById = new Map(rounds.map((round) => [round.roundId, round]));
  const playerById = new Map(players.map((player) => [player.playerId, player]));
  invariant(roundById.size === rounds.length, 'duplicate roundId');
  invariant(playerById.size === players.length, 'duplicate playerId');

  const publicReceipts = receipts.map((receipt) => {
    invariant(roundById.has(receipt.roundId), `unknown roundId ${receipt.roundId}`);
    invariant(playerById.has(receipt.playerId), `unknown playerId ${receipt.playerId}`);
    return {...receipt, digestAlgorithm: 'sha256', digestProfile: 'inkubator-canonical-json/0.1', digest: digestRecord(receipt)};
  });

  const shipsByPlayer = new Map(players.map((player) => [player.playerId, 0]));
  for (const receipt of receipts) shipsByPlayer.set(receipt.playerId, (shipsByPlayer.get(receipt.playerId) ?? 0) + 1);

  const playerStats = players.map((player) => ({
    playerId: player.playerId,
    ships: shipsByPlayer.get(player.playerId) ?? 0,
    rounds: new Set(receipts.filter((receipt) => receipt.playerId === player.playerId).map((receipt) => receipt.roundId)).size,
  }));

  return {
    protocolVersion: 'inkubator-public-state/0.1',
    mode,
    rounds,
    players,
    receipts: publicReceipts,
    playerStats,
  };
}
