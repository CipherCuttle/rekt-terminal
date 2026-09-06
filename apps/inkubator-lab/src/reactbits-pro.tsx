import {Component, Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ErrorInfo, type ReactNode} from 'react';

const ReactBitsGlitchText = lazy(() => import('./components/react-bits/glitch-text'));
const ReactBitsDitherWave = lazy(() => import('./components/react-bits/dither-wave'));
const ReactBitsGrainWave = lazy(() => import('./components/react-bits/grain-wave'));
const ReactBitsSquircleShift = lazy(() => import('./components/react-bits/squircle-shift'));

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
