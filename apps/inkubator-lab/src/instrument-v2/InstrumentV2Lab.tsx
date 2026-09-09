import type {ReactNode} from 'react';
import './instrument-v2.css';

const metrics = [
  ['04', 'BUILDS'],
  ['07', 'OBSERVED'],
  ['03', 'THREADS'],
  ['—', 'PROVEN'],
] as const;

const builds = [
  {name: 'Qnty', detail: 'Observed repository window', age: 'APR', state: 'OBSERVED'},
  {name: 'QntyLab', detail: 'Observed repository window', age: 'JUN', state: 'OBSERVED'},
  {name: 'rekt-terminal', detail: 'Selected build context', age: 'SEP', state: 'ACTIVE'},
] as const;

function Screw({className = ''}: {className?: string}) {
  return <i className={`iv2-screw ${className}`} aria-hidden="true" />;
}

function SegmentBars({tone = 'cyan', count = 9}: {tone?: 'cyan' | 'orange' | 'violet'; count?: number}) {
  return (
    <span className="iv2-segments" data-tone={tone} aria-hidden="true">
      {Array.from({length: count}, (_, index) => <i key={index} style={{opacity: Math.max(.16, 1 - index * .08)}} />)}
    </span>
  );
}

function CathodeWell({title, kicker, children, className = ''}: {title: string; kicker: string; children: ReactNode; className?: string}) {
  return (
    <section className={`iv2-cathode ${className}`}>
      <Screw className="iv2-screw-tl" /><Screw className="iv2-screw-tr" /><Screw className="iv2-screw-bl" /><Screw className="iv2-screw-br" />
      <div className="iv2-cathode-scan" aria-hidden="true" />
      <header className="iv2-cathode-head"><strong>{title}</strong><span>{kicker}</span></header>
      {children}
    </section>
  );
}

function SwordfishDiagnostic() {
  return (
    <svg className="iv2-fish" viewBox="0 0 560 250" role="img" aria-label="Swordfish diagnostic display">
      <g className="iv2-gridlines">
        {Array.from({length: 12}, (_, i) => <line key={`v-${i}`} x1={24 + i * 46} y1="18" x2={24 + i * 46} y2="232" />)}
        {Array.from({length: 6}, (_, i) => <line key={`h-${i}`} x1="18" y1={30 + i * 38} x2="542" y2={30 + i * 38} />)}
      </g>
      <g className="iv2-fish-lines">
        <path d="M58 137 C128 118 186 97 246 90 C302 83 349 95 397 111 C438 124 470 130 514 132" />
        <path d="M58 137 C132 148 185 158 251 159 C311 160 355 148 401 139 C446 130 478 130 514 132" />
        <path d="M58 137 L20 137 L94 124" />
        <path d="M58 137 L20 137 L95 151" />
        <path d="M245 90 C251 53 273 31 316 20 C305 56 316 79 345 95" />
        <path d="M255 159 C270 194 300 216 339 224 C330 193 339 169 365 151" />
        <path d="M397 111 C430 83 473 71 520 82 C491 103 475 119 460 132" />
        <path d="M401 139 C441 158 472 174 522 182 C497 158 484 146 460 132" />
        <path d="M416 112 C439 105 461 106 481 112" />
        <path d="M421 120 C445 116 468 118 490 124" />
        <circle cx="212" cy="121" r="29" />
        <circle cx="212" cy="121" r="8" />
        <path d="M243 112 C279 101 314 101 346 112" />
        <path d="M245 132 C281 145 315 146 348 136" />
        <path d="M252 101 C279 88 310 87 334 95" />
        <path d="M252 146 C280 156 309 157 335 151" />
        <path d="M352 102 C371 99 388 104 405 112" />
        <path d="M356 145 C373 148 391 145 406 139" />
      </g>
      <g className="iv2-fish-accent">
        <circle cx="297" cy="126" r="16" />
        <circle cx="297" cy="126" r="5" />
        <path d="M287 100 l9 -20 M302 99 l7 -19 M316 103 l12 -17" />
        <path d="M290 151 l3 20 M305 151 l6 19 M319 146 l12 17" />
      </g>
      <g className="iv2-crosses">
        <path d="M125 58v18M116 67h18M454 57v18M445 66h18M136 194v18M127 203h18M470 194v18M461 203h18" />
      </g>
    </svg>
  );
}

function TinyScope({label = 'SIGNAL'}: {label?: string}) {
  return (
    <div className="iv2-tiny-scope">
      <div className="iv2-scope-label"><span>{label}</span><b>LIVE</b></div>
      <svg viewBox="0 0 220 82" aria-hidden="true">
        <path className="iv2-wave-a" d="M2 46 C18 16 32 72 48 42 S78 21 94 43 S126 67 142 36 S174 18 190 43 S208 61 218 35" />
        <path className="iv2-wave-b" d="M2 58 C20 44 32 49 48 56 S80 61 94 50 S122 41 140 51 S172 63 188 48 S207 38 218 44" />
      </svg>
    </div>
  );
}

function Header() {
  return (
    <header className="iv2-topbar">
      <div className="iv2-brand"><strong>REKT</strong><span>INKUBATOR</span></div>
      <div className="iv2-mantra">IDEAS ›<br />BUILD ›<br />ONCHAIN ›</div>
      <nav className="iv2-topnav" aria-label="Calibration navigation"><b>PLAYER</b><span>EXPLORE</span><span>DOCS</span><span>COMMUNITY</span></nav>
      <div className="iv2-wallet"><span className="iv2-search">⌕</span><i>◈</i><strong>0x7a3…9f2</strong><small>CALIBRATION</small></div>
    </header>
  );
}

function Rail() {
  const items = [['PLAYER', 'BUILD MODE'], ['THREADS', 'IDEAS & DISCUSSION'], ['BUILD', 'TOOLS & DEPLOY'], ['SOURCE', 'CODE & RESOURCES'], ['COLLECT', 'ASSETS'], ['PROFILE', 'IDENTITY']];
  return (
    <aside className="iv2-rail">
      {items.map(([label, meta], index) => <button key={label} className={index === 0 ? 'is-active' : ''}><span>{index === 0 ? '●' : '○'}</span><b>{label}</b><small>// {meta}</small></button>)}
      <div className="iv2-rail-copy">SAME<br />DEGENS<br />HIGHER<br />PURPOSE<i /></div>
      <div className="iv2-barcode" aria-hidden="true" />
      <small className="iv2-fixture-note">ART REFERENCE<br />CALIBRATION ONLY</small>
    </aside>
  );
}

function HeroCathode() {
  return (
    <CathodeWell title="REKT.LIVE" kicker="// ECOSYSTEM SCAN" className="iv2-hero-crt">
      <div className="iv2-hero-crt-body">
        <div className="iv2-crt-left-copy">BUILD<br />DISCOVER<br />DEPLOY<br />REPEAT<span>—</span></div>
        <SwordfishDiagnostic />
        <div className="iv2-crt-readouts">
          <span>SIGNAL</span><SegmentBars />
          <span>CREATIVITY</span><SegmentBars tone="violet" count={7} />
          <span>ACTIVITY</span><SegmentBars tone="orange" count={8} />
          <small>OBSERVED INPUTS</small>
        </div>
      </div>
      <footer className="iv2-crt-footer"><span className="iv2-cyan-bars" /> <b>INPUTS ONLINE</b><i /></footer>
    </CathodeWell>
  );
}

function Intro() {
  return (
    <section className="iv2-intro iv2-panel">
      <Screw className="iv2-screw-tr" />
      <div className="iv2-title-row"><h1>PLAYER</h1><span className="iv2-slashes"><i /><i /></span></div>
      <h2>BUILDER RECORD.</h2>
      <p>A durable builder dossier rendered as an industrial software instrument. Activity, evidence and project context stay visually distinct.</p>
      <div className="iv2-dotfield" aria-hidden="true" />
      <div className="iv2-metrics">{metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    </section>
  );
}

function ProfileCard() {
  return (
    <section className="iv2-panel iv2-profile-card">
      <header><b>BUILDER RECORD</b><small>OBSERVED PROJECTION</small></header>
      <div className="iv2-profile-body">
        <div className="iv2-avatar">R</div>
        <div><strong>CIPHERCUTTLE</strong><p>Current prototype identity. Durable work evidence only; no inferred trust or XP.</p></div>
      </div>
      <dl>
        <div><dt>CURRENT CONTEXT</dt><dd>rekt-terminal</dd></div>
        <div><dt>TRUTH CEILING</dt><dd>OBSERVED</dd></div>
        <div><dt>PROVEN RECORD</dt><dd>NOT CONNECTED</dd></div>
      </dl>
    </section>
  );
}

function BuildList() {
  return (
    <section className="iv2-panel iv2-build-list">
      <header><b>BUILD THREAD</b><small>CHRONOLOGICAL / NON-ANCESTRY</small></header>
      {builds.map((build) => <article key={build.name}>
        <time>{build.age}</time><i data-state={build.state} /><div><strong>{build.name}</strong><span>{build.detail}</span></div><em>{build.state}</em>
      </article>)}
    </section>
  );
}

function RightRail() {
  return (
    <div className="iv2-right-rail">
      <CathodeWell title="SIGNAL ANALYSIS" kicker="OBSERVED"><TinyScope label="REPO PULSE" /></CathodeWell>
      <CathodeWell title="SOURCE VERIFY" kicker="TRUTH"><div className="iv2-checks"><span>ORIGIN <b>KNOWN</b></span><span>INPUT <b>OBSERVED</b></span><span>PROOF <b>—</b></span><span>STATUS <b>CALIBRATION</b></span></div></CathodeWell>
      <CathodeWell title="SELECTED BUILD" kicker="CONTEXT"><div className="iv2-selected"><svg viewBox="0 0 180 72" aria-hidden="true"><rect x="22" y="18" width="116" height="38" rx="5" /><path d="M32 26h78M32 34h62M32 42h88M145 25l13 12-13 12" /></svg><strong>REKT-TERMINAL</strong><span>OBSERVED CONTEXT</span></div></CathodeWell>
    </div>
  );
}

function MobileDock() {
  return <nav className="iv2-mobile-dock" aria-label="Mobile calibration modes">{['PLAYER', 'THREADS', 'BUILD', 'COLLECT', 'PROFILE'].map((item, index) => <button className={index === 0 ? 'is-active' : ''} key={item}><span>{index === 0 ? '●' : '□'}</span>{item}</button>)}</nav>;
}

export default function InstrumentV2Lab() {
  return (
    <main className="iv2-page">
      <div className="iv2-machine">
        <Header />
        <div className="iv2-layout">
          <Rail />
          <div className="iv2-main">
            <div className="iv2-upper"><HeroCathode /><Intro /><RightRail /></div>
            <div className="iv2-lower"><ProfileCard /><BuildList /><div className="iv2-mobile-only"><RightRail /></div></div>
          </div>
        </div>
        <footer className="iv2-footer"><b>REKT INKUBATOR</b><span>INSTRUMENT OS V2 / ART CALIBRATION</span><div className="iv2-barcode" /></footer>
        <MobileDock />
      </div>
    </main>
  );
}
