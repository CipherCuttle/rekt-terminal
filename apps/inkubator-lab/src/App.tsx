import {useEffect, useState, type ReactNode} from 'react';
import {DitherWave, GrainWave, GlitchText} from './reactbits-pro';

const loop = [
  {number: '01', name: 'CHALLENGE', body: 'Pick a constraint sharp enough to make a stranger curious.'},
  {number: '02', name: 'SHIP', body: 'Put a working URL in the room. A deck does not count.'},
  {number: '03', name: 'FLEX', body: 'Show the build while it is still weird enough to be interesting.'},
  {number: '04', name: 'REWARD', body: 'Give the strongest build money, status, and a reason to return.'},
  {number: '05', name: 'REPEAT', body: 'Let the first round pull the next builder through the door.'},
];

const builds = [
  {code: 'A / 001', title: 'PLAYABLE', body: 'A small game with one rule that survives the group chat.', tone: 'violet'},
  {code: 'B / 002', title: 'USEFUL', body: 'A weird tool that earns a place in somebody’s actual workflow.', tone: 'lilac'},
  {code: 'C / 003', title: 'INTERACTIVE', body: 'A visual experiment that rewards touching the surface.', tone: 'acid'},
  {code: 'D / 004', title: 'UNCLASSIFIED', body: 'The category is the point. Make it work before you name it.', tone: 'deep'},
];
type NftItem = {
  id: string;
  image: string;
  href: string;
  collection: 'REKT INK' | 'CHIBI HOOD';
};

const nftCollections: Record<NftItem['collection'], NftItem[]> = {
  'REKT INK': [
    {id: '#4229', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/a1f984a85febce03618144188a07e5/54a1f984a85febce03618144188a07e5.gif?frame-time=1&w=700', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/4229', collection: 'REKT INK'},
    {id: '#3230', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/ab29611a2426c09b3f1b5267c72511/2bab29611a2426c09b3f1b5267c72511.gif?frame-time=1&w=700', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/3230', collection: 'REKT INK'},
    {id: '#611', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/20ae7e48349747f18d2a6ee10a2282/0b20ae7e48349747f18d2a6ee10a2282.gif?frame-time=1&w=700', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/611', collection: 'REKT INK'},
    {id: '#4066', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/8dd695bceebd665b818422a2d49a80/6e8dd695bceebd665b818422a2d49a80.gif?frame-time=1&w=700', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/4066', collection: 'REKT INK'},
    {id: '#3135', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/084fc836e05a4d1bd11aeed823d54d/61084fc836e05a4d1bd11aeed823d54d.gif?frame-time=1&w=700', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/3135', collection: 'REKT INK'},
    {id: '#2163', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/af2eda09512a9b5e422abc8cd74007/f8af2eda09512a9b5e422abc8cd74007.gif?frame-time=1&w=700', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/2163', collection: 'REKT INK'},
  ],
  'CHIBI HOOD': [
    {id: '#7267', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/b45d71950a6c7da97c994afdc3d28c/6bb45d71950a6c7da97c994afdc3d28c.gif?frame-time=1&w=700', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7267', collection: 'CHIBI HOOD'},
    {id: '#6651', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/415eb1eeab0562cd52a8d8aa9f43c4/52415eb1eeab0562cd52a8d8aa9f43c4.gif?frame-time=1&w=700', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/6651', collection: 'CHIBI HOOD'},
    {id: '#7530', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/48d2fe52902c0bc13d95a8002b41de/b748d2fe52902c0bc13d95a8002b41de.gif?frame-time=1&w=700', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7530', collection: 'CHIBI HOOD'},
    {id: '#8263', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/089e29cc63e5ce969628eec778ae2f/87089e29cc63e5ce969628eec778ae2f.gif?frame-time=1&w=700', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/8263', collection: 'CHIBI HOOD'},
    {id: '#4559', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/16749a316d39c548ad5732b93e1ad8/a916749a316d39c548ad5732b93e1ad8.gif?frame-time=1&w=700', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/4559', collection: 'CHIBI HOOD'},
    {id: '#7033', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/adad6c4a83c6c30b8f32981b354af9/cbadad6c4a83c6c30b8f32981b354af9.gif?frame-time=1&w=700', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7033', collection: 'CHIBI HOOD'},
  ],
};

function CollectionCarousel() {
  const [collection, setCollection] = useState<NftItem['collection']>('REKT INK');
  const [index, setIndex] = useState(0);
  const items = nftCollections[collection];
  const item = items[index];

  useEffect(() => setIndex(0), [collection]);

  function move(delta: number) {
    setIndex((current) => (current + delta + items.length) % items.length);
  }

  return (
    <div className="collection-panel">
      <div className="collection-panel__copy">
        <div className="section-label"><span>04</span><b>LIVE COLLECTIONS</b></div>
        <h3>Actual art.<br />Still moving.</h3>
        <p>Animated frames from the real REKT Ink and Chibi Hood collections. No stock mockups, no poster stand-ins.</p>
        <div className="collection-panel__stats">
          <span><b>4,444</b> REKT INK</span>
          <span><b>8,888</b> CHIBI HOOD</span>
        </div>
      </div>
      <div className="collection-panel__stage">
        <div className="collection-panel__topline"><span>{item.collection}</span><span>FRAME {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span></div>
        <div className="nft-carousel">
          <button className="nft-nav" type="button" onClick={() => move(-1)} aria-label="Previous NFT">←</button>
          <a className="nft-frame" href={item.href} target="_blank" rel="noreferrer">
            <div className="nft-frame__grid" aria-hidden="true" />
            <img src={item.image} alt={item.collection + ' ' + item.id} />
            <div className="nft-frame__caption"><strong>{item.collection} {item.id}</strong><span>VIEW ON OPENSEA ↗</span></div>
          </a>
          <button className="nft-nav" type="button" onClick={() => move(1)} aria-label="Next NFT">→</button>
        </div>
        <div className="collection-panel__controls">
          <div className="collection-switch" role="group" aria-label="Choose collection">
            {(Object.keys(nftCollections) as NftItem['collection'][]).map((name) => <button key={name} type="button" className={collection === name ? 'is-active' : ''} onClick={() => setCollection(name)}>{name}</button>)}
          </div>
          <span className="collection-source">LIVE MEDIA / OPENSEA</span>
        </div>
      </div>
    </div>
  );
}


function SectionLabel({number, children}: {number: string; children: ReactNode}) {
  return <div className="section-label"><span>{number}</span><b>{children}</b></div>;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, {rootMargin: '-25% 0px -55% 0px', threshold: [0.05, 0.3, 0.7]});
    ids.forEach((id) => { const node = document.getElementById(id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function App() {
  const ids = ['signal', 'loop', 'builds', 'collections', 'room', 'open'];
  const active = useActiveSection(ids);
  const [loopStep, setLoopStep] = useState(1);
  const selected = loop[loopStep];

  return (
    <main className="signal-board" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="REKT Inkubator home"><span>REKT</span><b>INK(CUBATOR)</b></a>
        <div className="round-readout"><span>ROUND</span><strong>000</strong><i>LIVE</i></div>
        <nav aria-label="Page sections" className="section-nav">
          {ids.map((id, index) => <a key={id} className={active === id ? 'is-active' : ''} href={`#${id}`} aria-label={`Go to section ${index}`}>{String(index).padStart(2, '0')}</a>)}
        </nav>
      </header>

      <section className="hero" id="signal" aria-labelledby="hero-title">
        <GrainWave className="hero-grain" />
        <div className="hero-wash" aria-hidden="true" />
        <div className="page-frame hero-grid">
          <div className="hero-copy">
            <div className="status"><span className="status-dot" /> ROUND 000 / COMMUNITY BUILD EXPERIMENT</div>
            <p className="eyebrow">SIGNAL BOARD / INK-NATIVE</p>
            <h1 id="hero-title"><GlitchText>MAKE DEGENS SHIP.</GlitchText></h1>
            <p className="hero-lede">A tight room for strange little things that exist outside the pitch deck.</p>
            <div className="hero-actions"><a className="button button-primary" href="#loop">ENTER THE LOOP <span>↓</span></a><span className="action-note">WORKING URL REQUIRED</span></div>
            <div className="hero-metrics"><span>7 DAYS</span><span>10 SLOTS</span><span>AI ALLOWED</span><span>NO DECKS</span></div>
          </div>
          <div className="hero-specimen" aria-label="REKT mark specimen">
            <div className="specimen-top"><span>SPECIMEN / 000</span><span>INK / REKT</span></div>
            <div className="glass-brand" aria-label="REKT INK identity plate"><div className="glass-brand__mark"><img src="./rekt-512.svg" alt="" /></div><div><strong>REKT INK</strong><span>THE OG NFT PROJECT OF INK</span><small>INK L2 / DSYNCART / 2025</small></div><i>GLASS ID / 000</i></div>
            <div className="specimen-art"><img src="./rekt-512.svg" alt="REKT mark" /><span className="specimen-line" /></div>
            <div className="specimen-bottom"><strong>BAD IDEAS / WORKING SOFTWARE</strong><span>FIELD NOTE 01</span></div>
          </div>
        </div>
      </section>

      <section className="story-section" id="loop" aria-labelledby="loop-title">
        <div className="page-frame story-grid">
          <div className="story-intro"><SectionLabel number="01">THE LOOP</SectionLabel><h2 id="loop-title">Attention is not a community.</h2><p>The room only matters if the room makes people build. Scroll the sequence, then decide where you enter.</p><div className="story-note">ONE EFFECT / ONE JOB<br />SCROLL IS THE FEEDBACK</div></div>
          <div className="loop-chamber">
            <DitherWave />
            <div className="chamber-wash" aria-hidden="true" />
            <div className="chamber-content"><div className="chamber-kicker">LIVE LOOP / {selected.number}</div><div className="chamber-word">{selected.name}</div><p>{selected.body}</p></div>
            <div className="loop-tabs" role="list" aria-label="Build loop steps">
              {loop.map((step, index) => <button key={step.number} type="button" className={loopStep === index ? 'is-active' : ''} onClick={() => setLoopStep(index)}><span>{step.number}</span><b>{step.name}</b></button>)}
            </div>
          </div>
        </div>
      </section>

      <section className="builds-section" id="builds" aria-labelledby="builds-title">
        <div className="page-frame">
          <div className="section-heading"><div><SectionLabel number="02">WHAT COUNTS</SectionLabel><h2 id="builds-title">Make the first thing feel chosen.</h2></div><p>Games, tools, interactive art, and unclassified experiments. Small is fine. Real is the filter.</p></div>
          <div className="build-grid">
            {builds.map((build, index) => <article className={`build-card ${build.tone}`} key={build.code}><div className="card-top"><span>{build.code}</span><i>{String(index + 1).padStart(2, '0')}</i></div><div className="card-mark" aria-hidden="true"><span>{index === 0 ? '✦' : index === 1 ? '↗' : index === 2 ? '◌' : '??'}</span></div><h3>{build.title}</h3><p>{build.body}</p><div className="card-foot">OPEN SLOT <span>+</span></div></article>)}
          </div>
        </div>
      </section>

      <section className="collections-section" id="collections" aria-labelledby="collections-title">
        <div className="page-frame">
          <div className="section-heading"><div><SectionLabel number="04">THE ART</SectionLabel><h2 id="collections-title">The signal has a face.</h2></div><p>REKT Ink is the identity layer. Chibi Hood is the companion character system. Put the actual artifacts in the room, not just the idea of them.</p></div>
          <CollectionCarousel />
        </div>
      </section>

      <section className="room-section" id="room" aria-labelledby="room-title">
        <div className="page-frame">
          <div className="section-heading"><div><SectionLabel number="05">THE ROOM</SectionLabel><h2 id="room-title">Sparse by design.</h2></div><p>Eight invited builders. Two wildcard slots. The point is not a membership dashboard; it is a room with enough signal to ship.</p></div>
          <div className="room-grid">
            {['VIBE CODER', 'GAME DEV', 'CREATIVE CODE', 'INK BUILDER', 'ARTIST', 'OSS TINKERER', 'WILDCARD', 'WILDCARD'].map((role, index) => <div className={`slot ${index > 5 ? 'is-open' : ''}`} key={`${role}-${index}`}><span>{String(index + 1).padStart(3, '0')}</span><strong>{role}</strong><i>{index > 5 ? 'OPEN' : 'INVITED'}</i></div>)}
          </div>
          <div className="reward-strip"><div><span>WEIGHT / 01</span><strong>250 USDT</strong></div><div><span>WEIGHT / 02</span><strong>REKT + CHIBI</strong></div><div><span>WEIGHT / 03</span><strong>FOUNDING STATUS</strong></div><div><span>WEIGHT / 04</span><strong>OFFICIAL SIGNAL</strong></div></div>
        </div>
      </section>

      <section className="open-section" id="open" aria-labelledby="open-title">
        <GrainWave />
        <div className="page-frame open-inner"><div><SectionLabel number="06">OPEN CHANNEL</SectionLabel><h2 id="open-title">Put the weird thing somewhere real.</h2><p>Build something that can be clicked. Bring the URL. Let the next round inherit the signal.</p></div><a className="button button-primary" href="#top">I WANT IN <span>↗</span></a></div>
      </section>

      <footer className="footer page-frame"><span>REKT INK(CUBATOR) / ROUND 000</span><span>SHIP &gt; TALK</span><span>INK-NATIVE BUILD CULTURE</span></footer>
    </main>
  );
}

export default App;
