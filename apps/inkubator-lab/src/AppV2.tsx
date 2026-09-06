import {useEffect, useState, type ReactNode} from 'react';
import {DitherWave, GrainWave, GlitchText, SquircleShift} from './reactbits-pro';

const loop = [
  {number: '01', name: 'CONSTRAINT', body: 'One rule. Less indecision.'},
  {number: '02', name: 'BUILD', body: 'Make the smallest real version.'},
  {number: '03', name: 'SHIP', body: 'Working URL. No deck.'},
  {number: '04', name: 'AMPLIFY', body: 'Clip it. Post it. Let it travel.'},
  {number: '05', name: 'REPEAT', body: 'Pull in the next builder.'},
];

const builds = [
  {code: 'TYPE / A001', title: 'PLAYABLE', body: 'A small game people can actually play.', mark: '✦'},
  {code: 'TYPE / B002', title: 'USEFUL', body: 'A tool somebody might use twice.', mark: '↗'},
  {code: 'TYPE / C003', title: 'INTERACTIVE', body: 'Something better when you touch it.', mark: '◌'},
  {code: 'TYPE / D004', title: 'UNCLASSIFIED', body: 'Weird is a valid category.', mark: '??'},
];

type NftItem = {
  id: string;
  image: string;
  href: string;
  collection: 'REKT INK' | 'CHIBI HOOD';
};

const nftCollections: Record<NftItem['collection'], NftItem[]> = {
  'REKT INK': [
    {id: '#4229', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/a1f984a85febce03618144188a07e5/54a1f984a85febce03618144188a07e5.gif?frame-time=1&w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/4229', collection: 'REKT INK'},
    {id: '#3230', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/ab29611a2426c09b3f1b5267c72511/2bab29611a2426c09b3f1b5267c72511.gif?frame-time=1&w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/3230', collection: 'REKT INK'},
    {id: '#611', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/20ae7e48349747f18d2a6ee10a2282/0b20ae7e48349747f18d2a6ee10a2282.gif?frame-time=1&w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/611', collection: 'REKT INK'},
    {id: '#4066', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/8dd695bceebd665b818422a2d49a80/6e8dd695bceebd665b818422a2d49a80.gif?frame-time=1&w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/4066', collection: 'REKT INK'},
    {id: '#3135', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/084fc836e05a4d1bd11aeed823d54d/61084fc836e05a4d1bd11aeed823d54d.gif?frame-time=1&w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/3135', collection: 'REKT INK'},
    {id: '#2163', image: 'https://i2c.seadn.io/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/af2eda09512a9b5e422abc8cd74007/f8af2eda09512a9b5e422abc8cd74007.gif?frame-time=1&w=900', href: 'https://opensea.io/item/ink/0x25aa78ab6785a4b0aeff5c170998992fd958d43d/2163', collection: 'REKT INK'},
  ],
  'CHIBI HOOD': [
    {id: '#7267', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/b45d71950a6c7da97c994afdc3d28c/6bb45d71950a6c7da97c994afdc3d28c.gif?frame-time=1&w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7267', collection: 'CHIBI HOOD'},
    {id: '#6651', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/415eb1eeab0562cd52a8d8aa9f43c4/52415eb1eeab0562cd52a8d8aa9f43c4.gif?frame-time=1&w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/6651', collection: 'CHIBI HOOD'},
    {id: '#7530', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/48d2fe52902c0bc13d95a8002b41de/b748d2fe52902c0bc13d95a8002b41de.gif?frame-time=1&w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7530', collection: 'CHIBI HOOD'},
    {id: '#8263', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/089e29cc63e5ce969628eec778ae2f/87089e29cc63e5ce969628eec778ae2f.gif?frame-time=1&w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/8263', collection: 'CHIBI HOOD'},
    {id: '#4559', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/16749a316d39c548ad5732b93e1ad8/a916749a316d39c548ad5732b93e1ad8.gif?frame-time=1&w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/4559', collection: 'CHIBI HOOD'},
    {id: '#7033', image: 'https://i2c.seadn.io/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/adad6c4a83c6c30b8f32981b354af9/cbadad6c4a83c6c30b8f32981b354af9.gif?frame-time=1&w=900', href: 'https://opensea.io/item/robinhood/0x4b712c60e11938b1026b8f5158e7e7f5b467302b/7033', collection: 'CHIBI HOOD'},
  ],
};

const sectionIds = ['signal', 'builds', 'loop', 'deal', 'collections', 'open'];

function SectionLabel({number, children}: {number: string; children: ReactNode}) {
  return <div className="d2-section-label"><span>{number}</span><b>{children}</b></div>;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, {rootMargin: '-24% 0px -58% 0px', threshold: [0.05, 0.25, 0.6]});

    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function CollectionTransmission() {
  const [collection, setCollection] = useState<NftItem['collection']>('REKT INK');
  const [index, setIndex] = useState(0);
  const items = nftCollections[collection];
  const current = items[index];
  const previous = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];

  useEffect(() => setIndex(0), [collection]);

  useEffect(() => {
    [previous.image, next.image].forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, [previous.image, next.image]);

  function move(delta: number) {
    setIndex((currentIndex) => (currentIndex + delta + items.length) % items.length);
  }

  return (
    <div className="d2-collection-shell">
      <SquircleShift className="d2-collection-effect" />
      <div className="d2-collection-wash" aria-hidden="true" />
      <div className="d2-collection-copy">
        <SectionLabel number="04">THE CULTURE</SectionLabel>
        <h2>BUILD OUT<br />FROM REKT.</h2>
        <p>Use the actual REKT / Chibi world as source material. Make something new.</p>
        <div className="d2-collection-switch" role="group" aria-label="Choose collection">
          {(Object.keys(nftCollections) as NftItem['collection'][]).map((name) => (
            <button key={name} type="button" className={collection === name ? 'is-active' : ''} onClick={() => setCollection(name)}>{name}</button>
          ))}
        </div>
        <span className="d2-source-note">CURATED MEDIA / OPENSEA</span>
      </div>

      <div className="d2-collection-stage">
        <div className="d2-stage-meta"><span>ARTIFACT / {current.id}</span><span>{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span></div>
        <div className="d2-art-triad">
          <button className="d2-art-peek d2-art-peek-prev" type="button" onClick={() => move(-1)} aria-label="Previous NFT">
            <img src={previous.image} alt="" />
            <span>← PREV</span>
          </button>
          <a className="d2-art-main" href={current.href} target="_blank" rel="noreferrer">
            <span className="d2-corner d2-corner-tl" /><span className="d2-corner d2-corner-tr" /><span className="d2-corner d2-corner-bl" /><span className="d2-corner d2-corner-br" />
            <img src={current.image} alt={`${current.collection} ${current.id}`} />
            <div className="d2-art-glass"><strong>{current.collection}</strong><span>{current.id} / VIEW ARTIFACT ↗</span></div>
          </a>
          <button className="d2-art-peek d2-art-peek-next" type="button" onClick={() => move(1)} aria-label="Next NFT">
            <img src={next.image} alt="" />
            <span>NEXT →</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AppV2() {
  const active = useActiveSection(sectionIds);
  const [loopStep, setLoopStep] = useState(1);
  const selected = loop[loopStep];

  return (
    <main className="dossier-v2 d2-compressed" id="top">
      <header className="d2-topbar">
        <a className="d2-brand" href="#top" aria-label="REKT Inkubator home"><span>REKT</span><b>INK(CUBATOR)</b></a>
        <div className="d2-transmission"><span>TRANSMISSION</span><strong>000</strong><i>BUILD MODE</i></div>
        <nav aria-label="Page sections" className="d2-nav">
          {sectionIds.map((id, index) => <a key={id} className={active === id ? 'is-active' : ''} href={`#${id}`} aria-label={`Go to ${id}`}>{String(index).padStart(2, '0')}</a>)}
        </nav>
      </header>

      <section className="d2-hero" id="signal" aria-labelledby="hero-title">
        <GrainWave className="d2-hero-grain" />
        <div className="d2-hero-wash" aria-hidden="true" />
        <div className="d2-frame d2-hero-grid">
          <div className="d2-hero-copy">
            <div className="d2-status"><span /> REKT INK(CUBATOR) / BUILD CHALLENGE</div>
            <p className="d2-eyebrow">BUILD WEIRD SHIT / SHIP IT</p>
            <h1 id="hero-title"><GlitchText>BUILD SOMETHING WEIRD. PUT IT ON THE INTERNET.</GlitchText></h1>
            <p className="d2-hero-lede">Short REKT build rounds for games, tools and weird internet experiments. You get a constraint and a deadline. You ship a working link.</p>
            <div className="d2-actions"><a className="d2-button" href="#loop">SEE THE LOOP <span>↓</span></a><b>MAKE DEGENS SHIP.</b></div>
            <div className="d2-metrics"><span>SHORT ROUNDS</span><span>WORKING LINK</span><span>REKT WORLD</span></div>
          </div>

          <div className="d2-artifact-bay" aria-label="REKT INK artifact identity">
            <span className="d2-corner d2-corner-tl" /><span className="d2-corner d2-corner-tr" /><span className="d2-corner d2-corner-bl" /><span className="d2-corner d2-corner-br" />
            <div className="d2-artifact-meta"><span>SPECIMEN / 000</span><span>REKT INK</span></div>
            <div className="d2-artifact-stack"><span className="d2-artifact-shadow" /><img src="./rekt-512.svg" alt="REKT mark" /><span className="d2-scan" /></div>
            <div className="d2-glass-id"><div className="d2-glass-mark"><img src="./rekt-512.svg" alt="" /></div><div><strong>REKT INK</strong><span>CULTURE → SOFTWARE</span><small>BUILD CHALLENGE / ROUND 000</small></div><i>GLASS ID / 000</i></div>
            <div className="d2-artifact-bottom"><strong>BAD IDEAS / WORKING SOFTWARE</strong><span>SHIP &gt; TALK</span></div>
          </div>
        </div>
      </section>

      <section className="d2-build-section" id="builds" aria-labelledby="builds-title">
        <div className="d2-frame">
          <div className="d2-section-head"><div><SectionLabel number="01">MAKE SOMETHING</SectionLabel><h2 id="builds-title">PICK A FORM.<br /><em>SHIP IT.</em></h2></div><p>Game, tool, interactive thing, or something unclassifiable. If people can click it, it counts.</p></div>
          <div className="d2-build-grid">
            {builds.map((build, index) => <article className="d2-build-card" key={build.code}><div className="d2-card-meta"><span>{build.code}</span><i>{String(index + 1).padStart(2, '0')}</i></div><div className="d2-card-mark" aria-hidden="true">{build.mark}</div><h3>{build.title}</h3><p>{build.body}</p><div className="d2-card-foot"><span>SHIP IT</span><b>+</b></div></article>)}
          </div>
        </div>
      </section>

      <section className="d2-signal-section" id="loop" aria-labelledby="loop-title">
        <div className="d2-frame d2-signal-grid">
          <div className="d2-signal-copy">
            <SectionLabel number="02">THE LOOP</SectionLabel>
            <h2 id="loop-title">5 STEPS.<br /><em>NO DECK.</em></h2>
            <p>Constraint → build → link → signal. That's the machine.</p>
          </div>
          <div className="d2-loop-instrument">
            <DitherWave />
            <div className="d2-loop-wash" aria-hidden="true" />
            <div className="d2-signal-statement">SHIP <span>&gt;</span> TALK</div>
            <div className="d2-loop-readout"><span>NOW / {selected.number}</span><strong>{selected.name}</strong><p>{selected.body}</p></div>
            <div className="d2-loop-tabs" role="list" aria-label="Build loop steps">
              {loop.map((step, index) => <button key={step.number} type="button" className={loopStep === index ? 'is-active' : ''} onClick={() => setLoopStep(index)}><span>{step.number}</span><b>{step.name}</b></button>)}
            </div>
          </div>
        </div>
      </section>

      <section className="d2-weight-section d2-deal-section" id="deal" aria-labelledby="deal-title">
        <div className="d2-frame">
          <div className="d2-section-head"><div><SectionLabel number="03">THE DEAL</SectionLabel><h2 id="deal-title">YOU BUILD IT.<br /><em>WE HELP IT TRAVEL.</em></h2></div><p>No pitch deck. Ship something people can click.</p></div>
          <div className="d2-weight-grid">
            <article><span>YOU</span><h3>MAKE<br />THE THING.</h3><ul><li>weird idea</li><li>working link</li><li>ship in public</li></ul></article>
            <article className="d2-weight-rekt"><span>INK(CUBATOR)</span><h3>CREATE<br />THE PULL.</h3><ul><li>constraint</li><li>deadline</li><li>eyes on what ships</li></ul></article>
          </div>
          <div className="d2-deal-flow"><span>AFTER SHIP</span><div className="d2-broadcast-flow" aria-label="Build distribution loop"><span>BUILD</span><b>→</b><span>CLIP</span><b>→</b><span>SHARE</span><b>→</b><span>NEXT BUILDER</span></div></div>
        </div>
        <div className="d2-marquee" aria-hidden="true"><div><span>MAKE DEGENS SHIP</span><i>✦</i><span>CULTURE → SOFTWARE</span><i>✦</i><span>WORKING URL OR GTFO</span><i>✦</i><span>MAKE DEGENS SHIP</span><i>✦</i><span>CULTURE → SOFTWARE</span><i>✦</i><span>WORKING URL OR GTFO</span><i>✦</i></div></div>
      </section>

      <section className="d2-collection-section" id="collections" aria-label="REKT and Chibi culture artifacts">
        <div className="d2-frame"><CollectionTransmission /></div>
      </section>

      <section className="d2-open" id="open" aria-labelledby="open-title">
        <GrainWave className="d2-open-grain" />
        <div className="d2-open-wash" aria-hidden="true" />
        <div className="d2-frame d2-open-inner">
          <div>
            <SectionLabel number="05">WHO / NEXT</SectionLabel>
            <div className="d2-fit-strip" aria-label="Builder types"><span>CODERS</span><span>GAME DEVS</span><span>ARTISTS</span><span>WEIRDOS</span></div>
            <h2 id="open-title">DUMB IDEA?<br /><em>MAKE IT REAL.</em></h2>
            <p>Can you turn it into a working link? You're the target.</p>
          </div>
          <div className="d2-button d2-button-static">ROUND 000 / SOON <span>↗</span></div>
        </div>
      </section>

      <footer className="d2-footer d2-frame"><span>REKT INK(CUBATOR)</span><span>BAD IDEAS. WORKING SOFTWARE.</span><span>MAKE DEGENS SHIP.</span></footer>
    </main>
  );
}

export default AppV2;
