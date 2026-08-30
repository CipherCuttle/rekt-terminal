import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInitialCareer, reduceCareer } from '@rekt-ink/career';
import { createInitialSimState } from '@rekt-ink/sim';
import { MarginTrainingScreen } from '../margin/MarginTrainingScreen';
import { PracticeProvider, type PracticeRuntime } from '../practice/react';
import type { PracticeSnapshot } from '../practice/store';

function makeSnapshot(authorized: boolean): PracticeSnapshot {
  let career = createInitialCareer('margin-ui-career', 0);
  if (authorized) {
    career = reduceCareer(career, {
      type: 'SKILL_UNLOCKED',
      eventId: 'margin-ui-unlock',
      skillId: 'MARGIN_2X',
    });
  }
  return {
    sim: createInitialSimState({ sessionId: 'margin-ui-spot', startedAtMs: 0 }),
    career,
    environment: 'LIVE',
    instrumentId: null,
    lastRejection: null,
    tradeReview: null,
    restoreStatus: 'FRESH',
    hydrated: true,
  };
}

function renderDesk(authorized = true): void {
  const snapshot = makeSnapshot(authorized);
  const session = {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
  };
  const runtime = { session, feed: {} } as unknown as PracticeRuntime;
  render(
    <PracticeProvider runtime={runtime}>
      <MarginTrainingScreen />
    </PracticeProvider>,
  );
}

function positionPanel(): HTMLElement {
  const title = screen.getByText('POSITION TRUTH');
  const panel = title.closest('.margin-training__position');
  if (!(panel instanceof HTMLElement)) throw new Error('position panel not found');
  return panel;
}

describe('MARGIN_2X historical training desk', () => {
  it('is undisclosed before PERP_LONG_2X authorization', () => {
    renderDesk(false);
    expect(screen.queryByRole('region', { name: 'MARGIN 2x historical training' })).toBeNull();
  });

  it('reveals the frozen episode one historical mark at a time', () => {
    renderDesk();
    expect(screen.getByRole('region', { name: 'MARGIN 2x historical training' })).toBeInTheDocument();
    expect(screen.getByText('$2488.93')).toBeInTheDocument();
    expect(screen.queryByText('$2488.62')).toBeNull();
    expect(screen.getByLabelText('Mark 1 revealed')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 2 hidden')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 3 hidden')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 4 hidden')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'NEXT HISTORICAL MARK' }));
    expect(screen.getByText('$2488.62')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 2 revealed')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark 3 hidden')).toBeInTheDocument();
  });

  it('opens isolated longs at both authorized leverage levels and never exposes a >2x control', () => {
    renderDesk();
    expect(screen.queryByRole('button', { name: '3x' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1x' }));
    fireEvent.click(screen.getByRole('button', { name: 'OPEN LONG // 1x' }));
    expect(within(positionPanel()).getByText('1x')).toBeInTheDocument();
    expect(within(positionPanel()).getByText('NONE @ 1x')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'RESTART EPISODE' }));
    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    fireEvent.click(screen.getByRole('button', { name: 'OPEN LONG // 2x' }));
    expect(within(positionPanel()).getByText('2x')).toBeInTheDocument();
    expect(within(positionPanel()).getByText('EST. LIQ').parentElement).not.toHaveTextContent('NONE @ 1x');
  });

  it('refuses a replacement stop that the current historical mark has already crossed', () => {
    renderDesk();
    fireEvent.click(screen.getByRole('button', { name: 'OPEN LONG // 2x' }));
    fireEvent.click(screen.getByRole('button', { name: 'NEXT HISTORICAL MARK' }));
    expect(screen.getByText('$2488.62')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Margin protective stop USD'), { target: { value: '2488.80' } });
    fireEvent.click(screen.getByRole('button', { name: 'UPDATE STOP' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('INVALID_STOP');
    expect(alert).toHaveTextContent('below the current mark');
    expect(within(positionPanel()).getByText('STOP').parentElement).toHaveTextContent('$2400.00');
  });
});
