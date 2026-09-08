import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import SignalChamberLab, {BURST_EVENTS, MAX_ACTIVE_PHYSICS_BODIES_DESKTOP, SIGNAL_EVENTS, SIGNAL_LIFETIME_MS, maxActiveBodiesForWidth} from './SignalChamberLab';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'matchMedia', {configurable: true, value: originalMatchMedia});
});

describe('World signal chamber experiment', () => {
  it('adds canonical events to the permanent ledger immediately', () => {
    render(<SignalChamberLab />);
    fireEvent.click(screen.getByRole('button', {name: 'NEXT EVENT'}));
    expect(screen.getByTestId('signal-lab').getAttribute('data-ledger-count')).toBe('1');
    expect(screen.getByRole('list', {name: 'Recent signals'}).querySelector('[data-signal-id="SIG-001"]')).toBeTruthy();
  });

  it('uses only canonical truth states and never renders PROVEN', () => {
    render(<SignalChamberLab />);
    fireEvent.click(screen.getByRole('button', {name: 'BURST TEST'}));
    expect(screen.getByTestId('signal-lab').getAttribute('data-ledger-count')).toBe(String(BURST_EVENTS.length));
    expect(screen.queryByText(/PROVEN/i)).toBeNull();
    expect(screen.queryByText(/PASS|FAIL|RECOMMENDATION|MATCHING/i)).toBeNull();
    expect(screen.getAllByText('OBSERVED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CLAIMED').length).toBeGreaterThan(0);
  });

  it('keeps the Matter body budget bounded while burst preserves every ledger event', async () => {
    render(<SignalChamberLab />);
    fireEvent.click(screen.getByRole('button', {name: 'BURST TEST'}));
    expect(screen.getByTestId('signal-lab').getAttribute('data-ledger-count')).toBe('10');
    await waitFor(() => expect(Number(screen.getByTestId('signal-lab').getAttribute('data-active-body-count'))).toBeLessThanOrEqual(MAX_ACTIVE_PHYSICS_BODIES_DESKTOP));
    expect(screen.getByTestId('signal-lab').getAttribute('data-queued-count')).toBe('10');
  });

  it('retires a visual capsule without removing its ledger entry', async () => {
    vi.useFakeTimers();
    render(<SignalChamberLab />);
    fireEvent.click(screen.getByRole('button', {name: 'NEXT EVENT'}));
    await vi.advanceTimersByTimeAsync(SIGNAL_LIFETIME_MS + 500);
    expect(screen.getByTestId('signal-lab').getAttribute('data-ledger-count')).toBe('1');
    expect(screen.getByRole('list', {name: 'Recent signals'})).toBeTruthy();
    vi.useRealTimers();
  });

  it('resets and replays the same deterministic first event', () => {
    render(<SignalChamberLab />);
    fireEvent.click(screen.getByRole('button', {name: 'NEXT EVENT'}));
    fireEvent.click(screen.getByRole('button', {name: 'NEXT EVENT'}));
    fireEvent.click(screen.getByRole('button', {name: 'RESET'}));
    fireEvent.click(screen.getByRole('button', {name: 'NEXT EVENT'}));
    expect(screen.getByRole('list', {name: 'Recent signals'}).querySelector('[data-signal-id="SIG-001"]')).toBeTruthy();
    expect(screen.getByRole('list', {name: 'Recent signals'}).querySelector('[data-signal-id="SIG-002"]')).toBeNull();
  });

  it('switches motion mode with a deterministic reset', () => {
    render(<SignalChamberLab />);
    fireEvent.click(screen.getByRole('button', {name: 'NEXT EVENT'}));
    fireEvent.click(screen.getByRole('button', {name: 'GSAP'}));
    expect(screen.getByTestId('signal-lab').getAttribute('data-mode')).toBe('gsap');
    expect(screen.getByTestId('signal-lab').getAttribute('data-ledger-count')).toBe('0');
  });

  it('does not start continuous physics under reduced motion', async () => {
    Object.defineProperty(window, 'matchMedia', {configurable: true, value: vi.fn().mockReturnValue({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})});
    render(<SignalChamberLab />);
    fireEvent.click(screen.getByRole('button', {name: 'NEXT EVENT'}));
    await waitFor(() => expect(screen.getByTestId('signal-lab').getAttribute('data-reduced-motion')).toBe('true'));
    expect(screen.getByTestId('signal-lab').getAttribute('data-active-body-count')).toBe('0');
    expect(screen.getByTestId('signal-lab').getAttribute('data-queued-count')).toBe('0');
  });

  it('keeps the mobile body cap at four and does not require horizontal overflow', () => {
    expect(maxActiveBodiesForWidth(390)).toBe(4);
    render(<SignalChamberLab />);
    expect(document.body.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth || Number.MAX_SAFE_INTEGER);
    expect(SIGNAL_EVENTS.every((event) => ['HELP_BEACON_OPENED', 'ASSIST_ACCEPTED', 'EXTERNAL_TEST_RECORDED'].includes(event.kind))).toBe(true);
  });
});
