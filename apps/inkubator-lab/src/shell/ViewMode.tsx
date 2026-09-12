import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';

export type InkubatorViewMode = 'LITE' | 'ADVANCED';

export const INKUBATOR_VIEW_MODE_KEY = 'rekt.inkubator.ui-mode.v1';
const LEGACY_COMMAND_VIEW_MODE_KEY = 'rekt.inkubator.command.ui-mode.v1';

type ViewModeValue = {
  mode: InkubatorViewMode;
  setMode: (mode: InkubatorViewMode) => void;
};

const ViewModeContext = createContext<ViewModeValue | null>(null);

function readStoredViewMode(): InkubatorViewMode {
  try {
    const current = window.localStorage.getItem(INKUBATOR_VIEW_MODE_KEY);
    if (current === 'ADVANCED' || current === 'LITE') return current;
    const legacy = window.localStorage.getItem(LEGACY_COMMAND_VIEW_MODE_KEY);
    if (legacy === 'ADVANCED' || legacy === 'LITE') return legacy;
  } catch {
    // Presentation preference is best-effort only.
  }
  return 'LITE';
}

export function ViewModeProvider({children, initialMode}: {children: ReactNode; initialMode?: InkubatorViewMode}) {
  const [mode, setModeState] = useState<InkubatorViewMode>(() => initialMode ?? readStoredViewMode());

  const value = useMemo<ViewModeValue>(() => ({
    mode,
    setMode: (next) => {
      setModeState(next);
      try {
        window.localStorage.setItem(INKUBATOR_VIEW_MODE_KEY, next);
        window.localStorage.setItem(LEGACY_COMMAND_VIEW_MODE_KEY, next);
      } catch {
        // Presentation preference persistence is best-effort only.
      }
    },
  }), [mode]);

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  return useContext(ViewModeContext);
}

export function ViewModeToggle() {
  const view = useViewMode();
  if (!view) return null;
  return (
    <div className="inkubator-view-mode" aria-label="Inkubator detail level">
      <span>VIEW</span>
      <div role="group" aria-label="Choose Inkubator detail level">
        <button type="button" aria-pressed={view.mode === 'LITE'} onClick={() => view.setMode('LITE')}>LITE</button>
        <button type="button" aria-pressed={view.mode === 'ADVANCED'} onClick={() => view.setMode('ADVANCED')}>ADVANCED</button>
      </div>
    </div>
  );
}
