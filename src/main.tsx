import './styles/index.scss';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './components/App';
import { StoreProvider } from './lib/store';
import { UIProvider } from './lib/ui';

if (!('ontouchstart' in window)) {
  document.documentElement.classList.add('no-touch');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UIProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </UIProvider>
  </StrictMode>,
);
