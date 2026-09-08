import {useEffect, useMemo, useRef, useState} from 'react';
import {useGSAP} from '@gsap/react';
import gsap from 'gsap';
import {Application, Graphics} from 'pixi.js';
import './instrument-os.css';

gsap.registerPlugin(useGSAP);

type LabState = 'IDLE' | 'INPUT' | 'ACTIVE' | 'SUCCESS' | 'ERROR';
type InstrumentZone = 'mission' | 'signal' | 'scope' | 'readout' | 'thread' | 'verifier' | 'rotary' | 'mode' | 'rekt' | 'crt';

const STATES: LabState[] = ['IDLE', 'INPUT', 'ACTIVE', 'SUCCESS', 'ERROR'];

const readoutByState: Record<LabState, string> = {
  IDLE: '000.0',
  INPUT: '018.4',
  ACTIVE: '073.2',
  SUCCESS: '100.0',
  ERROR: 'ERR.4',
};

const scopeValuesByState: Record<LabState, number[]> = {
  IDLE: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  INPUT: [0.5, 0.5, 0.28, 0.7, 0.5, 0.5, 0.5, 0.5],
  ACTIVE: [0.5, 0.16, 0.82, 0.24, 0.76, 0.2, 0.7, 0.3, 0.62, 0.18, 0.76, 0.5],
  SUCCESS: [0.5, 0.5, 0.3, 0.68, 0.38, 0.6, 0.26, 0.5, 0.5],
  ERROR: [0.5, 0.5, 0.12, 0.9, 0.18, 0.84, 0.5, 0.5],
};

const scopeColorByState: Record<LabState, number> = {
  IDLE: 0x65dcff,
  INPUT: 0xffb24a,
  ACTIVE: 0x65dcff,
  SUCCESS: 0xb9ff3d,
  ERROR: 0xff625f,
};

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  return reducedMotion;
}

function Frame({title, code, zone, children}: {title: string; code: string; zone: InstrumentZone; children: React.ReactNode}) {
  return (
    <section className={`ios-frame ios-frame--${zone}`} data-zone={zone} data-testid="instrument-primitive">
      <header><span>{code}</span><strong>{title}</strong><i aria-hidden="true" /></header>
      <div className="ios-frame-body">{children}</div>
    </section>
  );
}

function RektSprite({state}: {state: LabState}) {
  return (
    <div className="ios-rekt" data-state={state.toLowerCase()} aria-label={`REKT sprite ${state.toLowerCase()}`}>
      <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path className="hood" d="M11 45 16 19 31 9 48 19 53 45 45 55 19 55Z" />
        <path className="face" d="M20 25 31 18 44 25 42 43 22 43Z" />
        <rect className="eye" x="24" y="29" width="5" height="4" />
        <rect className="eye" x="36" y="29" width="5" height="4" />
        <path className="tentacle" d="M44 44 C55 45 56 53 48 58 C42 61 38 58 40 54 C42 51 47 53 48 50" />
        <circle className="halo" cx="32" cy="10" r="7" />
      </svg>
      <span>{state}</span>
    </div>
  );
}

function SignalPath({state}: {state: LabState}) {
  return (
    <svg className="ios-signal" data-state={state.toLowerCase()} data-motion="gsap" viewBox="0 0 260 86" aria-label={`Signal path ${state.toLowerCase()}`}>
      <path d="M8 58 H64 L84 28 H150 L172 58 H252" />
      <circle cx="8" cy="58" r="4" />
      <circle cx="252" cy="58" r="4" />
      <circle className="ios-signal-pulse" cx="8" cy="58" r="5" />
    </svg>
  );
}

function Rotary({state}: {state: LabState}) {
  const angle = {IDLE: -120, INPUT: -68, ACTIVE: 10, SUCCESS: 118, ERROR: 150}[state];
  return <div className="ios-rotary" style={{'--angle': `${angle}deg`} as React.CSSProperties}><div className="ios-rotary-ring"><div className="ios-rotary-knob"><i /></div></div><span>GAIN / {state}</span></div>;
}

function PixiScope({state, reducedMotion}: {state: LabState; reducedMotion: boolean}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent)) return;

    let cancelled = false;
    let app: Application | null = null;

    const boot = async () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(240, Math.round(bounds.width || 320));
      const height = Math.max(88, Math.round(bounds.height || 104));
      const next = new Application();
      await next.init({width, height, backgroundAlpha: 0, antialias: true, preference: 'webgl'});

      if (cancelled) {
        next.destroy(true, {children: true});
        return;
      }

      app = next;
      next.canvas.className = 'ios-pixi-canvas';
      next.canvas.setAttribute('aria-hidden', 'true');
      host.replaceChildren(next.canvas);

      const grid = new Graphics();
      for (let x = 0; x <= width; x += Math.max(36, Math.round(width / 6))) grid.moveTo(x, 0).lineTo(x, height);
      for (let y = 0; y <= height; y += Math.max(22, Math.round(height / 4))) grid.moveTo(0, y).lineTo(width, y);
      grid.stroke({color: 0x9d78ff, alpha: 0.12, pixelLine: true});

      const values = scopeValuesByState[state];
      const trace = new Graphics();
      values.forEach((value, index) => {
        const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
        const y = Math.max(5, Math.min(height - 5, value * height));
        if (index === 0) trace.moveTo(x, y);
        else trace.lineTo(x, y);
      });
      trace.stroke({color: scopeColorByState[state], width: 1.5});

      const scanner = new Graphics().circle(0, 0, 2.5).fill(scopeColorByState[state]);
      scanner.position.set(width * 0.68, height * 0.5);
      scanner.alpha = reducedMotion ? 0.42 : 0.88;

      next.stage.addChild(grid, trace, scanner);

      if (!reducedMotion) {
        next.ticker.add((ticker) => {
          scanner.x = (scanner.x + ticker.deltaTime * 1.35) % width;
        });
      }
    };

    void boot();

    return () => {
      cancelled = true;
      if (app) app.destroy(true, {children: true});
      host.replaceChildren();
    };
  }, [state, reducedMotion]);

  return (
    <div
      ref={hostRef}
      className="ios-pixi-host"
      role="img"
      aria-label={`Pixi oscilloscope ${state.toLowerCase()}`}
      data-renderer="pixi"
      data-motion-policy={reducedMotion ? 'reduced' : 'full'}
    />
  );
}

function ThreadNode({state}: {state: LabState}) {
  return <div className="ios-thread"><div className="ios-thread-line"/><div className="ios-thread-node"><span>07</span></div><div><b>{state === 'SUCCESS' ? 'PROVEN' : state === 'ERROR' ? 'BLOCKED' : 'OBSERVED'}</b><small>source event / calibration</small></div></div>;
}

function VerifierMachine({state}: {state: LabState}) {
  return <div className="ios-verifier"><div className="ios-verifier-core"><span>VFY</span><i /></div><div className="ios-verifier-copy"><b>{state === 'SUCCESS' ? 'ACCEPT' : state === 'ERROR' ? 'REJECT' : 'INSPECT'}</b><small>truth ceiling intact</small></div></div>;
}

function MissionMachine({state}: {state: LabState}) {
  return <div className="ios-mission"><div className="ios-mission-orbit"><i/><i/><i/></div><div className="ios-mission-core"><small>CURRENT MISSION</small><strong>SHIP THE WEIRD LITTLE THING</strong><span>{state === 'ERROR' ? 'BLOCKER DETECTED' : state === 'SUCCESS' ? 'READY TO SHIP' : 'NEXT MOVE // CONNECT SOURCE'}</span></div></div>;
}

export default function InstrumentLab() {
  const [state, setState] = useState<LabState>('ACTIVE');
  const [mode, setMode] = useState('COMMAND');
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const stateIndex = useMemo(() => STATES.indexOf(state), [state]);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;

    const pulse = root.querySelector<SVGCircleElement>('.ios-signal-pulse');
    const thread = root.querySelector<HTMLElement>('.ios-thread-node');
    const mission = root.querySelector<HTMLElement>('.ios-mission-core');
    const verifier = root.querySelector<HTMLElement>('.ios-verifier-core');
    if (!pulse || !thread || !mission || !verifier) return;

    gsap.set([thread, mission, verifier], {clearProps: 'transform,opacity,filter'});
    gsap.set(pulse, {attr: {cx: 8, cy: 58}, opacity: reducedMotion ? 0.6 : 0.22});

    if (reducedMotion) return;

    const timeline = gsap.timeline({defaults: {ease: 'power2.out'}});
    timeline
      .to(pulse, {attr: {cx: 84, cy: 28}, opacity: 1, duration: 0.18})
      .to(pulse, {attr: {cx: 172, cy: 58}, duration: 0.18})
      .to(pulse, {attr: {cx: 252, cy: 58}, opacity: 0.7, duration: 0.18})
      .fromTo(thread, {scale: 0.84, opacity: 0.45}, {scale: 1, opacity: 1, duration: 0.14}, '-=0.12')
      .fromTo(mission, {filter: 'brightness(0.78)'}, {filter: 'brightness(1)', duration: 0.24}, '-=0.04')
      .fromTo(verifier, {scale: 0.92}, {scale: 1, duration: 0.18}, '-=0.12');

    if (state === 'SUCCESS') {
      timeline.fromTo(mission, {boxShadow: '0 0 0 rgba(185,255,61,0)'}, {boxShadow: '0 0 24px rgba(185,255,61,.16)', duration: 0.36, yoyo: true, repeat: 1});
    } else if (state === 'ERROR') {
      timeline.fromTo(mission, {x: 0}, {x: 3, duration: 0.07, yoyo: true, repeat: 3, ease: 'steps(1)'}, '-=0.08');
    }
  }, {scope: rootRef, dependencies: [state, reducedMotion], revertOnUpdate: true});

  return (
    <main
      ref={rootRef}
      className="ios-lab"
      data-state={state.toLowerCase()}
      data-mode={mode.toLowerCase()}
      data-motion="gsap"
      data-motion-policy={reducedMotion ? 'reduced' : 'full'}
    >
      <div className="ios-crt" aria-hidden="true" />
      <header className="ios-lab-header">
        <div><small>REKT INK(CUBATOR) // 9A</small><h1>INSTRUMENT / MOTION LAB</h1><p>Calibration surface. Synthetic state only — never canonical product truth.</p></div>
        <div className="ios-state-bank" aria-label="Calibration state selector">{STATES.map((item) => <button key={item} type="button" aria-pressed={state === item} onClick={() => setState(item)}>{item}</button>)}</div>
      </header>

      <div className="ios-event-status" aria-live="polite">EVENT // {state} // {reducedMotion ? 'STATIC ACCESSIBLE PROJECTION' : 'CAUSAL MOTION ACTIVE'}</div>

      <section className="ios-chassis">
        <nav className="ios-mode-rail" aria-label="Instrument mode selector">
          <span className="ios-rail-label">MODE</span>
          {['WORLD','COMMAND','PROJECT','PLAYER','SHIP'].map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}><span>{item.slice(0, 1)}</span><b>{item}</b></button>)}
          <span className="ios-rail-tail">OS/01</span>
        </nav>

        <section className="ios-console" aria-label="Instrument primitives">
          <div className="ios-bus-label" aria-hidden="true">SIGNAL BUS // A</div>
          <Frame code="10" title="MISSION MACHINE" zone="mission"><MissionMachine state={state}/></Frame>
          <Frame code="01" title="SIGNAL PATH" zone="signal"><SignalPath state={state}/><p>Input → relay → projection. GSAP renders event causality.</p></Frame>
          <Frame code="04" title="NUMERIC READOUT" zone="readout"><div className="ios-readout"><small>TRUTH CONFIDENCE</small><strong>{readoutByState[state]}</strong><span>{state}</span></div></Frame>
          <Frame code="09" title="VERIFIER MACHINE" zone="verifier"><VerifierMachine state={state}/></Frame>
          <Frame code="06" title="THREAD NODE" zone="thread"><ThreadNode state={state}/></Frame>
          <Frame code="03" title="OSCILLOSCOPE" zone="scope"><PixiScope state={state} reducedMotion={reducedMotion}/><div className="ios-caption"><span>RX TRACE / PIXI</span><b>{stateIndex + 1}.0 kHz</b></div></Frame>
          <Frame code="07" title="REKT SPRITE" zone="rekt"><RektSprite state={state}/></Frame>
          <Frame code="02" title="ROTARY / GAUGE" zone="rotary"><Rotary state={state}/></Frame>
          <Frame code="05" title="MODE SWITCH" zone="mode"><div className="ios-mode-demo"><b>{mode}</b><span>one machine / five lenses</span></div></Frame>
          <Frame code="08" title="CRT MATERIAL" zone="crt"><div className="ios-crt-demo"><div className="ios-crt-raw">RAW SIGNAL</div><div className="ios-crt-treated">DISPLAY SIGNAL</div></div></Frame>
        </section>
      </section>

      <footer className="ios-lab-footer"><span>GSAP // EVENT CHOREOGRAPHY</span><span>PIXI // 2D INSTRUMENT DISPLAY</span><span>TANSTACK // LIVE COMMAND NEXT</span></footer>
    </main>
  );
}
