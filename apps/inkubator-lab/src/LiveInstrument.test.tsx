import {cleanup, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {InkubatorApiError} from './generated/inkubator-api-client';
import {MissionGate} from './LiveInstrument';

afterEach(cleanup);

function renderGate(client: {getMyCommand: unknown}, children = <div>COMMAND SURFACE</div>) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <MissionGate mode="COMMAND" client={client as never}>{children}</MissionGate>
    </QueryClientProvider>,
  );
}

describe('MissionGate routing', () => {
  it('routes to MissionBootstrap when the command query fails with the canonical active_mission_not_found 404', async () => {
    renderGate({getMyCommand: vi.fn().mockRejectedValue(new InkubatorApiError(404, 'active_mission_not_found'))});
    expect(await screen.findByRole('heading', {name: 'What are you shipping?'})).toBeTruthy();
    expect(screen.getByText('COMMAND / NO ACTIVE MISSION')).toBeTruthy();
    expect(screen.queryByText('COMMAND SURFACE')).toBeNull();
  });

  it('does not route to MissionBootstrap when the command query fails with a different error', async () => {
    renderGate({getMyCommand: vi.fn().mockRejectedValue(new InkubatorApiError(500, 'command_projection_unavailable'))});
    expect(await screen.findByText('COMMAND SURFACE')).toBeTruthy();
    expect(screen.queryByRole('heading', {name: 'What are you shipping?'})).toBeNull();
    expect(screen.queryByText('COMMAND / NO ACTIVE MISSION')).toBeNull();
  });

  it('keeps the Command surface while the command query is still loading', () => {
    renderGate({getMyCommand: vi.fn().mockReturnValue(new Promise(() => {}))});
    expect(screen.getByText('COMMAND SURFACE')).toBeTruthy();
    expect(screen.queryByRole('heading', {name: 'What are you shipping?'})).toBeNull();
  });
});
