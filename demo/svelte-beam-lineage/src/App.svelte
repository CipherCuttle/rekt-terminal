<script>
  import { onDestroy, tick } from 'svelte';
  import { scale } from 'svelte/transition';
  import AnimatedBeam from '$lib/AnimatedBeam.svelte';

  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const BIRTH_HOT_WINDOW = 8 * DAY;
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
  $: birthProject = [...visibleProjects]
    .filter((p) => playhead >= p.birthMs && playhead - p.birthMs <= BIRTH_HOT_WINDOW)
    .sort((a, b) => b.birthMs - a.birthMs)[0] ?? null;
  $: activeProject = birthProject
    ?? (selected && playhead >= selected.birthMs && playhead <= selected.endMs ? selected : null)
    ?? [...activeProjects].sort((a, b) => b.birthMs - a.birthMs)[0]
    ?? null;
  $: probeProject = activeProject ?? (selected && playhead >= selected.birthMs ? selected : null);
  $: knownProjectCount = projects.filter((p) => projectIsBorn(p)).length;
  $: knownFamilyCount = families.filter((f) => familyIsBorn(f.id)).length;
  $: ticks = buildTicks();
  $: bins = buildBins();

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function xPct(ms) { return 5 + clamp((ms - viewStart) / Math.max(1, viewEnd - viewStart), 0, 1) * 90; }
  function familyStartX(f) { return xPct(Math.max(familyBirth[f.id], viewStart)); }
  function familyEndX(f) { return xPct(Math.min(familyEnd[f.id], viewEnd)); }
  function birthX(p) { return xPct(Math.max(p.birthMs, viewStart)); }
  function endX(p) { return xPct(Math.min(p.endMs, viewEnd)); }
  function fmt(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function familyIsBorn(id) { return playhead >= familyBirth[id]; }
  function projectIsBorn(p) { return playhead >= p.birthMs; }
  function projectIsEnded(p) { return playhead >= p.endMs; }
  function familyIsHot(id) { return activeProject?.family === id; }
  function projectIsHot(id) { return activeProject?.id === id; }
  function bornCount(id) { return projects.filter((p) => p.family === id && playhead >= p.birthMs).length; }

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
      if (p.birthMs > playhead || p.birthMs > viewEnd || p.endMs < viewStart) continue;
      const observedStart = Math.max(p.birthMs, viewStart);
      const observedEnd = Math.min(p.endMs, playhead, viewEnd);
      if (observedEnd < observedStart) continue;
      const from = clamp(Math.floor(((observedStart - viewStart) / span) * count), 0, count - 1);
      const to = clamp(Math.ceil(((observedEnd - viewStart) / span) * count), 0, count - 1);
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

  function selectProject(p) {
    if (projectIsBorn(p)) selected = p;
  }

  async function toggleFamily(id) {
    if (!familyIsBorn(id)) return;
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsed = next;
    await tick();
    geometryKey += 1;
  }

  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="app-shell">
  <nav class="mode-rail" aria-label="REKT Inkubator surfaces">
    <div class="brand"><i class="brand-mark" aria-hidden="true"></i><span>REKT / INK(CUBATOR)</span></div>
    <div class="mode-links" aria-label="Instrument modes">
      {#each ['WORLD','COMMAND','PROJECT','PLAYER','SHIP'] as surface}
        <span class:current={surface === 'PLAYER'}>{surface}</span>
      {/each}
    </div>
    <span class="mode-meta">COCKPIT / SIGNAL SYSTEM V0</span>
  </nav>

  <header class="player-header">
    <div class="player-ident">
      <div class="player-glyph" aria-hidden="true"><span>CC</span></div>
      <div>
        <div class="kicker">PLAYER / BUILDER</div>
        <h1>CIPHERCUTTLE</h1>
        <p>BUILD HISTORY // OBSERVED REPOSITORY WINDOWS</p>
      </div>
    </div>
    <div class="player-stats" aria-label="History state">
      <div><strong>{String(knownProjectCount).padStart(2, '0')}</strong><span>KNOWN BUILDS</span></div>
      <div><strong>{String(knownFamilyCount).padStart(2, '0')}</strong><span>KNOWN FAMILIES</span></div>
    </div>
  </header>

  <section class="meta-strip" aria-label="History metadata">
    <div><span>SOURCE</span><b class="observed"><i></i>GITHUB / OBSERVED</b></div>
    <div><span>PLAYHEAD</span><b>{fmt(playhead)}</b></div>
    <div><span>DIRECTION</span><b>{direction < 0 ? 'REVERSE' : 'FORWARD'}</b></div>
    <div><span>LINEAGE CLAIM</span><b>GROUPING ≠ ANCESTRY</b></div>
  </section>

  <section class="instrument-frame">
    <header class="topbar">
      <div>
        <div class="eyebrow">INSTRUMENT 04 / PLAYER HISTORY</div>
        <h2>BUILD LINEAGE // LIVING HISTORY</h2>
      </div>
      <div class="source-pill"><i></i>AnimatedBeam.svelte // UPSTREAM UNMODIFIED</div>
    </header>

    <section class="controls" aria-label="History replay controls">
      <button on:click={rewind}>REWIND</button>
      <button class:active={playing} on:click={togglePlay}>{playing ? 'PAUSE' : 'PLAY HISTORY'}</button>
      <button on:click={() => speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1}>{speed}×</button>
      <div class="scales">
        {#each ['YEAR','MONTH','WEEK','DAY'] as mode}
          <button class:active={scaleMode === mode} on:click={() => setScale(mode)}>{mode}</button>
        {/each}
      </div>
      <div class="date-read"><i></i>{direction < 0 ? '←' : '→'} {fmt(playhead)}</div>
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
          <div class:born={familyIsBorn(family.id)} class="anchor family-start" bind:this={familyStartRefs[family.id]} style={`left:${familyStartX(family)}%;top:${family.y}px`}></div>
          <div class="anchor family-end" bind:this={familyEndRefs[family.id]} style={`left:${familyEndX(family)}%;top:${family.y}px`}></div>
          {#if familyIsBorn(family.id)}
            <button
              class:collapsed={collapsed.has(family.id)}
              class:active-family={familyIsHot(family.id)}
              class="family-label"
              style={`left:${familyStartX(family)}%;top:${family.y}px;--family-a:${family.colorA}`}
              on:click={() => toggleFamily(family.id)}
              in:scale={{ duration: 320, start: 0.45 }}
              out:scale={{ duration: 180, start: 0.45 }}
            >
              <i></i><span>{family.label}</span><small>{bornCount(family.id)} BUILDS · {collapsed.has(family.id) ? 'EXPAND' : 'COLLAPSE'}</small>
            </button>
          {/if}
        {/each}

        {#each visibleProjects as p (p.id)}
          <div
            class:born={projectIsBorn(p)}
            class:hot={projectIsHot(p.id)}
            class="anchor birth-anchor"
            bind:this={birthRefs[p.id]}
            style={`left:${birthX(p)}%;top:${familyById[p.family].y}px`}
          ></div>
          <div class="anchor end-anchor" bind:this={endRefs[p.id]} style={`left:${endX(p)}%;top:${familyById[p.family].y + p.dy}px`}></div>

          {#if !collapsed.has(p.family) && projectIsBorn(p)}
            <button
              class:selected={selected?.id === p.id}
              class:past={playhead > p.endMs}
              class:temporal-active={playhead >= p.birthMs && playhead <= p.endMs}
              class:beam-active={projectIsHot(p.id)}
              class="project-label"
              style={`left:${birthX(p)}%;top:${familyById[p.family].y + p.dy}px;--family-a:${familyById[p.family].colorA}`}
              on:click={() => selectProject(p)}
              in:scale={{ duration: 420, start: 0.35 }}
              out:scale={{ duration: 220, start: 0.35 }}
            >
              <i></i><span>{p.name}</span><small>{fmt(p.birthMs)}</small>
            </button>
          {/if}

          {#if !collapsed.has(p.family) && projectIsEnded(p)}
            <div
              class:past={playhead > p.endMs}
              class="end-cap"
              style={`left:${endX(p)}%;top:${familyById[p.family].y + p.dy}px;--family-a:${familyById[p.family].colorA}`}
              in:scale={{ duration: 260, start: 0.4 }}
              out:scale={{ duration: 160, start: 0.4 }}
            ></div>
          {/if}
        {/each}

        {#key geometryKey}
          <div class="beam-layer">
            {#each visibleFamilies as family (family.id)}
              {#if rootRef && familyStartRefs[family.id]}
                <AnimatedBeam
                  {containerRef}
                  fromRef={rootRef}
                  toRef={familyStartRefs[family.id]}
                  curvature={family.y < 298 ? 44 : -44}
                  duration={10.8}
                  delay={0.20}
                  pathColor={familyIsBorn(family.id) ? '#383d46' : '#22262d'}
                  pathWidth={familyIsBorn(family.id) ? 1.0 : 0.72}
                  pathOpacity={familyIsBorn(family.id) ? 0.10 : 0.045}
                  gradientStartColor={familyIsHot(family.id) ? family.colorA : familyIsBorn(family.id) ? '#272c34' : '#171b20'}
                  gradientStopColor={familyIsHot(family.id) ? family.colorB : familyIsBorn(family.id) ? '#343a45' : '#20252c'}
                />
              {/if}
              {#if familyStartRefs[family.id] && familyEndRefs[family.id]}
                <AnimatedBeam
                  {containerRef}
                  fromRef={familyStartRefs[family.id]}
                  toRef={familyEndRefs[family.id]}
                  curvature={0}
                  duration={11.6}
                  delay={0.34}
                  pathColor={familyIsBorn(family.id) ? '#3f444d' : '#21252c'}
                  pathWidth={familyIsBorn(family.id) ? 1.2 : 0.72}
                  pathOpacity={familyIsBorn(family.id) ? 0.12 : 0.04}
                  gradientStartColor={familyIsHot(family.id) ? family.colorA : familyIsBorn(family.id) ? '#242931' : '#171b20'}
                  gradientStopColor={familyIsHot(family.id) ? family.colorB : familyIsBorn(family.id) ? '#323842' : '#20252c'}
                />
              {/if}
            {/each}

            {#each visibleProjects as p (p.id)}
              {#if !collapsed.has(p.family) && projectIsBorn(p) && birthRefs[p.id] && endRefs[p.id]}
                {#key `${p.id}:${projectIsHot(p.id) ? direction : 0}`}
                  <AnimatedBeam
                    {containerRef}
                    fromRef={birthRefs[p.id]}
                    toRef={endRefs[p.id]}
                    curvature={p.dy * -0.62}
                    reverse={projectIsHot(p.id) && direction < 0}
                    duration={projectIsHot(p.id) ? 8.8 : 12.8}
                    delay={projectIsHot(p.id) ? 0.04 : 0.42}
                    pathColor={projectIsHot(p.id) ? '#505762' : '#343942'}
                    pathWidth={projectIsHot(p.id) ? 1.55 : 0.9}
                    pathOpacity={projectIsHot(p.id) ? 0.20 : 0.08}
                    gradientStartColor={projectIsHot(p.id) ? familyById[p.family].colorA : '#20252c'}
                    gradientStopColor={projectIsHot(p.id) ? familyById[p.family].colorB : '#303640'}
                  />
                {/key}
              {/if}
            {/each}
          </div>
        {/key}
      </div>

      <div class="histogram">
        <div class="hist-label"><span>KNOWN ACTIVITY MASS // SCRUB HISTORY</span><b>{activeProject ? `TRACE: ${activeProject.name}` : scaleMode}</b></div>
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
  </section>

  <aside class="probe instrument-frame">
    <div class="probe-head">
      <div><span class="kicker">PROJECT PROBE</span><strong>PLAYHEAD-BOUNDED INSPECTION</strong></div>
      <span class="truth-state"><i></i>OBSERVED</span>
    </div>
    {#if probeProject}
      <div class="probe-project">
        <strong>{probeProject.name}</strong>
        <span>{probeProject.language} // OBSERVED REPOSITORY WINDOW</span>
      </div>
      <dl>
        <div><dt>BIRTH MARKER</dt><dd>{fmt(probeProject.birthMs)}</dd></div>
        <div><dt>LAST PUSH SNAPSHOT</dt><dd>{projectIsEnded(probeProject) ? fmt(probeProject.endMs) : 'NOT YET REACHED'}</dd></div>
        <div><dt>TRACE STATE</dt><dd>{projectIsHot(probeProject.id) ? (direction < 0 ? 'LIVE · REVERSE' : 'LIVE · FORWARD') : projectIsEnded(probeProject) ? 'HISTORICAL' : 'ACTIVE WINDOW'}</dd></div>
      </dl>
    {:else}
      <div class="probe-project empty">
        <strong>NO PROJECT YET</strong>
        <span>SCRUB OR PLAY FORWARD TO MATERIALIZE BUILD HISTORY</span>
      </div>
    {/if}
    <p>Repository windows are OBSERVED demo inputs. Family grouping is presentation context, not proven ancestry. Future project names, end-state and activity stay hidden until the playhead reaches them.</p>
  </aside>
</div>
