import { createContext, use, type ReactNode } from 'react';
import type { LocalStore } from './store';

const StoreContext = createContext<LocalStore | null>(null);

export function StoreProvider({ store, children }: { store: LocalStore; children: ReactNode }) {
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore(): LocalStore {
  const store = use(StoreContext);
  if (!store) throw new Error('useStore must be used within a StoreProvider');
  return store;
}
