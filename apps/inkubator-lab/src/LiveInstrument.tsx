import {lazy, useEffect, useMemo, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {InkubatorApiError} from './generated/inkubator-api-client';
import {createInkubatorApiClient} from './inkubator-api';
import {INSTRUMENT_MODES, InstrumentNavigationProvider, parseInstrumentMode, type InstrumentMode} from './shell/InstrumentNavigation';
import {TerminalShell} from './shell/TerminalShell';
import './auth/live-auth.css';

const LiveCommand = lazy(() => import('./command/LiveCommand'));
const LiveProject = lazy(() => import('./project/LiveProject'));
const LiveWorld = lazy(() => import('./world/LiveWorld'));
const LivePlayer = lazy(() => import('./player/LivePlayer'));
const LiveShip = lazy(() => import('./ship/LiveShip'));
const authClient = createInkubatorApiClient();

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

function IdentityGate({mode, children}: {mode: InstrumentMode; children: ReactNode}) {
  const sessionQuery = useQuery({
    queryKey: ['inkubator', 'session', 'me'],
    queryFn: () => authClient.getMe(),
    retry: false,
    staleTime: 30_000,
  });

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
      return (
        <TerminalShell mode={mode} kicker="REKT INK(CUBATOR) // IDENTITY" title="SIGN IN" description="GitHub establishes player identity. Repository access remains a separate permission step." workspaceClassName="inkubator-auth-state">
          <div className="inkubator-auth-card">
            <small>PLAYER IDENTITY // UNAUTHENTICATED</small>
            <h2>CONTINUE WITH GITHUB</h2>
            <p>Sign in to restore or create your PLAYER. We bind the immutable GitHub user ID; your username is not identity authority.</p>
            <a className="inkubator-auth-action" href="/v1/auth/github/start">CONTINUE WITH GITHUB →</a>
            <p className="inkubator-auth-footnote">Repository installation comes after login and remains read-only / separately authorized.</p>
          </div>
        </TerminalShell>
      );
    }

    return (
      <TerminalShell mode={mode} kicker="REKT INK(CUBATOR) // IDENTITY" title="SERVICE OFFLINE" description="The private Inkubator runtime is not reachable from this origin." workspaceClassName="inkubator-auth-state inkubator-auth-state--offline" role="alert">
        <div className="inkubator-auth-card">
          <small>AUTH / API</small><h2>INKUBATOR BACKEND REQUIRED</h2>
          <p>{status === 404 ? 'This static preview has no /v1 backend. GitHub login requires the same-origin Inkubator API.' : sessionQuery.error.message}</p>
          <p>No fixture session or fake identity fallback is permitted.</p>
        </div>
      </TerminalShell>
    );
  }

  return <>{children}</>;
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
      url.searchParams.set('mode', next.toLowerCase());
      window.history.pushState({instrumentMode: next}, '', url);
      setMode(next);
    },
  }), [mode]);

  return (
    <InstrumentNavigationProvider value={navigation}>
      <IdentityGate mode={mode}><Surface mode={mode} /></IdentityGate>
    </InstrumentNavigationProvider>
  );
}
