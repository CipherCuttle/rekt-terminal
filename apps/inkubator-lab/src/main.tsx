import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppV3 from './AppV3';
import './base-v3.css';
import './comeback-v3.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppV3 />
  </StrictMode>
);
