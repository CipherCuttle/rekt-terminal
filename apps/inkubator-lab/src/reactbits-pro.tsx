import type {CSSProperties, ReactNode} from 'react';

/**
 * Public Inkubator effect boundary.
 *
 * React Bits Pro source is licensed private input and is intentionally absent
 * from the public repository. Product surfaces depend only on these stable
 * Inkubator-owned exports; this public implementation renders the existing
 * V3 CSS fallbacks so composition, reduced-motion behavior and layout survive
 * without publishing licensed component source.
 */

type EffectKind = 'grain' | 'dither' | 'squircle';

const layerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

function PublicEffect({kind, className = ''}: {kind: EffectKind; className?: string}) {
  return (
    <div
      className={['reactbits-layer', `reactbits-${kind}-layer`, className].filter(Boolean).join(' ')}
      style={layerStyle}
      aria-hidden="true"
    >
      <div className={`reactbits-fallback reactbits-fallback-${kind}`} />
    </div>
  );
}

export function GlitchText({children}: {children: ReactNode}) {
  const text = typeof children === 'string' ? children : undefined;
  return <span className="glitch-text" data-text={text}>{children}</span>;
}

export function GrainWave({className = '', startupDelayMs: _startupDelayMs = 0}: {className?: string; startupDelayMs?: number}) {
  return <PublicEffect kind="grain" className={className} />;
}

export function DitherWave({className = ''}: {className?: string}) {
  return <PublicEffect kind="dither" className={className} />;
}

export function SquircleShift({className = ''}: {className?: string}) {
  return <PublicEffect kind="squircle" className={className} />;
}
