import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import ChallengeProduct from './ChallengeProduct';
import {CHALLENGE_SURFACES, parseChallengeSurface, SURFACE_STATES} from './state';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Stage E Challenge product shell', () => {
  it('locks the seven-surface Challenge IA and excludes the historical five-mode navigation', () => {
    render(<ChallengeProduct />);
    const nav = screen.getByRole('navigation', {name: 'Challenge product'});
    expect(within(nav).getAllByRole('button')).toHaveLength(7);
    expect(CHALLENGE_SURFACES).toEqual(['DISCOVER', 'COMPILER', 'CHALLENGE', 'MY_BUILD', 'REVIEW', 'HISTORY', 'OPERATOR']);
    expect(within(nav).queryByText('WORLD')).toBeNull();
    expect(within(nav).queryByText('COMMAND')).toBeNull();
    expect(within(nav).queryByText('PROJECT')).toBeNull();
    expect(within(nav).queryByText('PLAYER')).toBeNull();
    expect(within(nav).queryByText('SHIP')).toBeNull();
  });

  it('uses an explicit unavailable state instead of legacy discovery data', () => {
    render(<ChallengeProduct />);
    expect(screen.getByText(/Challenge discovery transport is not exposed yet/i)).toBeTruthy();
    expect(screen.getByText(/Historical World, Project and social discovery routes are intentionally not substituted/i)).toBeTruthy();
    expect(document.querySelector('[data-surface-state="unavailable_or_stale"]')).toBeTruthy();
  });

  it('keeps compiler input labeled as local draft until the real compiler is wired', () => {
    render(<ChallengeProduct />);
    fireEvent.click(screen.getByRole('button', {name: /COMPILER \/ CREATE/i}));
    expect(screen.getByText(/Start with a fuzzy idea/i)).toBeTruthy();
    const source = screen.getByLabelText('SOURCE INTENT');
    fireEvent.change(source, {target: {value: 'Build a realtime public launch dashboard'}});
    expect(screen.getByText('DRAFT CAPTURED LOCALLY')).toBeTruthy();
    expect(screen.getByText(/Compiler state is not generated yet/i)).toBeTruthy();
    expect(screen.getByRole('button', {name: /COMPILE — TRANSPORT WIRING NEXT/i})).toBeDisabled();
  });

  it('normalizes deep-link surface names and exposes the full canonical state vocabulary', () => {
    expect(parseChallengeSurface('my-build')).toBe('MY_BUILD');
    expect(parseChallengeSurface('history')).toBe('HISTORY');
    expect(parseChallengeSurface('world')).toBeUndefined();
    expect(SURFACE_STATES).toEqual(['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'UNAVAILABLE_OR_STALE', 'UNAUTHORIZED']);
  });
});
