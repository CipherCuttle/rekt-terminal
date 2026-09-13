import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createOpenAICompatibleInterpreter} from '../src/compiler-provider.mjs';
import {responseFormatForMode} from '../compiler/benchmark/interpretation-response-format.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, '..');
const configPath = path.resolve(packageDir, 'compiler/benchmark/providers.openrouter-stable.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function validInterpretation(sourceIntent) {
  return {
    schema_version: 'inkubator.compiler-interpretation/1.0',
    proposal: {
      schema_version: 'inkubator.compiler-proposal/1.0',
      source_intent: sourceIntent,
      requirements: [],
      knowledge: [],
      outcome_criteria: [],
      delivery_criteria: [],
      preferences: {},
    },
    explanation: 'No material requirement was established by this fixture.',
  };
}

test('strict response format forbids undeclared semantic fields and authority provenance', () => {
  const responseFormat = responseFormatForMode('json_schema');
  assert.equal(responseFormat.type, 'json_schema');
  assert.equal(responseFormat.json_schema.strict, true);
  const schema = responseFormat.json_schema.schema;
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.proposal.additionalProperties, false);
  const requirement = schema.properties.proposal.properties.requirements.items;
  assert.equal(requirement.additionalProperties, false);
  assert.equal(requirement.properties.provenance.const, 'MODEL_PROPOSAL');
});

test('adapter forwards provider-specific response format and refuses oversized request before fetch', async () => {
  const sourceIntent = 'Build a tiny static page.';
  let calls = 0;
  let body;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    body = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          model: 'google/gemini-3.1-flash-lite',
          openrouter_metadata: {provider_name: 'Google AI Studio'},
          choices: [{message: {content: JSON.stringify(validInterpretation(sourceIntent))}}],
          usage: {prompt_tokens: 50, completion_tokens: 40, cost: 0.001},
        };
      },
      async text() { return ''; },
    };
  };
  const responseFormat = responseFormatForMode('json_schema');
  const interpret = createOpenAICompatibleInterpreter({
    name: 'fixture',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3.1-flash-lite',
    apiKey: 'fixture-key',
    fetchImpl,
    maxTokens: 1600,
    maxInputBytes: 20000,
    responseFormat,
  });
  const run = await interpret(sourceIntent);
  assert.equal(calls, 1);
  assert.deepEqual(body.response_format, responseFormat);
  assert.ok(run.request_input_bytes > 0 && run.request_input_bytes <= 20000);

  const blocked = createOpenAICompatibleInterpreter({
    name: 'blocked',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3.1-flash-lite',
    apiKey: 'fixture-key',
    fetchImpl,
    maxTokens: 1600,
    maxInputBytes: 1,
    responseFormat,
  });
  await assert.rejects(() => blocked(sourceIntent), /request exceeds byte ceiling/);
  assert.equal(calls, 1, 'oversized request must be rejected before fetch');
});

test('stable config pins two vendors, prices, formats and aggregate worst-case below ceiling', () => {
  const policy = config.run_policy;
  assert.equal(policy.free_only, false);
  assert.equal(policy.requires_runtime_authorization, true);
  assert.equal(policy.max_total_usd, 0.15);
  assert.equal(config.providers.length, 2);

  const maxInputTokens = policy.max_input_bytes_per_request + policy.billing_token_overhead_per_request;
  const taskCount = 10;
  let worstCase = 0;
  for (const provider of config.providers) {
    assert.equal(provider.provider_preferences.allow_fallbacks, false);
    assert.equal(provider.provider_preferences.require_parameters, true);
    assert.equal(provider.provider_preferences.only.length, 1);
    assert.equal(provider.enforce_response_model, true);
    assert.equal(provider.require_reported_cost, true);
    assert.ok(['json_object', 'json_schema'].includes(provider.response_format_mode));
    assert.ok(provider.provider_preferences.max_price.prompt <= provider.input_usd_per_million);
    assert.ok(provider.provider_preferences.max_price.completion <= provider.output_usd_per_million);
    worstCase += taskCount * ((maxInputTokens * provider.input_usd_per_million)
      + (policy.max_tokens_per_response * provider.output_usd_per_million)) / 1_000_000;
  }
  assert.equal(config.providers[0].provider_preferences.only[0], 'deepinfra');
  assert.equal(config.providers[0].provider_preferences.data_collection, 'deny');
  assert.equal(config.providers[0].provider_preferences.zdr, true);
  assert.equal(config.providers[0].response_format_mode, 'json_schema');
  assert.equal(config.providers[1].provider_preferences.only[0], 'google-ai-studio');
  assert.ok(worstCase <= policy.max_total_usd);
  assert.equal(Math.round(worstCase * 1_000_000) / 1_000_000, 0.105512);
});

test('paid benchmark cannot execute merely because OPENROUTER_API_KEY exists', () => {
  const result = spawnSync(process.execPath, ['compiler/benchmark/run.mjs'], {
    cwd: packageDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENROUTER_API_KEY: 'must-not-be-used',
      BENCHMARK_MODE: 'full',
      BENCHMARK_PROVIDERS: 'providers.openrouter-stable.json',
      BENCHMARK_AUTHORIZE_PAID: '',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PAID_EXECUTION_NOT_AUTHORIZED/);
});

test('authorized stable preflight with no key proves spend bound without network/model calls', () => {
  const result = spawnSync(process.execPath, ['compiler/benchmark/run.mjs'], {
    cwd: packageDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENROUTER_API_KEY: '',
      BENCHMARK_MODE: 'full',
      BENCHMARK_PROVIDERS: 'providers.openrouter-stable.json',
      BENCHMARK_AUTHORIZE_PAID: 'YES',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.paid_execution_authorized, true);
  assert.equal(receipt.spend_ceiling_usd, 0.15);
  assert.equal(Math.round(receipt.preflight_worst_case_cost_usd * 1_000_000) / 1_000_000, 0.105512);
  assert.equal(receipt.total_estimated_cost_usd, 0);
  assert.equal(receipt.total_reported_cost_usd, null);
  assert.equal(receipt.d_gate_5_evidence_ready, false);
  assert.ok(receipt.providers.every((provider) => provider.status === 'SKIPPED_MISSING_KEY'));
});
