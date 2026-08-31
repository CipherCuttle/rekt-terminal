import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`VERIFY_PWA=FAIL ${message}`);
  process.exitCode = 1;
};

const manifest = JSON.parse(read('apps/web/public/manifest.webmanifest'));
const index = read('apps/web/index.html');
const sw = read('apps/web/public/sw.js');
const css = read('apps/web/src/pwa.css');

if (!manifest.name && !manifest.short_name) fail('manifest must declare name or short_name');
if (manifest.start_url !== '/') fail('manifest start_url must stay at the application root');
if (manifest.scope !== '/') fail('manifest scope must stay at the application root');
if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) fail('manifest display is not installable app chrome');
if (manifest.prefer_related_applications === true) fail('manifest must not prefer a native application');

const iconSizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes));
if (!iconSizes.has('192x192')) fail('manifest is missing a 192x192 application icon');
if (!iconSizes.has('512x512')) fail('manifest is missing a 512x512 application icon');
if (!(manifest.icons ?? []).some((icon) => icon.purpose === 'maskable')) fail('manifest is missing a maskable icon');
for (const icon of manifest.icons ?? []) {
  const relative = String(icon.src ?? '').replace(/^\//, '');
  if (!relative || !exists(path.join('apps/web/public', relative))) fail(`manifest icon does not exist: ${icon.src}`);
}

if (!index.includes('rel="manifest" href="/manifest.webmanifest"')) fail('index.html does not link the web app manifest');
if (!index.includes('viewport-fit=cover')) fail('viewport-fit=cover is required for safe-area layout');
if (!index.includes('apple-mobile-web-app-capable')) fail('iOS standalone metadata is missing');

if (!sw.includes("pathname === '/health' || pathname.startsWith('/v1/')")) {
  fail('service worker does not declare /health and /v1/* as network-only');
}
if (!/if \(isNetworkOnlyPath\(url\.pathname\)\) return;[\s\S]*?request\.mode === 'navigate'/.test(sw)) {
  fail('service worker cache interception occurs before the network-only API gate');
}
if (!sw.includes("url.origin !== self.location.origin")) fail('service worker does not enforce same-origin cache scope');
if (!sw.includes("event.data?.type === 'SKIP_WAITING'")) fail('service worker update activation handshake is missing');

if (!css.includes('--safe-t: env(safe-area-inset-top')) fail('top safe-area inset is not defined');
if (!css.includes('.chart-box') || !css.includes('touch-action: pan-y')) fail('chart mobile gesture boundary is missing');
if (!css.includes('@media (prefers-reduced-motion: reduce)')) fail('reduced-motion policy is missing');

if (!process.exitCode) console.log('VERIFY_PWA=PASS');
