import {cleanup, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {assertConnectionContext, ConnectionContextProvider, ConnectionContextStrip} from './ConnectionContext';

afterEach(cleanup);

const context = {
  schema_version: 'player.connection_context.private.v1',
  player: {player_id: 'player-1', display_name: 'Builder'},
  github: {user_id: '123', login: 'builder'},
  states: {signed_in: 'SIGNED_IN', app_access: 'GRANTED', repository_authorized: 'AUTHORIZED', project_linked: 'LINKED', observing: 'OBSERVING'},
  source: {repository_id: '456', repository_full_name: 'builder/project', visibility: 'PRIVATE', availability: 'AVAILABLE', last_observed_at: null},
} as const;

describe('Connection context', () => {
  it('rejects malformed context instead of coercing it into a supported state', () => {
    expect(() => assertConnectionContext({...context, states: {...context.states, observing: 'ACTIVE'}})).toThrow('connection_context_state_invalid');
  });

  it('keeps the five connection states in the shell and hides provenance behind disclosure', async () => {
    const client = {getMyConnectionContext: vi.fn().mockResolvedValue(context)};
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={queryClient}><ConnectionContextProvider client={client}><ConnectionContextStrip /></ConnectionContextProvider></QueryClientProvider>);
    expect(await screen.findByText('Builder')).toBeTruthy();
    for (const label of ['SIGNED IN', 'APP ACCESS', 'REPOSITORY AUTHORIZED', 'PROJECT LINKED', 'OBSERVING']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText('INSPECT CONNECTION PROVENANCE')).toBeTruthy();
    expect(screen.getByText('INSPECT CONNECTION PROVENANCE').closest('details')?.open).toBe(false);
  });
});
