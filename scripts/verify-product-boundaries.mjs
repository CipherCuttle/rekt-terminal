import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'config/product-boundaries.json');

function fail(message) {
  console.error(`Product boundary invariant failed: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeRepoPath(value) {
  return value.split('/').join(path.sep);
}

function isInside(candidate, parent) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

if (!fs.existsSync(manifestPath)) fail('config/product-boundaries.json is missing');
const manifest = readJson(manifestPath);
if (manifest.schema_version !== 1) fail(`unsupported schema_version ${JSON.stringify(manifest.schema_version)}`);
if (manifest.repository !== 'CipherCuttle/rekt-terminal') fail(`unexpected repository identity ${JSON.stringify(manifest.repository)}`);

const expectedIds = ['rekt-terminal', 'rekt-inkubator'];
const actualIds = Object.keys(manifest.products ?? {});
if (actualIds.length !== expectedIds.length || expectedIds.some((id) => !actualIds.includes(id))) {
  fail(`product set must be exactly ${expectedIds.join(', ')}`);
}

const packageJson = readJson(path.join(root, 'package.json'));
const expectedBuildScripts = {
  'build:terminal': 'npm run build -w @rekt-ink/episodes && npm run build -w @rekt-ink/sim && npm run build -w @rekt-ink/career && npm run build -w @rekt-ink/learning && npm run build -w @rekt-ink/api && npm run build -w @rekt-ink/web',
  'build:inkubator': 'npm run build -w @rekt-ink/inkubator-lab',
};
for (const [name, expected] of Object.entries(expectedBuildScripts)) {
  if (packageJson.scripts?.[name] !== expected) {
    fail(`${name} must remain product-scoped; got ${JSON.stringify(packageJson.scripts?.[name])}`);
  }
}
if (/inkubator/i.test(packageJson.scripts['build:terminal'])) fail('build:terminal must not build Inkubator application workspaces');
if (/@rekt-ink\/(?:web|api)\b/.test(packageJson.scripts['build:inkubator'])) fail('build:inkubator must not build REKT Terminal application workspaces');

const products = new Map();
const workspaceOwner = new Map();
const runtimeRoots = [];
for (const id of expectedIds) {
  const product = manifest.products[id];
  if (!product?.frontend?.path || !product.frontend.workspace || !product.frontend.build_script || !product.frontend.output_directory) {
    fail(`${id} frontend contract is incomplete`);
  }
  const records = [product.frontend, ...(product.services ?? [])];
  const roots = [];
  for (const record of records) {
    if (!record.path || !record.workspace) fail(`${id} runtime record is incomplete`);
    const abs = path.join(root, normalizeRepoPath(record.path));
    const pkgPath = path.join(abs, 'package.json');
    if (!fs.existsSync(pkgPath)) fail(`${id} runtime root missing: ${record.path}`);
    const pkg = readJson(pkgPath);
    if (pkg.name !== record.workspace) fail(`${record.path} must be workspace ${record.workspace}; got ${JSON.stringify(pkg.name)}`);
    if (workspaceOwner.has(record.workspace)) fail(`workspace ${record.workspace} belongs to more than one product`);
    workspaceOwner.set(record.workspace, id);
    roots.push(abs);
    runtimeRoots.push({id, abs, path: record.path});
  }
  products.set(id, {product, roots});
}

for (let i = 0; i < runtimeRoots.length; i += 1) {
  for (let j = i + 1; j < runtimeRoots.length; j += 1) {
    const left = runtimeRoots[i];
    const right = runtimeRoots[j];
    if (left.id !== right.id && (isInside(left.abs, right.abs) || isInside(right.abs, left.abs))) {
      fail(`product runtime roots overlap: ${left.path} <-> ${right.path}`);
    }
  }
}

const terminal = manifest.products['rekt-terminal'];
const inkubator = manifest.products['rekt-inkubator'];
if (terminal.frontend.path !== 'apps/web' || terminal.frontend.workspace !== '@rekt-ink/web') fail('REKT Terminal frontend identity drifted');
if (terminal.frontend.output_directory !== 'apps/web/dist') fail('REKT Terminal deployment output drifted');
if (inkubator.frontend.path !== 'apps/inkubator-lab' || inkubator.frontend.workspace !== '@rekt-ink/inkubator-lab') fail('REKT Inkubator frontend identity drifted');
if (inkubator.frontend.output_directory !== 'inkubator') fail('REKT Inkubator deployment output drifted');

const inkubatorVite = fs.readFileSync(path.join(root, 'apps/inkubator-lab/vite.config.ts'), 'utf8');
if (!/outDir:\s*['"]\.\.\/\.\.\/inkubator['"]/.test(inkubatorVite)) fail('REKT Inkubator Vite output must remain repository /inkubator');
const terminalVite = fs.readFileSync(path.join(root, 'apps/web/vite.config.ts'), 'utf8');
const terminalOutDir = terminalVite.match(/outDir:\s*['"]([^'"]+)['"]/);
if (terminalOutDir && terminalOutDir[1] !== 'dist') fail(`REKT Terminal Vite output must remain apps/web/dist; got ${terminalOutDir[1]}`);

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const skippedDirectories = new Set(['node_modules', 'dist', 'coverage', 'storybook-static']);

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (entry.isFile() && codeExtensions.has(path.extname(entry.name))) yield fullPath;
  }
}

function importedSpecifiers(source) {
  const specs = new Set();
  const patterns = [
    /(?:\bfrom\s+|\bimport\s*\(|\brequire\s*\()\s*['"`]([^'"`]+)['"`]/g,
    /^\s*import\s*['"`]([^'"`]+)['"`]/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specs.add(match[1]);
  }
  return specs;
}

for (const [productId, {roots}] of products) {
  const otherRoots = runtimeRoots.filter((record) => record.id !== productId);
  for (const appRoot of roots) {
    for (const filePath of walk(appRoot)) {
      const source = fs.readFileSync(filePath, 'utf8');
      for (const specifier of importedSpecifiers(source)) {
        const owner = workspaceOwner.get(specifier);
        if (owner && owner !== productId) {
          fail(`${path.relative(root, filePath)} imports application workspace ${specifier} owned by ${owner}`);
        }
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(filePath), specifier);
          const crossRoot = otherRoots.find((record) => isInside(resolved, record.abs));
          if (crossRoot) fail(`${path.relative(root, filePath)} crosses product boundary into ${crossRoot.path}`);
        } else if (specifier.startsWith('apps/')) {
          const resolved = path.join(root, normalizeRepoPath(specifier));
          const crossRoot = otherRoots.find((record) => isInside(resolved, record.abs));
          if (crossRoot) fail(`${path.relative(root, filePath)} imports repo path across product boundary: ${specifier}`);
        }
      }
    }
  }
}

if (manifest.forbidden?.cross_product_application_imports !== true) fail('cross-product application imports must be forbidden');
if (manifest.forbidden?.cross_product_application_routing !== true) fail('cross-product application routing must be forbidden');
if (manifest.forbidden?.shared_canonical_deployment_identity !== true) fail('shared canonical deployment identity must be forbidden');
if (manifest.forbidden?.shared_product_authority !== true) fail('shared product authority must be forbidden');

console.log('REKT product boundary invariants: PASS');
