import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createGzip} from 'node:zlib';

const root = path.resolve(process.env.INKUBATOR_DIR || 'inkubator');
const port = Number(process.env.PORT || 4175);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
};

function resolveRequest(urlPath) {
  const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, requested);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

const server = http.createServer((req, res) => {
  let file = resolveRequest(req.url);
  if (!file) {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404).end('Not found');
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const type = types[ext] || 'application/octet-stream';
  const compressible = /^(text\/|application\/(javascript|json)|image\/svg\+xml)/.test(type);
  const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(req.headers['accept-encoding'] || '');
  const immutable = file.includes(`${path.sep}assets${path.sep}`);

  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.setHeader('Vary', 'Accept-Encoding');

  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });

  if (compressible && acceptsGzip) {
    res.setHeader('Content-Encoding', 'gzip');
    stream.pipe(createGzip({level: 9})).pipe(res);
  } else {
    stream.pipe(res);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Inkubator performance server listening on http://127.0.0.1:${port}`);
});
