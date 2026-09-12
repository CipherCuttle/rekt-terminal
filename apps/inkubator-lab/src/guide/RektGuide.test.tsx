import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {INSTRUMENT_MODES, InstrumentNavigationProvider, type InstrumentMode} from '../shell/InstrumentNavigation';
import {RektGuide} from './RektGuide';

afterEach(cleanup);

function renderGuide(currentMode: InstrumentMode = 'PROJECT') {
  const onModeSelect = vi.fn();
  render(
    <InstrumentNavigationProvider value={{enabledModes: INSTRUMENT_MODES, onModeSelect}}>
      <RektGuide currentMode={currentMode}/>
    </InstrumentNavigationProvider>,
  );
  return onModeSelect;
}

describe('REKT Guide', () => {
  it('searches help and routes to the existing COMMAND workflow instead of inventing a new action path', () => {
    const onModeSelect = renderGuide('PROJECT');
    fireEvent.click(screen.getByRole('button', {name: 'Open REKT Guide'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search REKT Guide'}), {target: {value: 'help'}});
    fireEvent.click(screen.getByRole('button', {name: /Ask for help/i}));

    expect(onModeSelect).toHaveBeenCalledWith('COMMAND');
    expect(screen.getByText(/Use the existing Help Beacon/i)).toBeTruthy();
  });

  it('explains truth states without changing instrument mode and closes with Escape', () => {
    const onModeSelect = renderGuide('COMMAND');
    fireEvent.click(screen.getByRole('button', {name: 'Open REKT Guide'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search REKT Guide'}), {target: {value: 'claimed'}});
    fireEvent.click(screen.getByRole('button', {name: /CLAIMED \/ OBSERVED \/ PROVEN/i}));

    expect(screen.getByText(/CLAIMED is what someone says/i)).toBeTruthy();
    expect(onModeSelect).not.toHaveBeenCalled();

    fireEvent.keyDown(window, {key: 'Escape'});
    expect(screen.queryByRole('dialog', {name: 'REKT GUIDE'})).toBeNull();
  });
});
