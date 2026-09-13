import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {
  CHALLENGE_SURFACES,
  SURFACE_CUES,
  SURFACE_LABELS,
  parseChallengeSurface,
  type ChallengeSurface,
  type SurfaceState,
} from './state';
import './challenge-product.css';

const STATE_COPY: Record<SurfaceState, string> = {
  NORMAL: 'LIVE / SOURCE-BOUND',
  LOADING: 'LOADING / NO FABRICATION',
  EMPTY: 'EMPTY / NO CANONICAL DATA',
  ERROR: 'ERROR / LAST TRUSTWORTHY VALUE ONLY',
  UNAVAILABLE_OR_STALE: 'UNAVAILABLE / DO NOT SUBSTITUTE LEGACY DATA',
  UNAUTHORIZED: 'UNAUTHORIZED / FAIL CLOSED',
};

function surfaceFromLocation(fallback: ChallengeSurface): ChallengeSurface {
  return parseChallengeSurface(new URLSearchParams(window.location.search).get('surface')) ?? fallback;
}

function StatePanel({state, title, children}: {state: SurfaceState; title: string; children: ReactNode}) {
  return (
    <section className="challenge-state" data-surface-state={state.toLowerCase()} aria-live={state === 'ERROR' ? 'assertive' : 'polite'}>
      <div className="challenge-state__status"><span aria-hidden="true" />{STATE_COPY[state]}</div>
      <h2>{title}</h2>
      <div className="challenge-state__body">{children}</div>
    </section>
  );
}

function DiscoverSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge discovery transport is not exposed yet.">
      <p>The forward product will list Challenge-first opportunities here. Historical World, Project and social discovery routes are intentionally not substituted.</p>
      <p className="challenge-state__foot">NEXT SOURCE: canonical Challenge public-read route.</p>
    </StatePanel>
  );
}

function CompilerSurface() {
  const [sourceIntent, setSourceIntent] = useState('');
  const state: SurfaceState = sourceIntent.trim() ? 'NORMAL' : 'EMPTY';
  return (
    <div className="compiler-foundation">
      <section className="compiler-intake" aria-labelledby="compiler-intake-title">
        <small>SOURCE / ORGANIZER DRAFT</small>
        <h2 id="compiler-intake-title">WHAT SHOULD EXIST WHEN THIS IS DONE?</h2>
        <p>Describe the software. This first Stage-E slice records only your draft input; it does not pretend a model or deterministic compile has run.</p>
        <label htmlFor="compiler-source-intent">SOURCE INTENT</label>
        <textarea
          id="compiler-source-intent"
          value={sourceIntent}
          onChange={(event) => setSourceIntent(event.target.value)}
          placeholder="Example: Build a public dashboard that tracks…"
          rows={8}
        />
        <div className="compiler-intake__actions">
          <button type="button" disabled>COMPILE — TRANSPORT WIRING NEXT</button>
          <span>{sourceIntent.trim() ? 'DRAFT CAPTURED LOCALLY' : 'NO SOURCE INTENT YET'}</span>
        </div>
      </section>

      <StatePanel state={state} title={sourceIntent.trim() ? 'Draft source is present. Compiler state is not generated yet.' : 'Start with a fuzzy idea.'}>
        <p>{sourceIntent.trim() ? 'The next changeset will bind this intake to the Stage-D compiler without moving provider credentials into the browser.' : 'No requirements, assumptions, blueprint, risk profile or acceptance facts exist until input is compiled.'}</p>
        <dl className="authority-ledger" aria-label="Compiler authority legend">
          <div><dt>SOURCE</dt><dd>what the organizer actually supplied</dd></div>
          <div><dt>MODEL_PROPOSAL</dt><dd>untrusted interpretation only</dd></div>
          <div><dt>ORGANIZER_ACCEPTED</dt><dd>explicit human acceptance</dd></div>
          <div><dt>DETERMINISTIC_RULE</dt><dd>machine-derived consequence</dd></div>
        </dl>
      </StatePanel>
    </div>
  );
}

function ChallengeSurface() {
  const challengeId = new URLSearchParams(window.location.search).get('challenge');
  return challengeId ? (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge read transport is not exposed yet.">
      <p>Requested Challenge: <code>{challengeId}</code>. The UI will not fall back to mutable Mission or Project state.</p>
    </StatePanel>
  ) : (
    <StatePanel state="EMPTY" title="No Challenge selected.">
      <p>Select a canonical Challenge from Discover or open a Challenge deep link once the Challenge public-read transport exists.</p>
    </StatePanel>
  );
}

function MyBuildSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge Entry transport is not exposed yet.">
      <p>My Build will be entry-specific and authenticated. Existing Project progress is not treated as Challenge authority.</p>
    </StatePanel>
  );
}

function ReviewSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Test Arena mechanics are not authorized in Stage E.">
      <p>This is the future organizer review surface. Stage G owns reveal, normalized testing, qualification and side-by-side evaluation mechanics.</p>
    </StatePanel>
  );
}

function HistorySurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge receipt read transport is not exposed yet.">
      <p>Durable evidence and Ship ancestry may be reused behind the boundary, but historical Ship UI is not substituted for Challenge receipts.</p>
    </StatePanel>
  );
}

function OperatorSurface() {
  return (
    <StatePanel state="UNAUTHORIZED" title="Operator authorization required.">
      <p>Exception handling is fail-closed. No operator controls are exposed until a canonical authorized operator context is established.</p>
    </StatePanel>
  );
}

function Surface({surface}: {surface: ChallengeSurface}) {
  if (surface === 'DISCOVER') return <DiscoverSurface />;
  if (surface === 'COMPILER') return <CompilerSurface />;
  if (surface === 'CHALLENGE') return <ChallengeSurface />;
  if (surface === 'MY_BUILD') return <MyBuildSurface />;
  if (surface === 'REVIEW') return <ReviewSurface />;
  if (surface === 'HISTORY') return <HistorySurface />;
  return <OperatorSurface />;
}

export default function ChallengeProduct({initialSurface = 'DISCOVER'}: {initialSurface?: ChallengeSurface}) {
  const [surface, setSurface] = useState(() => surfaceFromLocation(initialSurface));

  useEffect(() => {
    const onPopState = () => setSurface(surfaceFromLocation(initialSurface));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialSurface]);

  const currentIndex = useMemo(() => CHALLENGE_SURFACES.indexOf(surface), [surface]);

  const selectSurface = (next: ChallengeSurface) => {
    if (next === surface) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    url.searchParams.delete('lab');
    url.searchParams.set('surface', next.toLowerCase().replaceAll('_', '-'));
    window.history.pushState({challengeSurface: next}, '', url);
    setSurface(next);
  };

  return (
    <main className="challenge-product" data-challenge-surface={surface.toLowerCase()}>
      <a className="challenge-skip" href="#challenge-workspace">Skip to Challenge workspace</a>
      <header className="challenge-topbar">
        <a className="challenge-brand" href="?surface=discover"><strong>REKT<i>//</i></strong><span>INKUBATOR</span></a>
        <span className="challenge-purpose">CHALLENGE OS / STAGE E</span>
        <span className="challenge-authority">TRUTH BEFORE THEATER</span>
      </header>

      <section className="challenge-heading">
        <div>
          <small>{String(currentIndex + 1).padStart(2, '0')} / {String(CHALLENGE_SURFACES.length).padStart(2, '0')} · {SURFACE_CUES[surface]}</small>
          <h1>{SURFACE_LABELS[surface]}</h1>
          <p>IDEA → FAIR BUILD CONTRACT → COMPETITION → REAL SOFTWARE → DURABLE RESULT</p>
        </div>
        <div className="challenge-heading__readout" aria-label="Stage readout">
          <span>PHASE<b>STAGE E</b></span>
          <span>AUTHORITY<b>CHALLENGE-FIRST</b></span>
          <span>MONEY<b>NOT AUTHORIZED</b></span>
        </div>
      </section>

      <section className="challenge-chassis">
        <nav className="challenge-nav" aria-label="Challenge product">
          <span className="challenge-nav__label">SURFACE / SELECT</span>
          {CHALLENGE_SURFACES.map((item, index) => (
            <button
              key={item}
              type="button"
              aria-current={item === surface ? 'page' : undefined}
              onClick={() => selectSurface(item)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{SURFACE_LABELS[item]}</b>
              <small>{SURFACE_CUES[item]}</small>
            </button>
          ))}
          <div className="challenge-nav__imprint" data-decorative aria-hidden="true">
            <span />
            <p>SAME DEGENS.<br /><b>BETTER CONTRACTS.</b></p>
          </div>
        </nav>

        <section id="challenge-workspace" tabIndex={-1} className="challenge-workspace" aria-label={`${SURFACE_LABELS[surface]} workspace`}>
          <Surface surface={surface} />
        </section>
      </section>

      <footer className="challenge-footer">
        <span>E-GATE-1 / IA LOCKED</span>
        <span>E-GATE-2 / STATES LOCKED</span>
        <span>E-GATE-3 / REAL DATA ONLY</span>
      </footer>
    </main>
  );
}
