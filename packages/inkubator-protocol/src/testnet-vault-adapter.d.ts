import type {BuildContract} from './challenge.d.ts';
import type {StageJ0SettlementAdapterBinding, StageJ0SettlementFundingFact} from './settlement-adapter.d.ts';

export interface StageJ2Network {
  network_id: 'ink-sepolia:763373';
  network_name: 'Ink Sepolia';
  chain_id: 763373;
  rpc_url: 'https://rpc-gel-sepolia.inkonchain.com';
  explorer_url: 'https://explorer-sepolia.inkonchain.com';
}

export interface StageJ2PayoutEntryInput {
  entry_id: string;
  payout_address: string;
}

export interface StageJ2PayoutRosterEntry extends StageJ2PayoutEntryInput {
  entry_digest: string;
  payout_order: number;
}

export interface StageJ2VaultPlan {
  schema_version: 'inkubator.testnet-vault-plan/1.0';
  value_mode: 'TEST_ONLY';
  network: StageJ2Network;
  challenge_id: string;
  challenge_digest: string;
  terms_digest: string;
  binding_digest: string;
  adapter_ref: string;
  asset: string;
  token_address: string;
  prize_minor_units: number;
  review_deadline_ms: number;
  organizer_selection_deadline_seconds: number;
  refund_recipient: string;
  outcome_authority: string;
  organizer_selection_authority: string;
  resolver_authority: string;
  payout_roster: readonly StageJ2PayoutRosterEntry[];
  plan_digest: string;
}

export interface StageJ2VaultSnapshot {
  schema_version: 'inkubator.testnet-vault-snapshot/1.0';
  plan_digest: string;
  vault_address: string;
  chain_id: number;
  token_address: string;
  challenge_digest: string;
  terms_digest: string;
  binding_digest: string;
  prize_minor_units: number;
  organizer_selection_deadline_seconds: number;
  refund_recipient: string;
  outcome_authority: string;
  organizer_selection_authority: string;
  resolver_authority: string;
}

export const STAGE_J2_VAULT_PLAN_SCHEMA_VERSION: string;
export const STAGE_J2_VAULT_SNAPSHOT_SCHEMA_VERSION: string;
export const STAGE_J2_NETWORK: Readonly<StageJ2Network>;
export const STAGE_J2_ALLOWED_TEST_ASSETS: readonly string[];
export const STAGE_J2_MAX_PAYOUT_RECIPIENTS: number;

export function stageJ2ReviewDeadlineSeconds(reviewDeadlineMs: number): number;
export function stageJ2ChallengeDigest(challengeId: string): string;
export function buildStageJ2PayoutRoster(entries: StageJ2PayoutEntryInput[]): readonly StageJ2PayoutRosterEntry[];
export function buildStageJ2VaultPlan(args: {
  contract: BuildContract;
  binding: StageJ0SettlementAdapterBinding;
  token_address: string;
  refund_recipient: string;
  outcome_authority: string;
  organizer_selection_authority: string;
  resolver_authority: string;
  entries: StageJ2PayoutEntryInput[];
}): Readonly<StageJ2VaultPlan>;
export function assertStageJ2VaultSnapshotMatchesPlan(plan: StageJ2VaultPlan, snapshot: StageJ2VaultSnapshot): StageJ2VaultSnapshot;
export function buildStageJ2FundingFact(args: {
  contract: BuildContract;
  binding: StageJ0SettlementAdapterBinding;
  vault_address: string;
  funding_tx_hash: string;
}): Readonly<StageJ0SettlementFundingFact>;
