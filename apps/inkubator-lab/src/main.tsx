import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import './base-v3.css';
import './comeback-v3.css';
import './protocol-v0.css';
import './signal-system/phase9-rehearsal.css';
import './instrument-os/motion-runtime.css';

const AppV3 = lazy(() => import('./AppV3'));
const SignalSystemLab = lazy(() => import('./signal-system/GoldenScreens'));
const InstrumentLab = lazy(() => import('./instrument-os/InstrumentLab'));
const LiveCommand = lazy(() => import('./command/LiveCommand'));
const params = new URLSearchParams(window.location.search);
const lab = params.get('lab');
const mode = params.get('mode');

const commandQueryClient = new QueryClient({
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
          : mode === 'command'
            ? <QueryClientProvider client={commandQueryClient}><LiveCommand /></QueryClientProvider>
            : <AppV3 />}
    </Suspense>
  </StrictMode>
);
