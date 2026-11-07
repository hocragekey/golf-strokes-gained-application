import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '../data/context';
import { GolfDb } from '../data/db';
import { LocalStore } from '../data/store';

/** A store backed by a fresh, uniquely named in-memory IndexedDB. */
export const createTestStore = (): LocalStore =>
  new LocalStore(new GolfDb(`test-${crypto.randomUUID()}`));

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    store = createTestStore(),
  }: { route?: string; path?: string; store?: LocalStore } = {},
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
  const result = render(
    <StoreProvider store={store}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            {path !== '*' && <Route path="*" element={<p>navigated</p>} />}
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </StoreProvider>,
  );
  return { ...result, store };
}
