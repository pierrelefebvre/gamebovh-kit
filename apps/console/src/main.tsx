import '@fontsource/press-start-2p/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/900-italic.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './styles/console.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { reloadIfOutdated } from './runtime/catalog.ts';
import { setupPwa } from './runtime/install.ts';
import { Services, ServicesProvider } from './runtime/services.tsx';

setupPwa();

// Un fichier de la console a changé de nom depuis l'ouverture de la page : on recharge une fois.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadIfOutdated((event as Event & { payload?: unknown }).payload ?? 'Failed to fetch dynamically imported module');
});

// Pas de <StrictMode> : il monte deux fois les composants en dev,
// ce qui lancerait deux fois chaque partie et brouillerait les étudiants.
const services = new Services();

services.init().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>,
  );
});
