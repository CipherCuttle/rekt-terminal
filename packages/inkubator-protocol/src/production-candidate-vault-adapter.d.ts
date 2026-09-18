export declare const STAGE_J4_NETWORK: Readonly<{
  network_id: 'ink-mainnet:57073';
  network_name: 'Ink';
  chain_id: 57073;
  explorer_url: 'https://explorer.inkonchain.com';
}>;

export declare const STAGE_J4_NATIVE_USDC: Readonly<{
  symbol: 'USDC';
  address: '0x2d270e6886d130d724215a266106e6832161eaed';
  decimals: 6;
  issuer: 'Circle';
}>;

export declare const STAGE_J4_FINALITY_PROVIDERS: readonly ['gelato', 'quicknode'];

export declare const STAGE_J4_EXCLUDED_USDC_E: Readonly<{
  symbol: 'USDC.e';
  address: '0xf1815bd50389c46847f0bda824ec8da914045d14';
  status: 'EXCLUDED_FROM_FIRST_CANDIDATE';
}>;

export declare const STAGE_J4_TOOLCHAIN: Readonly<{
  foundry: '1.8.3';
  solc: '0.8.37';
  evm: 'prague';
  optimizer: true;
  optimizer_runs: 200;
  bytecode_metadata_hash: 'none';
  ffi: false;
}>;

export declare function stageJ4DeadlineSeconds(deadlineMs: number): number;
export declare function buildStageJ4DeploymentPlan(input: Record<string, unknown>): Readonly<Record<string, unknown>>;
export declare function evaluateStageJ4Finality(observations: unknown): Readonly<Record<string, unknown>>;
export declare function buildStageJ4ReleaseCandidateReceipt(input: Record<string, unknown>): Readonly<Record<string, unknown>>;

export declare function appendStageJ4ReconciliationReceipt(history: readonly Readonly<Record<string, unknown>>[], input: Record<string, unknown>): readonly Readonly<Record<string, unknown>>[];
