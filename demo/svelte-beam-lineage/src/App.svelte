<script>
  import { onDestroy, tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import AnimatedBeam from '$lib/AnimatedBeam.svelte';

  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const START = Date.parse('2026-04-01T00:00:00Z');
  const END = Date.parse('2026-09-10T00:00:00Z');

  const families = [
    { id: 'qnty', label: 'QNTY SYSTEMS', y: 108, colorA: '#78e8ff', colorB: '#875fff' },
    { id: 'other', label: 'OTHER BUILDS', y: 238, colorA: '#a8afbb', colorB: '#707887' },
    { id: 'rekt', label: 'REKT SYSTEMS', y: 365, colorA: '#bb8cff', colorB: '#78e8ff' },
    { id: 'signal', label: 'SIGNAL / FRONTIER', y: 490, colorA: '#79ddff', colorB: '#b18aff' },
  ];

  const projects = [
    { id: 'qnty-core', family: 'qnty', name: 'Qnty', birth: '2026-04-09T21:29:04Z', end: '2026-08-16T21:46:51Z', dy: -58, language: 'Python' },
    { id: 'qntylab', family: 'qnty', name: 'QntyLab', birth: '2026-07-31T04:03:04Z', end: '2026-09-08T14:25:11Z', dy: -30, language: 'Python' },
    { id: 'eval', family: 'qnty', name: 'QntyAgentEval', birth: '2026-08-10T21:11:39Z', end: '2026-08-11T00:00:55Z', dy: 0, language: 'Python' },
    { id: 'qntyspot', family: 'qnty', name: 'QntySpot', birth: '2026-08-24T04:32:18Z', end: '2026-09-08T20:19:23Z', dy: 34, language: 'Python' },
    { id: 'authority', family: 'qnty', name: 'QntyAuthorityRoot', birth: '2026-09-02T20:10:38Z', end: '2026-09-08T15:53:16Z', dy: 68, language: 'TypeScript' },
    { id: 'rugpull', family: 'other', name: 'rugpull-tycoon', birth: '2026-07-01T23:35:31Z', end: '2026-07-18T21:06:47Z', dy: -36, language: 'TypeScript' },
    { id: 'smokestack', family: 'other', name: 'Smokestack', birth: '2026-08-23T21:24:56Z', end: '2026-08-28T03:08:23Z', dy: 38, language: 'TypeScript' },
    { id: 'rekt-terminal', family: 'rekt', name: 'rekt-terminal', birth: '2026-08-27T23:40:44Z', end: '2026-09-09T00:19:58Z', dy: -42, language: 'TypeScript' },
    { id: 'apple', family: 'rekt', name: 'apple-inu-bite-night', birth: '2026-09-08T12:37:00Z', end: '2026-09-08T22:17:27Z', dy: 42, language: 'TypeScript' },
    { id: 'frontier', family: 'signal', name: 'frontier', birth: '2026-09-04T23:27:04Z', end: '2026-09-08T22:48:18Z', dy: -30, language: 'TypeScript' },
  ].map((p) => ({ ...p, birthMs: Date.parse(p.birth), endMs: Date.parse(p.end) }));

  const familyById = Object.fromEntries(families.map((f) => [f.id, f]));
  const familyBirth = Object.fromEntries(
    families.map((f) => [f.id, Math.min(...projects.filter((p) => p.family === f.id).map((p) => p.birthMs))])
  );
  const familyEnd = Object.fromEntries(
    families.map((f) => [f.id, Math.max(...projects.filter((p) => p.family === f.id).map((p) => p.endMs))])
  );

  let containerRef;
  let rootRef;
  let familyStartRefs = {};
  let familyEndRefs = {};
  let birthRefs = {};
  let endRefs = {};
  let selected = projects[1];
  let collapsed = new Set();
  let playhead = END;
  let playing = false;
  let speed = 1;
  let direction = 1;
  let raf = 0;
  let lastFrame = 0;
  let scaleMode = 'YEAR';
  let viewStart = START;
  let viewEnd = END;
  let geometryKey = 0;

  $: visibleProjects = projects.filter((p) => p.endMs >= viewStart && p.birthMs <= viewEnd);
  $: visibleFamilies = families.filter((f) => visibleProjects.some((p) => p.family === f.id));
  $: activeProjects = visibleProjects.filter((p) => playhead >= p.birthMs && playhead <= p.endMs);
  $: activeProject = activeProjects.find((p) => p.id === selected?.id) ?? [...activeProjects].sort((a, b) => b.birthMs - a.birthMs)[0] ?? null;
  $: ticks = buildTicks();
  $: bins = buildBins();

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function xPct(ms) { return 5 + clamp((ms - viewStart) / Math.max(1, viewEnd - viewStart), 0, 1) * 90; }
  function familyStartX(f) { return xPct(Math.max(familyBirth[f.id], viewStart)); }
  function familyEndX(f) { return xPct(Math.min(familyEnd[f.id], viewEnd)); }
  function birthX(p) { return xPct(Math.max(p.birthMs, viewStart)); }
  function endX(p) { return xPct(Math.min(p.endMs, viewEnd)); }
  function fmt(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function familyIsHot(id) { return activeProject?.family === id; }
  function projectIsHot(id) { return activeProject?.id === id; }

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
    const count = 42;
    const span = viewEnd - viewStart;
    const arr = Array.from({ length: count }, (_, i) => ({ i, value: 0 }));
    for (const p of projects) {
      if (p.birthMs > viewEnd || p.endMs < viewStart) continue;
      const from = clamp(Math.floor(((Math.max(p.birthMs, viewStart) - viewStart) / span) * count), 0, count - 1);
      const to = clamp(Math.ceil(((Math.min(p.endMs, viewEnd) - viewStart) / span) * count), 0, count - 1);
      for (let i = from; i <= to; i += 1) arr[i].value += 1;
    }
    const max = Math.max(1, ...arr.map((b) => b.value));
    return arr.map((b) => ({ ...b, h: 7 + (b.value / max) * 38 }));
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

  async function rewind() {
    playing = false;
    cancelAnimationFrame(raf);
    direction = -1;
    playhead = START;
    if (scaleMode !== 'YEAR') {
      scaleMode = 'YEAR';
      viewStart = START;
      viewEnd = END;
      await tick();
      geometryKey += 1;
    }
  }

  function togglePlay() {
    if (playing) {
      playing = false;
      cancelAnimationFrame(raf);
      return;
    }
    if (playhead >= END - 1000) playhead = START;
    direction = 1;
    if (scaleMode !== 'YEAR') setScale('YEAR');
    playing = true;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!playing) return;
    const dt = now - lastFrame;
    lastFrame = now;
    playhead += dt * speed * ((END - START) / 16_000);
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
    const next = Number(value);
    if (next !== playhead) direction = next < playhead ? -1 : 1;
    playhead = next;
    await tick();
  }

  function selectProject(p) { selected = p; }

  async function toggleFamily(id) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsed = next;
    await tick();
    geometryKey += 1;
  }

  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="app-shell">
  <header class="topbar">
    <div>
      <div class="eyebrow">EXACT UPSTREAM SVELTE MOTION // PERSISTENT HISTORY CONTEXT</div>
      <h1>BUILD LINEAGE // LIVING HISTORY</h1>
    </div>
    <div class="source-pill">AnimatedBeam.svelte // UNMODIFIED</div>
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
    <div class="date-read">{direction < 0 ? '←' : '→'} {fmt(playhead)}</div>
  </section>

  <main class="stage-card">
    <div class="axis">
      {#each ticks as t}
        <div class="tick" style={`left:${xPct(t)}%`}><span>{tickLabel(t)}</span></div>
      {/each}
      <div class="playhead" style={`left:${xPct(playhead)}%`}></div>
    </div>

    <div class="beam-stage" bind:this={containerRef}>
      {#each visibleFamilies as family (family.id)}
        <div class:active-band={familyIsHot(family.id)} class="family-band" style={`top:${family.y - 50}px;--family-a:${family.colorA}`}></div>
      {/each}

      <div class="root node root" bind:this={rootRef} style="left:3.5%;top:298px"><span>PLAYER</span><small>BUILD ROOT</small></div>

      {#each visibleFamilies as family (family.id)}
        <div class="anchor family-start" bind:this={familyStartRefs[family.id]} style={`left:${familyStartX(family)}%;top:${family.y}px`}></div>
        <div class="anchor family-end" bind:this={familyEndRefs[family.id]} style={`left:${familyEndX(family)}%;top:${family.y}px`}></div>
        <button
          class:collapsed={collapsed.has(family.id)}
          class:active-family={familyIsHot(family.id)}
          class="family-label"
          style={`left:${familyStartX(family)}%;top:${family.y}px;--family-a:${family.colorA}`}
          on:click={() => toggleFamily(family.id)}
        >
          <i></i><span>{family.label}</span><small>{projects.filter((p) => p.family === family.id).length} BUILDS · {collapsed.has(family.id) ? 'EXPAND' : 'COLLAPSE'}</small>
        </button>
      {/each}

      {#each visibleProjects as p (p.id)}
        <div class="anchor birth-anchor" bind:this={birthRefs[p.id]} style={`left:${birthX(p)}%;top:${familyById[p.family].y}px`}></div>
        <div class="anchor end-anchor" bind:this={endRefs[p.id]} style={`left:${endX(p)}%;top:${familyById[p.family].y + p.dy}px`}></div>

        {#if !collapsed.has(p.family)}
          <button
            class:selected={selected?.id === p.id}
            class:future={playhead < p.birthMs}
            class:past={playhead > p.endMs}
            class:temporal-active={playhead >= p.birthMs && playhead <= p.endMs}
            class:beam-active={projectIsHot(p.id)}
            class="project-label"
            style={`left:${birthX(p)}%;top:${familyById[p.family].y + p.dy}px;--family-a:${familyById[p.family].colorA}`}
            on:click={() => selectProject(p)}
            in:scale={{ duration: 520, start: 0.72 }}
            out:fade={{ duration: 220 }}
          >
            <i></i><span>{p.name}</span><small>{fmt(p.birthMs)}</small>
          </button>
          <div
            class:future={playhead < p.birthMs}
            class:past={playhead > p.endMs}
            class:temporal-active={playhead >= p.birthMs && playhead <= p.endMs}
            class="end-cap"
            style={`left:${endX(p)}%;top:${familyById[p.family].y + p.dy}px;--family-a:${familyById[p.family].colorA}`}
          ></div>
        {/if}
      {/each}

      {#key `${geometryKey}:${direction}`}
        <div class="beam-layer">
          {#each visibleFamilies as family (family.id)}
            {#if rootRef && familyStartRefs[family.id]}
              <AnimatedBeam
                {containerRef}
                fromRef={rootRef}
                toRef={familyStartRefs[family.id]}
                curvature={family.y < 298 ? 44 : -44}
                reverse={direction < 0}
                duration={10.8}
                delay={0.20}
                pathColor="#383d46"
                pathWidth={1.0}
                pathOpacity={0.10}
                gradientStartColor={familyIsHot(family.id) ? family.colorA : '#272c34'}
                gradientStopColor={familyIsHot(family.id) ? family.colorB : '#343a45'}
              />
            {/if}
            {#if familyStartRefs[family.id] && familyEndRefs[family.id]}
              <AnimatedBeam
                {containerRef}
                fromRef={familyStartRefs[family.id]}
                toRef={familyEndRefs[family.id]}
                curvature={0}
                reverse={direction < 0}
                duration={11.6}
                delay={0.34}
                pathColor="#3f444d"
                pathWidth={1.2}
                pathOpacity={0.12}
                gradientStartColor={familyIsHot(family.id) ? family.colorA : '#242931'}
                gradientStopColor={familyIsHot(family.id) ? family.colorB : '#323842'}
              />
            {/if}
          {/each}

          {#each visibleProjects as p (p.id)}
            {#if !collapsed.has(p.family) && birthRefs[p.id] && endRefs[p.id]}
              <AnimatedBeam
                {containerRef}
                fromRef={birthRefs[p.id]}
                toRef={endRefs[p.id]}
                curvature={p.dy * -0.62}
                reverse={direction < 0}
                duration={projectIsHot(p.id) ? 8.8 : 12.8}
                delay={projectIsHot(p.id) ? 0.04 : 0.42}
                pathColor={projectIsHot(p.id) ? '#505762' : '#343942'}
                pathWidth={projectIsHot(p.id) ? 1.55 : 0.9}
                pathOpacity={projectIsHot(p.id) ? 0.20 : 0.08}
                gradientStartColor={projectIsHot(p.id) ? familyById[p.family].colorA : '#20252c'}
                gradientStopColor={projectIsHot(p.id) ? familyById[p.family].colorB : '#303640'}
              />
            {/if}
          {/each}
        </div>
      {/key}
    </div>

    <div class="histogram">
      <div class="hist-label"><span>ACTIVE PROJECT MASS // SCRUB HISTORY</span><b>{activeProject ? `TRACE: ${activeProject.name}` : scaleMode}</b></div>
      <div class="bars">
        {#each bins as b}
          <i style={`height:${b.h}px;opacity:${b.value ? 0.82 : 0.10}`}></i>
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
        <div><dt>TRACE STATE</dt><dd>{projectIsHot(selected.id) ? (direction < 0 ? 'LIVE · REVERSE' : 'LIVE · FORWARD') : 'CONTEXT'}</dd></div>
      </dl>
    {/if}
    <p>The full history now stays resident while the playhead moves. Past and future branches remain as context; only the currently intersected project trace is promoted to the literal upstream <code>AnimatedBeam.svelte</code> motion.</p>
  </aside>
</div>