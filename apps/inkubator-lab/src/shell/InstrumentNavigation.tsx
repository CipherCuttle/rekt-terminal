import {createContext, useContext, type ReactNode} from 'react';

export const INSTRUMENT_MODES = ['WORLD', 'COMMAND', 'PROJECT', 'PLAYER', 'SHIP'] as const;
export type InstrumentMode = (typeof INSTRUMENT_MODES)[number];

type InstrumentNavigationValue = {
  enabledModes: readonly InstrumentMode[];
  onModeSelect: (mode: InstrumentMode) => void;
};

const InstrumentNavigationContext = createContext<InstrumentNavigationValue | null>(null);

export function InstrumentNavigationProvider({value, children}: {value: InstrumentNavigationValue; children: ReactNode}) {
  return <InstrumentNavigationContext.Provider value={value}>{children}</InstrumentNavigationContext.Provider>;
}

export function useInstrumentNavigation() {
  return useContext(InstrumentNavigationContext);
}

export function parseInstrumentMode(value: string | null | undefined): InstrumentMode | undefined {
  const normalized = value?.toUpperCase();
  return INSTRUMENT_MODES.find((mode) => mode === normalized);
}
