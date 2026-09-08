import {createServer, type Server} from 'node:http';
import {expect, test} from '@playwright/test';

let upstream: Server;

test.beforeAll(async () => {
  upstream = createServer((request, response) => {
    if (request.url === '/v1/transport-probe') {
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({
        ok: true,
        transport: 'vite-proxy',
      }));
      return;
    }

    response.writeHead(404, {'content-type': 'application/json'});
    response.end(JSON.stringify({error: 'not_found'}));
  });

  await new Promise<void>((resolve, reject) => {
    upstream.once('error', reject);
    upstream.listen(8799, '127.0.0.1', resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    upstream.close((error) => error ? reject(error) : resolve());
  });
});

test('browser same-origin /v1 traffic reaches the configured API upstream', async ({page}) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const response = await fetch('/v1/transport-probe', {
      credentials: 'include',
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  });

  expect(result).toEqual({
    status: 200,
    body: {
      ok: true,
      transport: 'vite-proxy',
    },
  });
});
