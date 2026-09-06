import {useEffect, useState, type ReactNode} from 'react';
import {DitherWave, GrainWave, SquircleShift} from './reactbits-pro';
import NftMedia from './components/NftMedia';
import ProtocolPreview from './components/ProtocolPreview';
import {showcaseByCollection, type ShowcaseCollection} from './data/showcase-tokens';

const loop = [
  {number: '01', name: 'CONSTRAINT', body: 'One rule. Less indecision.'},
  {number: '02', name: 'BUILD', body: 'Make the smallest real version.'},
  {number: '03', name: 'SHIP', body: 'Working link. No deck.'},
  {number: '04', name: 'AMPLIFY', body: 'Clip it. Post it. Let it travel.'},
  {number: '05', name: 'REPEAT', body: 'Pull in the next builder.'},
];

const builds = [
  {code: 'A001', title: 'PLAYABLE', body: 'A small game people can actually play.', mark: '✦'},
  {code: 'B002', title: 'USEFUL', body: 'A tool somebody might use twice.', mark: '↗'},
  {code: 'C003', title: 'INTERACTIVE', body: 'Better when somebody touches it.', mark: '◌'},
  {code: 'D004', title: '???', body: 'Weird is a valid category.', mark: '??'},
];

type MediaItem = {
  id: string;
  collection: ShowcaseCollection;
  media: string;
  href: string;
};

// Verified moving collection media already used by the project. The live collector will
// replace this fallback feed with the rarity/market-curated token set in showcase-tokens.ts.
const fallbackMedia: Record<ShowcaseCollection, MediaItem[]> = {
  'REKT INK': [
    {id: '4066', collection: 'REKT INK', media: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/8dd695bceebd665b818422a2d49a80/6e8dd695bceebd665b818422a2d49a80.gif?w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/4066'},
    {id: '4229', collection: 'REKT INK', media: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/a1f984a85febce03618144188a07e5/54a1f984a85febce03618144188a07e5.gif?w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/4229'},
    {id: '3230', collection: 'REKT INK', media: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/ab29611a2426c09b3f1b5267c72511/2bab29611a2426c09b3f1b5267c72511.gif?w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/3230'},
    {id: '611', collection: 'REKT INK', media: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/20ae7e48349747f18d2a6ee10a2282/0b20ae7e48349747f18d2a6ee10a2282.gif?w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/611'},
  ],
  'CHIBI HOOD': [
    {id: '7267', collection: 'CHIBI HOOD', media: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/b45d71950a6c7da97c994afdc3d28c/6bb45d71950a6c7da97c994afdc3d28c.gif?w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7267'},
    {id: '6651', collection: 'CHIBI HOOD', media: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/415eb1eeab0562cd52a8d8aa9f43c4/52415eb1eeab0562cd52a8d8aa9f43c4.gif?w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/6651'},
    {id: '7530', collection: 'CHIBI HOOD', media: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/48d2fe52902c0bc13d95a8002b41de/b748d2fe52902c0bc13d95a8002b41de.gif?w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7530'},
    {id: '8263', collection: 'CHIBI HOOD', media: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/089e29cc63e5ce969628eec778ae2f/87089e29cc63e5ce969628eec778ae2f.gif?w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/8263'},
  ],
};

const sectionIds = ['signal', 'builds', 'machine', 'comeback', 'roadmap', 'open'];
const sectionLabels: Record<string, string> = {
  signal: 'Hero',
  builds: 'What counts',
  machine: 'The machine',
  comeback: 'The comeback',
  roadmap: 'Roadmap',
  open: 'Open channel',
};

function SectionLabel({number, children}: {number: string; children: ReactNode}) {
  return <div className="d3-section-label"><span>{number}</span><b>{children}</b></div>;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, {rootMargin: '-22% 0px -60% 0px', threshold: [0.05, 0.25, 0.55]});

    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function CollectionTabs({value, onChange}: {value: ShowcaseCollection; onChange: (value: ShowcaseCollection) => void}) {
  return (
    <div className="d3-collection-tabs" role="group" aria-label="Choose collection">
      {(['REKT INK', 'CHIBI HOOD'] as ShowcaseCollection[]).map((name) => (
        <button
          key={name}
          type="button"
          className={value === name ? 'is-active' : ''}
          aria-pressed={value === name}
          onClick={() => onChange(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function LiveSignal() {
  const [collection, setCollection] = useState<ShowcaseCollection>('CHIBI HOOD');
  const [index, setIndex] = useState(0);
  const items = fallbackMedia[collection];
  const current = items[index % items.length];

  useEffect(() => setIndex(0), [collection]);

  function move() {
    setIndex((value) => (value + 1) % items.length);
  }

  return (
    <aside className="d3-live-signal" aria-label="REKT world signal">
      <div className="d3-signal-head"><span><i /> SIGNAL / REKT WORLD</span><b>CURATED ART</b></div>
      <a className="d3-signal-media" href={current.href} target="_blank" rel="noreferrer">
        <NftMedia src={current.media} alt={`${current.collection} #${current.id}`} priority />
        <span className="d3-media-scan" aria-hidden="true" />
      </a>
      <div className="d3-signal-body">
        <CollectionTabs value={collection} onChange={setCollection} />
        <div className="d3-signal-title" aria-live="polite"><span>{current.collection}</span><strong>#{current.id}</strong></div>
        <div className="d3-signal-facts">
          <span><small>MEDIA</small>ANIMATED</span>
          <span><small>CURATION</small>RARITY + MARKET</span>
          <span><small>LIVE SALES</small>COLLECTOR NEXT</span>
        </div>
        <div className="d3-signal-foot"><a href={current.href} target="_blank" rel="noreferrer">OPEN ON OPENSEA ↗</a><button type="button" aria-label={`Show next ${collection} artwork`} onClick={move}>NEXT ART →</button></div>
      </div>
    </aside>
  );
}

function BuildMachine() {
  const [step, setStep] = useState(0);
  const current = loop[step];

  return (
    <section className="d3-machine d3-section" id="machine">
      <DitherWave className="d3-machine-wave" />
      <div className="d3-machine-wash" aria-hidden="true" />
      <div className="d3-frame d3-machine-grid">
        <div className="d3-machine-copy">
          <SectionLabel number="02">THE MACHINE</SectionLabel>
          <h2>5 STEPS.<br />NO DECK.</h2>
          <p>Give people a reason to move, then make the shipped thing recruit the next builder.</p>
          <div className="d3-loop-readout" aria-live="polite"><span>{current.number}</span><div><strong>{current.name}</strong><p>{current.body}</p></div></div>
        </div>
        <div className="d3-loop-panel">
          <div className="d3-loop-strip" role="group" aria-label="Build loop steps">
            {loop.map((item, itemIndex) => (
              <button
                key={item.name}
                type="button"
                className={step === itemIndex ? 'is-active' : ''}
                aria-pressed={step === itemIndex}
                onClick={() => setStep(itemIndex)}
              >
                <span>{item.number}</span><b>{item.name}</b>
              </button>
            ))}
          </div>
          <div className="d3-deal-grid">
            <article><span>YOU / BUILDER</span><h3>MAKE THE THING.</h3><ul><li>weird idea</li><li>working link</li><li>ship in public</li></ul></article>
            <article><span>INK(CUBATOR)</span><h3>CREATE THE PULL.</h3><ul><li>constraint</li><li>deadline</li><li>eyes on what ships</li></ul></article>
          </div>
          <div className="d3-flywheel">BUILD <i>→</i> CLIP <i>→</i> SHARE <i>→</i> NEXT BUILDER</div>
        </div>
      </div>
      <ProtocolPreview />
    </section>
  );
}

function SignalChart() {
  return (
    <div className="d3-chart" aria-label="Growth chart placeholder. Historical data starts when the collector is connected.">
      <div className="d3-chart-head"><span>GROWTH SIGNAL</span><b>DATA STARTS WITH COLLECTOR</b></div>
      <svg viewBox="0 0 640 180" aria-hidden="true" focusable="false">
        <path className="d3-chart-grid" d="M0 45H640M0 90H640M0 135H640" />
        <path className="d3-chart-line" d="M0 145 C80 142 105 130 155 132 S235 113 285 119 S365 88 410 93 S500 63 545 70 S605 45 640 49" />
        <circle className="d3-chart-dot" cx="640" cy="49" r="5" />
      </svg>
      <div className="d3-chart-axis"><span>START</span><span>30D</span><span>90D</span><span>NOW</span></div>
    </div>
  );
}

function ComebackGallery() {
  const [collection, setCollection] = useState<ShowcaseCollection>('REKT INK');
  const [index, setIndex] = useState(0);
  const items = fallbackMedia[collection];
  const current = items[index % items.length];
  const curated = showcaseByCollection[collection];

  useEffect(() => setIndex(0), [collection]);

  return (
    <div className="d3-comeback-stage">
      <SquircleShift className="d3-comeback-effect" />
      <div className="d3-comeback-stage-wash" aria-hidden="true" />
      <div className="d3-gallery-head"><CollectionTabs value={collection} onChange={setCollection} /><span>MOVING ART / OPENSEA</span></div>
      <a className="d3-gallery-main" href={current.href} target="_blank" rel="noreferrer">
        <NftMedia src={current.media} alt={`${current.collection} #${current.id}`} />
        <div className="d3-gallery-glass"><strong>{current.collection} #{current.id}</strong><span>OPEN ART ↗</span></div>
      </a>
      <div className="d3-gallery-controls"><button type="button" aria-label={`Show previous ${collection} artwork`} onClick={() => setIndex((value) => (value - 1 + items.length) % items.length)}>← PREV</button><span aria-live="polite">{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span><button type="button" aria-label={`Show next ${collection} artwork`} onClick={() => setIndex((value) => (value + 1) % items.length)}>NEXT →</button></div>
      <div className="d3-curation-head"><span>SHOWCASE 15 / {collection}</span><b>RARITY + MARKET + VISUAL</b></div>
      <div className="d3-curation-rail">
        {curated.map((token) => (
          <a key={token.tokenId} href={token.href} target="_blank" rel="noreferrer" title={token.note}>
            <strong>#{token.tokenId}</strong><span>{token.rarityRank ? `RANK ${token.rarityRank.toLocaleString()}` : 'MARKET WILDCARD'}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function AppV3() {
  const active = useActiveSection(sectionIds);

  return (
    <main className="d3" id="top">
      <header className="d3-topbar">
        <a className="d3-brand" href="#top" aria-label="REKT Inkubator home"><span>REKT</span><b>INK(CUBATOR)</b></a>
        <div className="d3-transmission"><span>TRANSMISSION 000</span><i>BUILD MODE</i></div>
        <nav aria-label="Page sections">{sectionIds.map((id, index) => <a key={id} className={active === id ? 'is-active' : ''} aria-current={active === id ? 'location' : undefined} aria-label={`${String(index).padStart(2, '0')} ${sectionLabels[id]}`} href={`#${id}`}>{String(index).padStart(2, '0')}</a>)}</nav>
      </header>

      <section className="d3-hero" id="signal" aria-labelledby="d3-hero-title">
        <GrainWave className="d3-hero-grain" startupDelayMs={2600} />
        <div className="d3-hero-wash" aria-hidden="true" />
        <div className="d3-frame d3-hero-grid">
          <div className="d3-hero-copy">
            <div className="d3-status"><i /> REKT INK(CUBATOR) / BUILD CHALLENGE</div>
            <p className="d3-eyebrow">BUILD WEIRD SHIT / SHIP IT</p>
            <h1 id="d3-hero-title">BUILD SOMETHING WEIRD.<br />PUT IT ON THE INTERNET.</h1>
            <p className="d3-lede">Short REKT build rounds for games, tools and weird internet experiments. Get a constraint. Ship a working link.</p>
            <div className="d3-principle"><span>OPERATING PRINCIPLE / 001</span><strong>MAKE DEGENS SHIP.</strong><b>SHIP &gt; TALK</b></div>
            <div className="d3-actions"><a className="d3-primary" href="#machine">SEE THE MACHINE ↓</a><span>NO DECKS / WORKING URL</span></div>
            <div className="d3-hero-meta"><span>SHORT ROUNDS</span><span>WORKING LINK</span><span>REKT WORLD</span></div>
          </div>
          <LiveSignal />
        </div>
      </section>

      <section className="d3-builds d3-section" id="builds">
        <div className="d3-frame">
          <div className="d3-section-head"><div><SectionLabel number="01">WHAT COUNTS</SectionLabel><h2>PICK A FORM.<br />SHIP IT.</h2></div><p>Games, tools, experiments, interactive nonsense. The category matters less than whether somebody can click it.</p></div>
          <div className="d3-build-grid">{builds.map((build) => <article key={build.code}><div><span>TYPE / {build.code}</span><b>{build.mark}</b></div><h3>{build.title}</h3><p>{build.body}</p></article>)}</div>
        </div>
      </section>

      <BuildMachine />

      <section className="d3-comeback d3-section" id="comeback">
        <div className="d3-frame">
          <div className="d3-comeback-grid">
            <div className="d3-comeback-copy">
              <SectionLabel number="03">THE COMEBACK</SectionLabel>
              <p className="d3-archive-kicker">THE QUIET YEARS / SIGNAL NEVER ZERO</p>
              <h2>TWO YEARS.<br />STILL HERE.</h2>
              <p className="d3-comeback-lede">The future stayed uncertain. A few people stayed anyway. REKT and Chibi kept the world visible. Now the next move is to build out from it.</p>
              <div className="d3-arc">
                <div><span>2024</span><strong>UNCERTAINTY</strong></div>
                <i>↓</i>
                <div><span>CORE</span><strong>A FEW STAYED</strong></div>
                <i>↓</i>
                <div><span>REKT + CHIBI</span><strong>KEPT MOVING</strong></div>
                <i>↓</i>
                <div className="is-now"><span>NOW</span><strong>BUILD THE COMEBACK</strong></div>
              </div>
            </div>
            <ComebackGallery />
          </div>
          <div className="d3-signal-metrics">
            <div><span>REKT HOLDERS</span><strong>—</strong><small>COLLECTOR PENDING</small></div>
            <div><span>CHIBI HOLDERS</span><strong>—</strong><small>COLLECTOR PENDING</small></div>
            <div><span>TELEGRAM</span><strong>—</strong><small>COLLECTOR PENDING</small></div>
            <div><span>THINGS SHIPPED</span><strong>00</strong><small>ROUND 000 START STATE</small></div>
          </div>
          <SignalChart />
        </div>
      </section>

      <section className="d3-roadmap d3-section" id="roadmap">
        <div className="d3-frame">
          <div className="d3-section-head"><div><SectionLabel number="04">ROADMAP</SectionLabel><h2>WHERE THE SIGNAL GOES.</h2></div><p>DIRECTION, NOT PROMISES. Build the loop first. Add proof of life next. Let the output compound after that.</p></div>
          <div className="d3-roadmap-rail" aria-label="Inkubator roadmap">
            <div className="d3-road-line"><span className="is-on" /><span /><span /><i /></div>
            <article className="is-now"><span>00 / NOW</span><h3>PROVE<br />THE LOOP</h3><p>First rounds. Real builders. Working things.</p></article>
            <article><span>01 / NEXT</span><h3>TURN ON<br />LIVE SIGNAL</h3><p>Latest buys, holder growth and community growth.</p></article>
            <article><span>02 / THEN</span><h3>COMPOUND<br />THE WORLD</h3><p>Recurring rounds, builder archive, more things born from REKT.</p></article>
          </div>
        </div>
      </section>

      <section className="d3-open" id="open">
        <GrainWave className="d3-open-grain" />
        <div className="d3-open-wash" aria-hidden="true" />
        <div className="d3-frame d3-open-inner">
          <SectionLabel number="05">OPEN CHANNEL</SectionLabel>
          <h2>DUMB IDEA?<br />MAKE IT REAL.</h2>
          <p>Round 000 opens when the room is ready.</p>
          <div className="d3-open-action"><span>APPLICATION FLOW / NEXT</span><b>WORKING URL OR GTFO.</b></div>
        </div>
      </section>

      <footer className="d3-footer"><span>REKT INK(CUBATOR) / TRANSMISSION 000</span><b>BAD IDEAS. WORKING SOFTWARE.</b><span>SHIP &gt; TALK.</span></footer>
    </main>
  );
}

export default AppV3;
