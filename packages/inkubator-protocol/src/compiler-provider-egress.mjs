import {createOpenAICompatibleInterpreter} from './compiler-provider.mjs';

export const COMPILER_PROVIDER_OUTBOUND_SCHEMA_VERSION = 'inkubator.compiler-provider-outbound/1.0';
export const COMPILER_PROVIDER_OUTBOUND_DATA_CLASS = 'ORGANIZER_INTENT';

const OUTBOUND_KEYS = new Set(['schema_version', 'data_class', 'organizer_intent']);
const POLICY_KEYS = new Set(['retention', 'training', 'request_logging', 'policy_reference']);
const ALLOWED_EXTRA_HEADERS = new Set(['x-openrouter-metadata', 'x-title', 'http-referer']);
const fail = (ok, message) => { if (!ok) throw new Error(message); };
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export function assertCompilerProviderOutboundInput(value) {
  fail(isObject(value), 'compiler provider outbound input must be an object');
  for (const key of Object.keys(value)) fail(OUTBOUND_KEYS.has(key), `compiler provider outbound input contains undeclared property ${key}`);
  fail(value.schema_version === COMPILER_PROVIDER_OUTBOUND_SCHEMA_VERSION, `unsupported compiler provider outbound schema ${value.schema_version}`);
  fail(value.data_class === COMPILER_PROVIDER_OUTBOUND_DATA_CLASS, `unsupported compiler provider outbound data class ${value.data_class}`);
  fail(typeof value.organizer_intent === 'string' && value.organizer_intent.length > 0, 'compiler provider organizer_intent must be a non-empty string');
  return value;
}

export function assertCompilerProviderDataPolicy(value) {
  fail(isObject(value), 'compiler provider data policy must be an object');
  for (const key of Object.keys(value)) fail(POLICY_KEYS.has(key), `compiler provider data policy contains undeclared property ${key}`);
  for (const key of POLICY_KEYS) fail(Object.hasOwn(value, key), `compiler provider data policy missing ${key}`);
  fail(value.retention === 'ZERO_DATA_RETENTION', 'compiler provider requires ZERO_DATA_RETENTION');
  fail(value.training === 'DISALLOWED', 'compiler provider training must be DISALLOWED');
  fail(value.request_logging === 'DISALLOWED', 'compiler provider request logging must be DISALLOWED');
  fail(typeof value.policy_reference === 'string' && value.policy_reference.length > 0 && value.policy_reference.length <= 500, 'compiler provider policy_reference invalid');
  return value;
}

function safeExtraHeaders(extraHeaders) {
  fail(extraHeaders === undefined || isObject(extraHeaders), 'compiler provider extraHeaders must be an object');
  const result = {};
  for (const [name, rawValue] of Object.entries(extraHeaders ?? {})) {
    const normalized = name.toLowerCase();
    fail(ALLOWED_EXTRA_HEADERS.has(normalized), `compiler provider extra header ${name} is not allowlisted`);
    fail(typeof rawValue === 'string' && rawValue.length > 0 && rawValue.length <= 200 && !/[\r\n]/.test(rawValue), `compiler provider extra header ${name} invalid`);
    result[name] = rawValue;
  }
  return result;
}

function redactingFetch(fetchImpl) {
  fail(typeof fetchImpl === 'function', 'provider fetch implementation is required');
  return async (...args) => {
    const response = await fetchImpl(...args);
    if (!response || response.ok !== false) return response;
    return {
      ok: false,
      status: response.status,
      async text() { return '[provider response body redacted]'; },
      async json() { throw new Error('provider response body unavailable'); },
    };
  };
}

export function createPrivacyBoundOpenAICompatibleInterpreter(options) {
  fail(isObject(options), 'compiler provider options must be an object');
  assertCompilerProviderDataPolicy(options.dataPolicy);
  const extraHeaders = safeExtraHeaders(options.extraHeaders);
  const interpreter = createOpenAICompatibleInterpreter({
    ...options,
    extraHeaders,
    fetchImpl: redactingFetch(options.fetchImpl ?? globalThis.fetch),
  });
  return async function interpretAuthorizedOrganizerIntent(input) {
    const outbound = assertCompilerProviderOutboundInput(input);
    return interpreter(outbound.organizer_intent);
  };
}
