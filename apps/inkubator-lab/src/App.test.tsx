import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import App from './App';

afterEach(() => cleanup());

describe('broadcast dossier', () => {
  it('renders the core REKT thesis and selected field log', () => {
    render(<App />);

    expect(screen.getByRole('heading', {name: 'MAKE DEGENS SHIP.'})).toBeTruthy();
    expect(screen.getByText('WORKING URL OR GTFO')).toBeTruthy();
    expect(screen.getByRole('row', {name: '009 PUBLIC WILDCARD OPEN'})).toBeTruthy();
  });

  it('exposes the loop as an interactive but understandable signal', () => {
    render(<App />);

    expect(screen.getByText('SHIP', {selector: '.loop-readout strong'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /REWARD/}));
    expect(screen.getByText('REWARD', {selector: '.loop-readout strong'})).toBeTruthy();
    expect(screen.getByText('Money, status, access, lore. The only metric that matters is whether somebody shipped.')).toBeTruthy();
  });
});
