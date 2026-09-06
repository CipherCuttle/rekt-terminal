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

describe('Inkubator value proposition', () => {
  it('explains what Inkubator is before asking the visitor to decode the culture', () => {
    render(<AppV2 />);
    expect(screen.getByRole('heading', {name: 'BUILD SOMETHING WEIRD. PUT IT ON THE INTERNET.'})).toBeTruthy();
    expect(screen.getByText('NOT ANOTHER COMMUNITY TO JOIN / A REASON TO BUILD')).toBeTruthy();
    expect(screen.getByText(/turns REKT culture into games, tools, and interactive experiments/i)).toBeTruthy();
    expect(screen.getByText('RECURRING ROUNDS')).toBeTruthy();
    expect(screen.getByText('WORKING URL')).toBeTruthy();
  });

  it('makes the round mechanics explicit and interactive', () => {
    render(<AppV2 />);
    expect(screen.getByText('BUILD', {selector: '.d2-loop-readout strong'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /AMPLIFY/}));
    expect(screen.getByText('AMPLIFY', {selector: '.d2-loop-readout strong'})).toBeTruthy();
    expect(screen.getByText('Turn the shipped artifact into a clip, demo, or post that can travel.')).toBeTruthy();
  });

  it('states the builder exchange without inventing rewards or official commitments', () => {
    const {container} = render(<AppV2 />);
    expect(container.querySelector('.d2-weight-grid article:first-child h3')?.textContent?.replace(/\s+/g, '')).toBe('BRINGTHETHING.');
    expect(container.querySelector('.d2-weight-grid article:last-child h3')?.textContent?.replace(/\s+/g, '')).toBe('CREATETHEPULL.');
    expect(screen.getByText('a distribution loop around what ships')).toBeTruthy();
    expect(screen.queryByText('250 USDT')).toBeNull();
    expect(screen.queryByText('OFFICIAL SIGNAL')).toBeNull();
    expect(screen.queryByText('8 INVITED')).toBeNull();
    expect(screen.queryByText('2 WILDCARDS')).toBeNull();
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
