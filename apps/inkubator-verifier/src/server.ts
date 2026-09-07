import http from 'node:http';
import {assertSafeVerifierEnvironment, verifyPublicUrl} from './policy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST = '127.0.0.1';
const portRaw = process.env.INKUBATOR_VERIFIER_PORT?.trim() ?? '4180';
const port = Number(portRaw);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('INKUBATOR_VERIFIER_PORT invalid');
assertSafeVerifierEnvironment(process.env);

const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.method === 'GET' && request.url === '/health') {
    response.statusCode = 200;
    response.end(JSON.stringify({status: 'ok', service: 'inkubator-verifier', trust_zone: 'NO_PLATFORM_SECRETS'}));
    return;
  }
  if (request.method !== 'POST' || request.url !== '/v1/verify-url') {
    response.statusCode = 404; response.end(JSON.stringify({error: 'not_found'})); return;
  }
  let size = 0;
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > 16 * 1024) request.destroy();
    else chunks.push(chunk);
  });
  request.on('end', async () => {
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { response.statusCode = 400; response.end(JSON.stringify({error: 'request_invalid'})); return; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { response.statusCode = 400; response.end(JSON.stringify({error: 'request_invalid'})); return; }
    const value = body as Record<string, unknown>;
    if (value.schema_version !== 'ship-verifier.request.v1' || typeof value.submission_id !== 'string' || !UUID.test(value.submission_id) || typeof value.url !== 'string') {
      response.statusCode = 400; response.end(JSON.stringify({error: 'request_invalid'})); return;
    }
    const observation = await verifyPublicUrl(value.submission_id, value.url);
    response.statusCode = 200;
    response.end(JSON.stringify(observation));
  });
});
server.listen(port, HOST, () => console.log(`inkubator verifier listening on http://${HOST}:${port}`));
