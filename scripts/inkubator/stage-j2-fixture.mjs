import fs from 'node:fs';
import path from 'node:path';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  IP_TERMS_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  buildSettlementIntent,
  computeDefaultResolution,
  freezeBuildContract,
} from '../../packages/inkubator-protocol/src/challenge.mjs';
import {
  bindStageJ0SettlementAdapter,
  buildStageJ0SettlementManifest,
} from '../../packages/inkubator-protocol/src/settlement-adapter.mjs';
import {
  STAGE_J2_NETWORK,
  buildStageJ2VaultPlan,
} from '../../packages/inkubator-protocol/src/testnet-vault-adapter.mjs';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function appendGithubEnv(values) {
  const target = process.env.GITHUB_ENV;
  if (!target) return;
  const body = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.appendFileSync(target, `${body}\n`);
}

const now = Date.now();
const challengeId = process.env.J2_CHALLENGE_ID ?? `CH-J2-${now}`;
const prizeMinorUnits = Number(process.env.J2_PRIZE_AMOUNT ?? '250000000');
if (!Number.isSafeInteger(prizeMinorUnits) || prizeMinorUnits <= 0) {
  throw new Error('J2_PRIZE_AMOUNT must be a positive safe integer');
}

const payoutByEntryId = {
  'E-A': requiredEnv('J2_BUILDER_A').toLowerCase(),
  'E-B': requiredEnv('J2_BUILDER_B').toLowerCase(),
  'E-C': requiredEnv('J2_BUILDER_C').toLowerCase(),
};

const contract = freezeBuildContract({
  schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
  challenge_id: challengeId,
  contract_version: 'stage-j2-public-testnet-rehearsal-v1',
  mechanism_version: MECHANISM_VERSION,
  settlement_policy_version: SETTLEMENT_POLICY_VERSION,
  ip_terms_version: IP_TERMS_VERSION,
  title: 'Stage J2 Ink Sepolia public-testnet rehearsal',
  brief: 'Execute the bounded 250-unit synthetic settlement loop on Ink Sepolia.',
  outcome_contract: {criteria: []},
  production_envelope: {criteria: []},
  delivery_contract: {criteria: []},
  preferences: {},
  reference_architecture: {},
  normative_constraints: [],
  normative_references: [],
  informational_references: [],
  knowledge: [],
  slot_limit: 3,
  activation_minimum: 1,
  entry_deadline: now + 1_000,
  build_start: now + 1_000,
  submission_deadline: now + 2_000,
  appeal_window_ms: 1_000,
  review_deadline: now + 180_000,
  prize_minor_units: prizeMinorUnits,
  prize_display: '250 TEST USDC',
  settlement_asset: 'USDC_TEST',
});

const binding = bindStageJ0SettlementAdapter({
  contract,
  adapter_kind: 'TESTNET_CHALLENGE_VAULT',
  adapter_ref: `ink-sepolia:j2-rehearsal:${challengeId}:challenge-vault-v1`,
  network_id: STAGE_J2_NETWORK.network_id,
});

const plan = buildStageJ2VaultPlan({
  contract,
  binding,
  token_address: requiredEnv('J2_TOKEN_ADDRESS'),
  refund_recipient: requiredEnv('J2_REFUND_RECIPIENT'),
  outcome_authority: requiredEnv('J2_OUTCOME_AUTHORITY'),
  organizer_selection_authority: requiredEnv('J2_ORGANIZER_AUTHORITY'),
  resolver_authority: requiredEnv('J2_RESOLVER_AUTHORITY'),
  entries: [
    {entry_id: 'E-C', payout_address: payoutByEntryId['E-C']},
    {entry_id: 'E-A', payout_address: payoutByEntryId['E-A']},
    {entry_id: 'E-B', payout_address: payoutByEntryId['E-B']},
  ],
});

const winnerIntent = buildSettlementIntent({
  contract,
  resolution: {
    type: 'WINNER_PAYOUT',
    winner_entry_id: 'E-A',
    distributions: [{entry_id: 'E-A', amount_minor_units: prizeMinorUnits}],
  },
  recipientByEntryId: payoutByEntryId,
});
const winnerManifest = buildStageJ0SettlementManifest({
  contract,
  settlementIntent: winnerIntent,
  binding,
  authorization_mode: 'ORGANIZER_SELECTION',
});

const defaultIntent = buildSettlementIntent({
  contract,
  resolution: computeDefaultResolution(['E-C', 'E-A', 'E-B'], prizeMinorUnits),
  recipientByEntryId: payoutByEntryId,
});
const defaultManifest = buildStageJ0SettlementManifest({
  contract,
  settlementIntent: defaultIntent,
  binding,
});

const refundIntent = buildSettlementIntent({
  contract,
  resolution: computeDefaultResolution([], prizeMinorUnits),
  refundRecipientId: requiredEnv('J2_REFUND_RECIPIENT').toLowerCase(),
});
const refundManifest = buildStageJ0SettlementManifest({
  contract,
  settlementIntent: refundIntent,
  binding,
});

const artifact = {
  schema_version: 'inkubator.stage-j2-rehearsal-fixture/1.0',
  generated_at: new Date(now).toISOString(),
  contract,
  binding,
  vault_plan: plan,
  scenarios: {
    organizer_winner: {intent: winnerIntent, manifest: winnerManifest},
    frozen_default_distribution: {intent: defaultIntent, manifest: defaultManifest},
    zero_qualifier_refund: {intent: refundIntent, manifest: refundManifest},
  },
};

const output = process.env.J2_FIXTURE_OUT ?? 'j2-artifacts/fixture.json';
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);

appendGithubEnv({
  J2_CHALLENGE_DIGEST: plan.challenge_digest,
  J2_TERMS_DIGEST: plan.terms_digest,
  J2_BINDING_DIGEST: plan.binding_digest,
  J2_SELECTION_DEADLINE_SECONDS: String(plan.organizer_selection_deadline_seconds),
  J2_PLAN_DIGEST: plan.plan_digest,
  J2_WINNER_MANIFEST_DIGEST: `0x${winnerManifest.manifest_digest}`,
  J2_DEFAULT_MANIFEST_DIGEST: `0x${defaultManifest.manifest_digest}`,
  J2_REFUND_MANIFEST_DIGEST: `0x${refundManifest.manifest_digest}`,
});

process.stdout.write(JSON.stringify({
  challenge_id: contract.challenge_id,
  terms_digest: contract.terms_digest,
  binding_digest: binding.binding_digest,
  plan_digest: plan.plan_digest,
  deadline_seconds: plan.organizer_selection_deadline_seconds,
  payout_roster: plan.payout_roster,
  output,
}, null, 2));
