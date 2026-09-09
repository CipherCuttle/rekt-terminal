import type {ReactNode} from 'react';
import {ReferenceOverlay} from './ReferenceOverlay';
import './instrument-v2.css';
import './instrument-v2-calibration.css';

const metrics = [
  ['1,337', 'ACTIVE PLAYERS'],
  ['420', 'PROJECTS'],
  ['69', 'LIVE BUILDS'],
  ['∞', 'POTENTIAL'],
] as const;

const threads = [
  {score: '128', name: 'REKT Names', detail: 'Onchain identity layer for the next wave.', tags: ['identity', 'ens', 'onchain'], author: '0xLemon', time: '2h ago', comments: 32, tone: 'violet'},
  {score: '96', name: 'SquidPay', detail: 'A simple onchain payment rail for creators.', tags: ['payments', 'infra', 'build'], author: 'tidal.kev', time: '5h ago', comments: 18, tone: 'mint'},
  {score: '64', name: 'REKT AI Toolkit', detail: 'Open tools for autonomous onchain agents.', tags: ['ai', 'agent', 'opensource'], author: 'rektlab', time: '8h ago', comments: 27, tone: 'black'},
  {score: '51', name: 'Guild Launcher', detail: 'Template for community-owned squads.', tags: ['dao', 'governance', 'template'], author: '0xmarie', time: '1d ago', comments: 14, tone: 'paper'},
  {score: '42', name: 'Onchain Games Index', detail: 'Tracking the next wave of real games.', tags: ['gaming', 'index', 'tools'], author: 'playrekt', time: '1d ago', comments: 11, tone: 'violet'},
] as const;

function Screw({className = ''}: {className?: string}) {
  return <i className={`iv2-screw ${className}`} aria-hidden="true" />;
}

function SegmentBars({tone = 'cyan', count = 9}: {tone?: 'cyan' | 'orange' | 'violet'; count?: number}) {
  return (
    <span className="iv2-segments" data-tone={tone} aria-hidden="true">
      {Array.from({length: count}, (_, index) => <i key={index} style={{opacity: Math.max(.13, 1 - index * .085)}} />)}
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
    <svg className="iv2-fish" viewBox="0 0 620 280" role="img" aria-label="REKT swordfish diagnostic display">
      <g className="iv2-gridlines">
        {Array.from({length: 13}, (_, i) => <line key={`v-${i}`} x1={24 + i * 48} y1="18" x2={24 + i * 48} y2="260" />)}
        {Array.from({length: 7}, (_, i) => <line key={`h-${i}`} x1="18" y1={24 + i * 38} x2="602" y2={24 + i * 38} />)}
      </g>
      <g className="iv2-fish-lines">
        <path d="M73 149 C147 127 215 105 279 99 C341 93 392 103 443 121 C484 135 520 143 570 146" />
        <path d="M73 149 C151 160 217 171 286 171 C345 171 396 159 446 151 C493 143 528 144 570 146" />
        <path d="M75 149 L22 149 L112 132" /><path d="M75 149 L22 149 L111 166" />
        <path d="M279 99 C286 57 314 29 358 17 C348 61 358 83 390 105" />
        <path d="M287 171 C307 214 338 239 383 251 C370 212 382 183 411 160" />
        <path d="M443 121 C481 91 527 78 583 90 C548 112 529 130 510 146" />
        <path d="M446 151 C489 171 526 190 583 199 C553 173 536 159 510 146" />
        <path d="M463 120 C488 112 512 113 535 120" /><path d="M467 130 C494 124 521 126 545 134" />
        <circle cx="242" cy="136" r="31" /><circle cx="242" cy="136" r="9" />
        <path d="M278 125 C315 113 352 113 390 125" /><path d="M279 148 C317 160 354 161 392 151" />
        <path d="M286 112 C316 98 350 97 379 106" /><path d="M288 160 C317 171 348 172 379 165" />
        <path d="M397 114 C416 111 432 115 449 123" /><path d="M401 159 C420 162 435 159 452 151" />
      </g>
      <g className="iv2-fish-accent">
        <circle cx="335" cy="140" r="17" /><circle cx="335" cy="140" r="5" />
        <path d="M321 113 l8 -21 M338 112 l7 -21 M355 116 l12 -18" />
        <path d="M326 166 l3 20 M342 166 l6 20 M357 162 l13 17" />
      </g>
      <g className="iv2-crosses">
        <path d="M145 63v19M135 72h20M506 62v19M496 71h20M157 219v19M147 228h20M523 217v19M513 226h20" />
      </g>
    </svg>
  );
}

function Header() {
  return (
    <header className="iv2-topbar">
      <div className="iv2-brand"><strong>REKT</strong><span>INKUBATOR</span></div>
      <div className="iv2-mantra">IDEAS&nbsp; ›<br />BUILD&nbsp;&nbsp; ›<br />ONCHAIN ›</div>
      <nav className="iv2-topnav" aria-label="Calibration navigation"><b>PLAYER</b><span>EXPLORE</span><span>DOCS</span><span>COMMUNITY</span></nav>
      <div className="iv2-wallet"><span className="iv2-search">⌕</span><i>▣</i><strong>0x7a3…9f2</strong><small>REKTOR</small><em aria-hidden="true" /></div>
    </header>
  );
}

function Rail() {
  const items = [['PLAYER', 'BUILD MODE', '●'], ['THREADS', 'IDEAS & DISCUSSION', '↝'], ['BUILD', 'TOOLS & DEPLOY', '▰'], ['SOURCE', 'CODE & RESOURCES', '▤'], ['COLLECT', 'ASSETS & NFTS', '◇'], ['PROFILE', 'STATS & IDENTITY', '♙']];
  return (
    <aside className="iv2-rail">
      {items.map(([label, meta, glyph], index) => <button key={label} className={index === 0 ? 'is-active' : ''}><span>{glyph}</span><b>{label}</b><small>// {meta}</small></button>)}
      <div className="iv2-rail-copy">SAME<br />DEGENS<br />HIGHER<br />PURPOSE<i /></div>
      <div className="iv2-rail-version">REKT INKUBATOR<br />V2.0.0</div>
      <div className="iv2-barcode" aria-hidden="true" />
      <small className="iv2-fixture-note">IDEAS COMPOUND.<br />PEOPLE BUILD.<br />ONCHAIN FOREVER.</small>
    </aside>
  );
}

function HeroCathode() {
  return (
    <CathodeWell title="REKT.LIVE" kicker="// ECOSYSTEM SCAN" className="iv2-hero-crt">
      <div className="iv2-hero-crt-body">
        <div className="iv2-crt-left-copy">BUILD<br />DISCUSS<br />DEPLOY<br />REPEAT<span>┊</span></div>
        <SwordfishDiagnostic />
        <div className="iv2-crt-readouts">
          <span>SIGNAL</span><SegmentBars />
          <span>COMMUNITY</span><div className="iv2-mini-wave" aria-hidden="true" />
          <span>CREATIVITY</span><SegmentBars tone="violet" count={8} />
          <span>DEGEN FUEL</span><SegmentBars tone="orange" count={9} />
        </div>
      </div>
      <footer className="iv2-crt-footer"><span className="iv2-cyan-bars" /><b>ALL SYSTEMS GO</b><i /></footer>
    </CathodeWell>
  );
}

function Intro() {
  return (
    <section className="iv2-intro iv2-panel">
      <Screw className="iv2-screw-tr" />
      <div className="iv2-title-row"><h1>PLAYER</h1><span className="iv2-slashes"><i /><i /></span></div>
      <h2>IDEAS TO ONCHAIN.</h2>
      <p>A playground for degens, creators and technologists to turn ideas into reality.<br />Discuss. Build. Ship. Onchain.</p>
      <div className="iv2-dotfield" aria-hidden="true" />
      <div className="iv2-compound-copy">IDEAS<br />COMPOUND<br />DIFFERENTLY<br />HERE.<i /></div>
      <div className="iv2-metrics">{metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <small className="iv2-cal-note">ART CALIBRATION FIXTURE — VALUES ARE NOT PRODUCT TRUTH</small>
    </section>
  );
}

function NetworkDisplay() {
  return (
    <CathodeWell title="NETWORK" kicker="LIVE" className="iv2-network-crt">
      <svg className="iv2-network" viewBox="0 0 320 170" aria-hidden="true">
        <g className="iv2-network-lines">
          <path d="M20 100 C55 53 88 46 130 82 S204 124 297 53" />
          <path d="M32 62 C79 97 106 108 148 84 S221 46 290 91" />
          <path d="M40 125 C91 120 122 92 164 98 S233 126 280 112" />
        </g>
        {[['41','109'],['91','73'],['135','89'],['173','101'],['218','71'],['266','94'],['284','52']].map(([x,y], i) => <g key={i}><circle className="iv2-network-node-halo" cx={x} cy={y} r="8" /><circle className="iv2-network-node" cx={x} cy={y} r="2.7" /></g>)}
        <path className="iv2-network-outline" d="M20 91 L51 64 75 72 97 51 120 64 146 57 172 71 196 61 228 77 250 65 294 80 283 109 254 117 234 104 207 122 172 112 148 128 119 114 91 123 65 108 39 117Z" />
      </svg>
      <div className="iv2-network-stats"><span>NODES <b>42</b></span><span>PEERS <b>1,208</b></span><span>LATENCY <b>36ms</b></span><div className="iv2-eq" /></div>
    </CathodeWell>
  );
}

function SignalAnalysis() {
  return (
    <CathodeWell title="SIGNAL ANALYSIS" kicker="LIVE" className="iv2-analysis-crt">
      <div className="iv2-analysis-body">
        <svg viewBox="0 0 210 105" aria-hidden="true">
          <g className="iv2-scope-grid"><path d="M0 21H210M0 42H210M0 63H210M0 84H210M42 0V105M84 0V105M126 0V105M168 0V105" /></g>
          <path className="iv2-wave-a" d="M2 61 C15 13 29 89 43 47 S69 28 84 57 S110 87 126 40 S153 17 169 58 S194 83 208 39" />
          <path className="iv2-wave-b" d="M2 69 C18 53 31 57 46 67 S74 73 87 61 S116 50 132 62 S162 74 178 60 S197 49 208 54" />
        </svg>
        <dl><div><dt>AMP</dt><dd>1.0</dd></div><div><dt>FREQ</dt><dd>440</dd></div><div><dt>PHASE</dt><dd>0.12</dd></div></dl>
      </div>
      <div className="iv2-analysis-footer"><span>IDEA ACTIVITY</span><div className="iv2-eq wide" /><span>EXCITEMENT</span><SegmentBars tone="orange" count={11} /></div>
    </CathodeWell>
  );
}

function SystemStatus() {
  return (
    <CathodeWell title="SYSTEM STATUS" kicker="ONLINE" className="iv2-status-crt">
      <div className="iv2-status-body">
        <div className="iv2-system-list"><span>API <b>OK</b></span><span>INDEXER <b>OK</b></span><span>STORAGE <b>OK</b></span><span>BUILDER <b>OK</b></span><span>BRIDGE <b>OK</b></span></div>
        <div className="iv2-uptime"><small>UPTIME</small><strong>99.99%</strong><svg viewBox="0 0 120 52" aria-hidden="true"><path d="M3 45L27 29 56 29 78 28 82 20 117 6" /></svg><em>KEEP BUILDING.</em></div>
      </div>
    </CathodeWell>
  );
}

function RightRail() {
  return <aside className="iv2-right-rail"><NetworkDisplay /><SignalAnalysis /><SystemStatus /><div className="iv2-right-stamp"><span className="iv2-stripes" /><b>REKT INKUBATOR</b><small>40.7128° N · 74.0060° W</small><em>A BRIGHTER<br />ONCHAIN<br />TOMORROW</em></div></aside>;
}

function ThreadWorkspace() {
  return (
    <section className="iv2-panel iv2-thread-workspace">
      <header className="iv2-thread-head">
        <div className="iv2-thread-icon">≋</div><div><h3>BUILD THREAD</h3><span>IDEAS&nbsp; › &nbsp;ITERATION&nbsp; › &nbsp;DEPLOYMENT</span></div>
        <select aria-label="Sort thread fixture" defaultValue="latest"><option value="latest">LATEST</option></select>
        <button type="button">＋&nbsp; NEW THREAD</button>
      </header>
      <nav className="iv2-thread-tabs" aria-label="Thread fixture filters"><b>ALL</b><span>IDEAS</span><span>BUILDS</span><span>UPDATES</span><span>DISCUSSIONS</span></nav>
      <div className="iv2-thread-list">
        {threads.map((thread) => (
          <article key={thread.name}>
            <div className="iv2-score"><span>▲</span><b>{thread.score}</b></div>
            <i className="iv2-thread-avatar" data-tone={thread.tone}>{thread.name.slice(0, 1)}</i>
            <div className="iv2-thread-copy"><strong>{thread.name}</strong><p>{thread.detail}</p><div>{thread.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></div>
            <div className="iv2-thread-author"><span>by {thread.author}</span><time>{thread.time}</time></div>
            <div className="iv2-thread-comments">▢ {thread.comments}</div><button className="iv2-thread-more" type="button" aria-label={`More actions for ${thread.name}`}>•••</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Featured() {
  return <section className="iv2-featured iv2-panel"><header><span>★</span><b>FEATURED</b><em>›</em></header><div><strong>BUILD<br />A MORE<br />OPEN FUTURE.</strong><i>// —</i><svg viewBox="0 0 200 105" aria-hidden="true"><ellipse cx="128" cy="51" rx="61" ry="31" /><path d="M68 51h121M81 33h96M81 69h96M128 20v62M101 23c17 16 18 45 0 59M155 23c-17 16-18 45 0 59" /></svg></div></section>;
}

function MobileSupport() {
  return <div className="iv2-mobile-support"><SignalAnalysis /><Featured /></div>;
}

function MobileDock() {
  return <nav className="iv2-mobile-dock" aria-label="Mobile calibration modes">{[['PLAYER','●'],['THREADS','▢'],['BUILD','◩'],['COLLECT','◇'],['PROFILE','♙']].map(([item,glyph], index) => <button className={index === 0 ? 'is-active' : ''} key={item}><span>{glyph}</span>{item}</button>)}</nav>;
}

export default function InstrumentV2Lab() {
  return (
    <main className="iv2-page">
      <div className="iv2-reference-stage">
        <div className="iv2-machine">
          <Header />
          <div className="iv2-layout">
            <Rail />
            <div className="iv2-content-grid">
              <div className="iv2-primary-column">
                <div className="iv2-upper"><HeroCathode /><Intro /></div>
                <ThreadWorkspace />
                <MobileSupport />
              </div>
              <RightRail />
            </div>
          </div>
          <footer className="iv2-footer"><span className="iv2-stripes" /><b>REKT INKUBATOR</b><small>40.7128° N · 74.0060° W</small><em>PEOPLE BUILD BETTER TOMORROWS ONCHAIN.</em><div className="iv2-barcode" /></footer>
          <MobileDock />
        </div>
        <ReferenceOverlay />
      </div>
    </main>
  );
}
