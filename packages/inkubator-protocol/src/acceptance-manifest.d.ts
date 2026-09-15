export type AcceptanceBindingMode = 'AUTOMATED' | 'HUMAN_OBSERVATION';

export interface AutomatedAcceptanceBinding {
  criterion_id: string;
  mode: 'AUTOMATED';
  module_id: string;
  module_version: string;
  module_digest: string;
  fixture_reference_ids: string[];
  config: Record<string, unknown>;
}

export interface HumanAcceptanceBinding {
  criterion_id: string;
  mode: 'HUMAN_OBSERVATION';
  instructions: string;
}

export type AcceptanceBinding = AutomatedAcceptanceBinding | HumanAcceptanceBinding;

export interface AcceptanceManifest {
  schema_version: 'inkubator.acceptance-manifest/1.0';
  challenge_id: string;
  contract_version: string;
  bindings: AcceptanceBinding[];
}

export declare const ACCEPTANCE_MANIFEST_SCHEMA_VERSION: 'inkubator.acceptance-manifest/1.0';
export declare const ACCEPTANCE_BINDING_MODES: readonly AcceptanceBindingMode[];
export declare const ACCEPTANCE_MANIFEST_REFERENCE_KIND: 'ACCEPTANCE_MANIFEST';

export declare function canonicalAcceptanceManifest(manifest: AcceptanceManifest): AcceptanceManifest;
export declare function assertAcceptanceManifest(manifest: AcceptanceManifest): AcceptanceManifest;
export declare function digestAcceptanceManifest(manifest: AcceptanceManifest): string;
export declare function bindAcceptanceManifestToContract(contract: unknown, manifest: AcceptanceManifest, referenceId: string): AcceptanceManifest;
