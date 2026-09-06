import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import App from './App';

afterEach(() => cleanup());

describe('React Bits-inspired signal board', () => {
  it('renders the useful first viewport without the old dossier language', () => {
    render(<App />);
    expect(screen.getByRole('heading', {name: 'MAKE DEGENS SHIP.'})).toBeTruthy();
    expect(screen.getByText('WORKING URL REQUIRED')).toBeTruthy();
    expect(screen.queryByText('BROADCAST DOSSIER')).toBeNull();
  });

  it('keeps the loop readable while the active chamber changes', () => {
    render(<App />);
    expect(screen.getByText('SHIP', {selector: '.chamber-word'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /REWARD/}));
    expect(screen.getByText('REWARD', {selector: '.chamber-word'})).toBeTruthy();
    expect(screen.getByText('Give the strongest build money, status, and a reason to return.')).toBeTruthy();
  });
});
