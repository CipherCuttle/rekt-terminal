import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createOpenAICompatibleInterpreter,
  estimateRunCostUsd,
  scoreCompilerInterpretation,
} from '../../src/compiler-provider.mjs';
import {responseFormatForMode} from './interpretation-response-format.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const readText = (name) => fs.readFileSync(path.resolve(here, name), 'utf8');
const fail = (ok, message) => { if (!ok) throw new Error(message); };
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const mode = process.env.BENCHMARK_MODE ?? 'full';
const providersFile = process.env.BENCHMARK_PROVIDERS ?? 'providers.example.json';
const paidExecutionAuthorized = process.env.BENCHMARK_AUTHORIZE_PAID === 'YES';
fail(['smoke', 'full'].includes(mode), `unsupported BENCHMARK_MODE ${mode}`);
fail(/^[A-Za-z0-9._-]+\.json$/.test(providersFile), 'BENCHMARK_PROVIDERS must be a JSON filename in compiler/benchmark');

const tasksText = readText('tasks.v1.json');
const providersText = readText(providersFile);
const tasksDocument = JSON.parse(tasksText);
const providersDocument = JSON.parse(providersText);
const runPolicy = providersDocument.run_policy ?? {};
const guardedPaidRun = !runPolicy.free_only && runPolicy.requires_runtime_authorization === true;
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
function providerPrices(provider) {
  const input = Number(provider.input_usd_per_million ?? 0);
  const output = Number(provider.output_usd_per_million ?? 0);
  fail(Number.isFinite(input) && input >= 0, `${provider.name} input price must be non-negative`);
  fail(Number.isFinite(output) && output >= 0, `${provider.name} output price must be non-negative`);
  return {input, output};
}
function validateFreeOnlyProvider(provider) {
  const {input, output} = providerPrices(provider);
  fail(provider.model.endsWith(':free'), `FREE_ONLY_CONFIG: ${provider.name} model must use :free`);
  fail(input === 0 && output === 0, `FREE_ONLY_CONFIG: ${provider.name} static prices must be zero`);
  const routing = provider.provider_preferences;
  fail(routing && routing.allow_fallbacks === false, `FREE_ONLY_CONFIG: ${provider.name} must disable provider fallbacks`);
  fail(routing.require_parameters === true, `FREE_ONLY_CONFIG: ${provider.name} must require requested parameters`);
  fail(Number(routing?.max_price?.prompt) === 0 && Number(routing?.max_price?.completion) === 0, `FREE_ONLY_CONFIG: ${provider.name} must enforce max_price=0`);
}
function validatePaidProvider(provider) {
  const {input, output} = providerPrices(provider);
  fail(!provider.model.endsWith(':free'), `PAID_CONFIG: ${provider.name} must use a stable non-free model id`);
  fail(input > 0 || output > 0, `PAID_CONFIG: ${provider.name} must declare non-zero observed prices`);
  const routing = provider.provider_preferences;
  fail(routing && routing.allow_fallbacks === false, `PAID_CONFIG: ${provider.name} must disable provider fallbacks`);
  fail(routing.require_parameters === true, `PAID_CONFIG: ${provider.name} must require requested parameters`);
  fail(Array.isArray(routing.only) && routing.only.length === 1, `PAID_CONFIG: ${provider.name} must pin exactly one provider slug`);
  fail(Number(routing?.max_price?.prompt) <= input, `PAID_CONFIG: ${provider.name} prompt max_price exceeds observed price`);
  fail(Number(routing?.max_price?.completion) <= output, `PAID_CONFIG: ${provider.name} completion max_price exceeds observed price`);
  responseFormatForMode(provider.response_format_mode);
}
function assertRoutingRun(run, provider) {
  if (runPolicy.free_only || provider.enforce_response_model === true) {
    fail(run.response_model === provider.model, `HARD_ABORT: ${provider.name} returned unexpected model ${run.response_model ?? 'MISSING'} instead of ${provider.model}`);
  }
  if (provider.expected_routing_provider_name) {
    fail(run.routing_metadata?.provider_name === provider.expected_routing_provider_name, `HARD_ABORT: ${provider.name} routed through ${run.routing_metadata?.provider_name ?? 'UNKNOWN'} instead of ${provider.expected_routing_provider_name}`);
  }
  if (runPolicy.free_only) fail(run.reported_cost_usd === null || run.reported_cost_usd === 0, `HARD_ABORT: ${provider.name} reported non-zero cost ${run.reported_cost_usd}`);
  if (!runPolicy.free_only && provider.require_reported_cost === true) fail(Number.isFinite(run.reported_cost_usd), `HARD_ABORT: ${provider.name} did not return a finite reported cost`);
}

fail(Array.isArray(tasksDocument.tasks) && tasksDocument.tasks.length > 0, 'benchmark corpus must contain tasks');
fail(Array.isArray(providersDocument.providers) && providersDocument.providers.length >= 2, 'benchmark config must contain at least two providers');
if (runPolicy.free_only) {
  fail(Number(runPolicy.max_total_usd) === 0, 'FREE_ONLY_CONFIG: max_total_usd must be zero');
  for (const provider of providersDocument.providers) validateFreeOnlyProvider(provider);
} else if (guardedPaidRun) {
  fail(Number.isFinite(Number(runPolicy.max_total_usd)) && Number(runPolicy.max_total_usd) > 0, 'PAID_CONFIG: max_total_usd must be positive');
  fail(Number.isInteger(Number(runPolicy.max_input_bytes_per_request)) && Number(runPolicy.max_input_bytes_per_request) > 0, 'PAID_CONFIG: max_input_bytes_per_request must be a positive integer');
  fail(Number.isInteger(Number(runPolicy.billing_token_overhead_per_request)) && Number(runPolicy.billing_token_overhead_per_request) >= 0, 'PAID_CONFIG: billing_token_overhead_per_request must be a non-negative integer');
  fail(paidExecutionAuthorized, 'PAID_EXECUTION_NOT_AUTHORIZED: set BENCHMARK_AUTHORIZE_PAID=YES only after explicit spend authorization');
  for (const provider of providersDocument.providers) validatePaidProvider(provider);
}

let selectedTasks = tasksDocument.tasks;
if (mode === 'smoke') {
  const smokeIds = new Set(runPolicy.smoke_task_ids ?? []);
  fail(smokeIds.size > 0, 'smoke mode requires run_policy.smoke_task_ids');
  selectedTasks = tasksDocument.tasks.filter((task) => smokeIds.has(task.id));
  fail(selectedTasks.length === smokeIds.size, 'smoke task id missing from benchmark corpus');
}

const maxTokensPerResponse = Number(runPolicy.max_tokens_per_response ?? 650);
fail(Number.isInteger(maxTokensPerResponse) && maxTokensPerResponse > 0, 'max_tokens_per_response must be a positive integer');
const maxInputBytesPerRequest = guardedPaidRun ? Number(runPolicy.max_input_bytes_per_request) : null;
const billingTokenOverhead = guardedPaidRun ? Number(runPolicy.billing_token_overhead_per_request) : 0;
const maxTotalUsd = guardedPaidRun || runPolicy.free_only ? Number(runPolicy.max_total_usd ?? 0) : null;
let preflightWorstCaseCostUsd = 0;
if (guardedPaidRun) {
  const conservativeInputTokens = maxInputBytesPerRequest + billingTokenOverhead;
  for (const provider of providersDocument.providers) {
    const {input, output} = providerPrices(provider);
    preflightWorstCaseCostUsd += selectedTasks.length * ((conservativeInputTokens * input) + (maxTokensPerResponse * output)) / 1_000_000;
  }
  fail(preflightWorstCaseCostUsd <= maxTotalUsd, `PAID_CONFIG: worst-case cost ${preflightWorstCaseCostUsd.toFixed(6)} exceeds max_total_usd ${maxTotalUsd}`);
}

const results = {
  schema_version: 'inkubator.compiler-provider-benchmark-result/1.0',
  generated_at: new Date().toISOString(),
  mode,
  gateway: providersDocument.gateway ?? 'direct',
  free_only: Boolean(runPolicy.free_only),
  guarded_paid_run: guardedPaidRun,
  paid_execution_authorized: guardedPaidRun && paidExecutionAuthorized,
  spend_ceiling_usd: maxTotalUsd,
  preflight_worst_case_cost_usd: guardedPaidRun ? preflightWorstCaseCostUsd : null,
  corpus_schema_version: tasksDocument.schema_version,
  corpus_sha256: sha256(tasksText),
  selected_task_ids: selectedTasks.map((task) => task.id),
  provider_config_schema_version: providersDocument.schema_version,
  provider_config_sha256: sha256(providersText),
  provider_config_file: providersFile,
  pricing_observed_at: providersDocument.pricing_observed_at,
  providers: [],
};
let cumulativeEstimatedCost = 0;
let cumulativeReportedCost = 0;
let hasReportedCost = false;

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
    maxTokens: maxTokensPerResponse,
    maxInputBytes: maxInputBytesPerRequest,
    responseFormat: responseFormatForMode(provider.response_format_mode),
    providerPreferences: provider.provider_preferences ?? null,
    reasoningConfig: provider.reasoning ?? null,
    extraHeaders: isOpenRouter ? {'X-OpenRouter-Metadata': 'enabled', 'X-Title': 'REKT Inkubator D-GATE-5 benchmark'} : {},
  });
  const taskResults = [];

  for (const task of selectedTasks) {
    try {
      const run = await interpretIntent(task.input);
      assertRoutingRun(run, provider);
      const score = scoreCompilerInterpretation({task, run, blueprints});
      const estimatedCost = estimateRunCostUsd(run, provider);
      fail(!runPolicy.free_only || estimatedCost === 0, `HARD_ABORT: ${provider.name} estimated non-zero free-only cost ${estimatedCost}`);
      cumulativeEstimatedCost += estimatedCost;
      if (Number.isFinite(run.reported_cost_usd)) {
        hasReportedCost = true;
        cumulativeReportedCost += run.reported_cost_usd;
      }
      if (guardedPaidRun) {
        fail(cumulativeEstimatedCost <= maxTotalUsd, `HARD_ABORT: cumulative estimated cost ${cumulativeEstimatedCost} exceeded ${maxTotalUsd}`);
        fail(!hasReportedCost || cumulativeReportedCost <= maxTotalUsd, `HARD_ABORT: cumulative reported cost ${cumulativeReportedCost} exceeded ${maxTotalUsd}`);
      }
      taskResults.push({
        task_id: task.id,
        status: 'COMPLETED',
        request_input_bytes: run.request_input_bytes,
        latency_ms: run.latency_ms,
        prompt_tokens: run.prompt_tokens,
        completion_tokens: run.completion_tokens,
        requested_model: run.requested_model,
        response_model: run.response_model,
        service_tier: run.service_tier,
        routing_metadata: run.routing_metadata,
        reported_cost_usd: run.reported_cost_usd,
        estimated_cost_usd: estimatedCost,
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
  fail(!runPolicy.free_only || totalEstimatedCost === 0, `HARD_ABORT: ${provider.name} free-only estimate exceeded zero`);
  fail(!runPolicy.free_only || totalReportedCost === null || totalReportedCost === 0, `HARD_ABORT: ${provider.name} free-only reported cost exceeded zero`);
  results.providers.push({
    name: provider.name,
    model: provider.model,
    status: completeRun ? 'COMPLETED' : 'PARTIAL',
    pricing_note: provider.pricing_note,
    response_format_mode: provider.response_format_mode ?? 'json_object',
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

results.total_estimated_cost_usd = cumulativeEstimatedCost;
results.total_reported_cost_usd = hasReportedCost ? cumulativeReportedCost : null;
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
