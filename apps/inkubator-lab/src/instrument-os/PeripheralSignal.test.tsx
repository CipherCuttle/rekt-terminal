import {act, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PeripheralSignal} from './PeripheralSignal';

describe('PeripheralSignal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not replay historical state on initial mount', () => {
    const {container} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    const signal = container.querySelector('svg[data-motion-contract="v1"]');
    expect(signal?.getAttribute('data-frame')).toBe('4');
    expect(signal?.getAttribute('aria-hidden')).toBe('true');
  });

  it('replays once when the stable domain event id changes', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-2" />);
    const signal = container.querySelector('svg[data-motion-contract="v1"]');
    expect(signal?.getAttribute('data-frame')).toBe('1');
    act(() => vi.advanceTimersByTime(380));
    expect(signal?.getAttribute('data-frame')).toBe('4');
  });

  it('does not restart for the same event id', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-2" />);
    act(() => vi.advanceTimersByTime(380));
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-2" />);
    const signal = container.querySelector('svg[data-motion-contract="v1"]');
    expect(signal?.getAttribute('data-frame')).toBe('4');
  });

  it('keeps debug geometry presentation-only', () => {
    const {container} = render(<PeripheralSignal cue="VERIFYING" eventId="verify-1" debug />);
    const signal = container.querySelector('svg[data-motion-contract="v1"]');
    expect(signal?.getAttribute('role')).toBe('presentation');
    expect(signal?.getAttribute('aria-hidden')).toBe('true');
  });
});
