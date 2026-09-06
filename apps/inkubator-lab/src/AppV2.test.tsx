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

describe('Inkubator broadcast dossier synthesis', () => {
  it('keeps the current signal-board thesis while restoring the transmission grammar', () => {
    render(<AppV2 />);
    expect(screen.getByRole('heading', {name: 'MAKE DEGENS SHIP.'})).toBeTruthy();
    expect(screen.getByText('TRANSMISSION')).toBeTruthy();
    expect(screen.getByText('WORKING URL OR GTFO')).toBeTruthy();
    expect(screen.getByText('SHIP > TALK')).toBeTruthy();
  });

  it('keeps the loop interactive and legible', () => {
    render(<AppV2 />);
    expect(screen.getByText('SHIP', {selector: '.d2-loop-readout strong'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /REWARD/}));
    expect(screen.getByText('REWARD', {selector: '.d2-loop-readout strong'})).toBeTruthy();
    expect(screen.getByText('Turn the strongest artifact into signal, status, and a reason to return.')).toBeTruthy();
  });

  it('shows real collection artifacts and switches collections without fake live claims', () => {
    render(<AppV2 />);
    expect(screen.getByText('REKT INK #4229')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'CHIBI HOOD'}));
    expect(screen.getByText('CHIBI HOOD #7267')).toBeTruthy();
    expect(screen.getByText('CURATED MEDIA / OPENSEA')).toBeTruthy();
    expect(screen.queryByText('LIVE MEDIA / OPENSEA')).toBeNull();
  });

  it('keeps unconfirmed reward commitments out of the public concept surface', () => {
    render(<AppV2 />);
    expect(screen.queryByText('250 USDT')).toBeNull();
    expect(screen.queryByText('OFFICIAL SIGNAL')).toBeNull();
    expect(screen.getByText('reward structure when locked')).toBeTruthy();
  });
});
