import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const root = path.resolve('inkubator');
const htmlPath = path.join(root, 'index.html');

if (!fs.existsSync(htmlPath)) {
  throw new Error('inkubator/index.html not found; build the Inkubator before checking budgets.');
}

const html = fs.readFileSync(htmlPath, 'utf8');
const refs = [
  ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g),
].map((match) => match[1].replace(/^\.\//, ''));

const records = refs.map((relative) => {
  const file = path.join(root, relative);
  const bytes = fs.readFileSync(file);
  return {
    relative,
    raw: bytes.length,
    gzip: gzipSync(bytes, {level: 9}).length,
    kind: relative.endsWith('.css') ? 'css' : 'js',
  };
});

const total = (kind, field) => records.filter((item) => item.kind === kind).reduce((sum, item) => sum + item[field], 0);
const jsRaw = total('js', 'raw');
const jsGzip = total('js', 'gzip');
const cssRaw = total('css', 'raw');
const cssGzip = total('css', 'gzip');
const initialGzip = jsGzip + cssGzip;

const kb = (value) => `${(value / 1024).toFixed(1)} KiB`;
console.log('Inkubator critical-path asset budget');
for (const item of records) console.log(`- ${item.relative}: ${kb(item.raw)} raw / ${kb(item.gzip)} gzip`);
console.log(`- initial JS: ${kb(jsRaw)} raw / ${kb(jsGzip)} gzip`);
console.log(`- initial CSS: ${kb(cssRaw)} raw / ${kb(cssGzip)} gzip`);
console.log(`- initial transfer (gzip): ${kb(initialGzip)}`);

const limits = {
  jsRaw: 420 * 1024,
  jsGzip: 150 * 1024,
  cssRaw: 48 * 1024,
  cssGzip: 16 * 1024,
  initialGzip: 165 * 1024,
};

const failures = [];
if (jsRaw > limits.jsRaw) failures.push(`initial JS raw ${kb(jsRaw)} > ${kb(limits.jsRaw)}`);
if (jsGzip > limits.jsGzip) failures.push(`initial JS gzip ${kb(jsGzip)} > ${kb(limits.jsGzip)}`);
if (cssRaw > limits.cssRaw) failures.push(`initial CSS raw ${kb(cssRaw)} > ${kb(limits.cssRaw)}`);
if (cssGzip > limits.cssGzip) failures.push(`initial CSS gzip ${kb(cssGzip)} > ${kb(limits.cssGzip)}`);
if (initialGzip > limits.initialGzip) failures.push(`initial transfer ${kb(initialGzip)} > ${kb(limits.initialGzip)}`);

if (failures.length) {
  console.error('\nPerformance budget failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Performance budget: PASS');
