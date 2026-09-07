import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {componentSchemas, openapiDocument} from './contract.js';

type Schema = {
  type?: string | string[];
  const?: string | number | boolean;
  enum?: Array<string | number | boolean>;
  $ref?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
};

type Parameter = {
  name: string;
  in: string;
  required?: boolean;
  schema?: Schema;
};

type MediaType = {schema?: Schema};
type Response = {content?: Record<string, MediaType>};
type RequestBody = {content?: Record<string, MediaType>};

type Operation = {
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
};

type Contract = {
  paths: Record<string, Record<string, Operation>>;
};

const schemas = componentSchemas as unknown as Record<string, Schema>;
const contract = openapiDocument as unknown as Contract;

const clientOperations = [
  ['/v1/dev/session', 'post'],
  ['/v1/session', 'delete'],
  ['/v1/me', 'get'],
  ['/v1/me/profile', 'get'],
  ['/v1/me/profile', 'patch'],
  ['/v1/me/command', 'get'],
  ['/v1/players/{playerId}', 'get'],
  ['/v1/players/{playerId}/private', 'get'],
  ['/v1/missions/{missionId}/ship-submissions', 'post'],
  ['/v1/projects/{projectId}/ship', 'get'],
  ['/v1/ship-receipts/{receiptId}', 'get'],
  ['/v1/rounds', 'get'],
  ['/v1/rounds/{roundId}/join', 'post'],
  ['/v1/missions', 'post'],
  ['/v1/missions/{missionId}', 'patch'],
  ['/v1/missions/{missionId}/gates/{gateKey}', 'patch'],
  ['/v1/development/projects', 'post'],
  ['/v1/projects/{projectId}', 'get'],
  ['/v1/projects/{projectId}/private', 'get'],
  ['/v1/projects/{projectId}/github-repositories', 'post'],
  ['/v1/github/install', 'post'],
  ['/v1/discover/players', 'get'],
  ['/v1/discover/projects', 'get'],
  ['/v1/players/{playerId}/follow', 'post'],
  ['/v1/projects/{projectId}/watch', 'post'],
  ['/v1/projects/{projectId}/help-beacons', 'post'],
  ['/v1/help-beacons/{beaconId}/close', 'post'],
  ['/v1/help-beacons/{beaconId}/assists', 'post'],
  ['/v1/assists/{assistId}/accept', 'post'],
  ['/v1/projects/{projectId}/help-loop', 'get'],
  ['/v1/projects/{projectId}/comments', 'get'],
  ['/v1/projects/{projectId}/comments', 'post'],
  ['/v1/comments/{commentId}/reactions/useful', 'post'],
  ['/v1/comments/{commentId}', 'delete'],
  ['/v1/projects/{projectId}/discussion', 'patch'],
  ['/v1/world/signals', 'get'],
  ['/v1/players/{playerId}/block', 'post'],
  ['/v1/players/{playerId}/block', 'delete'],
  ['/v1/comments/{commentId}/report', 'post'],
  ['/v1/projects/{projectId}/tester-requests', 'post'],
  ['/v1/tester-requests/{testRequestId}/results', 'post'],
  ['/v1/projects/{projectId}/external-tests', 'get'],
] as const;

function primitiveType(type: string): string {
  if (type === 'string') return 'string';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'null') return 'null';
  if (type === 'object') return 'Record<string, unknown>';
  return 'unknown';
}

function schemaType(schema: Schema): string {
  if (schema.$ref) return schema.$ref.split('/').at(-1) ?? 'unknown';
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (Array.isArray(schema.type)) return schema.type.map(primitiveType).join(' | ');
  if (schema.type === 'array') {
    const itemType = schema.items ? schemaType(schema.items) : 'unknown';
    return `${itemType.includes(' | ') ? `(${itemType})` : itemType}[]`;
  }
  if (schema.type) return primitiveType(schema.type);
  return 'unknown';
}

function renderDeclaration(name: string, schema: Schema): string {
  if (schema.type !== 'object' || !schema.properties) {
    return `export type ${name} = ${schemaType(schema)};`;
  }

  const required = new Set(schema.required ?? []);
  const lines = [`export interface ${name} {`];
  for (const [property, propertySchema] of Object.entries(schema.properties)) {
    lines.push(`  ${property}${required.has(property) ? '' : '?'}: ${schemaType(propertySchema)};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function jsonSchema(content: Record<string, MediaType> | undefined): Schema | undefined {
  return content?.['application/json']?.schema;
}

function successResponseType(operation: Operation): string {
  const responses = Object.entries(operation.responses ?? {})
    .filter(([status]) => /^2\d\d$/.test(status))
    .sort(([left], [right]) => Number(left) - Number(right));

  if (responses.length === 0) {
    throw new Error(`operation ${operation.operationId ?? '<unknown>'} has no 2xx response`);
  }
  if (responses.length !== 1) {
    throw new Error(
      `operation ${operation.operationId ?? '<unknown>'} declares ${responses.length} successful responses; ` +
        'the generated client requires exactly one 2xx response until success unions are implemented',
    );
  }

  const [, response] = responses[0];
  const responseContent = response.content;
  if (!responseContent || Object.keys(responseContent).length === 0) return 'void';

  const schema = jsonSchema(responseContent);
  if (!schema) {
    throw new Error(
      `successful response on ${operation.operationId ?? '<unknown>'} must use application/json ` +
        'or declare no response content',
    );
  }
  return schemaType(schema);
}

function pathExpression(route: string, parameters: Parameter[]): string {
  const pathParameters = new Map(
    parameters.filter((parameter) => parameter.in === 'path').map((parameter) => [parameter.name, parameter]),
  );

  const placeholders = [...route.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  for (const placeholder of placeholders) {
    const parameter = pathParameters.get(placeholder);
    if (!parameter?.required || !parameter.schema) {
      throw new Error(`path parameter ${placeholder} for ${route} must be required and typed`);
    }
  }
  for (const parameter of pathParameters.values()) {
    if (!placeholders.includes(parameter.name)) {
      throw new Error(`OpenAPI path parameter ${parameter.name} is not present in ${route}`);
    }
  }

  if (placeholders.length === 0) return JSON.stringify(route);
  const rendered = route.replace(/\{([^}]+)\}/g, (_match, name: string) => `\${encodeURIComponent(${name})}`);
  return `\`${rendered}\``;
}

function renderOperation(route: string, method: string): string {
  const operation = contract.paths[route]?.[method];
  if (!operation?.operationId) {
    throw new Error(`client operation missing operationId: ${method.toUpperCase()} ${route}`);
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(operation.operationId)) {
    throw new Error(`operationId is not a valid TypeScript method name: ${operation.operationId}`);
  }

  const parameters = operation.parameters ?? [];
  const unsupportedParameters = parameters.filter((parameter) => parameter.in !== 'path');
  if (unsupportedParameters.length > 0) {
    const locations = unsupportedParameters.map((parameter) => `${parameter.name}:${parameter.in}`).join(', ');
    throw new Error(
      `operation ${operation.operationId} declares unsupported generated-client parameters (${locations}); ` +
        'implement that parameter location before changing the OpenAPI contract',
    );
  }

  const pathParameters = parameters.filter((parameter) => parameter.in === 'path');
  const args = pathParameters.map((parameter) => {
    if (!parameter.required || !parameter.schema) {
      throw new Error(`path parameter ${parameter.name} on ${operation.operationId} must be required and typed`);
    }
    return `${parameter.name}: ${schemaType(parameter.schema)}`;
  });

  const bodySchema = jsonSchema(operation.requestBody?.content);
  if (operation.requestBody && !bodySchema) {
    throw new Error(`request body on ${operation.operationId} must declare application/json schema`);
  }
  if (bodySchema) args.push(`body: ${schemaType(bodySchema)}`);

  const responseType = successResponseType(operation);
  const init = [`method: '${method.toUpperCase()}'`];
  if (bodySchema) init.push('body: JSON.stringify(body)');

  return [
    `  ${operation.operationId}(${args.join(', ')}): Promise<${responseType}> {`,
    `    return this.request<${responseType}>(${pathExpression(route, parameters)}, {${init.join(', ')}});`,
    '  }',
  ].join('\n');
}

const declarations = Object.entries(schemas)
  .map(([name, schema]) => renderDeclaration(name, schema))
  .join('\n\n');

const methods = clientOperations.map(([route, method]) => renderOperation(route, method)).join('\n\n');

const generated = `/* GENERATED FROM apps/inkubator-api/src/contract.ts. DO NOT EDIT. */
${declarations}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class InkubatorApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'InkubatorApiError';
  }
}

export class InkubatorApiClient {
  constructor(
    private readonly baseUrl = '',
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    const response = await this.fetchImpl(\`${'${this.baseUrl.replace(/\\/$/, \'\')}'}${'${path}'}\`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {error?: unknown} | null;
      const message = typeof body?.error === 'string' ? body.error : \`request_failed_${'${response.status}'}\`;
      throw new InkubatorApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

${methods}
}
`;

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
