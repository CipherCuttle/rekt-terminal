import {createHash} from 'node:crypto';

const ROUND_STATES = new Set(['DRAFT', 'OPEN', 'BUILDING', 'SHIP_WINDOW', 'CLOSED', 'ARCHIVED']);
const EVIDENCE_TYPES = new Set(['LIVE_URL', 'DEMO', 'SOURCE']);
const EVIDENCE_STATES = new Set(['PASS', 'SUPPLIED', 'MISSING', 'STALE']);
const ROUND_ID = /^R[A-Z0-9-]{2,31}$/;
const PLAYER_ID = /^P[A-Z0-9-]{2,31}$/;
const RECEIPT_ID = /^R[A-Z0-9-]+-S[0-9]{3,}$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHttps(value, label) {
  invariant(typeof value === 'string', `${label} must be a string`);
  const url = new URL(value);
  invariant(url.protocol === 'https:', `${label} must use https`);
}

function assertDateTime(value, label) {
  invariant(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label} must be an ISO date-time`);
}

export function assertRound(round) {
  invariant(round && typeof round === 'object' && !Array.isArray(round), 'round must be an object');
  invariant(round.schemaVersion === 'inkubator.round/0.1', 'unsupported round schemaVersion');
  invariant(ROUND_ID.test(round.roundId), 'invalid roundId');
  invariant(typeof round.title === 'string' && round.title.length > 0, 'round title is required');
  invariant(ROUND_STATES.has(round.status), 'invalid round status');
  invariant(typeof round.constraint === 'string' && round.constraint.length > 0, 'round constraint is required');
  invariant(round.rules && typeof round.rules === 'object', 'round rules are required');
  for (const key of ['workingUrlRequired', 'demoRequired', 'aiAllowed']) {
    invariant(typeof round.rules[key] === 'boolean', `round.rules.${key} must be boolean`);
  }
  return round;
}

export function assertPlayer(player) {
  invariant(player && typeof player === 'object' && !Array.isArray(player), 'player must be an object');
  invariant(player.schemaVersion === 'inkubator.player/0.1', 'unsupported player schemaVersion');
  invariant(PLAYER_ID.test(player.playerId), 'invalid playerId');
  invariant(typeof player.handle === 'string' && player.handle.length > 0, 'player handle is required');
  invariant(typeof player.displayName === 'string' && player.displayName.length > 0, 'player displayName is required');
  invariant(player.character && typeof player.character === 'object', 'player character is required');
  invariant(typeof player.character.callSign === 'string' && player.character.callSign.length > 0, 'character callSign is required');
  invariant(typeof player.character.archetype === 'string' && player.character.archetype.length > 0, 'character archetype is required');
  return player;
}

export function assertReceipt(receipt) {
  invariant(receipt && typeof receipt === 'object' && !Array.isArray(receipt), 'receipt must be an object');
  invariant(receipt.schemaVersion === 'inkubator.ship-receipt/0.1', 'unsupported receipt schemaVersion');
  invariant(RECEIPT_ID.test(receipt.receiptId), 'invalid receiptId');
  invariant(ROUND_ID.test(receipt.roundId), 'invalid receipt roundId');
  invariant(PLAYER_ID.test(receipt.playerId), 'invalid receipt playerId');
  invariant(receipt.artifact && typeof receipt.artifact === 'object', 'artifact is required');
  invariant(typeof receipt.artifact.title === 'string' && receipt.artifact.title.length > 0, 'artifact title is required');
  assertHttps(receipt.artifact.url, 'artifact.url');
  if (receipt.artifact.demoUrl) assertHttps(receipt.artifact.demoUrl, 'artifact.demoUrl');
  if (receipt.artifact.sourceUrl) assertHttps(receipt.artifact.sourceUrl, 'artifact.sourceUrl');
  assertDateTime(receipt.shippedAt, 'shippedAt');
  invariant(Array.isArray(receipt.evidence) && receipt.evidence.length > 0, 'receipt evidence is required');
  for (const evidence of receipt.evidence) {
    invariant(EVIDENCE_TYPES.has(evidence.type), 'invalid evidence type');
    invariant(EVIDENCE_STATES.has(evidence.status), 'invalid evidence status');
    assertDateTime(evidence.observedAt, 'evidence.observedAt');
    invariant(typeof evidence.claim === 'string' && evidence.claim.length > 0, 'evidence claim is required');
  }
  return receipt;
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
