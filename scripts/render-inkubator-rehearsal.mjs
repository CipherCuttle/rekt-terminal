import {createServer, request as httpRequest} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {spawn} from 'node:child_process';

const publicPort = Number(process.env.PORT || 10000);
const apiPort = Number(process.env.INKUBATOR_INTERNAL_API_PORT || 8788);
const host = '0.0.0.0';
const distDir = normalize(join(process.cwd(), 'apps/inkubator-lab/dist'));

const api = spawn(process.execPath, ['apps/inkubator-api/dist/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(apiPort),
  },
});

api.once('exit', (code, signal) => {
  console.error('inkubator api exited', {code, signal});
  process.exit(code ?? 1);
});

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

function proxy(req, res) {
  const upstream = httpRequest({
    hostname: '127.0.0.1',
    port: apiPort,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', (error) => {
    console.error('inkubator api proxy error', error);
    if (!res.headersSent) res.writeHead(502, {'content-type': 'application/json'});
    res.end(JSON.stringify({error: 'inkubator_api_unavailable'}));
  });
  req.pipe(upstream);
}

async function serveStatic(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  let candidate = normalize(join(distDir, relative || 'index.html'));
  if (!candidate.startsWith(distDir)) {
    res.writeHead(400);
    return res.end('bad request');
  }

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) candidate = join(candidate, 'index.html');
    const body = await readFile(candidate);
    res.writeHead(200, {
      'content-type': types.get(extname(candidate)) || 'application/octet-stream',
      'cache-control': candidate.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    return res.end(body);
  } catch {
    const body = await readFile(join(distDir, 'index.html'));
    res.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache'});
    return res.end(body);
  }
}

const server = createServer((req, res) => {
  const path = req.url || '/';
  if (path === '/health' || path.startsWith('/v1/') || path === '/openapi.json') return proxy(req, res);
  void serveStatic(req, res).catch((error) => {
    console.error('static serving failed', error);
    if (!res.headersSent) res.writeHead(500);
    res.end('internal server error');
  });
});

server.listen(publicPort, host, () => {
  console.log(`REKT Inkubator rehearsal listening on ${host}:${publicPort}`);
});

function shutdown(signal) {
  console.log(`received ${signal}`);
  server.close(() => {
    if (!api.killed) api.kill('SIGTERM');
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
