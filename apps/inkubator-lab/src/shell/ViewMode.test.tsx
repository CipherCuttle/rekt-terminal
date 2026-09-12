import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {useMemo, useState} from 'react';
import {InstrumentNavigationProvider, type InstrumentMode} from './InstrumentNavigation';
import {TerminalShell} from './TerminalShell';
import {INKUBATOR_VIEW_MODE_KEY, ViewModeProvider} from './ViewMode';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function Harness() {
  const [mode, setMode] = useState<InstrumentMode>('COMMAND');
  const navigation = useMemo(() => ({
    enabledModes: ['WORLD', 'COMMAND', 'PROJECT', 'PLAYER', 'SHIP'] as const,
    onModeSelect: setMode,
  }), []);

  return <ViewModeProvider initialMode="ADVANCED">
    <InstrumentNavigationProvider value={navigation}>
      <TerminalShell mode={mode} kicker="TEST" title={`${mode} PAGE`}>
        <p>{mode} CONTENT</p>
      </TerminalShell>
    </InstrumentNavigationProvider>
  </ViewModeProvider>;
}

it('keeps one persisted Lite Advanced mode while moving between instrument pages', () => {
  const {container} = render(<Harness />);
  const shell = () => container.querySelector('[data-shell="terminal"]');

  expect(shell()?.getAttribute('data-mode')).toBe('command');
  expect(shell()?.getAttribute('data-view-mode')).toBe('advanced');

  fireEvent.click(screen.getByRole('button', {name: 'LITE'}));
  expect(shell()?.getAttribute('data-view-mode')).toBe('lite');
  expect(window.localStorage.getItem(INKUBATOR_VIEW_MODE_KEY)).toBe('LITE');

  fireEvent.click(container.querySelector('button[data-mode="project"]')!);
  expect(shell()?.getAttribute('data-mode')).toBe('project');
  expect(shell()?.getAttribute('data-view-mode')).toBe('lite');

  fireEvent.click(container.querySelector('button[data-mode="world"]')!);
  expect(shell()?.getAttribute('data-mode')).toBe('world');
  expect(shell()?.getAttribute('data-view-mode')).toBe('lite');

  fireEvent.click(screen.getByRole('button', {name: 'ADVANCED'}));
  expect(shell()?.getAttribute('data-view-mode')).toBe('advanced');
  expect(window.localStorage.getItem(INKUBATOR_VIEW_MODE_KEY)).toBe('ADVANCED');

  fireEvent.click(container.querySelector('button[data-mode="ship"]')!);
  expect(shell()?.getAttribute('data-mode')).toBe('ship');
  expect(shell()?.getAttribute('data-view-mode')).toBe('advanced');
});
