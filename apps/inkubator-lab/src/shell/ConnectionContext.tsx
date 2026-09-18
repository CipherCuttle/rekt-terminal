import {createContext, useContext, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {InkubatorApiError, type ConnectionContext as ConnectionContextView, type InkubatorApiClient} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';

type ConnectionClient = Pick<InkubatorApiClient, 'getMyConnectionContext'>;
type ConnectionQueryState = {
  data?: ConnectionContextView;
  error?: unknown;
  isPending: boolean;
  refetch: () => Promise<unknown>;
};

const ConnectionQueryContext = createContext<ConnectionQueryState | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Bounded runtime guard for the new shell authority boundary. */
export function assertConnectionContext(value: unknown): ConnectionContextView {
  if (!isRecord(value) || value.schema_version !== 'player.connection_context.private.v1' || !isRecord(value.player) || !isRecord(value.github) || !isRecord(value.states) || !isRecord(value.source)) {
    throw new Error('connection_context_schema_invalid');
  }
  const states = value.states;
  const source = value.source;
  if (typeof value.player.player_id !== 'string' || typeof value.player.display_name !== 'string' || !isNullableString(value.github.user_id) || !isNullableString(value.github.login)) {
    throw new Error('connection_context_identity_invalid');
  }
  if (states.signed_in !== 'SIGNED_IN' || !['GRANTED', 'NOT_GRANTED', 'REVOKED'].includes(String(states.app_access)) || !['AUTHORIZED', 'NOT_AUTHORIZED', 'REVOKED'].includes(String(states.repository_authorized)) || !['LINKED', 'NOT_LINKED', 'ACCESS_REVOKED'].includes(String(states.project_linked)) || !['OBSERVING', 'NOT_OBSERVING', 'UNAVAILABLE'].includes(String(states.observing))) {
    throw new Error('connection_context_state_invalid');
  }
  if (!isNullableString(source.repository_id) || !isNullableString(source.repository_full_name) || !['NONE', 'PUBLIC', 'PRIVATE'].includes(String(source.visibility)) || !['NONE', 'AVAILABLE', 'REVOKED'].includes(String(source.availability)) || !isNullableString(source.last_observed_at)) {
    throw new Error('connection_context_source_invalid');
  }
  return value as unknown as ConnectionContextView;
}

export function ConnectionContextProvider({children, client = createInkubatorApiClient()}: {children: ReactNode; client?: ConnectionClient}) {
  const query = useQuery({
    queryKey: ['inkubator', 'connection-context'],
    queryFn: async () => assertConnectionContext(await client.getMyConnectionContext()),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  return <ConnectionQueryContext.Provider value={{data: query.data, error: query.error, isPending: query.isPending, refetch: async () => { await query.refetch(); }}}>{children}</ConnectionQueryContext.Provider>;
}

export function useConnectionContext() {
  return useContext(ConnectionQueryContext);
}

function stateValue(value: string | undefined, pending: boolean, error: unknown) {
  if (pending) return 'CHECKING';
  if (error instanceof InkubatorApiError && error.status === 401) return 'ANONYMOUS';
  if (error) return 'UNAVAILABLE';
  return value?.replaceAll('_', ' ') ?? 'UNKNOWN';
}

function StatusCell({label, value}: {label: string; value: string}) {
  return <div className="connection-context-cell"><small>{label}</small><strong>{value}</strong></div>;
}

export function ConnectionContextStrip() {
  const context = useConnectionContext();
  if (!context) return null;
  const data = context.data;
  const github = data?.github.login ?? (data ? 'NOT CONNECTED' : 'ANONYMOUS');
  const source = data?.source.repository_full_name ?? (data ? 'NO PROJECT SOURCE' : 'PUBLIC WORLD');
  const rx = stateValue(data?.states.observing, context.isPending, context.error);
  const statuses = data ? [
    ['SIGNED IN', stateValue(data.states.signed_in, false, undefined)],
    ['APP ACCESS', stateValue(data.states.app_access, false, undefined)],
    ['REPOSITORY AUTHORIZED', stateValue(data.states.repository_authorized, false, undefined)],
    ['PROJECT LINKED', stateValue(data.states.project_linked, false, undefined)],
    ['OBSERVING', stateValue(data.states.observing, false, undefined)],
  ] : [];

  return <section className="connection-context" aria-label="Connection context" data-connection-state={context.error ? 'unavailable' : context.isPending ? 'pending' : 'ready'}>
    <div className="connection-context-strip">
      <StatusCell label="PLAYER" value={data?.player.display_name ?? 'ANONYMOUS'} />
      <StatusCell label="GITHUB" value={github} />
      <StatusCell label="SOURCE" value={source} />
      <StatusCell label="RX" value={rx} />
      <details className="connection-context-inspector">
        <summary>INSPECT CONNECTION PROVENANCE</summary>
        <div className="connection-context-detail">
          <p>{context.error instanceof InkubatorApiError && context.error.status === 401 ? 'WORLD is public. Sign in to create a private Player context or authorize a repository.' : context.error ? 'The private connection projection is unavailable. No source state is inferred.' : 'Private connection context is projected by the server. Provider IDs are authority; names are verified display metadata.'}</p>
          {data ? <dl>{statuses.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div><dt>GITHUB ID</dt><dd>{data.github.user_id ?? 'NOT AVAILABLE'}</dd></div><div><dt>SOURCE ID</dt><dd>{data.source.repository_id ?? 'NOT LINKED'}</dd></div><div><dt>LAST OBSERVED</dt><dd>{data.source.last_observed_at ?? 'NO OBSERVATION'}</dd></div></dl> : null}
        </div>
      </details>
    </div>
  </section>;
}
