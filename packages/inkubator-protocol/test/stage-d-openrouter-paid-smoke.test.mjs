import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createOpenAICompatibleInterpreter} from '../src/compiler-provider.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, '..');
const configPath = path.resolve(packageDir, 'compiler/benchmark/providers.openrouter-paid-smoke.json');

const interpretation = (sourceIntent) => ({
  schema_version: 'inkubator.compiler-interpretation/1.0',
  proposal: {
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: sourceIntent,
    requirements: [
      {key: 'accounts', value: false, provenance: 'MODEL_PROPOSAL'},
      {key: 'persistence', value: false, provenance: 'MODEL_PROPOSAL'},
      {key: 'uploads_private', value: false, provenance: 'MODEL_PROPOSAL'},
      {key: 'realtime', value: false, provenance: 'MODEL_PROPOSAL'},
      {key: 'notifications', value: false, provenance: 'MODEL_PROPOSAL'},
      {key: 'onchain_read', value: false, provenance: 'MODEL_PROPOSAL'},
      {key: 'wallet_transactions', value: false, provenance: 'MODEL_PROPOSAL'},
      {key: 'custody_private_keys', value: false, provenance: 'MODEL_PROPOSAL'},
    ],
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  },
  explanation: 'Static page with no dynamic state.',
});

test('paid smoke config is fixed to four strict-schema calls with a two-cent worst-case ceiling', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.gateway, 'openrouter');
  assert.equal(config.run_policy.free_only, false);
  assert.equal(config.run_policy.max_total_usd, 0.02);
  assert.equal(config.run_policy.max_tokens_per_response, 1600);
  assert.deepEqual(config.run_policy.smoke_task_ids, ['STATIC_BASELINE', 'PRIVATE_KEY_CUSTODY_INJECTION']);
  assert.deepEqual(config.providers.map((provider) => provider.model), [
    'deepseek/deepseek-v4-flash-0731',
    'google/gemini-3.1-flash-lite',
  ]);
  for (const provider of config.providers) {
    assert.equal(provider.api_key_env, 'OPENROUTER_API_KEY');
    assert.equal(provider.structured_output, 'json_schema');
    assert.equal(provider.timeout_ms, 75000);
    assert.equal(provider.provider_preferences.require_parameters, true);
    assert.equal(provider.provider_preferences.allow_fallbacks, true);
    assert.ok(provider.provider_preferences.max_price.prompt >= provider.input_usd_per_million);
    assert.ok(provider.provider_preferences.max_price.completion >= provider.output_usd_per_million);
  }
});

test('paid smoke preflight reserves prompt plus strict schema before any key or network call', () => {
  const result = spawnSync(process.execPath, ['compiler/benchmark/run.mjs'], {
    cwd: packageDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENROUTER_API_KEY: '',
      BENCHMARK_MODE: 'smoke',
      BENCHMARK_PROVIDERS: 'providers.openrouter-paid-smoke.json',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.mode, 'smoke');
  assert.equal(receipt.max_total_usd, 0.02);
  assert.ok(receipt.preflight_reserved_max_cost_usd > 0.0087292, 'strict schema bytes should increase the conservative reservation');
  assert.ok(receipt.preflight_reserved_max_cost_usd <= receipt.max_total_usd);
  assert.equal(receipt.d_gate_5_evidence_ready, false);
  assert.ok(receipt.providers.every((provider) => provider.status === 'SKIPPED_MISSING_KEY'));
});

test('OpenRouter adapter sends strict schema, routing and reasoning controls and records exact model/cost receipt', async () => {
  const sourceIntent = 'Build a static page.';
  let request;
  const fetchImpl = async (url, options) => {
    request = {url, options};
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          model: 'google/gemini-3.1-flash-lite',
          service_tier: 'default',
          openrouter_metadata: {provider_name: 'Google AI Studio'},
          choices: [{message: {content: JSON.stringify(interpretation(sourceIntent))}}],
          usage: {prompt_tokens: 120, completion_tokens: 80, cost: 0.00015},
        };
      },
      async text() { return ''; },
    };
  };
  const routing = {allow_fallbacks: true, require_parameters: true, max_price: {prompt: 0.30, completion: 1.60}};
  const reasoning = {effort: 'minimal'};
  const interpretIntent = createOpenAICompatibleInterpreter({
    name: 'fixture',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3.1-flash-lite',
    apiKey: 'secret-fixture',
    fetchImpl,
    timeoutMs: 75000,
    maxTokens: 1600,
    providerPreferences: routing,
    reasoningConfig: reasoning,
    structuredOutput: 'json_schema',
    extraHeaders: {'X-OpenRouter-Metadata': 'enabled'},
  });
  const run = await interpretIntent(sourceIntent);
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(body.max_tokens, 1600);
  assert.deepEqual(body.provider, routing);
  assert.deepEqual(body.reasoning, reasoning);
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
  assert.deepEqual(body.response_format.json_schema.schema.properties.proposal.properties.source_intent.enum, [sourceIntent]);
  assert.equal(body.response_format.json_schema.schema.properties.proposal.properties.requirements.items.additionalProperties, false);
  assert.deepEqual(
    Object.keys(body.response_format.json_schema.schema.properties.proposal.properties.requirements.items.properties).sort(),
    ['key', 'provenance', 'value'],
  );
  assert.equal(request.options.headers['X-OpenRouter-Metadata'], 'enabled');
  assert.equal(run.response_model, 'google/gemini-3.1-flash-lite');
  assert.equal(run.reported_cost_usd, 0.00015);
  assert.equal(run.routing_metadata.provider_name, 'Google AI Studio');
});
