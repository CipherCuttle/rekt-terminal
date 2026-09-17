import {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {InkubatorApiError, type InkubatorApiClient} from './generated/inkubator-api-client';
import {createInkubatorApiClient} from './inkubator-api';
import ChallengeProduct, {type ChallengeProductApi} from './challenge-ui/ChallengeProduct';
import {CHALLENGE_SURFACES, parseChallengeSurface, SURFACE_CUES, SURFACE_LABELS, type ChallengeSurface} from './challenge-ui/state';
import './instrument-os/instrument-os.css';
import './shell/terminal-shell.css';
import './shell/terminal-shell-v2.css';
import './shell/coherence-foundation-v0.css';
import './shell/faceplate.css';
import './shell/faceplate-a11y.css';
import './shell/readability-v1.css';
import './challenge-ui/challenge-journey.css';

const defaultClient = createInkubatorApiClient();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USER_SURFACES: ChallengeSurface[] = ['DISCOVER', 'COMPILER', 'CHALLENGE', 'MY_BUILD', 'REVIEW', 'HISTORY'];

function challengeHref(surface: ChallengeSurface, challengeId?: string | null): string {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('surface', surface.toLowerCase().replaceAll('_', '-'));
  if (challengeId) url.searchParams.set('challenge', challengeId);
  return `${url.pathname}${url.search}`;
}

function parseChallengeTarget(value: string): string | null {
  const trimmed = value.trim();
  if (UUID_PATTERN.test(trimmed)) return trimmed.toLowerCase();
  try {
    const url = new URL(trimmed, window.location.origin);
    const candidate = url.searchParams.get('challenge');
    return candidate && UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
  } catch {
    return null;
  }
}

function currentSurface(): ChallengeSurface {
  return parseChallengeSurface(new URLSearchParams(window.location.search).get('surface')) ?? 'DISCOVER';
}

function FaceplateRail({surface, challengeId}: {surface: ChallengeSurface; challengeId: string | null}) {
  return (
    <nav className="ios-mode-rail ios-shell-mode-rail challenge-journey-rail" aria-label="Inkubator journey">
      <span className="ios-rail-label">JOURNEY / SELECT</span>
      {USER_SURFACES.map((item, index) => {
        const needsChallenge = ['CHALLENGE', 'MY_BUILD', 'REVIEW', 'HISTORY'].includes(item);
        const enabled = !needsChallenge || Boolean(challengeId);
        const current = item === surface;
        const href = enabled ? challengeHref(item, challengeId) : undefined;
        return href ? (
          <a key={item} href={href} aria-current={current ? 'page' : undefined} data-availability="enabled">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <b>{SURFACE_LABELS[item]}</b>
            <small>{SURFACE_CUES[item]} · {current ? 'CURRENT' : 'AVAILABLE'}</small>
          </a>
        ) : (
          <span key={item} className="challenge-journey-rail__pending" data-availability="pending">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <b>{SURFACE_LABELS[item]}</b>
            <small>{SURFACE_CUES[item]} · NEEDS CHALLENGE</small>
          </span>
        );
      })}
      <a className="challenge-journey-operator" href={challengeHref('OPERATOR', challengeId)}>SYSTEM / OPERATOR</a>
      <div className="faceplate-rail-imprint" aria-hidden="true">
        <span className="faceplate-reg" />
        <p>IDEA →<br /><b>SOFTWARE.</b></p>
        <small>REKT / INKUBATOR / ALPHA</small>
      </div>
    </nav>
  );
}

function SessionStatus({client}: {client: Pick<InkubatorApiClient, 'getMe'>}) {
  const query = useQuery({queryKey: ['inkubator', 'session', 'journey'], queryFn: () => client.getMe(), retry: false, staleTime: 30_000});
  if (query.isPending) return <span className="challenge-journey-session">IDENTITY / CHECKING</span>;
  if (!query.error) return <span className="challenge-journey-session" data-state="connected">GITHUB / CONNECTED</span>;
  const status = query.error instanceof InkubatorApiError ? query.error.status : 0;
  if (status === 401) return <a className="challenge-journey-session challenge-journey-session--action" href="/v1/auth/github/start">CONNECT GITHUB →</a>;
  return <button type="button" className="challenge-journey-session challenge-journey-session--action" onClick={() => void query.refetch()}>IDENTITY OFFLINE / RETRY</button>;
}

function JourneyChrome({surface, challengeId, client, children}: {surface: ChallengeSurface; challengeId: string | null; client: Pick<InkubatorApiClient, 'getMe'>; children: React.ReactNode}) {
  return (
    <main className="ios-lab ios-shell ios-shell-v2 challenge-journey-shell" data-shell="terminal" data-shell-variant="v2" data-mode="command">
      <a className="faceplate-skip" href="#journey-workspace">Skip to Inkubator</a>
      <div className="faceplate-topbar">
        <a className="faceplate-brand" href={challengeHref('DISCOVER')}><strong>REKT<i>//</i></strong><span className="faceplate-brand-label">INKUBATOR</span></a>
        <span className="faceplate-purpose">TECHNICAL FACEPLATE / CHALLENGE PRODUCT</span>
        <SessionStatus client={client} />
        <span className="faceplate-registration" aria-hidden="true" />
      </div>
      <header className="ios-lab-header ios-shell-header challenge-journey-header">
        <span className="faceplate-head-reg" aria-hidden="true" />
        <div>
          <small>{String(USER_SURFACES.indexOf(surface) + 1).padStart(2, '0')} / {String(USER_SURFACES.length).padStart(2, '0')} · {SURFACE_CUES[surface]}</small>
          <h1>{surface === 'DISCOVER' ? 'WHAT ARE YOU HERE TO DO?' : SURFACE_LABELS[surface]}</h1>
          <p>{surface === 'DISCOVER' ? 'Run a build challenge or enter one. The product should tell you the next move without requiring secret URLs or internal protocol knowledge.' : 'ONE CHALLENGE. ONE FROZEN CONTRACT. ONE CLEAR NEXT MOVE.'}</p>
        </div>
        <div className="ios-shell-readout" aria-label="Alpha authority">
          <div><span>VALUE</span><b>TEST ONLY</b></div>
          <div><span>JUDGING</span><b>OBJECTIVE + ORGANIZER PICK</b></div>
          <div><span>STATE</span><b>{challengeId ? 'CHALLENGE OPEN' : 'NO CHALLENGE SELECTED'}</b></div>
        </div>
      </header>
      <section className="ios-shell-chassis">
        <FaceplateRail surface={surface} challengeId={challengeId} />
        <section id="journey-workspace" tabIndex={-1} className="ios-shell-workspace challenge-journey-workspace" aria-label={`${SURFACE_LABELS[surface]} workspace`}>
          {children}
        </section>
      </section>
      <footer className="ios-lab-footer ios-shell-footer challenge-journey-footer">
        <span>STAGE I / OWNER TRIAL</span><span>NO REAL VALUE</span><span>TRUTH BEFORE THEATER</span>
      </footer>
    </main>
  );
}

function JourneyHome({client}: {client: Pick<InkubatorApiClient, 'getMe'>}) {
  const params = new URLSearchParams(window.location.search);
  const existingChallenge = params.get('challenge');
  const [target, setTarget] = useState(existingChallenge ?? '');
  const challengeId = useMemo(() => parseChallengeTarget(target), [target]);
  const observation = params.get('github_observation');
  const observationReason = params.get('github_observation_reason');

  return (
    <JourneyChrome surface="DISCOVER" challengeId={challengeId ?? existingChallenge} client={client}>
      {observation === 'degraded' ? <div className="challenge-journey-notice" role="status">GITHUB OBSERVATION DEGRADED · {observationReason ?? 'provider observation incomplete'} · challenge creation and deterministic state remain available.</div> : null}
      <section className="challenge-journey-intro">
        <small>START / CHOOSE YOUR ROLE</small>
        <h2>ONE FRONT DOOR.</h2>
        <p>Organizers define what should exist and freeze the rules. Builders open an existing Challenge, read the exact contract, build, check and submit immutable evidence.</p>
      </section>

      <div className="challenge-journey-lanes">
        <article className="challenge-journey-lane challenge-journey-lane--organizer">
          <small>01 / ORGANIZER</small>
          <h3>I WANT TO RUN A BUILD CHALLENGE.</h3>
          <p>Describe the software outcome, resolve the compiler questions, freeze the Build Contract, then open the competition with TEST value.</p>
          <ol><li>CREATE</li><li>COMPILE</li><li>LOCK</li><li>OPEN</li></ol>
          <a className="challenge-journey-primary" href={challengeHref('COMPILER')}>CREATE A CHALLENGE →</a>
        </article>

        <article className="challenge-journey-lane challenge-journey-lane--builder">
          <small>02 / BUILDER</small>
          <h3>I HAVE A CHALLENGE TO BUILD.</h3>
          <p>Paste the Challenge link or ID. You should land on the public contract first, then join and continue into My Build.</p>
          <label htmlFor="challenge-target">CHALLENGE LINK OR ID</label>
          <input id="challenge-target" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Paste a Challenge URL or UUID" />
          {challengeId ? <a className="challenge-journey-primary" href={challengeHref('CHALLENGE', challengeId)}>OPEN CHALLENGE →</a> : <span className="challenge-journey-primary challenge-journey-primary--disabled">ENTER A VALID CHALLENGE ID</span>}
        </article>
      </div>

      <section className="challenge-journey-loop" aria-label="Inkubator product journey">
        <small>THE LOOP / WHAT HAPPENS NEXT</small>
        <div>{['POST', 'COMPILE', 'LOCK', 'BUILD', 'SUBMIT', 'REVEAL', 'TEST', 'PICK', 'RECEIPT'].map((step, index) => <span key={step}><b>{String(index + 1).padStart(2, '0')}</b>{step}</span>)}</div>
      </section>
    </JourneyChrome>
  );
}

export type ChallengeJourneyClient = ChallengeProductApi & Pick<InkubatorApiClient, 'getMe'>;

export default function ChallengeJourney({client = defaultClient as ChallengeJourneyClient}: {client?: ChallengeJourneyClient}) {
  const [surface, setSurface] = useState(currentSurface);
  const challengeId = new URLSearchParams(window.location.search).get('challenge');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'command' && !params.get('surface')) {
      params.delete('mode');
      params.set('surface', 'discover');
      window.history.replaceState({challengeSurface: 'DISCOVER'}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
      setSurface('DISCOVER');
    }
    const onPopState = () => setSurface(currentSurface());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (surface === 'DISCOVER') return <JourneyHome client={client} />;

  return (
    <JourneyChrome surface={surface} challengeId={challengeId} client={client}>
      <div className="challenge-journey-runtime">
        <ChallengeProduct initialSurface={surface} api={client} />
      </div>
    </JourneyChrome>
  );
}
