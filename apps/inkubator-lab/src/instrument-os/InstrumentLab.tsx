import {useMemo, useState} from 'react';
import './instrument-os.css';

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

const scopePathByState: Record<LabState, string> = {
  IDLE: 'M0 40 L240 40',
  INPUT: 'M0 40 L28 40 L42 28 L58 52 L74 40 L240 40',
  ACTIVE: 'M0 40 L22 40 L38 12 L54 66 L70 25 L90 54 L108 18 L128 62 L148 30 L166 48 L186 20 L204 58 L222 40 L240 40',
  SUCCESS: 'M0 40 L42 40 L58 24 L76 54 L96 30 L118 48 L140 22 L164 40 L240 40',
  ERROR: 'M0 40 L54 40 L68 10 L82 70 L96 14 L112 66 L128 40 L240 40',
};

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
  return <svg className="ios-signal" data-state={state.toLowerCase()} viewBox="0 0 260 86" aria-label={`Signal path ${state.toLowerCase()}`}><path d="M8 58 H64 L84 28 H150 L172 58 H252"/><circle cx="8" cy="58" r="4"/><circle cx="252" cy="58" r="4"/><circle className="ios-signal-pulse" cx="84" cy="28" r="5"/></svg>;
}

function Rotary({state}: {state: LabState}) {
  const angle = {IDLE: -120, INPUT: -68, ACTIVE: 10, SUCCESS: 118, ERROR: 150}[state];
  return <div className="ios-rotary" style={{'--angle': `${angle}deg`} as React.CSSProperties}><div className="ios-rotary-ring"><div className="ios-rotary-knob"><i /></div></div><span>GAIN / {state}</span></div>;
}

function Scope({state}: {state: LabState}) {
  return <svg className="ios-scope" viewBox="0 0 240 80" aria-label={`Oscilloscope ${state.toLowerCase()}`}><g className="grid"><path d="M0 20H240M0 40H240M0 60H240M40 0V80M80 0V80M120 0V80M160 0V80M200 0V80"/></g><path className="trace" d={scopePathByState[state]}/></svg>;
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
  const stateIndex = useMemo(() => STATES.indexOf(state), [state]);

  return (
    <main className="ios-lab" data-state={state.toLowerCase()} data-mode={mode.toLowerCase()}>
      <div className="ios-crt" aria-hidden="true" />
      <header className="ios-lab-header">
        <div><small>REKT INK(CUBATOR) // 9A</small><h1>INSTRUMENT / MOTION LAB</h1><p>Calibration surface. Synthetic state only — never canonical product truth.</p></div>
        <div className="ios-state-bank" aria-label="Calibration state selector">{STATES.map((item) => <button key={item} type="button" aria-pressed={state === item} onClick={() => setState(item)}>{item}</button>)}</div>
      </header>

      <section className="ios-chassis">
        <nav className="ios-mode-rail" aria-label="Instrument mode selector">
          <span className="ios-rail-label">MODE</span>
          {['WORLD','COMMAND','PROJECT','PLAYER','SHIP'].map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}><span>{item.slice(0, 1)}</span><b>{item}</b></button>)}
          <span className="ios-rail-tail">OS/01</span>
        </nav>

        <section className="ios-console" aria-label="Instrument primitives">
          <div className="ios-bus-label" aria-hidden="true">SIGNAL BUS // A</div>
          <Frame code="10" title="MISSION MACHINE" zone="mission"><MissionMachine state={state}/></Frame>
          <Frame code="01" title="SIGNAL PATH" zone="signal"><SignalPath state={state}/><p>Input → relay → projection. Motion represents causality.</p></Frame>
          <Frame code="04" title="NUMERIC READOUT" zone="readout"><div className="ios-readout"><small>TRUTH CONFIDENCE</small><strong>{readoutByState[state]}</strong><span>{state}</span></div></Frame>
          <Frame code="09" title="VERIFIER MACHINE" zone="verifier"><VerifierMachine state={state}/></Frame>
          <Frame code="06" title="THREAD NODE" zone="thread"><ThreadNode state={state}/></Frame>
          <Frame code="03" title="OSCILLOSCOPE" zone="scope"><Scope state={state}/><div className="ios-caption"><span>RX TRACE</span><b>{stateIndex + 1}.0 kHz</b></div></Frame>
          <Frame code="07" title="REKT SPRITE" zone="rekt"><RektSprite state={state}/></Frame>
          <Frame code="02" title="ROTARY / GAUGE" zone="rotary"><Rotary state={state}/></Frame>
          <Frame code="05" title="MODE SWITCH" zone="mode"><div className="ios-mode-demo"><b>{mode}</b><span>one machine / five lenses</span></div></Frame>
          <Frame code="08" title="CRT MATERIAL" zone="crt"><div className="ios-crt-demo"><div className="ios-crt-raw">RAW SIGNAL</div><div className="ios-crt-treated">DISPLAY SIGNAL</div></div></Frame>
        </section>
      </section>

      <footer className="ios-lab-footer"><span>RAW UI MUST WORK WITH CRT OFF</span><span>CLAIMED ≠ OBSERVED ≠ PROVEN</span><span>AMBIENT QUIET / EVENT PRECISE / PROOF RARE</span></footer>
    </main>
  );
}
