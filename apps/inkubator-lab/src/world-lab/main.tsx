import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import SignalChamberLab from './SignalChamberLab';
import './signal-chamber-lab.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SignalChamberLab />
  </StrictMode>,
);
