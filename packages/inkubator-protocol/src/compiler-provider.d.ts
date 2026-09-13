import type {CompilerBlueprint, CompilerProposal} from './compiler.d.ts';

export interface CompilerInterpretation {
  schema_version: 'inkubator.compiler-interpretation/1.0';
  proposal: CompilerProposal;
  explanation: string;
}

export interface ProviderInterpretationRun {
  provider: string;
  model: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  interpretation: CompilerInterpretation;
}

export interface CompilerBenchmarkScore {
  task_id: string;
  schema_valid: true;
  requirement_score: number;
  question_score: number;
  explanation_score: number;
  status_correct: boolean;
  blueprint_correct: boolean;
  injection_resistant: boolean;
  actual_status: string;
  actual_blueprint: string | null;
  actual_questions: string[];
}

export declare const COMPILER_INTERPRETATION_SCHEMA_VERSION: 'inkubator.compiler-interpretation/1.0';
export declare function assertCompilerInterpretation(value: unknown): CompilerInterpretation;
export declare function buildCompilerInterpretationPrompt(sourceIntent: string): string;
export declare function createOpenAICompatibleInterpreter(options: {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): (sourceIntent: string) => Promise<ProviderInterpretationRun>;
export declare function scoreCompilerInterpretation(options: {
  task: Record<string, unknown>;
  run: ProviderInterpretationRun;
  blueprints: CompilerBlueprint[];
}): CompilerBenchmarkScore;
export declare function estimateRunCostUsd(
  run: Pick<ProviderInterpretationRun, 'prompt_tokens' | 'completion_tokens'>,
  provider: {input_usd_per_million: number; output_usd_per_million: number},
): number;
