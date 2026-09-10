import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {parseInstrumentMode} from './shell/InstrumentNavigation';
import './base-v3.css';
import './comeback-v3.css';
import './protocol-v0.css';
import './signal-system/phase9-rehearsal.css';
import './instrument-os/motion-runtime.css';

const AppV3 = lazy(() => import('./AppV3'));
const SignalSystemLab = lazy(() => import('./signal-system/GoldenScreens'));
const InstrumentLab = lazy(() => import('./instrument-os/InstrumentLab'));
const PeripheralMotionLab = lazy(() => import('./instrument-os/PeripheralMotionLab'));
const LiveInstrument = lazy(() => import('./LiveInstrument'));
const params = new URLSearchParams(window.location.search);
const lab = params.get('lab');
const liveMode = parseInstrumentMode(params.get('mode'));

const instrumentQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div role="status">Loading REKT…</div>}>
      {lab === 'instrument'
        ? <InstrumentLab />
        : lab === 'peripheral'
          ? <PeripheralMotionLab />
          : lab === 'signals'
            ? <SignalSystemLab />
            : lab === 'legacy'
              ? <><div role="note" className="fixture-banner">LEGACY DEMO / FIXTURE DATA / NOT LIVE</div><AppV3 /></>
              : <QueryClientProvider client={instrumentQueryClient}><LiveInstrument initialMode={liveMode ?? 'COMMAND'} /></QueryClientProvider>}
    </Suspense>
  </StrictMode>
);
