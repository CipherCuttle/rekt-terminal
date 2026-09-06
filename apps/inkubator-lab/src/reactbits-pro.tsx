import {Component, type CSSProperties, type ErrorInfo, type ReactNode} from 'react';
import ReactBitsGlitchText from './components/react-bits/glitch-text';
import ReactBitsDitherWave from './components/react-bits/dither-wave';
import ReactBitsGrainWave from './components/react-bits/grain-wave';
import ReactBitsSquircleShift from './components/react-bits/squircle-shift';

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
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

const layerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none' as const,
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
    <div className={["reactbits-layer", "reactbits-grain-layer", className].filter(Boolean).join(" ")} style={layerStyle} aria-hidden="true">
      {supportsWebGL() ? (
        <EffectBoundary fallback={<EffectFallback kind="grain" />}>
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
        </EffectBoundary>
      ) : (
        <EffectFallback kind="grain" />
      )}
    </div>
  );
}

export function DitherWave() {
  return (
    <div className="reactbits-layer reactbits-dither-layer" style={layerStyle} aria-hidden="true">
      {supportsWebGL() ? (
        <EffectBoundary fallback={<EffectFallback kind="dither" />}>
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
        </EffectBoundary>
      ) : (
        <EffectFallback kind="dither" />
      )}
    </div>
  );
}

export function SquircleShift({className = ''}: {className?: string}) {
  return (
    <div className={["reactbits-layer", "reactbits-squircle-layer", className].filter(Boolean).join(" ")} style={layerStyle} aria-hidden="true">
      {supportsWebGL() ? (
        <EffectBoundary fallback={<EffectFallback kind="squircle" />}>
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
        </EffectBoundary>
      ) : (
        <EffectFallback kind="squircle" />
      )}
    </div>
  );
}
