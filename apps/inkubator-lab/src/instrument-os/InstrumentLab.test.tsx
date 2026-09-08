import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import InstrumentLab from './InstrumentLab';

afterEach(cleanup);

describe('REKT Instrument OS calibration lab', () => {
  it('renders the bounded ten-primitive calibration set without claiming product truth', () => {
    const {container} = render(<InstrumentLab />);
    expect(screen.getByRole('heading', {name: 'INSTRUMENT / MOTION LAB'})).toBeTruthy();
    expect(screen.getByText(/Synthetic state only/i)).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="instrument-primitive"]')).toHaveLength(10);
    expect(screen.getByText('MISSION MACHINE')).toBeTruthy();
    expect(screen.getByText('VERIFIER MACHINE')).toBeTruthy();
    expect(screen.getByText('LAST RX AGE')).toBeTruthy();
    expect(screen.getByText(/CANONICAL PIXEL SPRITE NOT FROZEN/i)).toBeTruthy();
    expect(container.querySelector('.ios-lab')?.getAttribute('data-motion')).toBe('gsap');
    expect(container.querySelector('.ios-lab')?.getAttribute('data-crt')).toBe('off');
    expect(container.querySelector('[data-renderer="pixi"]')?.getAttribute('data-renderer-lifecycle')).toBe('retained');
  });

  it('drives every primitive from one explicit calibration event without globally promoting truth color', () => {
    const {container} = render(<InstrumentLab />);
    fireEvent.click(screen.getByRole('button', {name: 'ERROR'}));
    expect(container.querySelector('.ios-lab')?.getAttribute('data-state')).toBe('error');
    expect(screen.getByText('RATCHET JAMMED / BLOCKER')).toBeTruthy();
    expect(screen.getByText(/FAILED OBSERVATION RECEIVED/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {name: 'SUCCESS'}));
    expect(container.querySelector('.ios-lab')?.getAttribute('data-state')).toBe('success');
    expect(screen.getByText('PROOF RECEIVED / RELEASE')).toBeTruthy();
    expect(screen.getByText(/EVENT \/\/ PROOF RECEIVED/i)).toBeTruthy();
    expect(screen.getByText('PROVEN')).toBeTruthy();
  });

  it('keeps CRT as an opt-in prototype material toggle', () => {
    const {container} = render(<InstrumentLab />);
    const toggle = screen.getByRole('button', {name: 'CRT PROTOTYPE OFF'});
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(container.querySelector('.ios-lab')?.getAttribute('data-crt')).toBe('on');
    expect(screen.getByRole('button', {name: 'CRT PROTOTYPE ON'}).getAttribute('aria-pressed')).toBe('true');
  });
});
