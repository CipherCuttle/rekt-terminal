import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const labRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('P9-H06 browser bundler cannot resolve @rekt-ink/sdk/server', async () => {
  const root = await mkdtemp(path.join(labRoot, '.phase9-server-boundary-'));
  try {
    await writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>\n');
    await writeFile(path.join(root, 'main.js'), "import {createInkubatorServerClient} from '@rekt-ink/sdk/server';\nconsole.log(createInkubatorServerClient);\n");

    let rejected = false;
    try {
      await build({
        root,
        logLevel: 'silent',
        build: {write: false, target: 'es2022'},
      });
    } catch (error) {
      rejected = true;
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /server|export|resolve|browser/i);
    }

    assert.equal(rejected, true, 'browser Vite build unexpectedly bundled the server-only DevKit credential entry');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
