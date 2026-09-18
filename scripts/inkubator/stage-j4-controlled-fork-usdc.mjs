import {execFileSync} from 'node:child_process';

import {
  STAGE_J4_EXCLUDED_USDC_E,
  STAGE_J4_NATIVE_USDC,
  buildStageJ4DeploymentPlan,
} from '../../packages/inkubator-protocol/src/production-candidate-vault-adapter.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const rpc = process.env.LOCAL_FORK_RPC ?? 'http://127.0.0.1:8547';
const actor = '0x1111111111111111111111111111111111111111';

function cast(args) {
  return execFileSync('cast', [...args, '--rpc-url', rpc], {
    encoding: 'utf8',
    timeout: 20_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const chainId = Number(cast(['chain-id']));
invariant(chainId === 31337, `local fork must use isolated chain id 31337, got ${chainId}`);

const nativeCode = cast(['code', STAGE_J4_NATIVE_USDC.address]).toLowerCase();
invariant(nativeCode.startsWith('0x') && nativeCode.length > 2, 'native Ink USDC missing from fork');
const bridgedCode = cast(['code', STAGE_J4_EXCLUDED_USDC_E.address]).toLowerCase();
invariant(bridgedCode.startsWith('0x') && bridgedCode.length > 2, 'documented USDC.e missing from fork');

const decimals = Number(cast(['call', STAGE_J4_NATIVE_USDC.address, 'decimals()(uint8)']));
invariant(decimals === 6, 'native USDC decimals mismatch on fork');

const symbol = cast(['call', STAGE_J4_NATIVE_USDC.address, 'symbol()(string)']).replace(/^"|"$/g, '');
invariant(symbol === 'USDC', 'native USDC symbol mismatch on fork');

const transferZero = cast([
  'call',
  STAGE_J4_NATIVE_USDC.address,
  'transfer(address,uint256)(bool)',
  actor,
  '0',
  '--from',
  actor,
]);
invariant(transferZero === 'true', `native USDC transfer(0) unexpected result: ${transferZero}`);

const transferFromZero = cast([
  'call',
  STAGE_J4_NATIVE_USDC.address,
  'transferFrom(address,address,uint256)(bool)',
  actor,
  actor,
  '0',
  '--from',
  actor,
]);
invariant(transferFromZero === 'true', `native USDC transferFrom(0) unexpected result: ${transferFromZero}`);

const acceptedPlan = buildStageJ4DeploymentPlan({
  source_commit: 'a'.repeat(40),
  challenge_digest: '0x' + '11'.repeat(32),
  terms_digest: '0x' + '22'.repeat(32),
  binding_digest: '0x' + '33'.repeat(32),
  token_address: STAGE_J4_NATIVE_USDC.address,
  refund_recipient: '0x' + '10'.repeat(20),
  outcome_authority: '0x' + '20'.repeat(20),
  organizer_selection_authority: '0x' + '30'.repeat(20),
  resolver_authority: '0x' + '40'.repeat(20),
  resolver_signer_set_digest: '0x' + '44'.repeat(32),
  prize_minor_units: 1,
  activation_deadline_ms: 1_000,
  organizer_selection_deadline_ms: 2_000,
  prebuild_refund_manifest_digest: '0x' + '55'.repeat(32),
  terminal_refund_manifest_digest: '0x' + '66'.repeat(32),
});
invariant(acceptedPlan.asset.address === STAGE_J4_NATIVE_USDC.address, 'candidate plan did not accept native USDC');

let bridgedRejected = false;
try {
  buildStageJ4DeploymentPlan({
    ...acceptedPlan,
    source_commit: 'a'.repeat(40),
    token_address: STAGE_J4_EXCLUDED_USDC_E.address,
    challenge_digest: acceptedPlan.challenge_digest,
    terms_digest: acceptedPlan.terms_digest,
    binding_digest: acceptedPlan.binding_digest,
    refund_recipient: acceptedPlan.refund_recipient,
    outcome_authority: acceptedPlan.outcome_authority,
    organizer_selection_authority: acceptedPlan.organizer_selection_authority,
    resolver_authority: acceptedPlan.resolver_authority,
    resolver_signer_set_digest: acceptedPlan.resolver_signer_set_digest,
    prize_minor_units: acceptedPlan.prize_minor_units,
    activation_deadline_ms: acceptedPlan.activation_deadline_seconds * 1000,
    organizer_selection_deadline_ms: acceptedPlan.organizer_selection_deadline_seconds * 1000,
    prebuild_refund_manifest_digest: acceptedPlan.prebuild_refund_manifest_digest,
    terminal_refund_manifest_digest: acceptedPlan.terminal_refund_manifest_digest,
  });
} catch {
  bridgedRejected = true;
}
invariant(bridgedRejected, 'candidate plan must reject documented USDC.e');

process.stdout.write(JSON.stringify({
  schema_version: 'inkubator.j4-controlled-fork-usdc/1.0',
  authority: 'LOCAL_FORK_ONLY_NO_UPSTREAM_BROADCAST_NO_REAL_VALUE',
  local_chain_id: chainId,
  native_usdc: STAGE_J4_NATIVE_USDC.address,
  excluded_usdc_e: STAGE_J4_EXCLUDED_USDC_E.address,
  decimals,
  symbol,
  transfer_zero: true,
  transfer_from_zero: true,
  native_candidate_plan: 'ACCEPTED',
  bridged_candidate_plan: 'REJECTED',
}, null, 2) + '\n');
