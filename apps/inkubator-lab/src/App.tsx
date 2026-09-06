import {useState, type ReactNode} from 'react';

type Direction = 'a' | 'b' | 'c';

const copy = {
  eyebrow: 'REKT INK(CUBATOR) // ROUND 000',
  title: ['MAKE', 'DEGENS', 'SHIP.'],
  subline: 'BAD IDEAS. WORKING SOFTWARE.',
  facts: [
    {value: '7', label: 'days to ship'},
    {value: '8', label: 'invited builders'},
    {value: '2', label: 'wildcard slots'},
    {value: 'AI', label: 'explicitly allowed'},
  ],
  cohort: [
    ['001', 'AI / vibe coder'],
    ['002', 'indie game dev'],
    ['003', 'creative coder'],
    ['004', 'Ink / onchain dev'],
    ['005', 'crypto shitposter who codes'],
    ['006', 'artist who prototypes'],
    ['007', 'open-source tinkerer'],
    ['008', 'wildcard weirdo'],
  ],
  loop: [
    ['01', 'CHALLENGE', 'pick a weird constraint'],
    ['02', 'SHIP', 'put a live URL in the room'],
    ['03', 'FLEX', 'clip it, post it, let it travel'],
    ['04', 'REWARD', 'money, status, access, lore'],
    ['05', 'REPEAT', 'make shipping the culture'],
  ],
};

const directionMeta: Record<Direction, {short: string; name: string; kicker: string}> = {
  a: {short: 'A', name: 'EDITORIAL BENTO', kicker: 'hierarchy before effects'},
  b: {short: 'B', name: 'KINETIC BROADCAST', kicker: 'event energy, no chaos soup'},
  c: {short: 'C', name: 'CONTROLLED HYBRID', kicker: 'editorial structure / rare breach'},
};

function CornerMarks({children}: {children: ReactNode}) {
  return <div className="corner-box"><span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />{children}</div>;
}

function DirectionSwitcher({direction, onChange, motion, onMotion}: {direction: Direction; onChange: (direction: Direction) => void; motion: boolean; onMotion: () => void}) {
  return (
    <div className="lab-controls" aria-label="Design lab controls">
      <div className="direction-tabs" role="tablist" aria-label="Visual direction">
        {(Object.keys(directionMeta) as Direction[]).map((key) => (
          <button
            className={`direction-tab ${direction === key ? 'is-active' : ''}`}
            key={key}
            type="button"
            role="tab"
            aria-selected={direction === key}
            onClick={() => onChange(key)}
          >
            <span className="tab-index">{directionMeta[key].short}</span>
            <span>{directionMeta[key].name}</span>
          </button>
        ))}
      </div>
      <button className="motion-toggle" type="button" aria-pressed={motion} onClick={onMotion}>
        <span className={`status-dot ${motion ? 'is-live' : ''}`} />
        MOTION {motion ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function LabHeader({direction}: {direction: Direction}) {
  return (
    <header className="lab-header">
      <a className="wordmark" href="#top" aria-label="REKT INK(CUBATOR) home">
        <span>REKT</span><i>INK(CUBATOR)</i>
      </a>
      <div className="header-context">
        <span>DESIGN LAB / V1</span>
        <span className="context-slash">/</span>
        <span>{directionMeta[direction].name}</span>
      </div>
      <span className="header-stamp">NO DECKS // LIVE URL OR GTFO</span>
    </header>
  );
}

function Artifact({variant = 'default', label = 'FIELD NOTE // 000'}: {variant?: 'default' | 'broadcast' | 'hybrid'; label?: string}) {
  return (
    <div className={`artifact artifact-${variant}`} aria-label="Abstract REKT Inkubator poster study">
      <div className="artifact-noise" />
      <div className="artifact-topline"><span>{label}</span><span>✳</span></div>
      <div className="artifact-title">REKT<span>INK</span></div>
      <div className="artifact-number">000</div>
      <div className="artifact-slash" />
      <div className="artifact-signal signal-orange">SHIP<br />OR<br />SHUT UP</div>
      <div className="artifact-signal signal-cyan">7 DAYS<br />NO EXCUSES</div>
      <div className="artifact-foot">BAD IDEAS / WORKING SOFTWARE</div>
      <div className="artifact-crosshair" />
    </div>
  );
}

function SectionLabel({index, children, tone = ''}: {index: string; children?: ReactNode; tone?: string}) {
  return <div className={`section-label ${tone}`}><span>{index}</span>{children && <span>{children}</span>}</div>;
}

function Stat({value, label, accent = ''}: {value: string; label: string; accent?: string}) {
  return <div className={`stat ${accent}`}><strong>{value}</strong><span>{label}</span></div>;
}

function LoopMachine({compact = false}: {compact?: boolean}) {
  const [active, setActive] = useState(1);
  return (
    <div className={`loop-machine ${compact ? 'is-compact' : ''}`}>
      <div className="loop-steps" role="list" aria-label="REKT Inkubator loop">
        {copy.loop.map(([index, title, detail], i) => (
          <div className="loop-step-item" key={index} role="listitem">
            <button className={`loop-step ${active === i ? 'is-active' : ''}`} type="button" onClick={() => setActive(i)}>
              <span className="loop-index">{index}</span>
              <span className="loop-title">{title}</span>
              <span className="loop-detail">{detail}</span>
            </button>
          </div>
        ))}
      </div>
      {!compact && <div className="loop-readout"><span>NOW IN THE MACHINE</span><strong>{copy.loop[active][1]}</strong><p>{copy.loop[active][2]}. The only metric that matters is whether somebody shipped.</p></div>}
    </div>
  );
}

function HeroTitle({className = ''}: {className?: string}) {
  return <h1 className={`hero-title ${className}`}>{copy.title.map((line) => <span key={line}>{line}</span>)}</h1>;
}

function FooterCta({tone = ''}: {tone?: string}) {
  return (
    <section className={`final-cta ${tone}`}>
      <div>
        <span className="eyebrow">ROUND // 000 — SMALL DECISION SURFACE</span>
        <h2>YOU BUILD.<br /><em>WE MAKE NOISE.</em></h2>
      </div>
      <a className="ship-button" href="#cohort">I WANT IN <span>↗</span></a>
    </section>
  );
}

function AEditorial() {
  return (
    <div className="direction-page page-a">
      <section className="a-hero" id="top">
        <div className="a-hero-copy">
          <span className="eyebrow">{copy.eyebrow}</span>
          <HeroTitle />
          <p className="hero-subline">{copy.subline}</p>
          <div className="hero-note"><span>01</span><p>A seven-day online build challenge for people who would rather ship a strange little thing than explain a pitch deck.</p></div>
        </div>
        <div className="a-hero-art"><Artifact label="REKT INK / SPECIMEN 000" /><span className="art-caption">CROPPED STUDY / NOT A PROMISE OF FUNDING</span></div>
        <div className="a-hero-footer"><span>AI / VIBE CODING ALLOWED</span><span>WORKING URL REQUIRED</span><span>VIKTOR × REKT / 2026</span></div>
      </section>

      <section className="a-overview" aria-labelledby="a-overview-heading">
        <SectionLabel index="01" tone="label-dark">ROUND 000 AT A GLANCE</SectionLabel>
        <div className="a-overview-grid">
          <div className="a-big-stat"><span id="a-overview-heading">THE BRIEF</span><strong>7<span>DAY</span></strong><p>Build a browser game, mini-app, weird tool, interactive artwork, or experiment that deserves a live URL.</p></div>
          <div className="a-facts">{copy.facts.map((fact) => <Stat key={fact.label} {...fact} />)}</div>
          <div className="a-rule"><span>NO REKT OWNERSHIP REQUIREMENT</span><span>2 PUBLIC WILDCARDS</span><span>NO DECK-ONLY SUBMISSIONS</span></div>
        </div>
      </section>

      <section className="a-machine" id="machine" aria-labelledby="a-machine-heading">
        <div className="a-machine-intro"><SectionLabel index="02" tone="label-dark" /><h2 id="a-machine-heading">THE<br /><em>MACHINE</em></h2><p>Make the act of shipping more contagious than the act of talking about shipping.</p></div>
        <LoopMachine />
      </section>

      <section className="a-cohort" id="cohort" aria-labelledby="a-cohort-heading">
        <div className="cohort-heading"><SectionLabel index="03" /><h2 id="a-cohort-heading">FOUNDING<br /><em>SUBJECTS</em></h2><p>You were picked because you build weird shit. No generic invite. No audience cosplay.</p></div>
        <div className="cohort-list">{copy.cohort.map(([index, role]) => <div className="cohort-line" key={index}><span>{index}</span><strong>{role}</strong><i>SELECTED</i></div>)}</div>
      </section>

      <section className="a-roles" aria-labelledby="a-roles-heading">
        <SectionLabel index="04" tone="label-dark">WHO DOES WHAT</SectionLabel>
        <h2 className="sr-only" id="a-roles-heading">WHO DOES WHAT</h2>
        <div className="roles-split">
          <div className="role-panel role-viktor"><span className="role-tag">VIKTOR / OPERATOR</span><h3>BUILD<br />THE ROOM.</h3><ul><li>build the site + invite flow</li><li>recruit / operate / publish</li><li>submissions + judging system</li><li>archive every good artifact</li></ul></div>
          <div className="role-panel role-rekt"><span className="role-tag">REKT / HONEY</span><h3>MAKE<br />NOISE.</h3><ul><li>prize liquidity + NFT rewards</li><li>brand authority + amplification</li><li>final judging + technical legitimacy</li><li>bridge strong work when warranted</li></ul></div>
        </div>
      </section>

      <section className="a-proof" aria-labelledby="a-proof-heading"><div><SectionLabel index="05" /><h2 id="a-proof-heading">BUILD<br /><em>TRAVELS.</em></h2><p>Every shipped build is a piece of content. The loop recruits the next builder.</p></div><div className="proof-flow"><span>BUILD</span><b>→</b><span>CLIP</span><b>→</b><span>SHARE</span><b>→</b><span>ATTENTION</span><b>→</b><span>NEW BUILDER</span></div><div className="funnel"><strong>15</strong><span>ENTER</span><i>→</i><strong>10</strong><span>SHIP</span><i>→</i><strong>3</strong><span>SLAP</span><i>→</i><strong>2</strong><span>STAY</span></div></section>
      <FooterCta tone="cta-a" />
    </div>
  );
}

function BBroadcast() {
  return (
    <div className="direction-page page-b">
      <section className="b-hero" id="top">
        <div className="broadcast-top"><span>{copy.eyebrow}</span><span>TRANSMISSION 000 / 007</span><span>STATUS: RECRUITING</span></div>
        <div className="b-title-wrap"><span className="b-giant-ghost">ROUND 000</span><HeroTitle className="b-title" /><span className="b-sticker">NO DECKS<br />JUST SHIP</span></div>
        <div className="b-hero-bottom"><div><p>{copy.subline}</p><span>7 DAYS / 8 INVITED / 2 WILDCARDS</span></div><Artifact variant="broadcast" label="LIVE FEED / 000" /></div>
      </section>
      <div className="marquee" aria-label="Challenge rules"><div className="marquee-track"><span>WORKING URL OR GTFO</span><i>✳</i><span>VIBE CODERS WELCOME</span><i>✳</i><span>DRAINERS NOT</span><i>✳</i><span>SHIP &gt; TALK</span><i>✳</i><span>WORKING URL OR GTFO</span><i>✳</i></div></div>

      <section className="b-brief" aria-labelledby="b-brief-heading"><div className="b-section-head"><span className="vertical-label">01 / BRIEF</span><h2 id="b-brief-heading">ONE WEEK.<br /><em>ONE URL.</em></h2></div><div className="b-brief-right"><p>Make a browser game, mini-app, weird tool, interactive art piece, or experiment that survives contact with a real browser.</p><div className="b-stats-row">{copy.facts.map((fact) => <Stat key={fact.label} {...fact} />)}</div></div></section>

      <section className="b-loop" aria-labelledby="b-loop-heading"><div className="broadcast-band">CHALLENGE / SHIP / FLEX / REWARD / REPEAT</div><div className="b-loop-inner"><div><span className="eyebrow">02 / THE LOOP</span><h2 id="b-loop-heading">MAKE<br /><em>IT TRAVEL.</em></h2></div><LoopMachine compact /><div className="loop-mark">5<br /><span>STEPS<br />TO CULTURE</span></div></div></section>

      <section className="b-cohort" id="cohort" aria-labelledby="b-cohort-heading"><div className="b-cohort-top"><span className="eyebrow">03 / CASTING CALL</span><h2 id="b-cohort-heading">FOUNDING<br /><em>SUBJECTS</em></h2><span className="b-counter">08 + 02<br /><small>PUBLIC WILDCARDS</small></span></div><div className="b-cohort-grid">{copy.cohort.map(([index, role], i) => <div className={`broadcast-subject subject-${i + 1}`} key={index}><span>{index}</span><strong>{role}</strong><i>BUILD SOMETHING</i></div>)}</div></section>

      <section className="b-distribution" aria-labelledby="b-distribution-heading"><div className="b-distribution-copy"><span className="eyebrow">04 / DISTRIBUTION</span><h2 id="b-distribution-heading">THE BUILD<br /><em>IS THE AD.</em></h2></div><div className="b-distribution-flow"><span>BUILD</span><b>→</b><span>CLIP</span><b>→</b><span>SHARE</span><b>→</b><span>NEW<br />BUILDER</span></div><div className="b-funnel-line"><strong>15</strong><span>ENTER</span><strong>10</strong><span>SHIP</span><strong>03</strong><span>SLAP</span><strong>02</strong><span>STAY</span></div></section>
      <FooterCta tone="cta-b" />
    </div>
  );
}

function WaveField() {
  return <div className="wave-field" aria-hidden="true">{Array.from({length: 13}, (_, i) => <span key={i} style={{'--wave': i} as React.CSSProperties} />)}</div>;
}

function CHybrid() {
  return (
    <div className="direction-page page-c">
      <section className="c-hero" id="top">
        <div className="c-hero-copy"><span className="eyebrow">{copy.eyebrow}</span><HeroTitle /><p className="hero-subline">{copy.subline}</p><div className="c-hero-micro"><span>7 DAYS</span><span>8 INVITED</span><span>2 WILDCARDS</span></div></div>
        <CornerMarks><WaveField /><div className="c-art-copy"><span>LIVE URL</span><strong>000</strong><i>FIELD<br />STUDY</i></div><div className="c-art-caption">ONE AMBIENT SYSTEM / NO LIBRARY DEMO</div></CornerMarks>
        <div className="c-hero-rail"><span>BUILD A WEIRD THING</span><b>↘</b><span>PUT IT ON THE INTERNET</span></div>
      </section>

      <section className="c-bento" aria-labelledby="c-bento-heading"><SectionLabel index="01" /><div className="c-bento-grid"><div className="c-brief-tile"><span className="tile-kicker">ROUND 000 / THE BRIEF</span><h2 id="c-bento-heading">A WEEK<br /><em>TO MAKE</em></h2><p>Browser game. Mini-app. Weird tool. Interactive art. Anything with a working URL and a pulse.</p><a href="#machine" className="text-link">READ THE LOOP ↘</a></div><div className="c-number-tile"><strong>7</strong><span>DAYS</span><small>NO EXCUSES</small></div><div className="c-list-tile"><Stat value="8" label="invited" /><Stat value="2" label="wildcards" accent="is-orange" /><Stat value="AI" label="allowed" accent="is-cyan" /><span className="tile-note">NO REKT OWNERSHIP REQUIRED</span></div><div className="c-art-tile"><Artifact variant="hybrid" label="REKT INK / CROP 000" /></div></div></section>

      <section className="c-machine" id="machine" aria-labelledby="c-machine-heading"><div className="c-machine-top"><SectionLabel index="02" /><div><span className="tile-kicker">THE MACHINE</span><h2 id="c-machine-heading">SHIP<br /><em>THE LOOP.</em></h2></div><p>Rigid macro-grid. Living signal. The system is allowed to misbehave only where it earns the attention.</p></div><LoopMachine /></section>

      <section className="c-cohort" id="cohort" aria-labelledby="c-cohort-heading"><div className="c-cohort-head"><SectionLabel index="03" /><h2 id="c-cohort-heading">PICKED<br /><em>FOR A REASON.</em></h2><p>Eight founding builders. Two public wildcard slots. You were selected because you build weird shit.</p></div><div className="c-cohort-list">{copy.cohort.map(([index, role]) => <div key={index}><span>{index}</span><strong>{role}</strong><i>FOUNDING SUBJECT</i></div>)}</div></section>

      <section className="c-roles" aria-labelledby="c-roles-heading"><SectionLabel index="04" /><div className="c-roles-grid"><div className="c-role c-role-v"><span>VIKTOR / OPERATOR</span><h2 id="c-roles-heading">BUILD<br /><em>THE ROOM.</em></h2><p>Site, invites, recruiting, submissions, judging, archive, coordination.</p></div><div className="c-role c-role-r"><span>REKT / HONEY</span><h2>MAKE<br /><em>NOISE.</em></h2><p>Prizes, NFTs, brand authority, amplification, judging, Ink bridge if warranted.</p></div></div></section>

      <section className="c-proof" aria-labelledby="c-proof-heading"><div className="c-proof-heading"><SectionLabel index="05" /><h2 id="c-proof-heading">BUILD<br /><em>→ ATTENTION</em></h2></div><div className="c-proof-flow"><div className="proof-row"><span>BUILD</span><b>→</b><span>CLIP</span><b>→</b><span>SHARE</span></div><div className="proof-row proof-row-small"><span>15 ENTER</span><span>10 SHIP</span><span>03 SLAP</span><span>02 STAY</span></div></div></section>
      <FooterCta tone="cta-c" />
    </div>
  );
}

function App() {
  const [direction, setDirection] = useState<Direction>('c');
  const [motion, setMotion] = useState(true);
  return (
    <div className={`app direction-${direction} ${motion ? 'motion-on' : 'motion-off'}`}>
      <LabHeader direction={direction} />
      <DirectionSwitcher direction={direction} onChange={setDirection} motion={motion} onMotion={() => setMotion((value) => !value)} />
      <div className="direction-readout" aria-live="polite"><span>READ {directionMeta[direction].short}</span><strong>{directionMeta[direction].name}</strong><i>{directionMeta[direction].kicker}</i></div>
      {direction === 'a' && <AEditorial />}
      {direction === 'b' && <BBroadcast />}
      {direction === 'c' && <CHybrid />}
      <footer className="lab-footer"><span>REKT INK(CUBATOR) / DESIGN LAB V1</span><span>THREE COMPOSITIONS / ONE CORE LOOP</span><span>STATIC TEST REQUIRED</span></footer>
    </div>
  );
}

export default App;
