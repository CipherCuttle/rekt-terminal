import type {BuildContract, SettlementIntent} from './challenge.d.ts';

export type StageJ0SettlementAdapterKind = 'MOCK' | 'TESTNET_CHALLENGE_VAULT';
export type SettlementAuthority =
  | 'INKUBATOR_OUTCOME'
  | 'ORGANIZER_SELECTION'
  | 'FROZEN_POLICY'
  | 'RESOLVER_THRESHOLD';
export type SettlementAdapterState =
  | 'UNBOUND'
  | 'BOUND'
  | 'FUNDED'
  | 'AUTHORIZED'
  | 'EXECUTION_PENDING'
  | 'RECONCILING'
  | 'FINALIZED';

export interface StageJ0SettlementAdapterBinding {
  schema_version: 'inkubator.settlement-adapter-binding/1.0';
  value_mode: 'TEST_ONLY';
  adapter_kind: StageJ0SettlementAdapterKind;
  adapter_ref: string;
  network_id: string | null;
  challenge_id: string;
  terms_digest: string;
  settlement_policy_version: string;
  asset: string;
  amount_minor_units: number;
  binding_digest: string;
}

export interface StageJ0SettlementFundingFact {
  schema_version: 'inkubator.settlement-funding-fact/1.0';
  value_mode: 'TEST_ONLY';
  binding_digest: string;
  challenge_id: string;
  terms_digest: string;
  asset: string;
  amount_minor_units: number;
  status: 'CONFIRMED_TEST';
  funding_ref: string;
}

export interface StageJ0SettlementManifest {
  schema_version: 'inkubator.settlement-manifest/1.0';
  value_mode: 'TEST_ONLY';
  challenge_id: string;
  terms_digest: string;
  settlement_policy_version: string;
  adapter_kind: StageJ0SettlementAdapterKind;
  binding_digest: string;
  intent_digest: string;
  intent_type: SettlementIntent['type'];
  asset: string;
  total_minor_units: number;
  recipients: SettlementIntent['recipients'];
  winner_entry_id: string | null;
  required_authorities: SettlementAuthority[];
  delivery_mode: 'CLAIMABLE';
  manifest_digest: string;
}

export interface StageJ0SettlementAuthorizationFact {
  schema_version: 'inkubator.settlement-authorization/1.0';
  value_mode: 'TEST_ONLY';
  manifest_digest: string;
  authority: SettlementAuthority;
  actor_id: string;
  verification_ref: string;
}

export interface StageJ0SettlementExecutionEnvelope {
  schema_version: 'inkubator.settlement-execution-envelope/1.0';
  value_mode: 'TEST_ONLY';
  manifest_digest: string;
  binding_digest: string;
  adapter_kind: StageJ0SettlementAdapterKind;
  challenge_id: string;
  terms_digest: string;
  asset: string;
  total_minor_units: number;
  recipients: SettlementIntent['recipients'];
  delivery_mode: 'CLAIMABLE';
  execution_digest: string;
}

export const SETTLEMENT_ADAPTER_BINDING_SCHEMA_VERSION: string;
export const SETTLEMENT_FUNDING_FACT_SCHEMA_VERSION: string;
export const SETTLEMENT_MANIFEST_SCHEMA_VERSION: string;
export const SETTLEMENT_AUTHORIZATION_SCHEMA_VERSION: string;
export const SETTLEMENT_EXECUTION_ENVELOPE_SCHEMA_VERSION: string;
export const STAGE_J0_ADAPTER_KINDS: readonly StageJ0SettlementAdapterKind[];
export const SETTLEMENT_AUTHORITIES: readonly SettlementAuthority[];
export const SETTLEMENT_ADAPTER_STATES: readonly SettlementAdapterState[];

export function bindStageJ0SettlementAdapter(args: {
  contract: BuildContract;
  adapter_kind: StageJ0SettlementAdapterKind;
  adapter_ref: string;
  network_id?: string | null;
}): Readonly<StageJ0SettlementAdapterBinding>;

export function assertStageJ0SettlementAdapterBinding(binding: unknown): StageJ0SettlementAdapterBinding;
export function assertStageJ0SettlementAdapterBindingMatchesContract(contract: BuildContract, binding: StageJ0SettlementAdapterBinding): StageJ0SettlementAdapterBinding;
export function assertStageJ0FundingFactMatchesBinding(contract: BuildContract, binding: StageJ0SettlementAdapterBinding, fact: StageJ0SettlementFundingFact): StageJ0SettlementFundingFact;
export function buildStageJ0SettlementManifest(args: {contract: BuildContract; settlementIntent: SettlementIntent; binding: StageJ0SettlementAdapterBinding}): Readonly<StageJ0SettlementManifest>;
export function assertStageJ0SettlementManifest(manifest: unknown): StageJ0SettlementManifest;
export function assertStageJ0SettlementManifestMatchesIntent(contract: BuildContract, settlementIntent: SettlementIntent, binding: StageJ0SettlementAdapterBinding, manifest: StageJ0SettlementManifest): StageJ0SettlementManifest;
export function assertRecordedStageJ0AuthorizationSet(manifest: StageJ0SettlementManifest, authorizationFacts: StageJ0SettlementAuthorizationFact[]): StageJ0SettlementAuthorizationFact[];
export function buildStageJ0ExecutionEnvelope(args: {contract: BuildContract; settlementIntent: SettlementIntent; binding: StageJ0SettlementAdapterBinding; manifest: StageJ0SettlementManifest; authorizationFacts: StageJ0SettlementAuthorizationFact[]}): Readonly<StageJ0SettlementExecutionEnvelope>;
export function assertStageJ0ExecutionEnvelopeMatchesManifest(manifest: StageJ0SettlementManifest, envelope: StageJ0SettlementExecutionEnvelope): StageJ0SettlementExecutionEnvelope;
export function canTransitionSettlementAdapterState(from: SettlementAdapterState, to: SettlementAdapterState): boolean;
export function transitionSettlementAdapterState(from: SettlementAdapterState, to: SettlementAdapterState): SettlementAdapterState;
