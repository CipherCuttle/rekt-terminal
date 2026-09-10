import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {parseInstrumentMode} from './shell/InstrumentNavigation';
import './base-v3.css';
import './comeback-v3.css';
import './protocol-v0.css';
import './signal-system/phase9-rehearsal.css';
import './instrument-os/motion-runtime.css';
import './command/live-command-v2-semantics.css';

const AppV3 = lazy(() => import('./AppV3'));
const SignalSystemLab = lazy(() => import('./signal-system/GoldenScreens'));
const InstrumentLab = lazy(() => import('./instrument-os/InstrumentLab'));
const WorldCompositionLab = lazy(() => import('./world-composition-lab/WorldCompositionLab'));
const LiveInstrument = lazy(() => import('./LiveInstrument'));
const params = new URLSearchParams(window.location.search);
const lab = params.get('lab');
const liveMode = parseInstrumentMode(params.get('mode'));
const requestedWorldVariant = params.get('variant');
const worldVariant = requestedWorldVariant === 'dispatch' || requestedWorldVariant === 'receiver'
  ? requestedWorldVariant
  : 'tape';
const requestedWorldScenario = params.get('scenario');
const worldScenario = requestedWorldScenario === 'quiet'
  || requestedWorldScenario === 'help-now'
  || requestedWorldScenario === 'burst'
  || requestedWorldScenario === 'all-observed'
  ? requestedWorldScenario
  : 'normal';

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
        : lab === 'signals'
          ? <SignalSystemLab />
          : lab === 'world-composition'
            ? <WorldCompositionLab variant={worldVariant} scenario={worldScenario} />
            : liveMode
              ? <QueryClientProvider client={instrumentQueryClient}><LiveInstrument initialMode={liveMode} /></QueryClientProvider>
              : <AppV3 />}
    </Suspense>
  </StrictMode>
);