import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import WorldCompositionLab from './WorldCompositionLab';
import {worldCompositionFixtures} from './world-composition-fixtures';
import type {WorldCompositionVariant} from './world-composition-types';

afterEach(() => cleanup());

const variants: WorldCompositionVariant[] = ['tape', 'dispatch', 'receiver'];

describe('WORLD composition lab', () => {
  it.each(variants)('renders the same ordered event data for %s', (variant) => {
    render(<WorldCompositionLab variant={variant} scenario="normal" />);
    const renderedIds = Array.from(document.querySelectorAll<HTMLElement>('[data-event-id]')).map((element) => element.dataset.eventId);
    expect(renderedIds).toEqual(worldCompositionFixtures.normal.map((event) => event.id));
  });

  it('keeps the current WORLD event union and truth labels bounded', () => {
    render(<WorldCompositionLab variant="receiver" scenario="help-now" />);
    expect(screen.getAllByText('HELP BEACON OPENED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CLAIMED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OBSERVED').length).toBeGreaterThan(0);
    expect(screen.queryByText('PROVEN')).toBeNull();
    expect(screen.queryByText(/GITHUB|SHIP SUBMITTED|CHEEVO/i)).toBeNull();
  });

  it('renders quiet and burst scenarios without changing the topology contract', () => {
    const {rerender} = render(<WorldCompositionLab variant="dispatch" scenario="quiet" />);
    expect(document.querySelectorAll('[data-event-id]')).toHaveLength(2);
    rerender(<WorldCompositionLab variant="dispatch" scenario="burst" />);
    expect(document.querySelectorAll('[data-event-id]')).toHaveLength(16);
    expect(screen.getByText('S4 / BURST')).toBeTruthy();
  });

  it('marks the lab as static and fixture-only', () => {
    render(<WorldCompositionLab variant="tape" scenario="normal" />);
    const root = document.querySelector('[data-world-composition-lab]');
    expect(root?.getAttribute('data-motion')).toBe('off');
    expect(root?.getAttribute('data-crt')).toBe('off');
    expect(screen.getByText('DEVELOPMENT FIXTURE / NOT LIVE DATA')).toBeTruthy();
  });
});
