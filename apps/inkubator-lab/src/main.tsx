import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppV3 from './AppV3';
import './styles.css';
import './dossier-polish.css';
import './visual-polish.css';
import './messaging-pass.css';
import './composition-polish.css';
import './final-spacing-fixes.css';
import './honeyslop-pass.css';
import './culture-arc.css';
import './comeback-v3.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppV3 />
  </StrictMode>
);
