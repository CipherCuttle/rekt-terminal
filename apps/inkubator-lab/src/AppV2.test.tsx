import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ReactNode} from 'react';

vi.mock('./reactbits-pro', () => ({
  GrainWave: ({className = ''}: {className?: string}) => <div data-testid="grain-wave" className={className} />,
  DitherWave: () => <div data-testid="dither-wave" />,
  SquircleShift: ({className = ''}: {className?: string}) => <div data-testid="squircle-shift" className={className} />,
  GlitchText: ({children}: {children: ReactNode}) => <>{children}</>,
}));

import AppV2 from './AppV2';

afterEach(() => cleanup());

describe('Inkubator compressed flow', () => {
  it('explains the challenge in the first viewport with low reading load', () => {
    render(<AppV2 />);
    expect(screen.getByRole('heading', {name: 'BUILD SOMETHING WEIRD. PUT IT ON THE INTERNET.'})).toBeTruthy();
    expect(screen.getByText('BUILD WEIRD SHIT / SHIP IT')).toBeTruthy();
    expect(screen.getByText(/Short REKT build rounds for games, tools and weird internet experiments/i)).toBeTruthy();
    expect(screen.getByText('SHORT ROUNDS')).toBeTruthy();
    expect(screen.getByText('WORKING LINK')).toBeTruthy();
    expect(screen.getByText('MAKE DEGENS SHIP.', {selector: '.d2-actions b'})).toBeTruthy();
  });

  it('keeps the five-step loop interactive and terse', () => {
    render(<AppV2 />);
    expect(screen.getByText('BUILD', {selector: '.d2-loop-readout strong'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /AMPLIFY/}));
    expect(screen.getByText('AMPLIFY', {selector: '.d2-loop-readout strong'})).toBeTruthy();
    expect(screen.getByText('Clip it. Post it. Let it travel.')).toBeTruthy();
  });

  it('merges value exchange and distribution without invented commitments', () => {
    const {container} = render(<AppV2 />);
    expect(container.querySelector('.d2-weight-grid article:first-child h3')?.textContent?.replace(/\s+/g, '')).toBe('MAKETHETHING.');
    expect(container.querySelector('.d2-weight-grid article:last-child h3')?.textContent?.replace(/\s+/g, '')).toBe('CREATETHEPULL.');
    expect(screen.getByText('eyes on what ships')).toBeTruthy();
    expect(screen.getByText('NEXT BUILDER')).toBeTruthy();
    expect(screen.queryByText('250 USDT')).toBeNull();
    expect(screen.queryByText('OFFICIAL SIGNAL')).toBeNull();
    expect(screen.queryByText('WHY IT EXISTS')).toBeNull();
    expect(screen.queryByText('WHO THIS IS FOR')).toBeNull();
  });

  it('explains why REKT and Chibi are present and keeps collection browsing explicit', () => {
    const {container} = render(<AppV2 />);
    expect(container.querySelector('.d2-collection-copy h2')?.textContent?.replace(/\s+/g, '')).toBe('TWOYEARS.STILLHERE.');
    expect(screen.getByText('HELD THE LINE')).toBeTruthy();
    expect(screen.getByText('BUILD THE COMEBACK')).toBeTruthy();
    expect(screen.getByText('BROWSE THE WORLD')).toBeTruthy();
    expect(screen.getByText('REKT INK', {selector: '.d2-art-glass strong'})).toBeTruthy();
    expect(screen.getByText(/#4229 \/ OPEN ON OPENSEA/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'CHIBI HOOD'}));
    expect(screen.getByText('CHIBI HOOD', {selector: '.d2-art-glass strong'})).toBeTruthy();
    expect(screen.getByText(/#7267 \/ OPEN ON OPENSEA/)).toBeTruthy();
    expect(screen.getByText('CLICK AN NFT TO OPEN IT ON OPENSEA')).toBeTruthy();
    expect(screen.queryByText('LIVE MEDIA / OPENSEA')).toBeNull();
  });

  it('shows a compact roadmap without presenting it as a promise', () => {
    render(<AppV2 />);
    expect(screen.getByText('COMEBACK PLAN')).toBeTruthy();
    expect(screen.getByText('DIRECTION / NOT PROMISES')).toBeTruthy();
    expect(screen.getByText('PROVE THE LOOP')).toBeTruthy();
    expect(screen.getByText('TURN ON LIVE SIGNAL')).toBeTruthy();
    expect(screen.getByText(/Latest REKT\/Chibi buys, holder growth and community growth/i)).toBeTruthy();
    expect(screen.getByText('COMPOUND IT')).toBeTruthy();
  });
});
