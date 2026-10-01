import {useEffect, useMemo, useState} from 'react';
import {InkubatorApiError} from '../inkubator-api';
import type {
  ConnectionContext,
  GitHubRepositoryChoices,
  SessionView,
} from '../generated/inkubator-api-client';
import './github-session-widget.css';

export interface GitHubSessionWidgetApi {
  getSession(): Promise<SessionView>;
  getConnectionContext(): Promise<ConnectionContext>;
  getGitHubRepositories(): Promise<GitHubRepositoryChoices>;
  signOut(): Promise<void>;
}

type WidgetState =
  | {kind: 'LOADING'}
  | {kind: 'SIGNED_OUT'}
  | {kind: 'ERROR'}
  | {
      kind: 'READY';
      session: SessionView;
      connection: ConnectionContext;
      repositories: GitHubRepositoryChoices;
    };

function remainingLabel(expiresAt: string, nowMs: number): {text: string; expiring: boolean; expired: boolean} {
  const remainingMs = Date.parse(expiresAt) - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return {text: 'expired', expiring: true, expired: true};
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    expiring: totalMinutes <= 15,
    expired: false,
  };
}

export function GitHubSessionWidget({api}: {api: GitHubSessionWidgetApi}) {
  const [state, setState] = useState<WidgetState>({kind: 'LOADING'});
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = async () => {
    setState({kind: 'LOADING'});
    try {
      const [session, connection] = await Promise.all([
        api.getSession(),
        api.getConnectionContext(),
      ]);
      const repositories = connection.states.repository_authorized === 'AUTHORIZED'
        ? await api.getGitHubRepositories().catch(() => [])
        : [];
      setState({kind: 'READY', session, connection, repositories});
    } catch (cause) {
      if (cause instanceof InkubatorApiError && cause.status === 401) {
        setState({kind: 'SIGNED_OUT'});
        return;
      }
      setState({kind: 'ERROR'});
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [api]);

  const sessionRemaining = useMemo(
    () => state.kind === 'READY' ? remainingLabel(state.session.expires_at, nowMs) : null,
    [state, nowMs],
  );

  if (state.kind === 'SIGNED_OUT') {
    return (
      <a className="github-session-widget github-session-widget--signed-out" href="/v1/auth/github/start">
        <span className="github-session-widget__mark">GH</span>
        <span><strong>CONNECT GITHUB</strong><small>Start an 8-hour REKT session</small></span>
      </a>
    );
  }

  if (state.kind === 'LOADING') {
    return <div className="github-session-widget github-session-widget--loading" aria-label="Loading GitHub session">GITHUB / CHECKING…</div>;
  }

  if (state.kind === 'ERROR') {
    return (
      <button className="github-session-widget github-session-widget--error" type="button" onClick={() => void load()}>
        GITHUB / UNAVAILABLE · RETRY
      </button>
    );
  }

  const login = state.connection.github.login;
  const githubId = state.connection.github.user_id;
  const avatar = githubId ? `https://avatars.githubusercontent.com/u/${encodeURIComponent(githubId)}?v=4&size=80` : null;
  const connected = state.connection.states.app_access === 'GRANTED';
  const repoAuthorized = state.connection.states.repository_authorized === 'AUTHORIZED';

  return (
    <details className="github-session-widget github-session-widget--ready">
      <summary>
        {avatar ? <img src={avatar} alt="" width="32" height="32" referrerPolicy="no-referrer" /> : <span className="github-session-widget__mark">GH</span>}
        <span className="github-session-widget__identity">
          <strong>{login ? `@${login}` : state.connection.player.display_name}</strong>
          <small>{connected ? 'GitHub connected' : 'GitHub attention needed'}</small>
        </span>
        <span
          className="github-session-widget__dot"
          data-state={!connected || !repoAuthorized ? 'attention' : sessionRemaining?.expiring ? 'expiring' : 'ready'}
          aria-hidden="true"
        />
      </summary>

      <div className="github-session-widget__panel">
        <div className="github-session-widget__row"><span>GITHUB</span><strong>{connected ? 'CONNECTED' : 'NOT CONNECTED'}</strong></div>
        <div className="github-session-widget__row"><span>REPOSITORIES</span><strong>{repoAuthorized ? state.repositories.length : 'NO ACCESS'}</strong></div>
        <div className="github-session-widget__row"><span>REKT SESSION</span><strong>{sessionRemaining?.text ?? 'UNKNOWN'}</strong></div>
        <div className="github-session-widget__row"><span>STEP-UP</span><strong>10 MIN FOR SENSITIVE GITHUB CHANGES</strong></div>

        {sessionRemaining?.expiring ? (
          <p className="github-session-widget__notice">
            {sessionRemaining.expired ? 'Session expired. Reconnect to continue.' : 'Session ending soon. Your unfinished Create draft is preserved.'}
          </p>
        ) : null}

        <div className="github-session-widget__actions">
          <a href="/v1/auth/github/start?switch=1">RECONNECT GITHUB</a>
          <button type="button" onClick={async () => {
            await api.signOut();
            setState({kind: 'SIGNED_OUT'});
          }}>SIGN OUT</button>
        </div>
      </div>
    </details>
  );
}
