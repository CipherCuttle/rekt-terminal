import {act, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PeripheralSignal} from './PeripheralSignal';

describe('PeripheralSignal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not replay historical state on initial mount', () => {
    const {container} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    const signal = container.querySelector('svg[data-motion-contract="v1"]');
    expect(signal).toHaveAttribute('data-frame', '4');
    expect(signal).toHaveAttribute('aria-hidden', 'true');
  });

  it('replays once when the stable domain event id changes', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-2" />);
    const signal = container.querySelector('svg[data-motion-contract="v1"]');
    expect(signal).toHaveAttribute('data-frame', '1');
    act(() => vi.advanceTimersByTime(380));
    expect(signal).toHaveAttribute('data-frame', '4');
  });

  it('does not restart for the same event id', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-2" />);
    act(() => vi.advanceTimersByTime(380));
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-2" />);
    const signal = container.querySelector('svg[data-motion-contract="v1"]');
    expect(signal).toHaveAttribute('data-frame', '4');
  });

  it('keeps debug geometry presentation-only', () => {
    render(<PeripheralSignal cue="VERIFYING" eventId="verify-1" debug />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
