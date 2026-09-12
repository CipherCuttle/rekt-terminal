import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {INSTRUMENT_MODES, InstrumentNavigationProvider} from './InstrumentNavigation';
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
    for (const mode of INSTRUMENT_MODES) {
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

  it('enables the whole rail only when the integrated router provides navigation', () => {
    const onModeSelect = vi.fn();
    render(
      <InstrumentNavigationProvider value={{enabledModes: INSTRUMENT_MODES, onModeSelect}}>
        <TerminalShell mode="COMMAND" kicker="REKT" title="COMMAND"><p>command payload</p></TerminalShell>
      </InstrumentNavigationProvider>,
    );

    for (const mode of INSTRUMENT_MODES) {
      expect((screen.getByRole('button', {name: new RegExp(mode)}) as HTMLButtonElement).disabled).toBe(false);
    }
    fireEvent.click(screen.getByRole('button', {name: /WORLD/}));
    expect(onModeSelect).toHaveBeenCalledWith('WORLD');
  });

  it('keeps every canonical Instrument OS mode on the v2 material shell', () => {
    const {rerender} = render(
      <TerminalShell mode="WORLD" kicker="REKT" title="WORLD"><p>world payload</p></TerminalShell>,
    );

    for (const mode of INSTRUMENT_MODES) {
      rerender(<TerminalShell mode={mode} kicker="REKT" title={mode}><p>{mode.toLowerCase()} payload</p></TerminalShell>);
      expect(screen.getByRole('main').getAttribute('data-shell-variant')).toBe('v2');
      expect(screen.getByRole('main').className).toContain('ios-shell-v2');
    }
  });
});