import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
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
function validateFreeOnlyProvider(provider) {
  fail(provider.model.endsWith(':free'), `FREE_ONLY_CONFIG: ${provider.name} model must use :free`);
  fail(Number(provider.input_usd_per_million) === 0 && Number(provider.output_usd_per_million) === 0, `FREE_ONLY_CONFIG: ${provider.name} static prices must be zero`);
  const routing = provider.provider_preferences;
  fail(routing && routing.allow_fallbacks === false, `FREE_ONLY_CONFIG: ${provider.name} must disable provider fallbacks`);
  fail(routing.require_parameters === true, `FREE_ONLY_CONFIG: ${provider.name} must require requested parameters`);
  fail(Number(routing?.max_price?.prompt) === 0 && Number(routing?.max_price?.completion) === 0, `FREE_ONLY_CONFIG: ${provider.name} must enforce max_price=0`);
}
function assertFreeOnlyRun(run, provider) {
  if (!runPolicy.free_only) return;
  fail(run.response_model === provider.model, `HARD_ABORT: ${provider.name} returned unexpected model ${run.response_model ?? 'MISSING'} instead of ${provider.model}`);
  fail(run.reported_cost_usd === null || run.reported_cost_usd === 0, `HARD_ABORT: ${provider.name} reported non-zero cost ${run.reported_cost_usd}`);
}

fail(Array.isArray(tasksDocument.tasks) && tasksDocument.tasks.length > 0, 'benchmark corpus must contain tasks');
fail(Array.isArray(providersDocument.providers) && providersDocument.providers.length >= 2, 'benchmark config must contain at least two providers');
if (runPolicy.free_only) {
  fail(Number(runPolicy.max_total_usd) === 0, 'FREE_ONLY_CONFIG: max_total_usd must be zero');
  for (const provider of providersDocument.providers) validateFreeOnlyProvider(provider);
}

let selectedTasks = tasksDocument.tasks;
if (mode === 'smoke') {
  const smokeIds = new Set(runPolicy.smoke_task_ids ?? []);
  fail(smokeIds.size > 0, 'smoke mode requires run_policy.smoke_task_ids');
  selectedTasks = tasksDocument.tasks.filter((task) => smokeIds.has(task.id));
  fail(selectedTasks.length === smokeIds.size, 'smoke task id missing from benchmark corpus');
}

const results = {
  schema_version: 'inkubator.compiler-provider-benchmark-result/1.0',
  generated_at: new Date().toISOString(),
  mode,
  gateway: providersDocument.gateway ?? 'direct',
  free_only: Boolean(runPolicy.free_only),
  corpus_schema_version: tasksDocument.schema_version,
  corpus_sha256: sha256(tasksText),
  selected_task_ids: selectedTasks.map((task) => task.id),
  provider_config_schema_version: providersDocument.schema_version,
  provider_config_sha256: sha256(providersText),
  provider_config_file: providersFile,
  pricing_observed_at: providersDocument.pricing_observed_at,
  providers: [],
};

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
    maxTokens: Number(runPolicy.max_tokens_per_response ?? 650),
    providerPreferences: provider.provider_preferences ?? null,
    extraHeaders: isOpenRouter ? {'X-OpenRouter-Metadata': 'enabled', 'X-Title': 'REKT Inkubator D-GATE-5 benchmark'} : {},
  });
  const taskResults = [];

  for (const task of selectedTasks) {
    try {
      const run = await interpretIntent(task.input);
      assertFreeOnlyRun(run, provider);
      const score = scoreCompilerInterpretation({task, run, blueprints});
      const estimatedCost = estimateRunCostUsd(run, provider);
      fail(!runPolicy.free_only || estimatedCost === 0, `HARD_ABORT: ${provider.name} estimated non-zero free-only cost ${estimatedCost}`);
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
