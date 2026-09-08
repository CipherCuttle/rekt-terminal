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
  });

  it('drives every primitive from one explicit calibration state selector', () => {
    const {container} = render(<InstrumentLab />);
    fireEvent.click(screen.getByRole('button', {name: 'ERROR'}));
    expect(container.querySelector('.ios-lab')?.getAttribute('data-state')).toBe('error');
    expect(screen.getByText('BLOCKER DETECTED')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'SUCCESS'}));
    expect(container.querySelector('.ios-lab')?.getAttribute('data-state')).toBe('success');
    expect(screen.getByText('READY TO SHIP')).toBeTruthy();
  });
});
