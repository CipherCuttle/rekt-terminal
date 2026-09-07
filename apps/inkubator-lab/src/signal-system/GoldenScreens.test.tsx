import {cleanup, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import GoldenScreens from './GoldenScreens';

const cases = [
  ['world', 'heading', /BUILD SOMETHING WEIRD/i],
  ['command', 'heading', /SHIP THE WEIRD LITTLE THING/i],
  ['project', 'heading', /^REKT MACHINE$/i],
  ['player', 'heading', /^CIPHERCUTTLE$/i],
  ['ship', 'signal', /SHIP ACCEPTED, source SHIP RULE V1/i],
] as const;

afterEach(() => cleanup());

describe('REKT Signal System golden screens', () => {
  it.each(cases)('renders %s with its dominant context', (screenName, kind, expected) => {
    render(<GoldenScreens screen={screenName} />);
    const dominant = kind === 'heading'
      ? screen.getByRole('heading', {name: expected})
      : screen.getByLabelText(expected);
    expect(dominant).toBeTruthy();
    expect(screen.getByRole('navigation', {name: /golden screen navigation/i})).toBeTruthy();
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
    const repositoryLabel = screen.getByText('REPOSITORY PUSH');
    const evidenceRow = repositoryLabel.closest('div');
    expect(evidenceRow).toBeTruthy();
    expect(within(evidenceRow as HTMLElement).getByLabelText(/OBSERVED, source GITHUB/i)).toBeTruthy();
  });

  it('uses proof semantics only on explicitly proven signals in the Ship receipt', () => {
    render(<GoldenScreens screen="ship" />);
    const accepted = screen.getByLabelText(/SHIP ACCEPTED, source SHIP RULE V1/i);
    const artifact = screen.getByLabelText(/PUBLIC ARTIFACT.*source VERIFIER/i);
    expect(accepted.getAttribute('data-ink-signal')).toBe('PROVEN');
    expect(artifact.getAttribute('data-ink-signal')).toBe('OBSERVED');
  });
});
