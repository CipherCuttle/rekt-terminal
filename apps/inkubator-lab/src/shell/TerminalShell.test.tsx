import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {TerminalShell} from './TerminalShell';

afterEach(cleanup);

describe('TerminalShell', () => {
  it('keeps one five-mode chassis while only the current production mode is enabled', () => {
    render(
      <TerminalShell
        mode="COMMAND"
        kicker="REKT INK(CUBATOR) // LIVE COMMAND"
        title="WEIRD LITTLE THING"
        footerItems={['CLAIMED ≠ OBSERVED ≠ PROVEN']}
      >
        <p>command payload</p>
      </TerminalShell>,
    );

    expect(screen.getByRole('main').getAttribute('data-shell')).toBe('terminal');
    expect(screen.getByRole('main').getAttribute('data-shell-variant')).toBe('v2');
    expect(screen.getByRole('navigation', {name: 'Instrument mode'})).toBeTruthy();
    for (const mode of ['WORLD', 'COMMAND', 'PROJECT', 'PLAYER', 'SHIP']) {
      const button = screen.getByRole('button', {name: new RegExp(mode)});
      expect(button.getAttribute('aria-pressed')).toBe(String(mode === 'COMMAND'));
      expect((button as HTMLButtonElement).disabled).toBe(mode !== 'COMMAND');
    }
    expect(screen.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeTruthy();
  });

  it('exposes mode switching only when a later mode is explicitly enabled', () => {
    const onModeSelect = vi.fn();
    render(
      <TerminalShell
        mode="COMMAND"
        kicker="REKT"
        title="COMMAND"
        enabledModes={['COMMAND', 'PROJECT']}
        onModeSelect={onModeSelect}
      >
        <p>command payload</p>
      </TerminalShell>,
    );

    fireEvent.click(screen.getByRole('button', {name: /PROJECT/}));
    expect(onModeSelect).toHaveBeenCalledWith('PROJECT');
    expect((screen.getByRole('button', {name: /WORLD/}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps WORLD on v2 while unmigrated PLAYER remains legacy', () => {
    const {rerender} = render(
      <TerminalShell mode="WORLD" kicker="REKT" title="WORLD">
        <p>world payload</p>
      </TerminalShell>,
    );

    expect(screen.getByRole('main').getAttribute('data-shell-variant')).toBe('v2');

    rerender(
      <TerminalShell mode="PLAYER" kicker="REKT" title="PLAYER">
        <p>player payload</p>
      </TerminalShell>,
    );

    expect(screen.getByRole('main').getAttribute('data-shell-variant')).toBe('legacy');
  });
});
