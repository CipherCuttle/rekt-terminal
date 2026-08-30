import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInitialCareer, reduceCareer } from '@rekt-ink/career';
import { createInitialSimState } from '@rekt-ink/sim';
import { MarginTrainingScreen } from '../margin/MarginTrainingScreen';
import { PracticeProvider, type PracticeRuntime } from '../practice/react';
import type { PracticeSnapshot } from '../practice/store';

function makeSnapshot(marginAuthorized: boolean, shortAuthorized = false): PracticeSnapshot {
  let career = createInitialCareer('margin-ui-career', 0);
  if (marginAuthorized) career = reduceCareer(career, { type: 'SKILL_UNLOCKED', eventId: 'margin-ui-unlock', skillId: 'MARGIN_2X' });
  if (shortAuthorized) career = reduceCareer(career, { type: 'SKILL_UNLOCKED', eventId: 'short-ui-unlock', skillId: 'SHORT' });
  return {
    sim: createInitialSimState({ sessionId: 'margin-ui-spot', startedAtMs: 0 }),
    career,
    environment: 'LIVE', instrumentId: null, lastRejection: null, tradeReview: null, restoreStatus: 'FRESH', hydrated: true,
  };
}

function renderDesk(marginAuthorized = true, shortAuthorized = false): void {
  const snapshot = makeSnapshot(marginAuthorized, shortAuthorized);
  const session = { subscribe: () => () => {}, getSnapshot: () => snapshot, recordMarginEpisodeCompletion: () => {} };
  const runtime = { session, feed: {} } as unknown as PracticeRuntime;
  render(<PracticeProvider runtime={runtime}><MarginTrainingScreen /></PracticeProvider>);
}

function positionPanel(): HTMLElement {
  const panel = screen.getByText('POSITION TRUTH').closest('.margin-training__position');
  if (!(panel instanceof HTMLElement)) throw new Error('position panel not found');
  return panel;
}

describe('MARGIN historical training desk', () => {
  it('is undisclosed before PERP_LONG_2X authorization', () => {
    renderDesk(false);
    expect(screen.queryByRole('region', { name: 'MARGIN 2x historical training' })).toBeNull();
  });

  it('reveals one historical mark at a time and offers two distinct episodes', () => {
    renderDesk();
    expect(screen.getByText('$2488.93')).toBeInTheDocument();
    expect(screen.queryByText('$2488.62')).toBeNull();
    expect(screen.getByRole('button', { name: 'EP 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EP 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 2 hidden')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'NEXT HISTORICAL MARK' }));
    expect(screen.getByText('$2488.62')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 2 revealed')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 3 hidden')).toBeInTheDocument();
  });

  it('switches to the second frozen episode without leaking its future marks', () => {
    renderDesk();
    fireEvent.click(screen.getByRole('button', { name: 'EP 2' }));
    expect(screen.getByText('$1919.99')).toBeInTheDocument();
    expect(screen.queryByText('$1916.82')).toBeNull();
    expect(screen.getByLabelText('Mark 2 hidden')).toBeInTheDocument();
  });

  it('opens isolated longs at 1x/2x and never exposes >2x', () => {
    renderDesk();
    expect(screen.queryByRole('button', { name: '3x' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1x' }));
    fireEvent.click(screen.getByRole('button', { name: 'OPEN LONG // 1x' }));
    expect(within(positionPanel()).getByText('1x')).toBeInTheDocument();
    expect(within(positionPanel()).getByText('EST. LIQ').parentElement).toHaveTextContent('NONE');
    fireEvent.click(screen.getByRole('button', { name: 'RESTART EPISODE' }));
    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    fireEvent.click(screen.getByRole('button', { name: 'OPEN LONG // 2x' }));
    expect(within(positionPanel()).getByText('2x')).toBeInTheDocument();
  });

  it('does not expose an actionable SHORT control before SHORT authorization', () => {
    renderDesk(true, false);
    expect(screen.queryByRole('button', { name: 'SHORT' })).toBeNull();
    expect(screen.queryByRole('button', { name: /OPEN SHORT/ })).toBeNull();
    expect(screen.getByText(/SHORT QUALIFICATION 0\/2/)).toBeInTheDocument();
  });

  it('reveals SHORT only after authorization and opens 1x/2x shorts', () => {
    renderDesk(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'SHORT' }));
    expect(screen.getByRole('button', { name: 'OPEN SHORT // 2x' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OPEN SHORT // 2x' }));
    expect(within(positionPanel()).getByText('SHORT')).toBeInTheDocument();
    expect(within(positionPanel()).getByText('2x')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'RESTART EPISODE' }));
    fireEvent.click(screen.getByRole('button', { name: '1x' }));
    fireEvent.click(screen.getByRole('button', { name: 'OPEN SHORT // 1x' }));
    expect(within(positionPanel()).getByText('1x')).toBeInTheDocument();
    expect(within(positionPanel()).getByText('EST. LIQ').parentElement).not.toHaveTextContent('NONE');
  });

  it('surfaces the SHORT current-mark stop rejection', () => {
    renderDesk(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'SHORT' }));
    fireEvent.click(screen.getByRole('button', { name: 'OPEN SHORT // 2x' }));
    fireEvent.change(screen.getByLabelText('Margin protective stop USD'), { target: { value: '2480.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'UPDATE STOP' }));
    expect(screen.getByRole('alert')).toHaveTextContent('INVALID_STOP');
    expect(screen.getByRole('alert')).toHaveTextContent('above the current mark');
  });
});
