import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {componentSchemas, openapiDocument} from './contract.js';

type Schema = {
  type?: string;
  const?: string | number | boolean;
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
  ['/v1/players/{playerId}', 'get'],
  ['/v1/players/{playerId}/private', 'get'],
] as const;

function schemaType(schema: Schema): string {
  if (schema.$ref) return schema.$ref.split('/').at(-1) ?? 'unknown';
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array') return `${schema.items ? schemaType(schema.items) : 'unknown'}[]`;
  if (schema.type === 'object') return 'Record<string, unknown>';
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

  for (const [, response] of responses) {
    const schema = jsonSchema(response.content);
    if (schema) return schemaType(schema);
  }
  return 'void';
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
