import {execFileSync} from 'node:child_process';

import {
  STAGE_J4_EXCLUDED_USDC_E,
  STAGE_J4_NATIVE_USDC,
  STAGE_J4_NETWORK,
} from '../../packages/inkubator-protocol/src/production-candidate-vault-adapter.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const providers = Object.freeze([
  {id: 'gelato', rpc: 'https://rpc-gel.inkonchain.com'},
  {id: 'quicknode', rpc: 'https://rpc-qnd.inkonchain.com'},
]);

function cast(args) {
  return execFileSync('cast', args, {
    encoding: 'utf8',
    timeout: 20_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function slotHash(label, subtractOne) {
  const input = '0x' + Buffer.from(label, 'utf8').toString('hex');
  const hash = BigInt(cast(['keccak', input]));
  const slot = subtractOne ? hash - 1n : hash;
  return '0x' + slot.toString(16).padStart(64, '0');
}

function storageAddress(rpc, slot) {
  const raw = cast(['storage', STAGE_J4_NATIVE_USDC.address, slot, '--rpc-url', rpc]).toLowerCase();
  invariant(/^0x[0-9a-f]{64}$/.test(raw), 'proxy slot read must be bytes32');
  return '0x' + raw.slice(-40);
}

function firstNonzeroAddress(rpc, slots, label) {
  for (const slot of slots) {
    const address = storageAddress(rpc, slot);
    if (address !== '0x0000000000000000000000000000000000000000') {
      return {slot, address};
    }
  }
  throw new Error(`${label} proxy slot not found`);
}

const implementationSlots = Object.freeze([
  slotHash('eip1967.proxy.implementation', true),
  slotHash('org.zeppelinos.proxy.implementation', false),
]);
const adminSlots = Object.freeze([
  slotHash('eip1967.proxy.admin', true),
  slotHash('org.zeppelinos.proxy.admin', false),
]);

const observations = providers.map(({id, rpc}) => {
  const chainId = Number(cast(['chain-id', '--rpc-url', rpc]));
  invariant(chainId === STAGE_J4_NETWORK.chain_id, `${id} returned wrong chain id ${chainId}`);

  const nativeCode = cast(['code', STAGE_J4_NATIVE_USDC.address, '--rpc-url', rpc]).toLowerCase();
  invariant(nativeCode.startsWith('0x') && nativeCode.length > 2, `${id} native USDC has no code`);
  const nativeCodeHash = cast(['keccak', nativeCode]).toLowerCase();

  const decimals = Number(cast([
    'call',
    STAGE_J4_NATIVE_USDC.address,
    'decimals()(uint8)',
    '--rpc-url',
    rpc,
  ]));
  invariant(decimals === STAGE_J4_NATIVE_USDC.decimals, `${id} native USDC decimals mismatch`);

  const symbol = cast([
    'call',
    STAGE_J4_NATIVE_USDC.address,
    'symbol()(string)',
    '--rpc-url',
    rpc,
  ]).replace(/^"|"$/g, '');
  invariant(symbol === STAGE_J4_NATIVE_USDC.symbol, `${id} native USDC symbol mismatch`);

  const pausedRaw = cast([
    'call',
    STAGE_J4_NATIVE_USDC.address,
    'paused()(bool)',
    '--rpc-url',
    rpc,
  ]);
  invariant(pausedRaw === 'true' || pausedRaw === 'false', `${id} paused() is not a bool`);

  const blacklister = cast([
    'call',
    STAGE_J4_NATIVE_USDC.address,
    'blacklister()(address)',
    '--rpc-url',
    rpc,
  ]).toLowerCase();
  invariant(/^0x[0-9a-f]{40}$/.test(blacklister), `${id} blacklister() is not an address`);

  const implementation = firstNonzeroAddress(rpc, implementationSlots, `${id} implementation`);
  const admin = firstNonzeroAddress(rpc, adminSlots, `${id} admin`);
  invariant(/^0x[0-9a-f]{40}$/.test(implementation.address), `${id} implementation address invalid`);
  invariant(/^0x[0-9a-f]{40}$/.test(admin.address), `${id} admin address invalid`);

  const implementationCode = cast(['code', implementation.address, '--rpc-url', rpc]).toLowerCase();
  invariant(implementationCode.startsWith('0x') && implementationCode.length > 2, `${id} implementation has no code`);
  const implementationCodeHash = cast(['keccak', implementationCode]).toLowerCase();

  const bridgedCode = cast(['code', STAGE_J4_EXCLUDED_USDC_E.address, '--rpc-url', rpc]).toLowerCase();
  invariant(bridgedCode.startsWith('0x') && bridgedCode.length > 2, `${id} documented USDC.e has no code`);

  return {
    provider_id: id,
    chain_id: chainId,
    native_usdc_address: STAGE_J4_NATIVE_USDC.address,
    native_usdc_code_hash: nativeCodeHash,
    decimals,
    symbol,
    paused: pausedRaw === 'true',
    blacklister,
    proxy_implementation_slot: implementation.slot,
    proxy_implementation_address: implementation.address,
    proxy_implementation_code_hash: implementationCodeHash,
    proxy_admin_slot: admin.slot,
    proxy_admin_address: admin.address,
    excluded_usdc_e_address: STAGE_J4_EXCLUDED_USDC_E.address,
    excluded_usdc_e_has_code: true,
  };
});

invariant(
  observations[0].native_usdc_code_hash === observations[1].native_usdc_code_hash,
  'providers disagree on native USDC runtime code hash',
);
invariant(
  observations[0].blacklister === observations[1].blacklister,
  'providers disagree on native USDC blacklister',
);
invariant(
  observations[0].paused === observations[1].paused,
  'providers disagree on native USDC pause state',
);

for (const key of [
  'proxy_implementation_slot',
  'proxy_implementation_address',
  'proxy_implementation_code_hash',
  'proxy_admin_slot',
  'proxy_admin_address',
]) {
  invariant(observations[0][key] === observations[1][key], `providers disagree on native USDC ${key}`);
}

process.stdout.write(JSON.stringify({
  schema_version: 'inkubator.j4-readonly-ink-asset-probe/1.0',
  authority: 'READ_ONLY_NO_BROADCAST_NO_VALUE',
  network: STAGE_J4_NETWORK.network_id,
  observations,
}, null, 2) + '\n');
