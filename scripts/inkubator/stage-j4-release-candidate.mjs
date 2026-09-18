import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';

import {buildStageJ4ReleaseCandidateReceipt} from '../../packages/inkubator-protocol/src/production-candidate-vault-adapter.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256Bytes(...buffers) {
  const hash = createHash('sha256');
  for (const buffer of buffers) hash.update(buffer);
  return '0x' + hash.digest('hex');
}

function sha256File(path) {
  return sha256Bytes(fs.readFileSync(path));
}

function keccakHex(hex) {
  invariant(typeof hex === 'string' && /^0x[0-9a-fA-F]+$/.test(hex), 'bytecode must be 0x-prefixed hex');
  return execFileSync('cast', ['keccak', hex], {encoding: 'utf8'}).trim().toLowerCase();
}

const root = new URL('../../', import.meta.url);
const sourceCommit = process.env.SOURCE_COMMIT;
const resolverSignerSetDigest = process.env.RESOLVER_SIGNER_SET_DIGEST;

invariant(typeof sourceCommit === 'string' && /^[0-9a-f]{40}$/.test(sourceCommit), 'SOURCE_COMMIT must be a lowercase 40-char SHA');
invariant(
  typeof resolverSignerSetDigest === 'string' && /^0x[0-9a-fA-F]{64}$/.test(resolverSignerSetDigest),
  'RESOLVER_SIGNER_SET_DIGEST must be a 32-byte hex digest',
);

const foundryPath = new URL('contracts/inkubator-vault/foundry.toml', root);
const vaultPath = new URL(
  'contracts/inkubator-vault/out/ProductionCandidateChallengeVault.sol/ProductionCandidateChallengeVault.json',
  root,
);
const resolverPath = new URL(
  'contracts/inkubator-vault/out/ImmutableResolver1271.sol/ImmutableResolver1271.json',
  root,
);

const vaultBytes = fs.readFileSync(vaultPath);
const resolverBytes = fs.readFileSync(resolverPath);
const vault = JSON.parse(vaultBytes);
const resolver = JSON.parse(resolverBytes);

const constructorAbi = vault.abi.filter((item) => item.type === 'constructor');
const receipt = buildStageJ4ReleaseCandidateReceipt({
  source_commit: sourceCommit,
  foundry_toml_digest: sha256File(foundryPath),
  artifact_digest: sha256Bytes(vaultBytes, resolverBytes),
  constructor_abi_digest: sha256Bytes(Buffer.from(JSON.stringify(constructorAbi))),
  vault_creation_bytecode_hash: keccakHex(vault.bytecode.object),
  vault_runtime_bytecode_hash: keccakHex(vault.deployedBytecode.object),
  resolver_creation_bytecode_hash: keccakHex(resolver.bytecode.object),
  resolver_runtime_bytecode_hash: keccakHex(resolver.deployedBytecode.object),
  resolver_signer_set_digest: resolverSignerSetDigest,
});

process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
