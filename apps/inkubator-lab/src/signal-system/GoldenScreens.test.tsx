import {render, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import GoldenScreens from './GoldenScreens';

const cases = [
  ['world', /BUILD SOMETHING WEIRD/i],
  ['command', /SHIP THE WEIRD LITTLE THING/i],
  ['project', /REKT MACHINE/i],
  ['player', /CIPHERCUTTLE/i],
  ['ship', /SHIP ACCEPTED/i],
] as const;

describe('REKT Signal System golden screens', () => {
  it.each(cases)('renders %s with its dominant context', (screenName, expected) => {
    render(<GoldenScreens screen={screenName} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: /golden screen navigation/i})).toBeInTheDocument();
  });

  it('keeps Command hierarchy mission → next move → thread → blocker', () => {
    const {container} = render(<GoldenScreens screen="command" />);
    const text = container.textContent ?? '';
    expect(text.indexOf('CURRENT MISSION')).toBeLessThan(text.indexOf('OPEN TEST REQUEST'));
    expect(text.indexOf('OPEN TEST REQUEST')).toBeLessThan(text.indexOf('THE THREAD'));
    expect(text.indexOf('THE THREAD')).toBeLessThan(text.indexOf('BLOCKER'));
  });

  it('never promotes observed GitHub evidence into PROVEN', () => {
    render(<GoldenScreens screen="command" />);
    const evidenceFrame = screen.getByText('EVIDENCE').closest('section');
    expect(evidenceFrame).not.toBeNull();
    expect(within(evidenceFrame!).getByText('REPOSITORY PUSH')).toBeInTheDocument();
    expect(within(evidenceFrame!).getByLabelText(/OBSERVED, source GITHUB/i)).toBeInTheDocument();
  });

  it('uses acid proof semantics only on explicitly proven signals in the Ship receipt', () => {
    render(<GoldenScreens screen="ship" />);
    expect(screen.getByLabelText(/SHIP ACCEPTED, source SHIP RULE V1/i)).toHaveAttribute('data-ink-signal', 'PROVEN');
    expect(screen.getByLabelText(/PUBLIC ARTIFACT.*source VERIFIER/i)).toHaveAttribute('data-ink-signal', 'OBSERVED');
  });
});
