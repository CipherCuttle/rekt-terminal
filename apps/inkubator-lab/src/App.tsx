import {useEffect, useRef, useState, type ReactNode} from 'react';

type DrawFrame = (context: CanvasRenderingContext2D, width: number, height: number, time: number, reduced: boolean) => void;

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

function useCanvasEffect(draw: DrawFrame, targetFps: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (navigator.userAgent.toLowerCase().includes('jsdom')) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let visible = true;
    let frame = 0;
    let last = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(context, width, height, 0, true);
    };

    const tick = (time: number) => {
      if (!visible || document.hidden) {
        frame = 0;
        return;
      }
      if (time - last >= 1000 / targetFps) {
        last = time;
        drawRef.current(context, width, height, time, false);
      }
      frame = window.requestAnimationFrame(tick);
    };

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !reduced && !frame) frame = window.requestAnimationFrame(tick);
      }, {threshold: 0.01})
      : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize, {passive: true});
    resize();
    if (!reduced) frame = window.requestAnimationFrame(tick);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [targetFps]);

  return canvasRef;
}

function GrainWave({className = ''}: {className?: string}) {
  const ref = useCanvasEffect((context, width, height, time, reduced) => {
    context.clearRect(0, 0, width, height);
    const t = reduced ? 0 : time * 0.00045;
    const lines = Math.max(18, Math.floor(height / 17));
    for (let index = 0; index < lines; index += 1) {
      const ratio = index / Math.max(1, lines - 1);
      const base = height * (0.12 + ratio * 0.77);
      const amplitude = 8 + Math.sin(ratio * Math.PI) * 25;
      context.beginPath();
      for (let x = -20; x <= width + 20; x += 7) {
        const y = base + Math.sin(x * 0.013 + t * (1.2 + ratio) + index * 0.32) * amplitude + Math.sin(x * 0.004 - t) * 7;
        x === -20 ? context.moveTo(x, y) : context.lineTo(x, y);
      }
      context.strokeStyle = `rgba(${142 + Math.round(ratio * 48)}, ${93 + Math.round(ratio * 45)}, 255, ${0.04 + Math.sin(ratio * Math.PI) * 0.13})`;
      context.lineWidth = 0.6 + (index % 3) * 0.18;
      context.stroke();
    }
    const specks = Math.floor((width * height) / 13000);
    for (let index = 0; index < specks; index += 1) {
      const x = (index * 83) % Math.max(1, width);
      const y = (index * 47 + (reduced ? 0 : time * 0.01)) % Math.max(1, height);
      context.fillStyle = 'rgba(238, 231, 255, .045)';
      context.fillRect(x, y, 1, 1);
    }
  }, 24);
  return <canvas ref={ref} className={`effect-canvas ${className}`} aria-hidden="true" />;
}

function DitherWave() {
  const ref = useCanvasEffect((context, width, height, time, reduced) => {
    context.clearRect(0, 0, width, height);
    const t = reduced ? 0 : time * 0.0007;
    const size = width < 540 ? 9 : 12;
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        const wave = Math.sin(x * 0.016 + t) * 40 + Math.sin(x * 0.004 - t * 0.7) * 18;
        const distance = Math.abs(y - (height * 0.5 + wave));
        const strength = Math.max(0, 1 - distance / 110);
        const alternate = ((x / size + y / size) % 2) === 0;
        if (strength > 0.04 && alternate) {
          context.fillStyle = `rgba(186, 153, 255, ${0.05 + strength * 0.42})`;
          context.fillRect(x, y, 2, 2);
        }
      }
    }
  }, 20);
  return <canvas ref={ref} className="effect-canvas" aria-hidden="true" />;
}

function GlitchText({children}: {children: ReactNode}) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      className="glitch-text"
      data-text={typeof children === 'string' ? children : undefined}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        ref.current?.style.setProperty('--glitch-x', `${x.toFixed(2)}px`);
        ref.current?.style.setProperty('--glitch-y', `${y.toFixed(2)}px`);
      }}
    >
      {children}
    </span>
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
  const ids = ['signal', 'loop', 'builds', 'room', 'open'];
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

      <section className="room-section" id="room" aria-labelledby="room-title">
        <div className="page-frame">
          <div className="section-heading"><div><SectionLabel number="03">THE ROOM</SectionLabel><h2 id="room-title">Sparse by design.</h2></div><p>Eight invited builders. Two wildcard slots. The point is not a membership dashboard; it is a room with enough signal to ship.</p></div>
          <div className="room-grid">
            {['VIBE CODER', 'GAME DEV', 'CREATIVE CODE', 'INK BUILDER', 'ARTIST', 'OSS TINKERER', 'WILDCARD', 'WILDCARD'].map((role, index) => <div className={`slot ${index > 5 ? 'is-open' : ''}`} key={`${role}-${index}`}><span>{String(index + 1).padStart(3, '0')}</span><strong>{role}</strong><i>{index > 5 ? 'OPEN' : 'INVITED'}</i></div>)}
          </div>
          <div className="reward-strip"><div><span>WEIGHT / 01</span><strong>250 USDT</strong></div><div><span>WEIGHT / 02</span><strong>REKT + CHIBI</strong></div><div><span>WEIGHT / 03</span><strong>FOUNDING STATUS</strong></div><div><span>WEIGHT / 04</span><strong>OFFICIAL SIGNAL</strong></div></div>
        </div>
      </section>

      <section className="open-section" id="open" aria-labelledby="open-title">
        <GrainWave />
        <div className="page-frame open-inner"><div><SectionLabel number="04">OPEN CHANNEL</SectionLabel><h2 id="open-title">Put the weird thing somewhere real.</h2><p>Build something that can be clicked. Bring the URL. Let the next round inherit the signal.</p></div><a className="button button-primary" href="#top">I WANT IN <span>↗</span></a></div>
      </section>

      <footer className="footer page-frame"><span>REKT INK(CUBATOR) / ROUND 000</span><span>SHIP &gt; TALK</span><span>INK-NATIVE BUILD CULTURE</span></footer>
    </main>
  );
}

export default App;
