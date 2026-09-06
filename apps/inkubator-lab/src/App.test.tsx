import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import App from './App';

afterEach(() => cleanup());

describe('design lab controls', () => {
  it('switches between materially different direction pages', () => {
    render(<App />);

    expect(screen.getByRole('heading', {name: 'PICKED FOR A REASON.'})).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', {name: 'A EDITORIAL BENTO'}));
    expect(screen.getByRole('heading', {name: 'FOUNDING SUBJECTS'})).toBeTruthy();
    expect(screen.queryByRole('heading', {name: 'PICKED FOR A REASON.'})).toBeNull();

    fireEvent.click(screen.getByRole('tab', {name: 'B KINETIC BROADCAST'}));
    expect(screen.getByRole('heading', {name: 'THE BUILD IS THE AD.'})).toBeTruthy();
    expect(screen.queryByRole('heading', {name: 'THE MACHINE'})).toBeNull();
  });

  it('exposes explicit motion and loop state controls', () => {
    render(<App />);

    const motion = screen.getByRole('button', {name: 'MOTION ON'});
    expect(motion.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(motion);
    expect(screen.getByRole('button', {name: 'MOTION OFF'}).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', {name: /REWARD.*money/}));
    expect(screen.getByText('REWARD', {selector: '.loop-readout strong'})).toBeTruthy();
  });
});
