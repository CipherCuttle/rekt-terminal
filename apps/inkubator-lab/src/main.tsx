import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppV2 from './AppV2';
import './styles.css';
import './dossier-polish.css';
import './visual-polish.css';
import './messaging-pass.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppV2 />
  </StrictMode>
);
