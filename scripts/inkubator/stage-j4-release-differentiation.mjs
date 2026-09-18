import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
function keccakHex(hex) {
  invariant(typeof hex === 'string' && /^0x[0-9a-fA-F]+$/.test(hex), 'bytecode must be 0x-prefixed hex');
  return execFileSync('cast', ['keccak', hex], {encoding: 'utf8'}).trim().toLowerCase();
}

const basePath = process.env.BASE_VAULT_ARTIFACT;
const variantPath = process.env.VARIANT_VAULT_ARTIFACT;
invariant(basePath && variantPath, 'BASE_VAULT_ARTIFACT and VARIANT_VAULT_ARTIFACT required');

const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const variant = JSON.parse(fs.readFileSync(variantPath, 'utf8'));

const baseCreation = keccakHex(base.bytecode.object);
const baseRuntime = keccakHex(base.deployedBytecode.object);
const variantCreation = keccakHex(variant.bytecode.object);
const variantRuntime = keccakHex(variant.deployedBytecode.object);

invariant(
  baseCreation !== variantCreation || baseRuntime !== variantRuntime,
  'altered optimizer/source candidate unexpectedly matches frozen release identity',
);

process.stdout.write(JSON.stringify({
  schema_version: 'inkubator.j4-release-differentiation/1.0',
  base_creation_hash: baseCreation,
  base_runtime_hash: baseRuntime,
  variant_creation_hash: variantCreation,
  variant_runtime_hash: variantRuntime,
  identity_match: false,
}, null, 2) + '\n');
