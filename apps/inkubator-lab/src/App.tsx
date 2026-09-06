import {useState, type ReactNode} from 'react';

type LoopStep = {index: string; title: string; detail: string};

const loop: LoopStep[] = [
  {index: '01', title: 'CHALLENGE', detail: 'Pick a weird constraint.'},
  {index: '02', title: 'SHIP', detail: 'Put a live URL in the room.'},
  {index: '03', title: 'FLEX', detail: 'Clip it. Post it. Let it travel.'},
  {index: '04', title: 'REWARD', detail: 'Money, status, access, lore.'},
  {index: '05', title: 'REPEAT', detail: 'Make shipping the culture.'},
];

const subjects = [
  ['001', 'AI / VIBE CODER', 'INVITED'],
  ['002', 'INDIE GAME DEV', 'INVITED'],
  ['003', 'CREATIVE CODER', 'INVITED'],
  ['004', 'INK / ONCHAIN DEV', 'INVITED'],
  ['005', 'SHITPOSTER WHO CODES', 'INVITED'],
  ['006', 'ARTIST WHO PROTOTYPES', 'INVITED'],
  ['007', 'OPEN-SOURCE TINKERER', 'INVITED'],
  ['008', 'WILDCARD WEIRDO', 'INVITED'],
  ['009', 'PUBLIC WILDCARD', 'OPEN'],
  ['010', 'PUBLIC WILDCARD', 'OPEN'],
];

function Label({children, tone = ''}: {children: ReactNode; tone?: string}) {
  return <span className={`label ${tone}`}>{children}</span>;
}

function DossierHeader() {
  return (
    <header className="instrument-header">
      <a className="brand-lockup" href="#top" aria-label="REKT INK(CUBATOR) home">
        <span>REKT</span><b>INK(CUBATOR)</b>
      </a>
      <div className="header-readout"><span>TRANSMISSION</span><strong>000</strong><i>LIVE</i></div>
      <div className="header-meta"><span>INK NATIVE / BUILD CULTURE</span><span>NO DECKS</span></div>
    </header>
  );
}

function ArtifactBay() {
  return (
    <div className="artifact-bay" aria-label="REKT INK specimen display">
      <div className="bay-corner bay-corner-tl" /><div className="bay-corner bay-corner-tr" />
      <div className="bay-corner bay-corner-bl" /><div className="bay-corner bay-corner-br" />
      <div className="artifact-meta artifact-meta-top"><span>SPECIMEN / 000</span><span>REKT INK</span></div>
      <div className="artifact-stack"><span className="artifact-shadow" /><img src="./rekt-512.svg" alt="REKT INK mark" /><span className="artifact-scan" /></div>
      <div className="artifact-caption"><span>OBJECT STATUS</span><strong>UNRELEASED CULTURE</strong><i>HANDLE WITH DISRESPECT</i></div>
      <div className="artifact-meta artifact-meta-bottom"><span>FIELD NOTE 01</span><span>BAD IDEAS / WORKING SOFTWARE</span></div>
    </div>
  );
}

function SignalLoop() {
  const [active, setActive] = useState(1);
  const current = loop[active];

  return (
    <div className="signal-loop">
      <div className="loop-tabs" role="list" aria-label="REKT build loop">
        {loop.map((step, index) => (
          <div className="loop-item" key={step.index} role="listitem">
            <button className={active === index ? 'is-active' : ''} type="button" onClick={() => setActive(index)}>
              <span>{step.index}</span><strong>{step.title}</strong>
            </button>
          </div>
        ))}
      </div>
      <div className="loop-readout" aria-live="polite">
        <Label tone="acid">NOW TRANSMITTING</Label>
        <strong>{current.title}</strong>
        <p>{current.detail} The only metric that matters is whether somebody shipped.</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <main className="dossier" id="top">
      <div className="ambient-field" aria-hidden="true" />
      <DossierHeader />

      <section className="hero-dossier" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="status-line"><span className="status-dot" /> ROUND 000 / COMMUNITY BUILD EXPERIMENT</div>
          <Label tone="acid">REKT INK(CUBATOR) / BROADCAST DOSSIER</Label>
          <h1 id="hero-title">MAKE <em>DEGENS</em> SHIP.</h1>
          <p className="hero-lede">Bad ideas. Working software. A seven-day transmission for people who would rather release a strange little thing than explain a pitch deck.</p>
          <div className="hero-actions"><a className="action-primary" href="#signal">ENTER THE DOSSIER <span>↓</span></a><span className="action-note">WORKING URL OR GTFO</span></div>
          <div className="hero-foot"><span>7 DAYS</span><span>8 INVITED</span><span>2 WILDCARDS</span><span>AI ALLOWED</span></div>
        </div>
        <ArtifactBay />
      </section>

      <section className="dossier-section signal-section" id="signal" aria-labelledby="signal-title">
        <div className="section-index">01 <span>THE SIGNAL</span></div>
        <div className="section-grid">
          <div className="section-intro"><h2 id="signal-title">ATTENTION<br /><em>IS NOT A<br />COMMUNITY.</em></h2><p>People do not need another place to lurk. They need a constraint, a live URL, and a reason to put the thing in public.</p></div>
          <div className="section-body"><div className="signal-statement">SHIP <span>&gt;</span> TALK</div><SignalLoop /></div>
        </div>
      </section>

      <section className="dossier-section field-section" id="subjects" aria-labelledby="subjects-title">
        <div className="section-index">02 <span>FIELD LOG / SUBJECTS 001—010</span></div>
        <div className="field-heading"><div><h2 id="subjects-title">MAKE THE FIRST 8<br /><em>FEEL CHOSEN.</em></h2><p>Not a membership dashboard. A selected transmission cohort. Two public wildcard slots keep the door from becoming a velvet rope.</p></div><div className="field-count"><strong>08</strong><span>INVITED</span><i>+</i><strong>02</strong><span>OPEN</span></div></div>
        <div className="subject-table" role="table" aria-label="Founding builder subjects">
          <div className="subject-row subject-head" role="row"><span>SUBJECT</span><span>PROFILE</span><span>ACCESS</span></div>
          {subjects.map(([index, profile, access]) => <div className={`subject-row ${access === 'OPEN' ? 'is-open' : ''}`} role="row" key={index}><span>{index}</span><strong>{profile}</strong><i>{access}</i></div>)}
        </div>
      </section>

      <section className="dossier-section weight-section" id="weight" aria-labelledby="weight-title">
        <div className="section-index">03 <span>WEIGHT / WHO DOES WHAT</span></div>
        <div className="weight-heading"><h2 id="weight-title">THE PRIZE IS SMALL.<br /><em>THE STACK ISN'T.</em></h2><p>One side builds the room. One side makes the room matter. The value is the loop, not the promise of a grant.</p></div>
        <div className="weight-grid"><article><Label>VIKTOR / OPERATOR</Label><h3>BUILD<br />THE ROOM.</h3><ul><li>site + invite flow</li><li>recruiting + seven-day ops</li><li>submissions + judging setup</li><li>content + archive</li></ul></article><article className="rekt-weight"><Label tone="acid">REKT / HONEY</Label><h3>MAKE<br />NOISE.</h3><ul><li>250 USDT prize pool</li><li>REKT / Chibi rewards</li><li>brand approval + official posts</li><li>judging weight + Ink intro when earned</li></ul></article></div>
      </section>

      <section className="dossier-section broadcast-section" id="broadcast" aria-labelledby="broadcast-title">
        <div className="section-index">04 <span>DISTRIBUTION / THE LOOP TRAVELS</span></div>
        <div className="broadcast-heading"><h2 id="broadcast-title">EVERY BUILD<br /><em>BECOMES MEDIA.</em></h2><p>The build is the ad. The clip recruits the next builder. The archive makes the first round feel larger than it was.</p></div>
        <div className="broadcast-flow"><span>BUILD</span><b>→</b><span>CLIP</span><b>→</b><span>SHARE</span><b>→</b><span>ATTENTION</span><b>→</b><span>NEW BUILDER</span></div>
        <div className="proof-strip"><div><strong>15</strong><span>ENTER</span></div><i>→</i><div><strong>10</strong><span>SHIP</span></div><i>→</i><div><strong>03</strong><span>SLAP</span></div><i>→</i><div className="proof-final"><strong>02</strong><span>STAY</span></div></div>
      </section>

      <section className="open-channel" aria-labelledby="open-title"><div><Label tone="acid">ROUND 000 / OPEN CHANNEL</Label><h2 id="open-title">NO DECKS.<br /><em>LIVE URL.</em></h2><p>Build something weird. Put it somewhere real. Let the internet decide if it deserves another round.</p></div><a className="action-primary" href="#top">I WANT IN <span>↗</span></a></section>
      <footer className="dossier-footer"><span>REKT INK(CUBATOR) / BROADCAST DOSSIER 000</span><span>BAD IDEAS. WORKING SOFTWARE.</span><span>SHIP &gt; TALK.</span></footer>
    </main>
  );
}

export default App;
