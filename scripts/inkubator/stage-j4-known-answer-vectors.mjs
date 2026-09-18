import {execFileSync} from 'node:child_process';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function strip0x(value) {
  return value.startsWith('0x') ? value.slice(2) : value;
}
function hexBytes(value) {
  return Buffer.from(strip0x(value), 'hex');
}
function utf8Hex(value) {
  return Buffer.from(value, 'utf8').toString('hex');
}
function wordHex(value) {
  const hex = typeof value === 'bigint' ? value.toString(16) : strip0x(value);
  if (hex.length > 64) throw new Error('word overflow');
  return hex.padStart(64, '0');
}
function uintPacked(value, bytes) {
  const hex = BigInt(value).toString(16);
  if (hex.length > bytes * 2) throw new Error('packed uint overflow');
  return hex.padStart(bytes * 2, '0');
}
function addressWord(value) {
  const hex = strip0x(value).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error('bad address');
  return hex.padStart(64, '0');
}
function bytes32Word(value) {
  const hex = strip0x(value).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('bad bytes32');
  return hex;
}
function keccakHex(hex) {
  return execFileSync('cast', ['keccak', '0x' + strip0x(hex)], {encoding: 'utf8'}).trim().toLowerCase();
}
function keccakUtf8(value) {
  return keccakHex(utf8Hex(value));
}
function hashWords(words) {
  return keccakHex(words.join(''));
}
function typed(domainSeparator, structHash) {
  return keccakHex('1901' + strip0x(domainSeparator) + strip0x(structHash));
}
function pair(left, right) {
  const a = BigInt(left);
  const b = BigInt(right);
  const [low, high] = a <= b ? [left, right] : [right, left];
  return keccakHex('01' + strip0x(low) + strip0x(high));
}

const V = Object.freeze({
  chainId: 57073n,
  vault: '0x1111111111111111111111111111111111111111',
  payoutA: '0x2222222222222222222222222222222222222222',
  payoutB: '0x3333333333333333333333333333333333333333',
  challenge: '0x' + 'aa'.repeat(32),
  terms: '0x' + 'bb'.repeat(32),
  binding: '0x' + 'cc'.repeat(32),
  entryA: '0x' + 'dd'.repeat(32),
  entryB: '0x' + '44'.repeat(32),
  defaultManifest: '0x' + 'ee'.repeat(32),
  winnerManifest: '0x' + '99'.repeat(32),
  amount: 1_234_567n,
});

const domainTypehash = keccakUtf8('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
const nameHash = keccakUtf8('REKT Inkubator Production Candidate Challenge Vault');
const versionHash = keccakUtf8('1');
const payoutSetTypehash = keccakUtf8(
  'PayoutSet(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 payoutSetRoot,uint16 payoutCount)',
);
const qualifierSetTypehash = keccakUtf8(
  'QualifierSet(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 payoutSetRoot,bytes32 qualifierSetRoot,uint16 qualifierCount,bytes32 defaultManifestDigest,bytes32 recoveryEvidenceDigest,uint8 mode)',
);
const settlementTypehash = keccakUtf8(
  'Settlement(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 manifestDigest,bytes32 qualifierSetRoot,uint8 kind,bytes32 recipientsDigest)',
);

const payoutLeafA = keccakHex(
  '00' + strip0x(V.entryA) + uintPacked(0, 2) + strip0x(V.payoutA),
);
const payoutLeafB = keccakHex(
  '00' + strip0x(V.entryB) + uintPacked(1, 2) + strip0x(V.payoutB),
);
const payoutRoot = pair(payoutLeafA, payoutLeafB);
const qualifierRoot = payoutLeafA;

const domainSeparator = hashWords([
  bytes32Word(domainTypehash),
  bytes32Word(nameHash),
  bytes32Word(versionHash),
  wordHex(V.chainId),
  addressWord(V.vault),
]);

const payoutSetStructHash = hashWords([
  bytes32Word(payoutSetTypehash),
  bytes32Word(V.challenge),
  bytes32Word(V.terms),
  bytes32Word(V.binding),
  bytes32Word(payoutRoot),
  wordHex(2n),
]);
const payoutSetDigest = typed(domainSeparator, payoutSetStructHash);

const qualifierStructHash = hashWords([
  bytes32Word(qualifierSetTypehash),
  bytes32Word(V.challenge),
  bytes32Word(V.terms),
  bytes32Word(V.binding),
  bytes32Word(payoutRoot),
  bytes32Word(qualifierRoot),
  wordHex(1n),
  bytes32Word(V.defaultManifest),
  wordHex(0n),
  wordHex(0n),
]);
const qualifierDigest = typed(domainSeparator, qualifierStructHash);

const recipientItemHash = hashWords([
  bytes32Word(V.entryA),
  wordHex(0n),
  addressWord(V.payoutA),
  wordHex(V.amount),
]);
const emptyHash = keccakHex('');
const recipientsDigest = hashWords([
  bytes32Word(emptyHash),
  bytes32Word(recipientItemHash),
]);

const settlementStructHash = hashWords([
  bytes32Word(settlementTypehash),
  bytes32Word(V.challenge),
  bytes32Word(V.terms),
  bytes32Word(V.binding),
  bytes32Word(V.winnerManifest),
  bytes32Word(qualifierRoot),
  wordHex(0n),
  bytes32Word(recipientsDigest),
]);
const organizerWinnerDigest = typed(domainSeparator, settlementStructHash);

const output = {
  schema_version: 'inkubator.j4-known-answer/1.0',
  vector: {
    chain_id: Number(V.chainId),
    vault: V.vault,
    payout_a: V.payoutA,
    payout_b: V.payoutB,
    challenge_digest: V.challenge,
    terms_digest: V.terms,
    binding_digest: V.binding,
    entry_a: V.entryA,
    entry_b: V.entryB,
    default_manifest_digest: V.defaultManifest,
    winner_manifest_digest: V.winnerManifest,
    amount: Number(V.amount),
  },
  expected: {
    domain_separator: domainSeparator,
    payout_leaf_a: payoutLeafA,
    payout_leaf_b: payoutLeafB,
    payout_root: payoutRoot,
    payout_set_digest: payoutSetDigest,
    qualifier_set_digest: qualifierDigest,
    recipient_item_hash: recipientItemHash,
    recipients_digest: recipientsDigest,
    organizer_winner_digest: organizerWinnerDigest,
  },
};

const FROZEN_EXPECTED = Object.freeze({
  domain_separator: '0x204531b5999ca51070b22a39919156f03fbd230b8bbae0cc64e73217a5f336fc',
  payout_leaf_a: '0x281a7222c0e843ba2a41febded46e963bf6cde4ba6697bcfa51c6537e7b8f643',
  payout_leaf_b: '0x2253be8e577fb53a76895f2866840e7ff437a9302922fbe7fbbe6f3f031b2bc2',
  payout_root: '0x0195b69843ca1d3cc2e4bfdb67b9a5d3c0719929a033f045db6d90095cf0312d',
  payout_set_digest: '0xa1f6397f2ba892b494c657bc6a183ec44183a2ed8be3a62b9f8ecd5ae5202e19',
  qualifier_set_digest: '0xfd1656fab8c2c886907ad90e2653f37eafd7da10244871054c8dea25ac7cf138',
  recipient_item_hash: '0x179ddcabd1fff8ca39c9924d568488bb6d12077423dfc583f6d17c6757ec8203',
  recipients_digest: '0xab2d83a02e24a7c6929b27bfb460790b593b9acba9325c4ce4eccc478434fa0d',
  organizer_winner_digest: '0x8244a6f57602be276724496196eebca9bbcaaa216145be78d2d8991c09446fc8',
});

for (const [key, expected] of Object.entries(FROZEN_EXPECTED)) {
  invariant(output.expected[key] === expected, `known-answer drift for ${key}: ${output.expected[key]} != ${expected}`);
}

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
