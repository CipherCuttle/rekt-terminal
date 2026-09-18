import fs from 'node:fs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const root = new URL('../../', import.meta.url);
const vaultArtifactPath = new URL(
  'contracts/inkubator-vault/out/ProductionCandidateChallengeVault.sol/ProductionCandidateChallengeVault.json',
  root,
);
const resolverArtifactPath = new URL(
  'contracts/inkubator-vault/out/ImmutableResolver1271.sol/ImmutableResolver1271.json',
  root,
);
const workflowPath = new URL('.github/workflows/inkubator-j4.yml', root);

const vault = JSON.parse(fs.readFileSync(vaultArtifactPath, 'utf8'));
const resolver = JSON.parse(fs.readFileSync(resolverArtifactPath, 'utf8'));
const workflow = fs.readFileSync(workflowPath, 'utf8');

function functionAbi(artifact) {
  return artifact.abi.filter((item) => item.type === 'function');
}

const vaultFunctions = functionAbi(vault);
const resolverFunctions = functionAbi(resolver);

const forbiddenNamePatterns = [
  /owner/i,
  /admin/i,
  /sweep/i,
  /rescue/i,
  /upgrade/i,
  /implementation/i,
  /proxy/i,
  /delegate/i,
  /arbitrary/i,
  /withdraw/i,
  /bridge/i,
  /swap/i,
  /yield/i,
  /fee/i,
];

for (const item of vaultFunctions) {
  for (const pattern of forbiddenNamePatterns) {
    invariant(!pattern.test(item.name), `forbidden vault ABI surface: ${item.name}`);
  }
}

for (const item of resolverFunctions) {
  invariant(
    item.stateMutability === 'view' || item.stateMutability === 'pure',
    `resolver exposes mutating callable surface: ${item.name}`,
  );
}

function assertForbiddenOpcodesAbsent(artifact, label) {
  const opcodes = artifact.deployedBytecode?.opcodes ?? '';
  invariant(!/(^|\s)SELFDESTRUCT(\s|$)/.test(opcodes), `${label} runtime contains SELFDESTRUCT`);
  invariant(!/(^|\s)DELEGATECALL(\s|$)/.test(opcodes), `${label} runtime contains DELEGATECALL`);
}

assertForbiddenOpcodesAbsent(vault, 'vault');
assertForbiddenOpcodesAbsent(resolver, 'resolver');

for (const pattern of [
  /forge\s+script[^\n]*--broadcast/i,
  /cast\s+send/i,
  /private[_-]?key/i,
  /mainnet[_-]?rpc[_-]?url/i,
]) {
  invariant(!pattern.test(workflow), `J4 CI contains forbidden production execution surface: ${pattern}`);
}

const resolverNames = resolverFunctions.map((item) => item.name).sort();
invariant(
  JSON.stringify(resolverNames) === JSON.stringify(['isSigner', 'isValidSignature', 'quorum', 'signer1', 'signer2', 'signer3'].sort()),
  `unexpected resolver ABI: ${resolverNames.join(',')}`,
);

const result = {
  schema_version: 'inkubator.j4-preaudit-static-verification/1.0',
  vault_function_count: vaultFunctions.length,
  resolver_functions: resolverNames,
  forbidden_abi_surfaces: 'ABSENT',
  forbidden_runtime_opcodes: 'ABSENT',
  production_broadcast_surface: 'ABSENT',
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
