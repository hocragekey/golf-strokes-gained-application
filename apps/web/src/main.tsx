import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { StoreProvider } from './data/context';
import { LocalStore } from './data/store';
import './styles.css';

// Ask the browser not to evict on-device data under storage pressure.
if ('storage' in navigator) void navigator.storage.persist();

const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'always', staleTime: Infinity } },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <StoreProvider store={new LocalStore()}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StoreProvider>
  </StrictMode>,
);
