import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import './base-v3.css';
import './comeback-v3.css';
import './protocol-v0.css';
import './signal-system/phase9-rehearsal.css';

const AppV3 = lazy(() => import('./AppV3'));
const SignalSystemLab = lazy(() => import('./signal-system/GoldenScreens'));
const params = new URLSearchParams(window.location.search);
const signalLab = params.get('lab') === 'signals';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div role="status">Loading REKT…</div>}>
      {signalLab ? <SignalSystemLab /> : <AppV3 />}
    </Suspense>
  </StrictMode>
);
