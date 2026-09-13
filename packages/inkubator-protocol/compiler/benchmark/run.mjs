import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createOpenAICompatibleInterpreter,
  estimateRunCostUsd,
  scoreCompilerInterpretation,
} from '../../src/compiler-provider.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (name) => JSON.parse(fs.readFileSync(path.resolve(here, name), 'utf8'));
const tasksDocument = readJson('tasks.v1.json');
const providersDocument = readJson('providers.example.json');
const blueprintDir = path.resolve(here, '../blueprints');
const blueprints = fs.readdirSync(blueprintDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(fs.readFileSync(path.join(blueprintDir, name), 'utf8')));

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function taskPassed(score) {
  return score.schema_valid
    && score.requirement_score === 1
    && score.question_score === 1
    && score.status_correct
    && score.blueprint_correct
    && score.injection_resistant;
}

const results = {
  schema_version: 'inkubator.compiler-provider-benchmark-result/1.0',
  generated_at: new Date().toISOString(),
  corpus_schema_version: tasksDocument.schema_version,
  provider_config_schema_version: providersDocument.schema_version,
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

  const interpretIntent = createOpenAICompatibleInterpreter({
    name: provider.name,
    baseUrl: provider.base_url,
    model: provider.model,
    apiKey,
  });
  const taskResults = [];

  for (const task of tasksDocument.tasks) {
    try {
      const run = await interpretIntent(task.input);
      const score = scoreCompilerInterpretation({task, run, blueprints});
      taskResults.push({
        task_id: task.id,
        status: 'COMPLETED',
        latency_ms: run.latency_ms,
        prompt_tokens: run.prompt_tokens,
        completion_tokens: run.completion_tokens,
        estimated_cost_usd: estimateRunCostUsd(run, provider),
        score,
      });
    } catch (error) {
      taskResults.push({
        task_id: task.id,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const completed = taskResults.filter((item) => item.status === 'COMPLETED');
  const passed = completed.filter((item) => taskPassed(item.score));
  results.providers.push({
    name: provider.name,
    model: provider.model,
    status: 'COMPLETED',
    pricing_note: provider.pricing_note,
    task_count: tasksDocument.tasks.length,
    completed_tasks: completed.length,
    passed_tasks: passed.length,
    pass_rate: tasksDocument.tasks.length ? passed.length / tasksDocument.tasks.length : 0,
    mean_requirement_score: mean(completed.map((item) => item.score.requirement_score)),
    mean_question_score: mean(completed.map((item) => item.score.question_score)),
    mean_explanation_score: mean(completed.map((item) => item.score.explanation_score)),
    mean_latency_ms: mean(completed.map((item) => item.latency_ms)),
    total_estimated_cost_usd: completed.reduce((sum, item) => sum + item.estimated_cost_usd, 0),
    task_results: taskResults,
  });
}

const measured = results.providers.filter((provider) => provider.status === 'COMPLETED');
results.d_gate_5_evidence_ready = measured.length >= 2;
results.notes = results.d_gate_5_evidence_ready
  ? 'At least two providers produced result sets on the same corpus. Human/provider selection remains a separate decision.'
  : 'D-GATE-5 remains open until at least two providers produce non-skipped result sets on this corpus revision.';

const rendered = `${JSON.stringify(results, null, 2)}\n`;
const outputPath = process.argv[2];
if (outputPath) {
  fs.writeFileSync(path.resolve(process.cwd(), outputPath), rendered, 'utf8');
}
process.stdout.write(rendered);
