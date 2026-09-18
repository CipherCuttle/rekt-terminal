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

const scriptsDir = new URL('scripts/inkubator/', root);
const stageJ4Scripts = fs.readdirSync(scriptsDir)
  .filter((name) => name.startsWith('stage-j4-') && name.endsWith('.mjs'))
  .map((name) => fs.readFileSync(new URL(name, scriptsDir), 'utf8'))
  .join('\n');

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

for (const pattern of [
  /\$\{\{\s*secrets\./i,
  /outcome[_-]?private[_-]?key/i,
  /resolver[_-]?private[_-]?key/i,
  /organizer[_-]?private[_-]?key/i,
  /\bmnemonic\b/i,
  /\bseed[_-]?phrase\b/i,
]) {
  invariant(!pattern.test(workflow), `J4 CI references forbidden signer secret surface: ${pattern}`);
  invariant(!pattern.test(stageJ4Scripts), `J4 scripts reference forbidden signer secret surface: ${pattern}`);
}

const vaultEvents = vault.abi.filter((item) => item.type === 'event');
for (const event of vaultEvents) {
  for (const input of event.inputs ?? []) {
    invariant(
      !['string', 'bytes'].includes(input.type) && !input.type.includes('[]'),
      `vault event exposes dynamic/private blob surface: ${event.name}.${input.name}:${input.type}`,
    );
    invariant(
      !/(github|username|handle|email|repository|repo_name|source_name|display_name)/i.test(input.name ?? ''),
      `vault event exposes identity/source metadata: ${event.name}.${input.name}`,
    );
    if (/evidence/i.test(input.name ?? '')) {
      invariant(input.type === 'bytes32', `evidence event field must remain opaque bytes32: ${event.name}.${input.name}`);
    }
  }
}

for (const item of vaultFunctions.filter((fn) => (fn.inputs ?? []).length === 0)) {
  for (const output of item.outputs ?? []) {
    invariant(
      !['string', 'bytes'].includes(output.type) && !output.type.includes('[]'),
      `public vault getter exposes dynamic/private blob: ${item.name} -> ${output.type}`,
    );
  }
}

const resolverNames = resolverFunctions.map((item) => item.name).sort();
invariant(
  JSON.stringify(resolverNames) === JSON.stringify(['INVALID', 'MAGICVALUE', 'isSigner', 'isValidSignature', 'quorum', 'signer1', 'signer2', 'signer3'].sort()),
  `unexpected resolver ABI: ${resolverNames.join(',')}`,
);

const result = {
  schema_version: 'inkubator.j4-preaudit-static-verification/1.0',
  vault_function_count: vaultFunctions.length,
  resolver_functions: resolverNames,
  forbidden_abi_surfaces: 'ABSENT',
  forbidden_runtime_opcodes: 'ABSENT',
  production_broadcast_surface: 'ABSENT',
  production_signer_secret_surface: 'ABSENT',
  event_private_blob_surface: 'ABSENT',
  event_identity_metadata_surface: 'ABSENT',
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
