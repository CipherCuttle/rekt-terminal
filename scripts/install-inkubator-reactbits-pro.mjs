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
    return /\.(tsx|ts|jsx|js)$/.test(entry.name) ? [fullPath] : [];
  });
}

function findComponent(slug) {
  const files = walk(srcRoot).filter((file) => !file.endsWith('reactbits-pro.tsx'));
  const exact = files.filter((file) => path.basename(file).replace(/\.(tsx|ts|jsx|js)$/, '').toLowerCase() === slug);
  const loose = files.filter((file) => path.basename(file).toLowerCase().includes(slug));
  const ranked = [...new Set([...exact, ...loose])].sort((a, b) => {
    const score = (file) => (file.includes(path.join('components', 'ui')) ? 0 : 1) + file.length / 10000;
    return score(a) - score(b);
  });
  if (!ranked[0]) throw new Error(`React Bits component not found: ${slug}`);
  return ranked[0];
}

function lazyImportFor(slug, binding) {
  const file = findComponent(slug);
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(path.dirname(adapterPath), file).replaceAll(path.sep, '/').replace(/\.(tsx|ts|jsx|js)$/, '');
  const importPath = relative.startsWith('.') ? relative : `./${relative}`;
  if (/export\s+default\b/.test(source)) {
    return {line: `const ${binding} = lazy(() => import('${importPath}'));`, file};
  }
  const named = source.match(/export\s+(?:function|const|class)\s+([A-Za-z0-9_]+)/);
  if (!named) throw new Error(`Could not determine export for ${file}`);
  return {line: `const ${binding} = lazy(() => import('${importPath}').then((module) => ({default: module.${named[1]}})));`, file};
}

const glitch = lazyImportFor('glitch-text', 'ReactBitsGlitchText');
const dither = lazyImportFor('dither-wave', 'ReactBitsDitherWave');
const grain = lazyImportFor('grain-wave', 'ReactBitsGrainWave');
const squircle = lazyImportFor('squircle-shift', 'ReactBitsSquircleShift');

const adapter = `import {Component, Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ErrorInfo, type ReactNode} from 'react';

${glitch.line}
${dither.line}
${grain.line}
${squircle.line}

class EffectBoundary extends Component<{children: ReactNode; fallback: ReactNode}, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('React Bits effect disabled; using CSS fallback.', error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function EffectFallback({kind}: {kind: 'grain' | 'dither' | 'squircle'}) {
  return <div className={'reactbits-fallback reactbits-fallback-' + kind} aria-hidden="true" />;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: {saveData?: boolean};
};

function canUseEnhancedEffects() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!supportsWebGL()) return false;
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (window.matchMedia('(max-width: 767px)').matches) return false;
  }
  const hints = navigator as NavigatorHints;
  if (hints.connection?.saveData) return false;
  if (typeof hints.deviceMemory === 'number' && hints.deviceMemory <= 2) return false;
  if (typeof hints.hardwareConcurrency === 'number' && hints.hardwareConcurrency <= 2) return false;
  return true;
}

const layerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none' as const,
};

function DeferredEffect({
  kind,
  className = '',
  startupDelayMs = 0,
  children,
}: {
  kind: 'grain' | 'dither' | 'squircle';
  className?: string;
  startupDelayMs?: number;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !canUseEnhancedEffects()) return;

    let near = false;
    let visible = document.visibilityState !== 'hidden';
    let timer = 0;

    const cancelScheduled = () => window.clearTimeout(timer);
    const activate = () => {
      cancelScheduled();
      if (near && visible) setActive(true);
    };
    const schedule = () => {
      cancelScheduled();
      if (!near || !visible) return;
      timer = window.setTimeout(activate, startupDelayMs || 80);
    };
    const wake = () => {
      if (!near || !visible) return;
      activate();
    };
    const onVisibility = () => {
      visible = document.visibilityState !== 'hidden';
      if (!visible) {
        cancelScheduled();
        setActive(false);
      } else if (near) {
        schedule();
      }
    };

    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        near = entry.isIntersecting;
        if (near) schedule();
        else {
          cancelScheduled();
          setActive(false);
        }
      }, {rootMargin: '320px 0px'});
      observer.observe(host);
    } else {
      near = true;
      schedule();
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', wake, {passive: true});
    window.addEventListener('touchstart', wake, {passive: true});
    window.addEventListener('keydown', wake);
    window.addEventListener('scroll', wake, {passive: true});

    return () => {
      cancelScheduled();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('scroll', wake);
    };
  }, [startupDelayMs]);

  return (
    <div ref={hostRef} className={['reactbits-layer', `reactbits-${kind}-layer`, className].filter(Boolean).join(' ')} style={layerStyle} aria-hidden="true">
      {active ? (
        <Suspense fallback={<EffectFallback kind={kind} />}>
          <EffectBoundary fallback={<EffectFallback kind={kind} />}>
            {children}
          </EffectBoundary>
        </Suspense>
      ) : (
        <EffectFallback kind={kind} />
      )}
    </div>
  );
}

export function GlitchText({children}: {children: ReactNode}) {
  return (
    <Suspense fallback={<span className="glitch-text">{children}</span>}>
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
    </Suspense>
  );
}

export function GrainWave({className = '', startupDelayMs = 0}: {className?: string; startupDelayMs?: number}) {
  return (
    <DeferredEffect kind="grain" className={className} startupDelayMs={startupDelayMs}>
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
    </DeferredEffect>
  );
}

export function DitherWave({className = ''}: {className?: string}) {
  return (
    <DeferredEffect kind="dither" className={className}>
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
        quality="medium"
        maxFPS={30}
        pauseWhenOffscreen
        className="reactbits-layer-fill"
      />
    </DeferredEffect>
  );
}

export function SquircleShift({className = ''}: {className?: string}) {
  return (
    <DeferredEffect kind="squircle" className={className}>
      <ReactBitsSquircleShift
        width="100%"
        height="100%"
        speed={0.28}
        colorLayers={3}
        gridFrequency={20}
        gridIntensity={0.75}
        waveSpeed={0.18}
        waveIntensity={0.13}
        spiralIntensity={0.8}
        lineThickness={0.055}
        falloff={1.1}
        centerX={1}
        centerY={1}
        colorTint="#b29aff"
        lightBackground="#08070e"
        darkBackground="#08070e"
        brightness={1.3}
        phaseOffset={10}
        className="reactbits-layer-fill"
      />
    </DeferredEffect>
  );
}
`;

fs.writeFileSync(adapterPath, adapter);

let app = fs.readFileSync(appPath, 'utf8');
app = app.replace(
  "import {useEffect, useRef, useState, type ReactNode} from 'react';",
  "import {useEffect, useState, type ReactNode} from 'react';\nimport {DitherWave, GrainWave, GlitchText} from './reactbits-pro';",
);
app = app.replace(/type DrawFrame = [\s\S]*?(?=const loop)/, '');
app = app.replace(/function useCanvasEffect[\s\S]*?function SectionLabel/, 'function SectionLabel');
fs.writeFileSync(appPath, app);

const marker = '/* React Bits Pro layer sizing */';
let styles = fs.readFileSync(stylesPath, 'utf8');
if (!styles.includes(marker)) {
  styles += `\n\n${marker}\n.reactbits-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }\n.reactbits-layer > * { display: block; width: 100%; height: 100%; }\n.reactbits-glitch { display: inline-block; max-width: 100%; }\n.glitch-text::before, .glitch-text::after { content: none; }\n`;
  fs.writeFileSync(stylesPath, styles);
}

console.log(JSON.stringify({
  installed: {glitch: glitch.file, dither: dither.file, grain: grain.file, squircle: squircle.file},
  adapter: path.relative(process.cwd(), adapterPath),
}));
