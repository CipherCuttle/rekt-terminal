<script>
  import { onDestroy, tick } from 'svelte';
  import AnimatedBeam from '$lib/AnimatedBeam.svelte';

  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const START = Date.parse('2026-04-01T00:00:00Z');
  const END = Date.parse('2026-09-10T00:00:00Z');
  const REPLAY_MS_PER_DAY = 90;
  const REPLAY_SEGMENT_MIN_MS = 850;
  const REPLAY_SEGMENT_MAX_MS = 3_200;
  const BIRTH_HOLD_MS = 1_650;
  const SCRUB_CUE_MS = 1_000;

  const projects = [
    { id: 'qnty-core', name: 'Qnty', birth: '2026-04-09T21:29:04Z', end: '2026-08-16T21:46:51Z', language: 'Python' },
    { id: 'rugpull', name: 'rugpull-tycoon', birth: '2026-07-01T23:35:31Z', end: '2026-07-18T21:06:47Z', language: 'TypeScript' },
    { id: 'qntylab', name: 'QntyLab', birth: '2026-07-31T04:03:04Z', end: '2026-09-08T14:25:11Z', language: 'Python' },
    { id: 'eval', name: 'QntyAgentEval', birth: '2026-08-10T21:11:39Z', end: '2026-08-11T00:00:55Z', language: 'Python' },
    { id: 'smokestack', name: 'Smokestack', birth: '2026-08-23T21:24:56Z', end: '2026-08-28T03:08:23Z', language: 'TypeScript' },
    { id: 'qntyspot', name: 'QntySpot', birth: '2026-08-24T04:32:18Z', end: '2026-09-08T20:19:23Z', language: 'Python' },
    { id: 'rekt-terminal', name: 'rekt-terminal', birth: '2026-08-27T23:40:44Z', end: '2026-09-09T00:19:58Z', language: 'TypeScript' },
    { id: 'authority', name: 'QntyAuthorityRoot', birth: '2026-09-02T20:10:38Z', end: '2026-09-08T15:53:16Z', language: 'TypeScript' },
    { id: 'frontier', name: 'frontier', birth: '2026-09-04T23:27:04Z', end: '2026-09-08T22:48:18Z', language: 'TypeScript' },
    { id: 'apple', name: 'apple-inu-bite-night', birth: '2026-09-08T12:37:00Z', end: '2026-09-08T22:17:27Z', language: 'TypeScript' },
  ].map((p, row) => ({ ...p, row, birthMs: Date.parse(p.birth), endMs: Date.parse(p.end) }));

  const replayBirths = [...projects].sort((a, b) => a.birthMs - b.birthMs);
  const latestObserved = [...projects].sort((a, b) => b.endMs - a.endMs)[0];

  let memoryOpen = false;
  let containerRef;
  let birthRefs = {};
  let cueEndRefs = {};
  let selected = latestObserved;
  let playhead = END;
  let playing = false;
  let speed = 1;
  let direction = 1;
  let raf = 0;
  let scaleMode = 'YEAR';
  let viewStart = START;
  let viewEnd = END;
  let geometryKey = 0;
  let cueProjectId = null;
  let cueTimeout = 0;
  let segmentFrom = START;
  let segmentTo = START;
  let segmentStartedAt = 0;
  let segmentDuration = 1;
  let holdUntil = 0;

  $: visibleProjects = projects.filter((p) => p.endMs >= viewStart && p.birthMs <= viewEnd);
  $: cueProject = cueProjectId ? projects.find((p) => p.id === cueProjectId) ?? null : null;
  $: knownProjectCount = projects.filter((p) => projectIsBorn(p)).length;
  $: ticks = buildTicks();
  $: bins = buildBins();

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function xPct(ms) { return 5 + clamp((ms - viewStart) / Math.max(1, viewEnd - viewStart), 0, 1) * 90; }
  function birthX(p) { return xPct(Math.max(p.birthMs, viewStart)); }
  function observedX(p) { return xPct(Math.min(Math.max(playhead, p.birthMs), p.endMs, viewEnd)); }
  function observedWidth(p) { return Math.max(0, observedX(p) - birthX(p)); }
  function cueEndX(p) { return Math.min(95, birthX(p) + 4.5); }
  function rowY(p) { return 70 + p.row * 48; }
  function fmt(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function fmtMonth(ms) { return new Date(ms).toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase(); }
  function projectIsBorn(p) { return playhead >= p.birthMs; }
  function projectIsEnded(p) { return playhead >= p.endMs; }
  function projectIsHot(id) { return cueProjectId === id; }
  function cueBeamDuration() { return playing ? Math.max(0.7, 1.35 / speed) : 0.78; }

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
    return arr.map((b) => ({ ...b, h: 5 + (b.value / max) * 30 }));
  }

  function clearCueTimeout() {
    clearTimeout(cueTimeout);
    cueTimeout = 0;
  }

  function setTransientCue(project) {
    clearCueTimeout();
    cueProjectId = project?.id ?? null;
    if (!project) return;
    cueTimeout = window.setTimeout(() => {
      if (!playing) cueProjectId = null;
      cueTimeout = 0;
    }, SCRUB_CUE_MS);
  }

  function crossedBirth(from, to) {
    if (from === to) return null;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    return [...projects]
      .filter((p) => p.birthMs > lo && p.birthMs <= hi)
      .sort((a, b) => b.birthMs - a.birthMs)[0] ?? null;
  }

  function replaySegmentDuration(from, to) {
    const gapDays = Math.max(0.01, (to - from) / DAY);
    const base = clamp(gapDays * REPLAY_MS_PER_DAY, REPLAY_SEGMENT_MIN_MS, REPLAY_SEGMENT_MAX_MS);
    return base / speed;
  }

  function nextReplayBirth(after) {
    return replayBirths.find((p) => p.birthMs > after + 1) ?? null;
  }

  function projectAtBirth(ms) {
    return replayBirths.find((p) => Math.abs(p.birthMs - ms) < 1_000) ?? null;
  }

  function beginReplaySegment(now) {
    const next = nextReplayBirth(playhead);
    segmentFrom = playhead;
    segmentTo = next?.birthMs ?? END;
    segmentStartedAt = now;
    segmentDuration = replaySegmentDuration(segmentFrom, segmentTo);
    holdUntil = 0;
    cueProjectId = null;
  }

  async function openMemory(project = null) {
    memoryOpen = true;
    playing = false;
    cancelAnimationFrame(raf);
    clearCueTimeout();
    holdUntil = 0;
    direction = 1;
    scaleMode = 'YEAR';
    viewStart = START;
    viewEnd = END;
    if (project) {
      selected = project;
      playhead = project.birthMs;
    } else {
      playhead = END;
    }
    await tick();
    geometryKey += 1;
    if (project) setTransientCue(project);
  }

  function closeMemory() {
    playing = false;
    cancelAnimationFrame(raf);
    clearCueTimeout();
    cueProjectId = null;
    holdUntil = 0;
    memoryOpen = false;
  }

  async function setScale(mode) {
    playing = false;
    cancelAnimationFrame(raf);
    holdUntil = 0;
    cueProjectId = null;
    clearCueTimeout();
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
    clearCueTimeout();
    cueProjectId = null;
    holdUntil = 0;
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

  async function togglePlay() {
    if (playing) {
      playing = false;
      cancelAnimationFrame(raf);
      holdUntil = 0;
      cueProjectId = null;
      return;
    }

    clearCueTimeout();
    if (playhead >= END - 1_000) playhead = START;
    direction = 1;

    if (scaleMode !== 'YEAR') {
      scaleMode = 'YEAR';
      viewStart = START;
      viewEnd = END;
      await tick();
      geometryKey += 1;
    }

    playing = true;
    const now = performance.now();
    beginReplaySegment(now);
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!playing) return;

    if (holdUntil) {
      if (now < holdUntil) {
        raf = requestAnimationFrame(frame);
        return;
      }
      cueProjectId = null;
      beginReplaySegment(now);
      raf = requestAnimationFrame(frame);
      return;
    }

    const progress = clamp((now - segmentStartedAt) / Math.max(1, segmentDuration), 0, 1);
    playhead = segmentFrom + (segmentTo - segmentFrom) * progress;

    if (progress >= 1) {
      playhead = segmentTo;
      const arrived = projectAtBirth(segmentTo);
      if (arrived) {
        selected = arrived;
        cueProjectId = arrived.id;
        holdUntil = now + (BIRTH_HOLD_MS / speed);
      } else {
        playhead = END;
        cueProjectId = null;
        playing = false;
        return;
      }
    }

    raf = requestAnimationFrame(frame);
  }

  function cycleSpeed() {
    const previous = speed;
    const next = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
    const now = performance.now();
    speed = next;

    if (!playing) return;
    if (holdUntil) {
      const remaining = Math.max(0, holdUntil - now);
      holdUntil = now + remaining * (previous / next);
      return;
    }

    segmentFrom = playhead;
    segmentStartedAt = now;
    segmentDuration = replaySegmentDuration(segmentFrom, segmentTo);
  }

  async function scrub(value) {
    playing = false;
    cancelAnimationFrame(raf);
    holdUntil = 0;
    const previous = playhead;
    const next = Number(value);
    if (next !== previous) direction = next < previous ? -1 : 1;
    const crossed = crossedBirth(previous, next);
    playhead = next;
    if (crossed) {
      selected = crossed;
      setTransientCue(crossed);
    } else {
      setTransientCue(null);
    }
    await tick();
  }

  function selectProject(project) {
    if (projectIsBorn(project)) selected = project;
  }

  onDestroy(() => {
    cancelAnimationFrame(raf);
    clearCueTimeout();
  });
</script>

<div class="app-shell">
  <nav class="mode-rail" aria-label="REKT Inkubator surfaces">
    <div class="brand"><i class="brand-mark" aria-hidden="true"></i><span>REKT / INK(CUBATOR)</span></div>
    <div class="mode-links" aria-label="Instrument modes">
      {#each ['WORLD','COMMAND','PROJECT','PLAYER','SHIP'] as surface}
        <span class:current={surface === 'PLAYER'}>{surface}</span>
      {/each}
    </div>
    <span class="mode-meta">PLAYER / BUILDER RECORD</span>
  </nav>

  <main class="player-record">
    <header class="identity-block">
      <div class="identity-main">
        <div class="player-glyph" aria-hidden="true"><span>CC</span></div>
        <div class="identity-copy">
          <div class="kicker">PLAYER / DURABLE BUILDER RECORD</div>
          <h1>CIPHERCUTTLE</h1>
          <div class="identity-line"><span class="observed-dot"></span>GITHUB SOURCE OBSERVED <b>·</b> DEMO HISTORY ONLY</div>
        </div>
      </div>
      <div class="latest-readout">
        <span>LAST OBSERVED WINDOW</span>
        <strong>{latestObserved.name}</strong>
        <small>through {fmt(latestObserved.endMs)}</small>
      </div>
    </header>

    <section class="current-strip" aria-label="Current builder context">
      <div class="section-index">01</div>
      <div>
        <span class="section-label">CURRENT MISSION</span>
        <strong>NOT PROJECTED IN THIS PROTOTYPE</strong>
        <p>PLAYER must not infer current Mission state from repository activity.</p>
      </div>
      <div class="current-state">INPUT REQUIRED</div>
    </section>

    <section class="record-strip" aria-label="Durable builder record">
      <div class="section-index">02</div>
      <div class="record-cell primary-record">
        <span>OBSERVED BUILDS</span>
        <strong>{String(projects.length).padStart(2, '0')}</strong>
        <small>repository windows in demo input</small>
      </div>
      <div class="record-cell unavailable"><span>SHIPS</span><strong>—</strong><small>not projected</small></div>
      <div class="record-cell unavailable"><span>ACCEPTED ASSISTS</span><strong>—</strong><small>not projected</small></div>
      <div class="record-cell unavailable"><span>ROUNDS / RECOVERIES</span><strong>—</strong><small>not projected</small></div>
    </section>

    <section class="thread-section" aria-labelledby="thread-title">
      <header class="section-head">
        <div>
          <div class="kicker">03 / MEMORY</div>
          <h2 id="thread-title">THE THREAD</h2>
          <p>Chronological observations only. No line below asserts ancestry, influence, quality or continuous effort.</p>
        </div>
        <button class="memory-entry" on:click={() => openMemory()}>
          <span>OPEN BUILD MEMORY</span>
          <b>REPLAY / INSPECT →</b>
        </button>
      </header>

      <div class="thread">
        {#each replayBirths as project, i (project.id)}
          <button class="thread-event" on:click={() => openMemory(project)} aria-label={`Open build memory at ${project.name}`}>
            <div class="thread-time">
              <span>{fmtMonth(project.birthMs)}</span>
              <b>{fmt(project.birthMs)}</b>
            </div>
            <div class="thread-spine" aria-hidden="true"><i></i></div>
            <div class="thread-copy">
              <span class="truth-tag">OBSERVED</span>
              <strong>{project.name}</strong>
              <small>{project.language} · repository window first observed in demo history</small>
            </div>
            <span class="thread-open">VIEW →</span>
          </button>
        {/each}
      </div>
    </section>

    <section class="record-note">
      <div class="section-index">04</div>
      <div>
        <span class="section-label">TRUTH CEILING</span>
        <strong>OBSERVED REPOSITORY WINDOWS ≠ SHIPS ≠ ASSISTS ≠ PROVEN ACHIEVEMENT</strong>
        <p>The production PLAYER surface should replace these demo-only observations with the actual durable Player projection when that operation is authorized and wired.</p>
      </div>
    </section>
  </main>

  {#if memoryOpen}
    <section class="memory-overlay" aria-label="Build memory replay">
      <header class="memory-header">
        <button class="back-button" on:click={closeMemory}>← PLAYER RECORD</button>
        <div>
          <span class="kicker">BUILD MEMORY / DEEP INSPECTION</span>
          <h2>CIPHERCUTTLE // OBSERVED BUILD WINDOWS</h2>
        </div>
        <div class="memory-truth"><i></i>OBSERVED</div>
      </header>

      <section class="controls" aria-label="History replay controls">
        <button on:click={rewind}>REWIND</button>
        <button class:active={playing} on:click={togglePlay}>{playing ? 'PAUSE' : 'PLAY HISTORY'}</button>
        <button on:click={cycleSpeed}>{speed}×</button>
        <div class="scales">
          {#each ['YEAR','MONTH','WEEK','DAY'] as mode}
            <button class:active={scaleMode === mode} on:click={() => setScale(mode)}>{mode}</button>
          {/each}
        </div>
        <div class="date-read">{direction < 0 ? '←' : '→'} {fmt(playhead)}</div>
      </section>

      <div class="memory-layout">
        <div class="memory-stage-card">
          <div class="axis">
            {#each ticks as t}
              <div class="tick" style={`left:${xPct(t)}%`}><span>{tickLabel(t)}</span></div>
            {/each}
            <div class="playhead" style={`left:${xPct(playhead)}%`}></div>
          </div>

          <div class="beam-stage" bind:this={containerRef}>
            {#each visibleProjects as p (p.id)}
              <div class:selected-row={selected?.id === p.id} class="project-row" style={`top:${rowY(p) - 22}px`}></div>
              <div class="row-name" class:born={projectIsBorn(p)} class:selected={selected?.id === p.id} style={`top:${rowY(p)}px`}>
                <span>{projectIsBorn(p) ? p.name : '·'}</span>
                <small>{projectIsBorn(p) ? p.language : ''}</small>
              </div>

              <div
                class:born={projectIsBorn(p)}
                class:hot={projectIsHot(p.id)}
                class="anchor birth-anchor"
                bind:this={birthRefs[p.id]}
                style={`left:${birthX(p)}%;top:${rowY(p)}px`}
              ></div>
              <div
                class="anchor cue-anchor"
                bind:this={cueEndRefs[p.id]}
                style={`left:${cueEndX(p)}%;top:${rowY(p)}px`}
              ></div>

              {#if projectIsBorn(p)}
                <button
                  class:selected={selected?.id === p.id}
                  class="observed-window-hit"
                  style={`left:${birthX(p)}%;width:${observedWidth(p)}%;top:${rowY(p)}px`}
                  on:click={() => selectProject(p)}
                  aria-label={`Inspect ${p.name}`}
                ></button>
                <div
                  class:selected={selected?.id === p.id}
                  class="observed-window"
                  style={`left:${birthX(p)}%;width:${observedWidth(p)}%;top:${rowY(p)}px`}
                ></div>
              {/if}

              {#if projectIsEnded(p)}
                <div class="end-cap" style={`left:${xPct(p.endMs)}%;top:${rowY(p)}px`}></div>
              {/if}
            {/each}

            {#key geometryKey}
              <div class="beam-layer">
                {#each visibleProjects as p (p.id)}
                  {#if projectIsHot(p.id) && birthRefs[p.id] && cueEndRefs[p.id]}
                    {#key `${p.id}:${direction}`}
                      <AnimatedBeam
                        {containerRef}
                        fromRef={birthRefs[p.id]}
                        toRef={cueEndRefs[p.id]}
                        curvature={0}
                        reverse={direction < 0}
                        duration={cueBeamDuration()}
                        delay={0.01}
                        pathColor="#465561"
                        pathWidth={1.35}
                        pathOpacity={0.22}
                        gradientStartColor="#5cc8ff"
                        gradientStopColor="#b29aff"
                      />
                    {/key}
                  {/if}
                {/each}
              </div>
            {/key}
          </div>

          <div class="histogram">
            <div class="hist-label"><span>KNOWN OBSERVED WINDOW MASS // SCRUB</span><b>{cueProject ? `ARRIVAL: ${cueProject.name}` : `${knownProjectCount}/${projects.length} VISIBLE`}</b></div>
            <div class="bars">
              {#each bins as b}
                <i style={`height:${b.h}px;opacity:${b.value ? 0.72 : 0.08}`}></i>
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
        </div>

        <aside class="memory-inspector">
          <span class="kicker">SELECTED OBSERVATION</span>
          {#if selected && projectIsBorn(selected)}
            <strong>{selected.name}</strong>
            <span class="inspector-truth"><i></i>OBSERVED WINDOW</span>
            <dl>
              <div><dt>FIRST OBSERVED</dt><dd>{fmt(selected.birthMs)}</dd></div>
              <div><dt>LAST PUSH SNAPSHOT</dt><dd>{projectIsEnded(selected) ? fmt(selected.endMs) : 'NOT YET REACHED'}</dd></div>
              <div><dt>LANGUAGE</dt><dd>{selected.language}</dd></div>
            </dl>
          {:else}
            <strong>NO BUILD SELECTED</strong>
            <p>Play or scrub forward until a repository window is observable.</p>
          {/if}
          <p class="inspector-note">This memory view deliberately removes family rails and parent/child branches. Chronological proximity does not prove ancestry or influence.</p>
        </aside>
      </div>

      <footer class="memory-footer">
        <span>REPLAY ENGINE / EVENT-PACED</span>
        <span>ANIMATED BEAM / UPSTREAM UNMODIFIED</span>
        <span>FUTURE STATE FAILS CLOSED</span>
      </footer>
    </section>
  {/if}
</div>