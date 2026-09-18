import {useEffect, useRef, useState} from 'react';
import {useGSAP} from '@gsap/react';
import gsap from 'gsap';
import {Application, Graphics} from 'pixi.js';
import {MOTION_EASE, MOTION_OVERLAP, MOTION_SECONDS} from './motion-tokens';
import {useReducedMotion} from './use-reduced-motion';
import './instrument-os.css';

gsap.registerPlugin(useGSAP);

type LabState = 'IDLE' | 'INPUT' | 'ACTIVE' | 'SUCCESS' | 'ERROR';
type InstrumentZone = 'mission' | 'signal' | 'scope' | 'readout' | 'thread' | 'verifier' | 'rotary' | 'mode' | 'rekt' | 'crt';

const STATES: LabState[] = ['IDLE', 'INPUT', 'ACTIVE', 'SUCCESS', 'ERROR'];

const observationAgeByState: Record<LabState, {value: string; unit: string}> = {
  IDLE: {value: '—', unit: 'NO RX'},
  INPUT: {value: '<1', unit: 'SEC'},
  ACTIVE: {value: '12', unit: 'SEC'},
  SUCCESS: {value: '02', unit: 'SEC'},
  ERROR: {value: '05:32', unit: 'MIN:SEC'},
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
  INPUT: 0x9d78ff,
  ACTIVE: 0x65dcff,
  SUCCESS: 0x65dcff,
  ERROR: 0xff625f,
};

const eventCopyByState: Record<LabState, string> = {
  IDLE: 'QUIET / NO SOURCE EVENT',
  INPUT: 'SOURCE EVENT RECEIVED',
  ACTIVE: 'OBSERVATION RELAYED',
  SUCCESS: 'PROOF RECEIVED',
  ERROR: 'FAILED OBSERVATION RECEIVED',
};


function Frame({title, code, zone, children}: {title: string; code: string; zone: InstrumentZone; children: React.ReactNode}) {
  return (
    <section className={`ios-frame ios-frame--${zone}`} data-zone={zone} data-testid="instrument-primitive">
      <header><span>{code}</span><strong>{title}</strong><i aria-hidden="true" /></header>
      <div className="ios-frame-body">{children}</div>
    </section>
  );
}

function RektSpriteBoundary({state}: {state: LabState}) {
  return (
    <div className="ios-rekt-slot" data-state={state.toLowerCase()} role="img" aria-label={`Canonical REKT pixel sprite placeholder boundary, ${state.toLowerCase()} state`}>
      <div className="ios-rekt-slot-grid" aria-hidden="true">
        <i/><i/><i/><i/><i/><i/><i/><i/><i/>
      </div>
      <div className="ios-rekt-slot-copy">
        <b>24×24 ASSET SLOT</b>
        <span>{state}</span>
        <small>PLACEHOLDER BOUNDARY / CANONICAL PIXEL SPRITE NOT FROZEN</small>
      </div>
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
  return <div className="ios-rotary" style={{'--angle': `${angle}deg`} as React.CSSProperties}><div className="ios-rotary-ring"><div className="ios-rotary-knob"><i /></div></div><span>RELAY LOAD / {state}</span></div>;
}

function drawScope(grid: Graphics, trace: Graphics, scanner: Graphics, width: number, height: number, state: LabState, reducedMotion: boolean) {
  grid.clear();
  for (let x = 0; x <= width; x += Math.max(36, Math.round(width / 6))) grid.moveTo(x, 0).lineTo(x, height);
  for (let y = 0; y <= height; y += Math.max(22, Math.round(height / 4))) grid.moveTo(0, y).lineTo(width, y);
  grid.stroke({color: 0x9d78ff, alpha: 0.12, pixelLine: true});

  const values = scopeValuesByState[state];
  trace.clear();
  values.forEach((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
    const y = Math.max(5, Math.min(height - 5, value * height));
    if (index === 0) trace.moveTo(x, y);
    else trace.lineTo(x, y);
  });
  trace.stroke({color: scopeColorByState[state], width: 1.5});

  scanner.clear().circle(0, 0, 2.5).fill(scopeColorByState[state]);
  scanner.alpha = reducedMotion ? 0.35 : 0.65;
  scanner.y = height * 0.5;
  scanner.x = Math.min(scanner.x || width * 0.18, width);
}

function PixiScope({state, reducedMotion}: {state: LabState; reducedMotion: boolean}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const traceRef = useRef<Graphics | null>(null);
  const scannerRef = useRef<Graphics | null>(null);
  const widthRef = useRef(320);
  const stateRef = useRef(state);
  const reducedMotionRef = useRef(reducedMotion);
  const generationRef = useRef(0);

  stateRef.current = state;
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent)) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const redraw = () => {
      const app = appRef.current;
      const grid = gridRef.current;
      const trace = traceRef.current;
      const scanner = scannerRef.current;
      if (!app || !grid || !trace || !scanner) return;
      const bounds = host.getBoundingClientRect();
      const width = Math.max(240, Math.round(bounds.width || 320));
      const height = Math.max(88, Math.round(bounds.height || 104));
      widthRef.current = width;
      app.renderer.resize(width, height);
      drawScope(grid, trace, scanner, width, height, stateRef.current, reducedMotionRef.current);
    };

    const boot = async () => {
      const next = new Application();
      await next.init({width: 320, height: 104, backgroundAlpha: 0, antialias: true, preference: 'webgl'});
      if (cancelled) {
        next.destroy(true, {children: true});
        return;
      }

      generationRef.current += 1;
      appRef.current = next;
      const grid = new Graphics();
      const trace = new Graphics();
      const scanner = new Graphics();
      gridRef.current = grid;
      traceRef.current = trace;
      scannerRef.current = scanner;
      next.stage.addChild(grid, trace, scanner);

      next.canvas.className = 'ios-pixi-canvas';
      next.canvas.setAttribute('aria-hidden', 'true');
      host.dataset.appGeneration = String(generationRef.current);
      host.replaceChildren(next.canvas);
      redraw();

      next.ticker.add((ticker) => {
        if (reducedMotionRef.current) return;
        scanner.x = (scanner.x + ticker.deltaTime * 0.55) % Math.max(widthRef.current, 1);
      });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(redraw);
        resizeObserver.observe(host);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      appRef.current?.destroy(true, {children: true});
      appRef.current = null;
      gridRef.current = null;
      traceRef.current = null;
      scannerRef.current = null;
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const app = appRef.current;
    const grid = gridRef.current;
    const trace = traceRef.current;
    const scanner = scannerRef.current;
    if (!host || !app || !grid || !trace || !scanner) return;
    const bounds = host.getBoundingClientRect();
    const width = Math.max(240, Math.round(bounds.width || widthRef.current));
    const height = Math.max(88, Math.round(bounds.height || 104));
    drawScope(grid, trace, scanner, width, height, state, reducedMotion);
  }, [state, reducedMotion]);

  return (
    <div
      ref={hostRef}
      className="ios-pixi-host"
      role="img"
      aria-label={`Pixi oscilloscope ${state.toLowerCase()}`}
      data-renderer="pixi"
      data-renderer-lifecycle="retained"
      data-motion-policy={reducedMotion ? 'reduced' : 'full'}
    />
  );
}

function ThreadNode({state}: {state: LabState}) {
  const truth = state === 'SUCCESS' ? 'PROVEN' : state === 'ERROR' ? 'BLOCKED' : state === 'IDLE' ? 'CLAIMED' : 'OBSERVED';
  return <div className="ios-thread" data-truth={truth.toLowerCase()}><div className="ios-thread-line"/><div className="ios-thread-node"><span>07</span></div><div><b>{truth}</b><small>source event / calibration</small></div></div>;
}

function VerifierMachine({state}: {state: LabState}) {
  const result = state === 'SUCCESS' ? 'PROVEN' : state === 'ERROR' ? 'FAILED' : state === 'IDLE' ? 'WAIT' : 'INSPECT';
  return <div className="ios-verifier" data-result={result.toLowerCase()}><div className="ios-verifier-core"><span>VFY</span><i /></div><div className="ios-verifier-copy"><b>{result}</b><small>truth ceiling intact</small></div></div>;
}

function MissionMachine({state}: {state: LabState}) {
  const carriageX = {IDLE: 72, INPUT: 190, ACTIVE: 344, SUCCESS: 568, ERROR: 344}[state];
  const status = state === 'ERROR' ? 'RATCHET JAMMED / BLOCKER' : state === 'SUCCESS' ? 'PROOF RECEIVED / RELEASE' : state === 'IDLE' ? 'RATCHET PARKED' : 'NEXT DETENT // CONNECT SOURCE';
  return (
    <div className="ios-mission" data-state={state.toLowerCase()}>
      <svg className="ios-mission-ratchet" viewBox="0 0 680 230" role="img" aria-label={`Mission ratchet ${state.toLowerCase()}`}>
        <path className="ios-ratchet-spine" d="M46 142 C112 142 112 88 178 88 S244 160 310 160 S376 94 442 94 S508 142 602 142" />
        <path className="ios-ratchet-hook" d="M602 142 C636 142 648 120 634 103 C624 91 610 99 616 110 C620 117 629 112 627 106" />
        <g className="ios-ratchet-detents" aria-hidden="true">
          <path d="M86 116v52"/><path d="M204 72v52"/><path d="M340 132v52"/><path d="M458 66v52"/><path d="M574 116v52"/>
        </g>
        <g className="ios-ratchet-carriage" transform={`translate(${carriageX} 0)`}>
          <path className="ios-ratchet-claw" d="M-24 118 h48 v18 l-10 10 v18 h-28 v-18 l-10-10z" />
          <path className="ios-ratchet-jaw" d="M-10 136 l10 9 10-9" />
          <circle className="ios-ratchet-proof" cx="0" cy="105" r="5" />
        </g>
        {state === 'ERROR' ? <path className="ios-ratchet-break" d="M322 150 l10-17 10 18 10-17 10 16" /> : null}
      </svg>
      <div className="ios-mission-copy">
        <small>CURRENT MISSION // MECHANICAL METAPHOR</small>
        <strong>SHIP THE WEIRD LITTLE THING</strong>
        <span>{status}</span>
      </div>
    </div>
  );
}

export default function InstrumentLab() {
  const [state, setState] = useState<LabState>('ACTIVE');
  const [mode, setMode] = useState('COMMAND');
  const [crtEnabled, setCrtEnabled] = useState(false);
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const observationAge = observationAgeByState[state];

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;

    const pulse = root.querySelector<SVGCircleElement>('.ios-signal-pulse');
    const thread = root.querySelector<HTMLElement>('.ios-thread-node');
    const mission = root.querySelector<SVGGElement>('.ios-ratchet-carriage');
    const verifier = root.querySelector<HTMLElement>('.ios-verifier-core');
    const proof = root.querySelector<SVGCircleElement>('.ios-ratchet-proof');
    if (!pulse || !thread || !mission || !verifier || !proof) return;

    gsap.set([thread, mission, verifier, proof], {clearProps: 'opacity,filter'});
    gsap.set(pulse, {attr: {cx: 8, cy: 58}, opacity: reducedMotion ? 0.6 : 0.22});
    gsap.set(proof, {opacity: state === 'SUCCESS' ? 1 : 0});

    if (reducedMotion) return;

    const timeline = gsap.timeline({defaults: {ease: MOTION_EASE.relay}});
    timeline
      .to(pulse, {attr: {cx: 84, cy: 28}, opacity: 1, duration: MOTION_SECONDS.relay})
      .to(pulse, {attr: {cx: 172, cy: 58}, duration: MOTION_SECONDS.relay})
      .to(pulse, {attr: {cx: 252, cy: 58}, opacity: 0.7, duration: MOTION_SECONDS.relay})
      .fromTo(thread, {scale: 0.84, opacity: 0.45}, {scale: 1, opacity: 1, duration: MOTION_SECONDS.switch}, MOTION_OVERLAP.thread)
      .fromTo(mission, {filter: 'brightness(0.72)'}, {filter: 'brightness(1)', duration: MOTION_SECONDS.mechanical, ease: MOTION_EASE.mechanical}, MOTION_OVERLAP.mission)
      .fromTo(verifier, {scale: 0.92}, {scale: 1, duration: MOTION_SECONDS.relay}, MOTION_OVERLAP.verifier);

    if (state === 'SUCCESS') {
      timeline.fromTo(proof, {scale: 0.4, opacity: 0}, {scale: 1, opacity: 1, duration: MOTION_SECONDS.signal, ease: MOTION_EASE.signal});
    } else if (state === 'ERROR') {
      timeline.fromTo(mission, {x: 0}, {x: 3, duration: MOTION_SECONDS.snap, yoyo: true, repeat: 3, ease: MOTION_EASE.error}, MOTION_OVERLAP.error);
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
      data-crt={crtEnabled ? 'on' : 'off'}
    >
      <div className="ios-crt" aria-hidden="true" />
      <header className="ios-lab-header">
        <div><small>REKT INK(CUBATOR) // 9A</small><h1>INSTRUMENT / MOTION LAB</h1><p>Calibration surface. Synthetic state only — never canonical product truth. Raw UI is reviewed with CRT off.</p></div>
        <div className="ios-lab-controls">
          <div className="ios-state-bank" aria-label="Calibration state selector">{STATES.map((item) => <button key={item} type="button" aria-pressed={state === item} onClick={() => setState(item)}>{item}</button>)}</div>
          <button className="ios-crt-toggle" type="button" aria-pressed={crtEnabled} onClick={() => setCrtEnabled((value) => !value)}>CRT PROTOTYPE {crtEnabled ? 'ON' : 'OFF'}</button>
        </div>
      </header>

      <div className="ios-event-status" aria-live="polite">EVENT // {eventCopyByState[state]} // {reducedMotion ? 'STATIC ACCESSIBLE PROJECTION' : 'CAUSAL MOTION ACTIVE'}</div>

      <section className="ios-chassis">
        <nav className="ios-mode-rail" aria-label="Instrument mode selector">
          <span className="ios-rail-label">MODE</span>
          {['WORLD','COMMAND','PROJECT','PLAYER','SHIP'].map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}><span>{item.slice(0, 1)}</span><b>{item}</b></button>)}
          <span className="ios-rail-tail">OS/01</span>
        </nav>

        <section className="ios-console" aria-label="Instrument primitives">
          <div className="ios-bus-label" aria-hidden="true">CALIBRATION BED // RAW</div>
          <Frame code="10" title="MISSION MACHINE" zone="mission"><MissionMachine state={state}/></Frame>
          <Frame code="01" title="SIGNAL PATH" zone="signal"><SignalPath state={state}/><p>Input → relay → projection. Motion is triggered by the selected event transition.</p></Frame>
          <Frame code="04" title="NUMERIC READOUT" zone="readout"><div className="ios-readout"><small>LAST RX AGE</small><strong>{observationAge.value}</strong><span>{observationAge.unit} // SYNTHETIC OBSERVATION AGE</span></div></Frame>
          <Frame code="09" title="VERIFIER MACHINE" zone="verifier"><VerifierMachine state={state}/></Frame>
          <Frame code="06" title="THREAD NODE" zone="thread"><ThreadNode state={state}/></Frame>
          <Frame code="03" title="OSCILLOSCOPE" zone="scope"><PixiScope state={state} reducedMotion={reducedMotion}/><div className="ios-caption"><span>RX TRACE / PIXI</span><b>{scopeValuesByState[state].length} SAMPLES</b></div></Frame>
          <Frame code="07" title="REKT SPRITE" zone="rekt"><RektSpriteBoundary state={state}/></Frame>
          <Frame code="02" title="ROTARY / GAUGE" zone="rotary"><Rotary state={state}/></Frame>
          <Frame code="05" title="MODE SWITCH" zone="mode"><div className="ios-mode-demo"><b>{mode}</b><span>one machine / five lenses</span></div></Frame>
          <Frame code="08" title="CRT MATERIAL" zone="crt"><div className="ios-crt-demo"><div className="ios-crt-raw">RAW UI / REVIEW TARGET</div><div className="ios-crt-treated">PROTOTYPE MATERIAL / OPTIONAL</div></div></Frame>
        </section>
      </section>

      <footer className="ios-lab-footer"><span>GSAP // SEMANTIC EVENT CHOREOGRAPHY</span><span>PIXI // RETAINED 2D RENDERER</span><span>TANSTACK // INSTALLED / DOWNSTREAM GATED</span></footer>
    </main>
  );
}
