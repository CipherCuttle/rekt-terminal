import './command-prototype.css';

type LabState = 'IDLE' | 'INPUT' | 'ACTIVE' | 'SUCCESS' | 'ERROR';

const COPY: Record<LabState, {status: string; next: string; event: string; thread: string}> = {
  IDLE: {status: 'AWAITING SIGNAL', next: 'CONNECT SOURCE', event: 'NO NEW OBSERVATION', thread: 'DECLARED'},
  INPUT: {status: 'SOURCE ACQUIRED', next: 'INSPECT OBSERVATION', event: 'GITHUB / PUSH RECEIVED', thread: 'OBSERVED'},
  ACTIVE: {status: 'BUILDING', next: 'REQUEST EXTERNAL TEST', event: 'SOURCE FRESH / BUILD ACTIVE', thread: 'BUILDING'},
  SUCCESS: {status: 'PROVEN', next: 'OPEN SHIP RECEIPT', event: 'VERIFIER / ACCEPTED', thread: 'PROVEN'},
  ERROR: {status: 'BLOCKED', next: 'RESOLVE FAILED CHECK', event: 'TEST / FAILED', thread: 'BLOCKED'},
};

function MiniRekt({state}: {state: LabState}) {
  return (
    <svg className="ioc-rekt" data-state={state.toLowerCase()} viewBox="0 0 64 64" aria-label={`REKT ${state.toLowerCase()}`} role="img">
      <g className="ioc-gear" aria-hidden="true">
        <path d="M28 4h8l1 5 5 2 4-3 6 6-3 4 2 5 5 1v8l-5 1-2 5 3 4-6 6-4-3-5 2-1 5h-8l-1-5-5-2-4 3-6-6 3-4-2-5-5-1v-8l5-1 2-5-3-4 6-6 4 3 5-2z" />
      </g>
      <path className="ioc-hood" d="M17 50 18 23 31 11 46 23 48 50 41 56 24 56Z" />
      <path className="ioc-face" d="M22 28 31 21 43 28 41 43 24 43Z" />
      {state === 'ERROR' ? (
        <g className="ioc-dead-eyes"><path d="m25 30 5 5m0-5-5 5m10-5 5 5m0-5-5 5" /></g>
      ) : (
        <g className="ioc-eyes"><path d="m25 31 6-2-2 4-4 1zm10-2 6 2v3l-4-1z" /></g>
      )}
      <path className="ioc-tentacle" d="M42 45c10 0 13 6 9 11-3 4-9 2-7-2 1-2 4 0 5-3 1-2-2-3-5-2" />
    </svg>
  );
}

function Source({name, state, detail}: {name: string; state: 'live' | 'idle' | 'warn' | 'proven'; detail: string}) {
  return (
    <div className="ioc-source" data-source-state={state}>
      <span className="ioc-source-lamp" aria-hidden="true" />
      <div><b>{name}</b><small>{detail}</small></div>
    </div>
  );
}

export default function CommandPrototype({state}: {state: LabState}) {
  const copy = COPY[state];
  const githubState = state === 'IDLE' ? 'idle' : state === 'ERROR' ? 'warn' : state === 'SUCCESS' ? 'proven' : 'live';
  const testState = state === 'SUCCESS' ? 'proven' : state === 'ERROR' ? 'warn' : state === 'ACTIVE' ? 'live' : 'idle';

  return (
    <section className="ioc" data-state={state.toLowerCase()} aria-labelledby="ioc-title">
      <header className="ioc-topbar">
        <div><span>RKT//INK</span><b id="ioc-title">COMMAND / CALIBRATION PROOF</b></div>
        <div className="ioc-top-status"><i aria-hidden="true" /><span>{copy.status}</span><small>SIM / NON-CANONICAL</small></div>
      </header>

      <div className="ioc-grid">
        <section className="ioc-machine" aria-label="Mission machine">
          <div className="ioc-machine-grid" aria-hidden="true" />
          <svg className="ioc-signal-map" viewBox="0 0 760 420" aria-hidden="true">
            <path className="ioc-wire ioc-wire-a" d="M32 100H168L230 170H370" />
            <path className="ioc-wire ioc-wire-b" d="M32 210H140L230 170" />
            <path className="ioc-wire ioc-wire-c" d="M370 170H530L612 105H730" />
            <path className="ioc-wire ioc-wire-d" d="M370 170V326H680" />
            <circle className="ioc-packet" cx="230" cy="170" r="5" />
          </svg>

          <div className="ioc-mission-core">
            <div className="ioc-core-id"><span>MISSION / 017</span><small>INKUBATOR TERMINAL</small></div>
            <MiniRekt state={state} />
            <div className="ioc-core-copy">
              <small>CURRENT MISSION</small>
              <strong>SHIP THE WEIRD LITTLE THING</strong>
              <span>{copy.status}</span>
            </div>
          </div>

          <div className="ioc-next">
            <div><small>NEXT MOVE // 01</small><strong>{copy.next}</strong></div>
            <span className="ioc-next-arrow" aria-hidden="true">→</span>
          </div>

          <div className="ioc-event-strip">
            <span>RX</span><b>{copy.event}</b><small>12s</small>
            <svg viewBox="0 0 120 20" aria-hidden="true"><path d="M0 12h20l7-8 8 14 9-10 8 4h18l7-6 8 10 9-4h26" /></svg>
          </div>
        </section>

        <aside className="ioc-sources" aria-label="Observed sources">
          <div className="ioc-panel-head"><span>SOURCE BUS</span><b>OBSERVERS</b></div>
          <Source name="GITHUB" state={githubState} detail={state === 'IDLE' ? 'NO SIGNAL' : 'REPO LINKED'} />
          <Source name="DEPLOY" state={state === 'SUCCESS' ? 'proven' : 'idle'} detail={state === 'SUCCESS' ? 'PUBLIC' : 'UNKNOWN'} />
          <Source name="TEST" state={testState} detail={state === 'ERROR' ? 'FAILED' : state === 'SUCCESS' ? 'PASSED' : state === 'ACTIVE' ? 'REQUESTED' : 'WAITING'} />
          <div className="ioc-scope-small" aria-label="Signal trace">
            <span>RX TRACE</span>
            <svg viewBox="0 0 180 72" aria-hidden="true"><path className="ioc-scope-grid" d="M0 18H180M0 36H180M0 54H180M45 0V72M90 0V72M135 0V72"/><path className="ioc-scope-trace" d={state === 'ERROR' ? 'M0 38h40l8-28 10 54 11-48 10 42 10-20h91' : state === 'IDLE' ? 'M0 38h180' : 'M0 38h20l8-13 9 28 10-17 9 7 13-23 12 31 12-18 12 5 11-9 14 14 14-10h26'} /></svg>
          </div>
        </aside>
      </div>

      <div className="ioc-thread" aria-label="Mission thread">
        <div className="ioc-thread-label"><span>THE THREAD</span><small>meaningful gates / not tasks</small></div>
        {[
          ['DECLARE', true],
          ['SOURCE', state !== 'IDLE'],
          ['BUILD', state === 'ACTIVE' || state === 'SUCCESS' || state === 'ERROR'],
          ['TEST', state === 'SUCCESS' || state === 'ERROR'],
          ['SHIP', state === 'SUCCESS'],
        ].map(([label, active], index) => (
          <div className="ioc-thread-step" data-active={active ? 'true' : 'false'} key={String(label)}>
            <i aria-hidden="true" /><div><span>{String(index + 1).padStart(2, '0')}</span><b>{label}</b>{label === 'BUILD' && <small>{copy.thread}</small>}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
