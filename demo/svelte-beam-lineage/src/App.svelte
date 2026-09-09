<script>
  const projects = [
    { id: 'qnty-core', name: 'Qnty', birth: '2026-04-09T21:29:04Z', end: '2026-08-16T21:46:51Z', language: 'Python', tone: 'cyan' },
    { id: 'rugpull', name: 'rugpull-tycoon', birth: '2026-07-01T23:35:31Z', end: '2026-07-18T21:06:47Z', language: 'TypeScript', tone: 'orange' },
    { id: 'qntylab', name: 'QntyLab', birth: '2026-07-31T04:03:04Z', end: '2026-09-08T14:25:11Z', language: 'Python', tone: 'violet' },
    { id: 'eval', name: 'QntyAgentEval', birth: '2026-08-10T21:11:39Z', end: '2026-08-11T00:00:55Z', language: 'Python', tone: 'cyan' },
    { id: 'smokestack', name: 'Smokestack', birth: '2026-08-23T21:24:56Z', end: '2026-08-28T03:08:23Z', language: 'TypeScript', tone: 'orange' },
    { id: 'qntyspot', name: 'QntySpot', birth: '2026-08-24T04:32:18Z', end: '2026-09-08T20:19:23Z', language: 'Python', tone: 'violet' },
    { id: 'rekt-terminal', name: 'rekt-terminal', birth: '2026-08-27T23:40:44Z', end: '2026-09-09T00:19:58Z', language: 'TypeScript', tone: 'violet' },
    { id: 'authority', name: 'QntyAuthorityRoot', birth: '2026-09-02T20:10:38Z', end: '2026-09-08T15:53:16Z', language: 'TypeScript', tone: 'cyan' },
    { id: 'frontier', name: 'frontier', birth: '2026-09-04T23:27:04Z', end: '2026-09-08T22:48:18Z', language: 'TypeScript', tone: 'orange' },
    { id: 'apple', name: 'apple-inu-bite-night', birth: '2026-09-08T12:37:00Z', end: '2026-09-08T22:17:27Z', language: 'TypeScript', tone: 'violet' },
  ].map((p) => ({ ...p, birthMs: Date.parse(p.birth), endMs: Date.parse(p.end) }));

  const latestObserved = [...projects].sort((a, b) => b.endMs - a.endMs)[0];
  const firstObserved = [...projects].sort((a, b) => a.birthMs - b.birthMs)[0];
  let selected = latestObserved;
  let identityRef;
  let threadRef;
  let sourceRef;

  function fmt(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function month(ms) {
    return new Date(ms).toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  }

  function jumpTo(target) {
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cycleBuild() {
    const index = projects.findIndex((project) => project.id === selected.id);
    selected = projects[(index + 1) % projects.length];
  }
</script>

<div class="workbench">
  <header class="system-bar">
    <div class="brand-lockup">
      <span class="brand-mark" aria-hidden="true"><i></i></span>
      <div>
        <strong>REKT / INK(CUBATOR)</strong>
        <span>PLAYER INSTRUMENT</span>
      </div>
    </div>

    <nav class="surface-switch" aria-label="REKT Inkubator surfaces">
      {#each ['WORLD','COMMAND','PROJECT','PLAYER','SHIP'] as surface, i}
        <span class:active={surface === 'PLAYER'}><b>0{i + 1}</b>{surface}</span>
      {/each}
    </nav>

    <div class="system-id">
      <span>UNIT</span>
      <b>PLR-0017</b>
    </div>
  </header>

  <main class="panel-grid">
    <section class="identity-module hardware-panel" bind:this={identityRef}>
      <div class="panel-label"><span>01</span> IDENTITY</div>
      <div class="identity-content">
        <div class="portrait-tile" aria-hidden="true">
          <span>CC</span>
          <i class="portrait-led"></i>
        </div>
        <div class="identity-copy">
          <div class="micro-label">DURABLE BUILDER RECORD</div>
          <h1>CIPHERCUTTLE</h1>
          <div class="source-badge"><i></i> GITHUB / OBSERVED</div>
          <p>This prototype shows repository windows only. It does not infer effort, impact, ancestry, reputation or Mission state.</p>
        </div>
      </div>

      <div class="hardware-keys" aria-label="Player record navigation">
        <button class="key key-violet" style="cursor:pointer" type="button" on:click={() => jumpTo(identityRef)}><b>PROFILE</b><span>01</span></button>
        <button class="key key-cyan" style="cursor:pointer" type="button" on:click={() => jumpTo(threadRef)}><b>THREAD</b><span>02</span></button>
        <button class="key key-orange" style="cursor:pointer" type="button" on:click={() => jumpTo(sourceRef)}><b>SOURCES</b><span>03</span></button>
        <button class="key key-dark" type="button" disabled><b>RECEIPTS</b><span>OFF</span></button>
      </div>
    </section>

    <section class="status-module hardware-panel">
      <div class="panel-label"><span>02</span> RECORD CHANNELS</div>
      <div class="meter-grid">
        <article class="meter live">
          <span>OBSERVED BUILDS</span>
          <strong>{String(projects.length).padStart(2, '0')}</strong>
          <div class="meter-track"><i style="width:100%"></i></div>
          <small>repository windows</small>
        </article>
        <article class="meter unavailable">
          <span>SHIPS</span>
          <strong>—</strong>
          <div class="meter-track"><i></i></div>
          <small>not projected</small>
        </article>
        <article class="meter unavailable">
          <span>ACCEPTED ASSISTS</span>
          <strong>—</strong>
          <div class="meter-track"><i></i></div>
          <small>not projected</small>
        </article>
        <article class="meter unavailable">
          <span>RECOVERIES</span>
          <strong>—</strong>
          <div class="meter-track"><i></i></div>
          <small>not projected</small>
        </article>
      </div>

      <div class="current-readout">
        <div class="readout-screen">
          <span>SELECTED OBSERVED BUILD</span>
          <strong>{selected.name}</strong>
          <small>{fmt(selected.endMs)} · {selected.language}</small>
        </div>
        <button class="encoder" style="border:0;background:transparent;padding:0;cursor:pointer;color:inherit" type="button" on:click={cycleBuild} aria-label="Select next observed build">
          <i aria-hidden="true"></i><span>NEXT</span>
        </button>
      </div>
    </section>

    <section class="thread-module hardware-panel" bind:this={threadRef}>
      <div class="panel-heading">
        <div>
          <div class="panel-label"><span>03</span> THE THREAD</div>
          <h2>OBSERVED BUILD HISTORY</h2>
        </div>
        <div class="thread-range">
          <span>{fmt(firstObserved.birthMs)}</span>
          <i></i>
          <span>{fmt(latestObserved.endMs)}</span>
        </div>
      </div>

      <div class="thread-board" aria-label="Chronological observed build history">
        <div class="thread-spine" aria-hidden="true"></div>
        {#each projects as project, i (project.id)}
          <button
            type="button"
            class:selected={selected.id === project.id}
            class={`thread-event tone-${project.tone}`}
            on:click={() => selected = project}
          >
            <span class="event-index">{String(i + 1).padStart(2, '0')}</span>
            <span class="event-node" aria-hidden="true"></span>
            <span class="event-date">{month(project.birthMs)}<b>{fmt(project.birthMs).slice(8)}</b></span>
            <span class="event-copy">
              <strong>{project.name}</strong>
              <small>{project.language} · OBSERVED REPOSITORY WINDOW</small>
            </span>
            <span class="event-state">OBSERVED</span>
          </button>
        {/each}
      </div>
    </section>

    <aside class="inspect-module hardware-panel" bind:this={sourceRef}>
      <div class="panel-label"><span>04</span> BUILD CARTRIDGE</div>
      <div class={`cartridge tone-${selected.tone}`}>
        <div class="cartridge-top">
          <span>{selected.language.toUpperCase()}</span>
          <b>OBS</b>
        </div>
        <strong>{selected.name}</strong>
        <small>REPOSITORY WINDOW</small>
        <div class="cartridge-contact" aria-hidden="true">
          {#each Array(8) as _}<i></i>{/each}
        </div>
      </div>

      <dl class="inspect-data">
        <div><dt>FIRST OBSERVED</dt><dd>{fmt(selected.birthMs)}</dd></div>
        <div><dt>LAST SNAPSHOT</dt><dd>{fmt(selected.endMs)}</dd></div>
        <div><dt>SOURCE STATE</dt><dd class="observed">OBSERVED</dd></div>
        <div><dt>RELATIONSHIP</dt><dd>NOT ASSERTED</dd></div>
      </dl>

      <div class="truth-note">
        <span class="truth-icon">i</span>
        <p><b>TRUTH BOUNDARY</b> Repository timing is context, not proof of work quality, effort, ancestry, collaboration or Ship status.</p>
      </div>
    </aside>
  </main>

  <footer class="footer-strip">
    <span>PLAYER / SAVE FILE</span>
    <span>CLAIMED ≠ OBSERVED ≠ PROVEN</span>
    <span>STATIC HISTORY · NO REPLAY ENGINE</span>
  </footer>
</div>