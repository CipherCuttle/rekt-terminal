<script>
  import { onDestroy, tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import AnimatedBeam from '$lib/AnimatedBeam.svelte';

  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const START = Date.parse('2026-04-01T00:00:00Z');
  const END = Date.parse('2026-09-10T00:00:00Z');

  const families = [
    { id: 'qnty', label: 'QNTY SYSTEMS', y: 125, colorA: '#78e8ff', colorB: '#875fff' },
    { id: 'other', label: 'OTHER BUILDS', y: 265, colorA: '#9ca4b3', colorB: '#6f7785' },
    { id: 'rekt', label: 'REKT SYSTEMS', y: 390, colorA: '#bb8cff', colorB: '#78e8ff' },
    { id: 'signal', label: 'SIGNAL / FRONTIER', y: 500, colorA: '#79ddff', colorB: '#b18aff' },
  ];

  const projects = [
    { id: 'qnty-core', family: 'qnty', name: 'Qnty', birth: '2026-04-09T21:29:04Z', end: '2026-08-16T21:46:51Z', dy: -56, language: 'Python' },
    { id: 'qntylab', family: 'qnty', name: 'QntyLab', birth: '2026-07-31T04:03:04Z', end: '2026-09-08T14:25:11Z', dy: -18, language: 'Python' },
    { id: 'eval', family: 'qnty', name: 'QntyAgentEval', birth: '2026-08-10T21:11:39Z', end: '2026-08-11T00:00:55Z', dy: 20, language: 'Python' },
    { id: 'qntyspot', family: 'qnty', name: 'QntySpot', birth: '2026-08-24T04:32:18Z', end: '2026-09-08T20:19:23Z', dy: 58, language: 'Python' },
    { id: 'authority', family: 'qnty', name: 'QntyAuthorityRoot', birth: '2026-09-02T20:10:38Z', end: '2026-09-08T15:53:16Z', dy: 96, language: 'TypeScript' },
    { id: 'rugpull', family: 'other', name: 'rugpull-tycoon', birth: '2026-07-01T23:35:31Z', end: '2026-07-18T21:06:47Z', dy: -28, language: 'TypeScript' },
    { id: 'smokestack', family: 'other', name: 'Smokestack', birth: '2026-08-23T21:24:56Z', end: '2026-08-28T03:08:23Z', dy: 28, language: 'TypeScript' },
    { id: 'rekt-terminal', family: 'rekt', name: 'rekt-terminal', birth: '2026-08-27T23:40:44Z', end: '2026-09-09T00:19:58Z', dy: -28, language: 'TypeScript' },
    { id: 'apple', family: 'rekt', name: 'apple-inu-bite-night', birth: '2026-09-08T12:37:00Z', end: '2026-09-08T22:17:27Z', dy: 30, language: 'TypeScript' },
    { id: 'frontier', family: 'signal', name: 'frontier', birth: '2026-09-04T23:27:04Z', end: '2026-09-08T22:48:18Z', dy: 0, language: 'TypeScript' },
  ].map((p) => ({ ...p, birthMs: Date.parse(p.birth), endMs: Date.parse(p.end) }));

  const familyById = Object.fromEntries(families.map((f) => [f.id, f]));
  const familyBirth = Object.fromEntries(
    families.map((f) => [f.id, Math.min(...projects.filter((p) => p.family === f.id).map((p) => p.birthMs))])
  );

  let containerRef;
  let rootRef;
  let familyRefs = {};
  let projectRefs = {};
  let selected = projects[1];
  let playhead = END;
  let playing = false;
  let speed = 1;
  let raf = 0;
  let lastFrame = 0;
  let scaleMode = 'YEAR';
  let viewStart = START;
  let viewEnd = END;
  let geometryKey = 0;

  $: visibleProjects = projects.filter((p) => p.birthMs <= playhead && p.birthMs >= viewStart - 0.02 * (viewEnd - viewStart) && p.birthMs <= viewEnd + 0.02 * (viewEnd - viewStart));
  $: visibleFamilies = families.filter((f) => familyBirth[f.id] <= playhead && visibleProjects.some((p) => p.family === f.id));
  $: ticks = buildTicks();
  $: bins = buildBins();

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function xPct(ms) { return 5 + clamp((ms - viewStart) / Math.max(1, viewEnd - viewStart), 0, 1) * 90; }
  function familyX(f) { return xPct(familyBirth[f.id]); }
  function projectX(p) { return xPct(p.birthMs); }
  function fmt(ms) { return new Date(ms).toISOString().slice(0, 10); }

  function tickLabel(ms) {
    const d = new Date(ms);
    if (scaleMode === 'YEAR') return d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    if (scaleMode === 'MONTH') return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    if (scaleMode === 'WEEK') return ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getUTCDay()];
    return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
  }

  function buildTicks() {
    const out = [];
    let step = 30 * DAY;
    if (scaleMode === 'MONTH') step = 7 * DAY;
    if (scaleMode === 'WEEK') step = DAY;
    if (scaleMode === 'DAY') step = 6 * HOUR;
    let t = Math.ceil(viewStart / step) * step;
    for (; t <= viewEnd; t += step) out.push(t);
    return out;
  }

  function buildBins() {
    const count = 36;
    const span = viewEnd - viewStart;
    const arr = Array.from({ length: count }, (_, i) => ({ i, value: 0 }));
    for (const p of projects) {
      if (p.birthMs < viewStart || p.birthMs > viewEnd) continue;
      const i = clamp(Math.floor(((p.birthMs - viewStart) / span) * count), 0, count - 1);
      arr[i].value += 1;
    }
    const max = Math.max(1, ...arr.map((b) => b.value));
    return arr.map((b) => ({ ...b, h: 8 + (b.value / max) * 35 }));
  }

  async function setScale(mode) {
    playing = false;
    cancelAnimationFrame(raf);
    scaleMode = mode;
    const spans = { YEAR: END - START, MONTH: 38 * DAY, WEEK: 10 * DAY, DAY: 36 * HOUR };
    const span = spans[mode];
    if (mode === 'YEAR') {
      viewStart = START;
      viewEnd = END;
    } else {
      viewStart = clamp(playhead - span * 0.72, START, END - span);
      viewEnd = Math.min(END, viewStart + span);
    }
    await tick();
    geometryKey += 1;
  }

  function rewind() {
    playing = false;
    cancelAnimationFrame(raf);
    playhead = START;
    setScale('YEAR');
  }

  function togglePlay() {
    if (playing) {
      playing = false;
      cancelAnimationFrame(raf);
      return;
    }
    if (playhead >= END - 1000) playhead = START;
    if (scaleMode !== 'YEAR') setScale('YEAR');
    playing = true;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!playing) return;
    const dt = now - lastFrame;
    lastFrame = now;
    playhead += dt * speed * ((END - START) / 13_000);
    if (playhead >= END) {
      playhead = END;
      playing = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  async function scrub(value) {
    playing = false;
    cancelAnimationFrame(raf);
    playhead = Number(value);
    await tick();
  }

  function selectProject(p) { selected = p; }

  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="app-shell">
  <header class="topbar">
    <div>
      <div class="eyebrow">EXACT UPSTREAM SVELTE MOTION TEST</div>
      <h1>BUILD LINEAGE // ANIMATED BEAM</h1>
    </div>
    <div class="source-pill">SikandarJODD / AnimatedBeam.svelte</div>
  </header>

  <section class="controls">
    <button on:click={rewind}>REWIND</button>
    <button class:active={playing} on:click={togglePlay}>{playing ? 'PAUSE' : 'PLAY HISTORY'}</button>
    <button on:click={() => speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1}>{speed}×</button>
    <div class="scales">
      {#each ['YEAR','MONTH','WEEK','DAY'] as mode}
        <button class:active={scaleMode === mode} on:click={() => setScale(mode)}>{mode}</button>
      {/each}
    </div>
    <div class="date-read">{fmt(playhead)}</div>
  </section>

  <main class="stage-card">
    <div class="axis">
      {#each ticks as t}
        <div class="tick" style={`left:${xPct(t)}%`}><span>{tickLabel(t)}</span></div>
      {/each}
      <div class="playhead" style={`left:${xPct(playhead)}%`}></div>
    </div>

    <div class="beam-stage" bind:this={containerRef}>
      <div class="root node root" bind:this={rootRef} style="left:4%;top:302px"><span>PLAYER</span></div>

      {#each visibleFamilies as family (family.id)}
        <div
          class="node family"
          bind:this={familyRefs[family.id]}
          style={`left:${familyX(family)}%;top:${family.y}px`}
          in:scale={{ duration: 300, start: 0.7 }}
        >
          <span>{family.label}</span>
        </div>
      {/each}

      {#each visibleProjects as p (p.id)}
        <button
          class:selected={selected?.id === p.id}
          class="node project"
          bind:this={projectRefs[p.id]}
          style={`left:${projectX(p)}%;top:${familyById[p.family].y + p.dy}px`}
          on:click={() => selectProject(p)}
          in:scale={{ duration: 380, start: 0.55 }}
          out:fade={{ duration: 160 }}
        >
          <span>{p.name}</span><small>{fmt(p.birthMs)}</small>
        </button>
      {/each}

      {#key geometryKey}
        {#each visibleFamilies as family (family.id)}
          {#if rootRef && familyRefs[family.id]}
            <AnimatedBeam
              {containerRef}
              fromRef={rootRef}
              toRef={familyRefs[family.id]}
              curvature={family.y < 302 ? 52 : -52}
              duration={6.2}
              delay={0.15}
              pathColor="#5a606b"
              pathWidth={1.6}
              pathOpacity={0.18}
              gradientStartColor={family.colorA}
              gradientStopColor={family.colorB}
            />
          {/if}
        {/each}

        {#each visibleProjects as p (p.id)}
          {#if familyRefs[p.family] && projectRefs[p.id]}
            <AnimatedBeam
              {containerRef}
              fromRef={familyRefs[p.family]}
              toRef={projectRefs[p.id]}
              curvature={p.dy * -0.78}
              duration={4.8 + (projects.indexOf(p) % 4) * 0.55}
              delay={(projects.indexOf(p) % 5) * 0.13}
              pathColor="#616773"
              pathWidth={selected?.id === p.id ? 2.6 : 1.8}
              pathOpacity={selected?.id === p.id ? 0.30 : 0.16}
              gradientStartColor={familyById[p.family].colorA}
              gradientStopColor={familyById[p.family].colorB}
            />
          {/if}
        {/each}
      {/key}
    </div>

    <div class="histogram">
      <div class="hist-label">PROJECT BIRTH HISTOGRAM // SCRUB HISTORY</div>
      <div class="bars">
        {#each bins as b}
          <i style={`height:${b.h}px;opacity:${b.value ? 0.8 : 0.12}`}></i>
        {/each}
      </div>
      <input
        aria-label="History playhead"
        type="range"
        min={START}
        max={END}
        step={HOUR}
        value={playhead}
        on:input={(e) => scrub(e.currentTarget.value)}
      />
    </div>
  </main>

  <aside class="probe">
    <div class="probe-title">PROJECT PROBE</div>
    {#if selected}
      <strong>{selected.name}</strong>
      <span>{selected.language} // OBSERVED REPOSITORY WINDOW</span>
      <dl>
        <div><dt>BIRTH MARKER</dt><dd>{fmt(selected.birthMs)}</dd></div>
        <div><dt>LAST PUSH SNAPSHOT</dt><dd>{fmt(selected.endMs)}</dd></div>
        <div><dt>GROUPING</dt><dd>{familyById[selected.family].label}</dd></div>
      </dl>
    {/if}
    <p>Every luminous connection above is the unmodified upstream <code>AnimatedBeam.svelte</code> component. The demo only supplies DOM refs, timeline positions, and component props.</p>
  </aside>
</div>
