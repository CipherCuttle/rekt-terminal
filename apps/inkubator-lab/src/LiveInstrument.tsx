import {lazy, useEffect, useMemo, useState} from 'react';
import {INSTRUMENT_MODES, InstrumentNavigationProvider, parseInstrumentMode, type InstrumentMode} from './shell/InstrumentNavigation';

const LiveCommand = lazy(() => import('./command/LiveCommand'));
const LiveProject = lazy(() => import('./project/LiveProject'));
const LiveWorld = lazy(() => import('./world/LiveWorld'));
const LivePlayer = lazy(() => import('./player/LivePlayer'));
const LiveShip = lazy(() => import('./ship/LiveShip'));

const SURFACES: Record<InstrumentMode, typeof LiveCommand> = {
  WORLD: LiveWorld,
  COMMAND: LiveCommand,
  PROJECT: LiveProject,
  PLAYER: LivePlayer,
  SHIP: LiveShip,
};

function modeFromLocation(fallback: InstrumentMode) {
  return parseInstrumentMode(new URLSearchParams(window.location.search).get('mode')) ?? fallback;
}

export default function LiveInstrument({initialMode}: {initialMode: InstrumentMode}) {
  const [mode, setMode] = useState(() => modeFromLocation(initialMode));

  useEffect(() => {
    const onPopState = () => setMode(modeFromLocation(initialMode));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialMode]);

  const navigation = useMemo(() => ({
    enabledModes: INSTRUMENT_MODES,
    onModeSelect: (next: InstrumentMode) => {
      if (next === mode) return;
      const url = new URL(window.location.href);
      url.searchParams.delete('lab');
      url.searchParams.set('mode', next.toLowerCase());
      window.history.pushState({instrumentMode: next}, '', url);
      setMode(next);
    },
  }), [mode]);

  const Surface = SURFACES[mode];
  return (
    <InstrumentNavigationProvider value={navigation}>
      <Surface />
    </InstrumentNavigationProvider>
  );
}
