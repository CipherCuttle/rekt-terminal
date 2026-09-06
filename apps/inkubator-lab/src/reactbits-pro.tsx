import type {CSSProperties, ReactNode} from 'react';
import ReactBitsGlitchText from './components/react-bits/glitch-text';
import ReactBitsDitherWave from './components/react-bits/dither-wave';
import ReactBitsGrainWave from './components/react-bits/grain-wave';

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
    <div className={["reactbits-layer", className].filter(Boolean).join(" ")} style={layerStyle} aria-hidden="true">
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
