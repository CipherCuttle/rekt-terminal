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
    expect(screen.getByText('MAKE DEGENS SHIP.')).toBeTruthy();
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

  it('shows real collection artifacts and switches collections without fake live claims', () => {
    render(<AppV2 />);
    expect(screen.getByText('REKT INK', {selector: '.d2-art-glass strong'})).toBeTruthy();
    expect(screen.getByText(/#4229 \/ VIEW ARTIFACT/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'CHIBI HOOD'}));
    expect(screen.getByText('CHIBI HOOD', {selector: '.d2-art-glass strong'})).toBeTruthy();
    expect(screen.getByText(/#7267 \/ VIEW ARTIFACT/)).toBeTruthy();
    expect(screen.getByText('CURATED MEDIA / OPENSEA')).toBeTruthy();
    expect(screen.queryByText('LIVE MEDIA / OPENSEA')).toBeNull();
  });
});
