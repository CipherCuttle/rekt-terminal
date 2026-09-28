import {lazy, useEffect, useMemo, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {InkubatorApiError, type InkubatorApiClient} from './generated/inkubator-api-client';
import {createInkubatorApiClient} from './inkubator-api';
import {INSTRUMENT_MODES, InstrumentNavigationProvider, parseInstrumentMode, type InstrumentMode} from './shell/InstrumentNavigation';
import {TerminalShell} from './shell/TerminalShell';
import './auth/live-auth.css';
import MissionBootstrap from './journey/MissionBootstrap';
import {isActiveMissionNotFound} from './journey/active-mission';
import {ConnectionContextProvider} from './shell/ConnectionContext';

const LiveCommand = lazy(() => import('./command/LiveCommand'));
const LiveProject = lazy(() => import('./project/LiveProject'));
const LiveWorld = lazy(() => import('./world/LiveWorld'));
const LivePlayer = lazy(() => import('./player/LivePlayer'));
const LiveShip = lazy(() => import('./ship/LiveShip'));
const authClient = createInkubatorApiClient();

const PRIVATE_MODE_COPY: Record<Exclude<InstrumentMode, 'WORLD'>, {kicker: string; title: string; body: string}> = {
  COMMAND: {kicker: 'COMMAND / PRIVATE MISSION', title: 'DECLARE YOUR MISSION.', body: 'Build normally in your repo. Inkubator tracks the Mission, evidence, help and Ship around that work.'},
  PROJECT: {kicker: 'PROJECT / PRIVATE BUILD', title: 'OPEN YOUR BUILD.', body: 'Inspect what this Project needs, who is helping, what was observed and what still blocks Ship.'},
  PLAYER: {kicker: 'PLAYER / PRIVATE RECORD', title: 'KEEP YOUR RECORD.', body: 'Read the durable record created by what you shipped, tested and helped build.'},
  SHIP: {kicker: 'SHIP / PRIVATE SUBMISSION', title: 'PROVE THE ARTIFACT.', body: 'Submit the thing you built, follow verification and keep the accepted receipt.'},
};

function modeFromLocation(fallback: InstrumentMode) {
  return parseInstrumentMode(new URLSearchParams(window.location.search).get('mode')) ?? fallback;
}

function Surface({mode}: {mode: InstrumentMode}) {
  if (mode === 'WORLD') return <LiveWorld />;
  if (mode === 'PROJECT') return <LiveProject />;
  if (mode === 'PLAYER') return <LivePlayer />;
  if (mode === 'SHIP') return <LiveShip />;
  return <LiveCommand />;
}

export function MissionGate({mode, children, client = authClient}: {mode: InstrumentMode; children: ReactNode; client?: Pick<InkubatorApiClient, 'getMyCommand'>}) {
  const query = useQuery({queryKey: ['inkubator', 'command', 'me'], queryFn: () => client.getMyCommand(), retry: false, enabled: mode === 'COMMAND'});
  if (mode === 'COMMAND' && isActiveMissionNotFound(query.error)) return <MissionBootstrap />;
  return <>{children}</>;
}

function IdentityGate({mode, children}: {mode: InstrumentMode; children: ReactNode}) {
  const requiresIdentity = mode !== 'WORLD';
  const sessionQuery = useQuery({
    queryKey: ['inkubator', 'session', 'me'],
    queryFn: () => authClient.getMe(),
    retry: false,
    staleTime: 30_000,
    enabled: requiresIdentity,
  });

  const withConnectionContext = () => <ConnectionContextProvider client={authClient}>{children}</ConnectionContextProvider>;

  if (!requiresIdentity) return withConnectionContext();

  if (sessionQuery.isPending) {
    return (
      <TerminalShell mode={mode} kicker="REKT INK(CUBATOR) // IDENTITY" title="IDENTITY BUS" description="Checking canonical Inkubator session." workspaceClassName="inkubator-auth-state">
        <div><small>AUTH / SESSION</small><h2>CONNECTING IDENTITY BUS</h2><p>Checking the server-owned session before loading private instruments.</p></div>
      </TerminalShell>
    );
  }

  if (sessionQuery.error) {
    const status = sessionQuery.error instanceof InkubatorApiError ? sessionQuery.error.status : 0;
    if (status === 401) {
      const copy = PRIVATE_MODE_COPY[mode as Exclude<InstrumentMode, 'WORLD'>];
      return (
        <TerminalShell mode={mode} kicker={copy.kicker} title={copy.title} description={copy.body} workspaceClassName="inkubator-auth-state">
          <div className="inkubator-auth-card">
            <small>PLAYER IDENTITY // GITHUB</small>
            <h2>{copy.title}</h2>
            {new URLSearchParams(window.location.search).get('auth') === 'github_failed' ? <p role="alert">GitHub sign-in did not complete. Try again to connect your identity.</p> : null}
            <p>{copy.body} GitHub signs you in with a server-owned session.</p>
            <div className="inkubator-auth-loop-label">
              <strong>YOUR BUILD LOOP</strong>
              <span>WHAT YOU DO</span>
            </div>
            <dl className="inkubator-auth-loop" aria-label="Your build loop">
              <div><dt>01</dt><dd>DECLARE</dd></div>
              <div><dt>02</dt><dd>CONNECT</dd></div>
              <div><dt>03</dt><dd>BUILD</dd></div>
              <div><dt>04</dt><dd>HELP / TEST</dd></div>
              <div><dt>05</dt><dd>SHIP</dd></div>
            </dl>
            <div className="inkubator-auth-actions">
              <a className="inkubator-auth-action" href="/v1/auth/github/start">ENTER WITH GITHUB →</a>
              <a className="inkubator-auth-action inkubator-auth-action--secondary" href="?mode=world">EXPLORE WORLD</a>
            </div>
            <p className="inkubator-auth-footnote">The instrument tabs are views, not onboarding steps. Repository access is a separate read-only GitHub App permission after sign-in. Inkubator observes work around your build; it is not where you write the code.</p>
          </div>
        </TerminalShell>
      );
    }

    return (
      <TerminalShell mode={mode} kicker="REKT INK(CUBATOR) // IDENTITY" title="SERVICE OFFLINE" description="The private Inkubator runtime is not reachable from this origin." workspaceClassName="inkubator-auth-state inkubator-auth-state--offline">
      <div className="inkubator-auth-card" role="alert">
          <small>AUTH / API</small><h2>INKUBATOR BACKEND REQUIRED</h2>
          <p>{status === 404 ? 'This static preview has no /v1 backend. GitHub login requires the same-origin Inkubator API.' : sessionQuery.error instanceof Error ? sessionQuery.error.message : 'The private connection projection could not be read.'}</p>
          <button type="button" className="journey-auth-retry" onClick={() => void sessionQuery.refetch()}>RETRY CONNECTION</button>
        </div>
      </TerminalShell>
    );
  }

  return withConnectionContext();
}

export default function LiveInstrument({initialMode}: {initialMode: InstrumentMode}) {
  const [mode, setMode] = useState(() => modeFromLocation(initialMode));

  useEffect(() => {
    const onPopState = () => setMode(modeFromLocation(initialMode));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialMode]);

  const navigation = useMemo(() => ({
    enabledModes: INSTRUMENT_MODES,
    onModeSelect: (next: InstrumentMode) => {
      if (next === mode) return;
      const url = new URL(window.location.href);
      url.searchParams.delete('lab');
      url.searchParams.delete('receipt');
      if (next !== 'SHIP' && next !== 'PROJECT') url.searchParams.delete('project');
      url.searchParams.set('mode', next.toLowerCase());
      window.history.pushState({instrumentMode: next}, '', url);
      setMode(next);
    },
  }), [mode]);

  return <InstrumentNavigationProvider value={navigation}>
    <IdentityGate mode={mode}><MissionGate mode={mode}><Surface mode={mode} /></MissionGate></IdentityGate>
  </InstrumentNavigationProvider>;
}
