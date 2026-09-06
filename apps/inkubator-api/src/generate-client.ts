import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {componentSchemas, openapiDocument} from './contract.js';

type Schema = {
  type?: string;
  const?: string | number | boolean;
  $ref?: string;
  properties?: Record<string, Schema>;
  required?: string[];
};

type Operation = {operationId?: string};
type Contract = {paths: Record<string, Record<string, Operation>>};

const schemas = componentSchemas as unknown as Record<string, Schema>;
const contract = openapiDocument as unknown as Contract;
const dtoNames = ['Error', 'DevSessionRequest', 'PublicPlayer', 'PrivatePlayer', 'SessionView'];

const operations = [
  ['/v1/dev/session', 'post', 'createDevSession'],
  ['/v1/session', 'delete', 'deleteSession'],
  ['/v1/me', 'get', 'getMe'],
  ['/v1/players/{playerId}', 'get', 'getPublicPlayer'],
  ['/v1/players/{playerId}/private', 'get', 'getPrivatePlayer'],
] as const;

for (const [route, method, operationId] of operations) {
  if (contract.paths[route]?.[method]?.operationId !== operationId) {
    throw new Error(`OpenAPI operation drift: ${method.toUpperCase()} ${route} must be ${operationId}`);
  }
}

function schemaType(schema: Schema): string {
  if (schema.$ref) return schema.$ref.split('/').at(-1) ?? 'unknown';
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'object') return 'Record<string, unknown>';
  return 'unknown';
}

function renderInterface(name: string, schema: Schema): string {
  if (schema.type !== 'object' || !schema.properties) throw new Error(`${name} must be an object schema`);
  const required = new Set(schema.required ?? []);
  const lines = [`export interface ${name} {`];
  for (const [property, propertySchema] of Object.entries(schema.properties)) {
    lines.push(`  ${property}${required.has(property) ? '' : '?'}: ${schemaType(propertySchema)};`);
  }
  lines.push('}');
  return lines.join('\n');
}

const interfaces = dtoNames.map((name) => renderInterface(name, schemas[name])).join('\n\n');
const generated = `/* GENERATED FROM apps/inkubator-api/src/contract.ts. DO NOT EDIT. */\n${interfaces}\n\nexport type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;\n\nexport class InkubatorApiError extends Error {\n  constructor(public readonly status: number, message: string) {\n    super(message);\n    this.name = 'InkubatorApiError';\n  }\n}\n\nexport class InkubatorApiClient {\n  constructor(\n    private readonly baseUrl = '',\n    private readonly fetchImpl: FetchLike = fetch,\n  ) {}\n\n  private async request<T>(path: string, init: RequestInit): Promise<T> {\n    const headers = new Headers(init.headers);\n    if (init.body !== undefined) headers.set('content-type', 'application/json');\n    const response = await this.fetchImpl(\`${'${this.baseUrl.replace(/\\\/$/, \'\')}'}${'${path}'}\`, {\n      ...init,\n      headers,\n      credentials: 'include',\n    });\n    if (!response.ok) {\n      const body = await response.json().catch(() => null) as {error?: unknown} | null;\n      const message = typeof body?.error === 'string' ? body.error : \`request_failed_${'${response.status}'}\`;\n      throw new InkubatorApiError(response.status, message);\n    }\n    if (response.status === 204) return undefined as T;\n    return await response.json() as T;\n  }\n\n  createDevSession(body: DevSessionRequest): Promise<SessionView> {\n    return this.request<SessionView>('/v1/dev/session', {method: 'POST', body: JSON.stringify(body)});\n  }\n\n  deleteSession(): Promise<void> {\n    return this.request<void>('/v1/session', {method: 'DELETE'});\n  }\n\n  getMe(): Promise<PrivatePlayer> {\n    return this.request<PrivatePlayer>('/v1/me', {method: 'GET'});\n  }\n\n  getPublicPlayer(playerId: string): Promise<PublicPlayer> {\n    return this.request<PublicPlayer>(\`/v1/players/${'${encodeURIComponent(playerId)}'}\`, {method: 'GET'});\n  }\n\n  getPrivatePlayer(playerId: string): Promise<PrivatePlayer> {\n    return this.request<PrivatePlayer>(\`/v1/players/${'${encodeURIComponent(playerId)}'}/private\`, {method: 'GET'});\n  }\n}\n`;

const target = fileURLToPath(new URL('../../inkubator-lab/src/generated/inkubator-api-client.ts', import.meta.url));
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== generated) {
    console.error('Generated Inkubator API client is stale. Run npm run generate:client -w @rekt-ink/inkubator-api');
    process.exit(1);
  }
  console.log('Generated Inkubator API client: PASS');
} else {
  fs.mkdirSync(new URL('../../inkubator-lab/src/generated/', import.meta.url), {recursive: true});
  fs.writeFileSync(target, generated);
  console.log(`Generated ${target}`);
}
