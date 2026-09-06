import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve('apps/inkubator-lab');
const srcRoot = path.join(appRoot, 'src');
const adapterPath = path.join(srcRoot, 'reactbits-pro.tsx');
const appPath = path.join(srcRoot, 'App.tsx');
const stylesPath = path.join(srcRoot, 'styles.css');

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\\.(tsx|ts|jsx|js)$/.test(entry.name) ? [fullPath] : [];
  });
}

function pascalCase(value) {
  return value.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
}

function findComponent(slug) {
  const files = walk(srcRoot).filter((file) => !file.endsWith('reactbits-pro.tsx'));
  const exact = files.filter((file) => path.basename(file).replace(/\\.(tsx|ts|jsx|js)$/, '').toLowerCase() === slug);
  const loose = files.filter((file) => path.basename(file).toLowerCase().includes(slug));
  const ranked = [...new Set([...exact, ...loose])].sort((a, b) => {
    const score = (file) => (file.includes(path.join('components', 'ui')) ? 0 : 1) + file.length / 10000;
    return score(a) - score(b);
  });
  if (!ranked[0]) throw new Error(`React Bits component not found: ${slug}`);
  return ranked[0];
}

function importFor(slug, binding) {
  const file = findComponent(slug);
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(path.dirname(adapterPath), file).replaceAll(path.sep, '/').replace(/\\.(tsx|ts|jsx|js)$/, '');
  const importPath = relative.startsWith('.') ? relative : `./${relative}`;
  if (/export\\s+default\\b/.test(source)) {
    return {line: `import ${binding} from '${importPath}';`, file};
  }
  const named = source.match(/export\\s+(?:function|const|class)\\s+([A-Za-z0-9_]+)/);
  if (!named) throw new Error(`Could not determine export for ${file}`);
  return {line: `import { ${named[1]} as ${binding} } from '${importPath}';`, file};
}

const glitch = importFor('glitch-text', 'ReactBitsGlitchText');
const dither = importFor('dither-wave', 'ReactBitsDitherWave');
const grain = importFor('grain-wave', 'ReactBitsGrainWave');

const adapter = `import type {ReactNode} from 'react';
${glitch.line}
${dither.line}
${grain.line}

const layerStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

export function GlitchText({children}: {children: ReactNode}) {
  return (
    <ReactBitsGlitchText
      text={typeof children === 'string' ? children : ''}
      colors={['#7a5cff', '#b29aff', '#9aff67']}
      textColor="#f2eff8"
      fontSize={96}
      fontWeight="900"
      radius={250}
      letterSpacing={-3}
      textAlign="left"
      autoFit
      className="glitch-text reactbits-glitch"
    />
  );
}

export function GrainWave({className = ''}: {className?: string}) {
  return (
    <div className={`reactbits-layer ${className}`} style={layerStyle} aria-hidden="true">
      <ReactBitsGrainWave
        width="100%"
        height="100%"
        speed={0.5}
        waveCount={25}
        startColor="#7a5cff"
        endColor="#b29aff"
        darkBackground="#08070e"
        className="reactbits-layer-fill"
      />
    </div>
  );
}

export function DitherWave() {
  return (
    <div className="reactbits-layer" style={layerStyle} aria-hidden="true">
      <ReactBitsDitherWave
        width="100%"
        height="100%"
        speed={0.75}
        intensity={1.4}
        scale={5}
        downScale={0.6}
        primaryColor="#b29aff"
        secondaryColor="#7a5cff"
        tertiaryColor="#08070e"
        opacity={0.9}
        quality="high"
        maxFPS={45}
        pauseWhenOffscreen
        className="reactbits-layer-fill"
      />
    </div>
  );
}
`;

fs.writeFileSync(adapterPath, adapter);

let app = fs.readFileSync(appPath, 'utf8');
app = app.replace(
  "import {useEffect, useRef, useState, type ReactNode} from 'react';",
  "import {useEffect, useState, type ReactNode} from 'react';\\nimport {DitherWave, GrainWave, GlitchText} from './reactbits-pro';",
);
app = app.replace(/type DrawFrame = [\\s\\S]*?function SectionLabel/, 'function SectionLabel');
fs.writeFileSync(appPath, app);

const marker = '/* React Bits Pro layer sizing */';
let styles = fs.readFileSync(stylesPath, 'utf8');
if (!styles.includes(marker)) {
  styles += `

${marker}
.reactbits-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.reactbits-layer > * { display: block; width: 100%; height: 100%; }
.reactbits-glitch { display: inline-block; max-width: 100%; }
.glitch-text::before, .glitch-text::after { content: none; }
`;
  fs.writeFileSync(stylesPath, styles);
}

console.log(JSON.stringify({
  installed: {glitch: glitch.file, dither: dither.file, grain: grain.file},
  adapter: path.relative(process.cwd(), adapterPath),
}));
