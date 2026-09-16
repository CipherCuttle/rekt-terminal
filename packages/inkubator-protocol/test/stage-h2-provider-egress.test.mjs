import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPILER_PROVIDER_OUTBOUND_DATA_CLASS,
  COMPILER_PROVIDER_OUTBOUND_SCHEMA_VERSION,
  createPrivacyBoundOpenAICompatibleInterpreter,
} from '../src/compiler-provider-egress.mjs';

const dataPolicy = {
  retention: 'ZERO_DATA_RETENTION',
  training: 'DISALLOWED',
  request_logging: 'DISALLOWED',
  policy_reference: 'fixture-zdr-no-training-no-request-logging',
};

function interpretation(sourceIntent) {
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
    explanation: 'No material requirements extracted.',
  };
}

function outbound(organizerIntent) {
  return {
    schema_version: COMPILER_PROVIDER_OUTBOUND_SCHEMA_VERSION,
    data_class: COMPILER_PROVIDER_OUTBOUND_DATA_CLASS,
    organizer_intent: organizerIntent,
  };
}

test('H2 provider egress accepts only organizer-intent data and emits no structured private fields', async () => {
  const organizerIntent = 'Build a public static microsite.';
  let request;
  const fetchImpl = async (url, options) => {
    request = {url, options};
    return {
      ok: true,
      status: 200,
      async json() {
        return {choices: [{message: {content: JSON.stringify(interpretation(organizerIntent))}}], usage: {}};
      },
      async text() { return ''; },
    };
  };
  const interpret = createPrivacyBoundOpenAICompatibleInterpreter({
    name: 'fixture',
    baseUrl: 'https://provider.example/v1',
    model: 'fixture-model',
    apiKey: 'fixture-key',
    fetchImpl,
    dataPolicy,
    extraHeaders: {'X-Title': 'REKT Inkubator privacy fixture'},
  });
  const run = await interpret(outbound(organizerIntent));
  const body = JSON.parse(request.options.body);
  const serialized = JSON.stringify(body);
  assert.equal(run.interpretation.proposal.source_intent, organizerIntent);
  assert.match(serialized, /Build a public static microsite/);
  for (const forbidden of ['immutable_source_reference', 'evidence_references', 'archive_reference', 'source_reference', 'cookie', 'session_token']) {
    assert.equal(serialized.includes(forbidden), false, `provider payload leaked ${forbidden}`);
  }
});

test('H2 provider egress rejects structured source/evidence/secrets before network egress', async () => {
  let calls = 0;
  const interpret = createPrivacyBoundOpenAICompatibleInterpreter({
    name: 'fixture', baseUrl: 'https://provider.example/v1', model: 'fixture-model', apiKey: 'fixture-key', dataPolicy,
    fetchImpl: async () => { calls += 1; throw new Error('must_not_call'); },
  });
  for (const extra of [
    {immutable_source_reference: {kind: 'GIT_COMMIT', value: 'private'}},
    {evidence_references: ['private']},
    {archive_reference: 'r2://private'},
    {cookie: 'session=secret'},
  ]) {
    await assert.rejects(() => interpret({...outbound('Build a page.'), ...extra}), /undeclared property/);
  }
  assert.equal(calls, 0);
});

test('H2 provider egress requires explicit zero-retention, no-training and no-request-logging policy', () => {
  for (const override of [
    {retention: 'UNKNOWN'},
    {training: 'UNKNOWN'},
    {request_logging: 'UNKNOWN'},
  ]) {
    assert.throws(() => createPrivacyBoundOpenAICompatibleInterpreter({
      name: 'fixture', baseUrl: 'https://provider.example/v1', model: 'fixture-model', apiKey: 'fixture-key',
      dataPolicy: {...dataPolicy, ...override},
    }), /ZERO_DATA_RETENTION|training must be DISALLOWED|request logging must be DISALLOWED/);
  }
});

test('H2 provider egress rejects sensitive or arbitrary extra headers', () => {
  for (const extraHeaders of [
    {cookie: 'secret'},
    {authorization: 'override'},
    {'x-api-key': 'secret'},
    {'x-private-source': 'repo-secret'},
  ]) {
    assert.throws(() => createPrivacyBoundOpenAICompatibleInterpreter({
      name: 'fixture', baseUrl: 'https://provider.example/v1', model: 'fixture-model', apiKey: 'fixture-key', dataPolicy, extraHeaders,
    }), /not allowlisted/);
  }
});

test('H2 provider HTTP errors do not echo provider response bodies into errors', async () => {
  const secret = 'PRIVATE_PROVIDER_ECHO_SECRET';
  const interpret = createPrivacyBoundOpenAICompatibleInterpreter({
    name: 'fixture', baseUrl: 'https://provider.example/v1', model: 'fixture-model', apiKey: 'fixture-key', dataPolicy,
    fetchImpl: async () => ({ok: false, status: 400, async text() { return secret; }}),
  });
  await assert.rejects(
    () => interpret(outbound('Build a page.')),
    (error) => {
      assert.match(error.message, /HTTP 400/);
      assert.equal(error.message.includes(secret), false);
      assert.match(error.message, /provider response body redacted/);
      return true;
    },
  );
});
