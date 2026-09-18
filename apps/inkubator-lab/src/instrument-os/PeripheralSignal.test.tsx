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

describe('PeripheralSignal interruption boundaries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});

  it('settles and cancels old frames when the event becomes unavailable', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="one"/>);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="two"/>);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('1');
    rerender(<PeripheralSignal cue="UNAVAILABLE"/>);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    act(() => vi.advanceTimersByTime(100));
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
  });

  it('does not replay an older canonical event after a different cue', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-one"/>);
    rerender(<PeripheralSignal cue="NEXT_MOVE_CHANGED" eventId="mission-one"/>);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-one"/>);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
  });

  it('immediately settles if reduced motion is enabled during an event', () => {
    let reduced = false;
    let listener: (() => void) | undefined;
    vi.stubGlobal('matchMedia', () => ({get matches() {return reduced;}, addEventListener: (_: string, cb: () => void) => {listener = cb;}, removeEventListener: vi.fn()}));
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="one"/>);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="two"/>);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('1');
    act(() => {reduced = true; listener?.();});
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    act(() => vi.advanceTimersByTime(100));
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
  });
});

describe('PeripheralSignal cancellation and idle guarantees', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});

  it('cancels stale timers on rapid re-trigger so the newest event wins', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="obs-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="obs-2" />);
    act(() => vi.advanceTimersByTime(95));
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('2');
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="obs-3" />);
    // Only the newest event's three frame timers may be pending.
    expect(vi.getTimerCount()).toBe(3);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('1');
    act(() => vi.advanceTimersByTime(95));
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('2');
    act(() => vi.advanceTimersByTime(190));
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears pending timers on unmount so no state writes happen after removal', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const {rerender, unmount} = render(<PeripheralSignal cue="SOURCE_RX" eventId="obs-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="obs-2" />);
    expect(vi.getTimerCount()).toBe(3);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('never replays when reduced motion is already enabled when the event arrives', () => {
    vi.stubGlobal('matchMedia', () => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()}));
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="obs-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="obs-2" />);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never schedules animation without an event: idle and status-only cues stay settled', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" />);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    expect(vi.getTimerCount()).toBe(0);
    rerender(<PeripheralSignal cue="STALE" />);
    expect(container.querySelector('svg')?.getAttribute('data-frame')).toBe('4');
    expect(vi.getTimerCount()).toBe(0);
  });
});
