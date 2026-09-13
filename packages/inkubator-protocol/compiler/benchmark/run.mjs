import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildCompilerInterpretationPrompt,
  buildCompilerInterpretationResponseFormat,
  COMPILER_INTERPRETATION_SYSTEM_PROMPT,
  createOpenAICompatibleInterpreter,
  estimateRunCostUsd,
  scoreCompilerInterpretation,
} from '../../src/compiler-provider.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const readText = (name) => fs.readFileSync(path.resolve(here, name), 'utf8');
const fail = (ok, message) => { if (!ok) throw new Error(message); };
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const mode = process.env.BENCHMARK_MODE ?? 'full';
const providersFile = process.env.BENCHMARK_PROVIDERS ?? 'providers.example.json';
fail(['smoke', 'full'].includes(mode), `unsupported BENCHMARK_MODE ${mode}`);
fail(/^[A-Za-z0-9._-]+\.json$/.test(providersFile), 'BENCHMARK_PROVIDERS must be a JSON filename in compiler/benchmark');

const tasksText = readText('tasks.v1.json');
const providersText = readText(providersFile);
const tasksDocument = JSON.parse(tasksText);
const providersDocument = JSON.parse(providersText);
const runPolicy = providersDocument.run_policy ?? {};
const blueprintDir = path.resolve(here, '../blueprints');
const blueprints = fs.readdirSync(blueprintDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(fs.readFileSync(path.join(blueprintDir, name), 'utf8')));

function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function taskPassed(score) {
  return score.schema_valid
    && score.requirement_score === 1
    && score.question_score === 1
    && score.explanation_score === 1
    && score.status_correct
    && score.blueprint_correct
    && score.injection_resistant
    && score.provider_authority_safe
    && score.source_intent_exact;
}
function routingCeilings(provider) {
  const maxPrice = provider.provider_preferences?.max_price;
  const prompt = Number(maxPrice?.prompt);
  const completion = Number(maxPrice?.completion);
  fail(Number.isFinite(prompt) && prompt >= 0, `BUDGET_CONFIG: ${provider.name} requires provider max_price.prompt`);
  fail(Number.isFinite(completion) && completion >= 0, `BUDGET_CONFIG: ${provider.name} requires provider max_price.completion`);
  return {prompt, completion};
}
function requestInputTokenUpperBound(sourceIntent, provider) {
  // A token cannot encode fewer than one UTF-8 byte. Count prompt plus strict response schema when used,
  // then add generous chat-framing headroom. This intentionally over-reserves the paid smoke budget.
  let contentBytes = Buffer.byteLength(COMPILER_INTERPRETATION_SYSTEM_PROMPT, 'utf8')
    + Buffer.byteLength(buildCompilerInterpretationPrompt(sourceIntent), 'utf8');
  if ((provider.structured_output ?? 'json_object') === 'json_schema') {
    contentBytes += Buffer.byteLength(JSON.stringify(buildCompilerInterpretationResponseFormat(sourceIntent)), 'utf8');
  }
  return contentBytes + 1024;
}
function reservedCallCostUsd(task, provider, maxTokens) {
  const ceilings = routingCeilings(provider);
  return ((requestInputTokenUpperBound(task.input, provider) * ceilings.prompt) + (maxTokens * ceilings.completion)) / 1_000_000;
}
function estimateAtRoutingCeiling(run, provider) {
  const ceilings = routingCeilings(provider);
  return ((Number(run.prompt_tokens ?? 0) * ceilings.prompt) + (Number(run.completion_tokens ?? 0) * ceilings.completion)) / 1_000_000;
}
function validateProvider(provider) {
  fail(typeof provider.name === 'string' && provider.name.length > 0, 'provider name is required');
  fail(typeof provider.model === 'string' && provider.model.length > 0, `${provider.name} model is required`);
  fail(typeof provider.api_key_env === 'string' && provider.api_key_env.length > 0, `${provider.name} api_key_env is required`);
  fail(Number.isFinite(Number(provider.input_usd_per_million)) && Number(provider.input_usd_per_million) >= 0, `${provider.name} input price must be non-negative`);
  fail(Number.isFinite(Number(provider.output_usd_per_million)) && Number(provider.output_usd_per_million) >= 0, `${provider.name} output price must be non-negative`);
  fail(provider.provider_preferences?.require_parameters === true, `BUDGET_CONFIG: ${provider.name} must require requested parameters`);
  fail(['json_object', 'json_schema'].includes(provider.structured_output ?? 'json_object'), `${provider.name} structured_output invalid`);
  const timeoutMs = Number(provider.timeout_ms ?? 30000);
  fail(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000, `${provider.name} timeout_ms must be in (0,120000]`);
  const ceilings = routingCeilings(provider);
  fail(Number(provider.input_usd_per_million) <= ceilings.prompt, `BUDGET_CONFIG: ${provider.name} input list price exceeds routing ceiling`);
  fail(Number(provider.output_usd_per_million) <= ceilings.completion, `BUDGET_CONFIG: ${provider.name} output list price exceeds routing ceiling`);
}
function assertRoutedRun(run, provider) {
  if (providersDocument.gateway !== 'openrouter') return;
  fail(run.response_model === provider.model, `HARD_ABORT: ${provider.name} returned unexpected model ${run.response_model ?? 'MISSING'} instead of ${provider.model}`);
}

fail(Array.isArray(tasksDocument.tasks) && tasksDocument.tasks.length > 0, 'benchmark corpus must contain tasks');
fail(Array.isArray(providersDocument.providers) && providersDocument.providers.length >= 2, 'benchmark config must contain at least two providers');
for (const provider of providersDocument.providers) validateProvider(provider);

let selectedTasks = tasksDocument.tasks;
if (mode === 'smoke') {
  const smokeIds = new Set(runPolicy.smoke_task_ids ?? []);
  fail(smokeIds.size > 0, 'smoke mode requires run_policy.smoke_task_ids');
  selectedTasks = tasksDocument.tasks.filter((task) => smokeIds.has(task.id));
  fail(selectedTasks.length === smokeIds.size, 'smoke task id missing from benchmark corpus');
}
const maxTokens = Number(runPolicy.max_tokens_per_response ?? 650);
fail(Number.isInteger(maxTokens) && maxTokens > 0, 'max_tokens_per_response must be a positive integer');
const maxTotalUsd = Number(runPolicy.max_total_usd);
fail(Number.isFinite(maxTotalUsd) && maxTotalUsd >= 0, 'run_policy.max_total_usd must be a non-negative finite number');

let preflightReservedMaxCostUsd = 0;
for (const provider of providersDocument.providers) {
  for (const task of selectedTasks) preflightReservedMaxCostUsd += reservedCallCostUsd(task, provider, maxTokens);
}
fail(preflightReservedMaxCostUsd <= maxTotalUsd, `BUDGET_CONFIG: reserved worst-case ${preflightReservedMaxCostUsd} exceeds max_total_usd ${maxTotalUsd}`);

const results = {
  schema_version: 'inkubator.compiler-provider-benchmark-result/1.0',
  generated_at: new Date().toISOString(),
  mode,
  gateway: providersDocument.gateway ?? 'direct',
  free_only: Boolean(runPolicy.free_only),
  max_total_usd: maxTotalUsd,
  preflight_reserved_max_cost_usd: preflightReservedMaxCostUsd,
  corpus_schema_version: tasksDocument.schema_version,
  corpus_sha256: sha256(tasksText),
  selected_task_ids: selectedTasks.map((task) => task.id),
  provider_config_schema_version: providersDocument.schema_version,
  provider_config_sha256: sha256(providersText),
  provider_config_file: providersFile,
  pricing_observed_at: providersDocument.pricing_observed_at,
  providers: [],
};

let cumulativeBudgetChargeUsd = 0;
for (const provider of providersDocument.providers) {
  const apiKey = process.env[provider.api_key_env];
  if (!apiKey) {
    results.providers.push({
      name: provider.name,
      model: provider.model,
      status: 'SKIPPED_MISSING_KEY',
      api_key_env: provider.api_key_env,
      task_results: [],
    });
    continue;
  }

  const isOpenRouter = providersDocument.gateway === 'openrouter';
  const interpretIntent = createOpenAICompatibleInterpreter({
    name: provider.name,
    baseUrl: provider.base_url,
    model: provider.model,
    apiKey,
    timeoutMs: Number(provider.timeout_ms ?? 30000),
    maxTokens,
    providerPreferences: provider.provider_preferences ?? null,
    reasoningConfig: provider.reasoning ?? null,
    structuredOutput: provider.structured_output ?? 'json_object',
    extraHeaders: isOpenRouter ? {'X-OpenRouter-Metadata': 'enabled', 'X-Title': 'REKT Inkubator D-GATE-5 paid smoke'} : {},
  });
  const taskResults = [];

  for (const task of selectedTasks) {
    try {
      const run = await interpretIntent(task.input);
      assertRoutedRun(run, provider);
      const score = scoreCompilerInterpretation({task, run, blueprints});
      const estimatedCost = estimateRunCostUsd(run, provider);
      const routingCeilingCost = estimateAtRoutingCeiling(run, provider);
      const reportedCost = run.reported_cost_usd;
      const budgetCharge = Math.max(routingCeilingCost, Number.isFinite(reportedCost) ? reportedCost : 0);
      cumulativeBudgetChargeUsd += budgetCharge;
      fail(cumulativeBudgetChargeUsd <= maxTotalUsd, `HARD_ABORT: cumulative bounded spend ${cumulativeBudgetChargeUsd} exceeded ${maxTotalUsd}`);
      taskResults.push({
        task_id: task.id,
        status: 'COMPLETED',
        latency_ms: run.latency_ms,
        prompt_tokens: run.prompt_tokens,
        completion_tokens: run.completion_tokens,
        requested_model: run.requested_model,
        response_model: run.response_model,
        service_tier: run.service_tier,
        routing_metadata: run.routing_metadata,
        reported_cost_usd: reportedCost,
        estimated_cost_usd: estimatedCost,
        routing_ceiling_cost_usd: routingCeilingCost,
        score,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('HARD_ABORT:')) throw error;
      taskResults.push({task_id: task.id, status: 'FAILED', error: message});
    }
  }

  const completed = taskResults.filter((item) => item.status === 'COMPLETED');
  const passed = completed.filter((item) => taskPassed(item.score));
  const completeRun = completed.length === selectedTasks.length;
  const totalEstimatedCost = completed.reduce((sum, item) => sum + item.estimated_cost_usd, 0);
  const reportedCosts = completed.map((item) => item.reported_cost_usd).filter((value) => Number.isFinite(value));
  const totalReportedCost = reportedCosts.length ? reportedCosts.reduce((sum, value) => sum + value, 0) : null;
  results.providers.push({
    name: provider.name,
    model: provider.model,
    status: completeRun ? 'COMPLETED' : 'PARTIAL',
    pricing_note: provider.pricing_note,
    task_count: selectedTasks.length,
    completed_tasks: completed.length,
    passed_tasks: passed.length,
    pass_rate: selectedTasks.length ? passed.length / selectedTasks.length : 0,
    mean_requirement_score: mean(completed.map((item) => item.score.requirement_score)),
    mean_question_score: mean(completed.map((item) => item.score.question_score)),
    mean_explanation_score: mean(completed.map((item) => item.score.explanation_score)),
    mean_latency_ms: mean(completed.map((item) => item.latency_ms)),
    total_estimated_cost_usd: totalEstimatedCost,
    total_reported_cost_usd: totalReportedCost,
    task_results: taskResults,
  });
}

results.cumulative_bounded_spend_usd = cumulativeBudgetChargeUsd;
const measured = results.providers.filter((provider) => provider.status === 'COMPLETED');
results.d_gate_5_evidence_ready = mode === 'full' && measured.length >= 2;
results.notes = mode === 'smoke'
  ? 'Smoke mode is preflight only and can never close D-GATE-5.'
  : results.d_gate_5_evidence_ready
    ? 'At least two providers completed every task on the same corpus digest. Human/provider selection remains a separate decision.'
    : 'D-GATE-5 remains open until at least two providers complete every task on this corpus digest.';

const rendered = `${JSON.stringify(results, null, 2)}\n`;
const outputPath = process.argv[2];
if (outputPath) fs.writeFileSync(path.resolve(process.cwd(), outputPath), rendered, 'utf8');
process.stdout.write(rendered);
