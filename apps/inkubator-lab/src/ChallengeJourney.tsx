import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {InkubatorApiError, type InkubatorApiClient} from './generated/inkubator-api-client';
import {createInkubatorApiClient} from './inkubator-api';
import ChallengeProduct, {type ChallengeProductApi} from './challenge-ui/ChallengeProduct';
import {parseChallengeSurface, SURFACE_CUES, SURFACE_LABELS, type ChallengeSurface} from './challenge-ui/state';
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
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    railRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [surface]);

  return (
    <nav ref={railRef} className="ios-mode-rail ios-shell-mode-rail challenge-journey-rail" aria-label="Inkubator journey">
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

function GitHubIdentityDock({client}: {client: Pick<InkubatorApiClient, 'getMyConnectionContext'>}) {
  const query = useQuery({
    queryKey: ['inkubator', 'connection', 'journey'],
    queryFn: () => client.getMyConnectionContext(),
    retry: false,
    staleTime: 30_000,
  });
  const login = query.data?.github.login;
  if (!login) return null;
  const profileUrl = `https://github.com/${login}`;
  return (
    <a className="challenge-github-dock" href={profileUrl} target="_blank" rel="noreferrer" aria-label={`GitHub connected as ${login}`}>
      <span className="challenge-github-dock__avatar">
        <img src={`${profileUrl}.png?size=96`} alt="" />
        <i aria-hidden="true">GH</i>
      </span>
      <span className="challenge-github-dock__copy"><b>@{login}</b><small><i aria-hidden="true" /> GITHUB CONNECTED</small></span>
    </a>
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

function JourneyChrome({surface, challengeId, client, children}: {surface: ChallengeSurface; challengeId: string | null; client: Pick<InkubatorApiClient, 'getMe' | 'getMyConnectionContext'>; children: ReactNode}) {
  return (
    <div className="ios-lab ios-shell ios-shell-v2 challenge-journey-shell" data-shell="terminal" data-shell-variant="v2" data-mode="command">
      <nav className="faceplate-topbar" aria-label="Product controls">
        <a className="faceplate-skip" href="#journey-workspace">Skip to Inkubator</a>
        <a className="faceplate-brand" href={challengeHref('DISCOVER', challengeId)}><strong>REKT<i>//</i></strong><span className="faceplate-brand-label">INKUBATOR</span></a>
        <span className="faceplate-purpose">TECHNICAL FACEPLATE / CHALLENGE PRODUCT</span>
        <SessionStatus client={client} />
        <span className="faceplate-registration" aria-hidden="true" />
      </nav>
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
        {surface === 'DISCOVER' ? (
          <main id="journey-workspace" tabIndex={-1} className="ios-shell-workspace challenge-journey-workspace">
            {children}
          </main>
        ) : (
          <section id="journey-workspace" tabIndex={-1} className="ios-shell-workspace challenge-journey-workspace">
            {children}
          </section>
        )}
      </section>
      <footer className="ios-lab-footer ios-shell-footer challenge-journey-footer">
        <span>STAGE I / OWNER TRIAL</span><span>NO REAL VALUE</span><span>TRUTH BEFORE THEATER</span>
      </footer>
      <GitHubIdentityDock client={client} />
    </div>
  );
}

const DEMO_CHALLENGES = [
  {
    id: 'launch-radar',
    eyebrow: 'DEMO / PRODUCT',
    title: 'Realtime Launch Radar',
    brief: 'Build a public dashboard that turns a noisy token launch into one clear, live status view.',
    criteria: ['Live launch state is obvious', 'Reload recovers the current state', 'Public demo + immutable source'],
    reward: '100 TEST',
    idea: 'Build a realtime public launch dashboard that clearly shows the current launch state, key milestones and recent changes.',
  },
  {
    id: 'wallet-safety',
    eyebrow: 'DEMO / WEB3',
    title: 'Wallet Safety Check',
    brief: 'Build a read-only wallet checker that explains risky approvals without ever holding keys or signing transactions.',
    criteria: ['Read-only wallet inspection', 'Risk explanation in plain language', 'No custody or hidden signing'],
    reward: '100 TEST',
    idea: 'Build a read-only wallet safety checker that explains risky token approvals in plain language and never holds private keys or signs transactions.',
  },
  {
    id: 'creator-drop',
    eyebrow: 'DEMO / CREATOR',
    title: 'Creator Drop Board',
    brief: 'Build a clean public board for a creator drop with status, deadlines and proof of what shipped.',
    criteria: ['Public drop status', 'Clear deadline states', 'Immutable delivery evidence'],
    reward: '100 TEST',
    idea: 'Build a public creator drop board that clearly shows current status, deadlines, shipped items and immutable delivery evidence.',
  },
] as const;

function compilerHrefFromIdea(idea: string): string {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('surface', 'compiler');
  url.searchParams.set('idea', idea);
  return `${url.pathname}${url.search}`;
}

function publicCreatorXUrl(summary: {informational_references: Array<{id: string; url: string}>} | null | undefined): string | null {
  return summary?.informational_references.find((reference) => reference.id === 'creator-x-profile')?.url ?? null;
}

function JourneyHome({client}: {client: Pick<InkubatorApiClient, 'getMe' | 'getMyConnectionContext'> & Pick<ChallengeProductApi, 'getChallenge'>}) {
  const params = new URLSearchParams(window.location.search);
  const existingChallenge = params.get('challenge');
  const [target, setTarget] = useState(existingChallenge ?? '');
  const challengeId = useMemo(() => parseChallengeTarget(target), [target]);
  const currentChallengeId = useMemo(() => parseChallengeTarget(existingChallenge ?? ''), [existingChallenge]);
  const currentChallenge = useQuery({
    queryKey: ['inkubator', 'discover', 'challenge', currentChallengeId],
    queryFn: () => client.getChallenge(currentChallengeId!),
    enabled: Boolean(currentChallengeId),
    retry: false,
    staleTime: 10_000,
  });
  const observation = params.get('github_observation');
  const observationReason = params.get('github_observation_reason');

  return (
    <JourneyChrome surface="DISCOVER" challengeId={challengeId ?? existingChallenge} client={client}>
      {observation === 'degraded' ? <div className="challenge-journey-notice" role="status">GITHUB OBSERVATION DEGRADED · {observationReason ?? 'provider observation incomplete'} · challenge creation and deterministic state remain available.</div> : null}
      <section className="challenge-journey-intro">
        <small>DISCOVER / BUILD SOMETHING WORTH TESTING</small>
        <h2>LAUNCH A CHALLENGE.<br />PROVE WHAT GETS BUILT.</h2>
        <p>Pick an idea, make the success criteria obvious, let builders compete against the same locked rules, then test what actually works.</p>
      </section>

      <section className="challenge-discover-dashboard" aria-labelledby="discover-dashboard-title">
        <div className="challenge-discover-dashboard__head">
          <div>
            <small>CHALLENGE BOARD</small>
            <h2 id="discover-dashboard-title">WHAT'S BUILDING?</h2>
          </div>
          <a className="challenge-journey-primary" href={challengeHref('COMPILER')}>+ LAUNCH YOUR OWN →</a>
        </div>

        {currentChallengeId ? (
          <section className="challenge-current" aria-label="Your current Challenge">
            <small>YOUR CURRENT CHALLENGE</small>
            {currentChallenge.isPending ? <p>Reading your canonical Challenge…</p> : currentChallenge.data ? (
              <>
                <div className="challenge-current__status"><b>{currentChallenge.data.status}</b><span>{currentChallenge.data.entry_count} / {currentChallenge.data.slot_limit} builders</span></div>
                <h3>{currentChallenge.data.contract_summary?.title ?? 'YOUR CHALLENGE'}</h3>
                <p>{currentChallenge.data.contract_summary?.brief ?? 'The Challenge exists, but public locked rules are not available yet.'}</p>
                <div className="challenge-current__creator">
                  <span>CREATOR <b>{currentChallenge.data.organizer?.display_name ?? 'INKUBATOR ORGANIZER'}</b></span>
                  {currentChallenge.data.organizer?.github_login ? <a href={`https://github.com/${currentChallenge.data.organizer.github_login}`} target="_blank" rel="noreferrer">GITHUB / @{currentChallenge.data.organizer.github_login} ↗</a> : null}
                  {publicCreatorXUrl(currentChallenge.data.contract_summary) ? <a href={publicCreatorXUrl(currentChallenge.data.contract_summary)!} target="_blank" rel="noreferrer">X PROFILE ↗</a> : null}
                </div>
                <dl className="challenge-current__facts">
                  <div><dt>REWARD</dt><dd>{currentChallenge.data.contract_summary ? (currentChallenge.data.contract_summary.prize_display ?? `${currentChallenge.data.contract_summary.prize_minor_units} ${currentChallenge.data.contract_summary.settlement_asset}`) : 'LOCK RULES FIRST'}</dd></div>
                  <div><dt>ENTRY CLOSES</dt><dd>{currentChallenge.data.entry_deadline}</dd></div>
                  <div><dt>SUBMIT BY</dt><dd>{currentChallenge.data.submission_deadline}</dd></div>
                </dl>
                <a className="challenge-journey-primary journey-next-action journey-next-action--link" href={challengeHref(currentChallenge.data.status === 'DRAFT' ? 'COMPILER' : 'CHALLENGE', currentChallenge.data.challenge_id)}>
                  {currentChallenge.data.status === 'DRAFT' ? 'CONTINUE SETUP →' : 'OPEN YOUR CHALLENGE →'}
                </a>
              </>
            ) : <p>Your Challenge could not be read right now. The demo board below is still safe to explore.</p>}
          </section>
        ) : null}

        <div className="challenge-demo-grid">
          {DEMO_CHALLENGES.map((demo) => (
            <article className="challenge-demo-card" key={demo.id}>
              <div className="challenge-demo-card__meta"><span>{demo.eyebrow}</span><b>{demo.reward}</b></div>
              <h3>{demo.title}</h3>
              <p>{demo.brief}</p>
              <div className="challenge-demo-card__criteria">
                <small>WHAT COUNTS AS DONE?</small>
                <ul>{demo.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
              </div>
              <a href={compilerHrefFromIdea(demo.idea)}>START FROM THIS IDEA →</a>
              <small className="challenge-demo-card__truth">EXAMPLE ONLY · NOT A LIVE CHALLENGE</small>
            </article>
          ))}
        </div>
      </section>

      <div className="challenge-role-choice" aria-label="Choose your role">
        <strong>WHAT ARE YOU DOING RIGHT NOW?</strong>
        <span><b>RUNNING THE CHALLENGE?</b> Use Organizer.</span>
        <span><b>BUILDING FOR SOMEONE ELSE?</b> Use Builder.</span>
      </div>

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

export type ChallengeJourneyClient = ChallengeProductApi & Pick<InkubatorApiClient, 'getMe' | 'getMyConnectionContext'>;

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
