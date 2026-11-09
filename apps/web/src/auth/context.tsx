import { useQueryClient } from '@tanstack/react-query';
import { liveQuery } from 'dexie';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GolfDb } from '../data/db';
import { AuthRequiredError, httpSyncApi, type SyncApi } from '../sync/api';
import { SyncEngine } from '../sync/engine';
import type { AuthClient, Profile, Session } from './google';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'signin';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncedAt?: string;
  message?: string;
}

export interface Account {
  enabled: boolean;
  profile: Profile | null;
  status: SyncStatus;
  renderButton: (el: HTMLElement) => Promise<void>;
  signIn: (session: Session) => Promise<void>;
  signOut: (removeData: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const noop = () => Promise.resolve();
const disabled: Account = {
  enabled: false,
  profile: null,
  status: { state: 'idle', pending: 0 },
  renderButton: noop,
  signIn: noop,
  signOut: noop,
  deleteAccount: noop,
  syncNow: noop,
};

const AccountContext = createContext<Account>(disabled);
const PROFILE_KEY = 'golf-sg:profile';
/** Debounce between a local change and pushing it. */
const SYNC_DELAY_MS = 2000;

function storedProfile(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Profile | null;
  } catch {
    return null;
  }
}

/** Optional Google sign-in plus background sync. Signed out, the app is unchanged (FR-ACCT-05). */
export function AccountProvider({
  client,
  db,
  api: injectedApi,
  children,
}: {
  client: AuthClient;
  db: GolfDb;
  api?: SyncApi;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(() =>
    client.enabled ? storedProfile() : null,
  );
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', pending: 0 });
  const session = useRef<Session | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const getToken = useCallback(async () => {
    const s = session.current;
    if (s && s.expiresAt - 60_000 > Date.now()) return s.token;
    session.current = await client.refresh();
    return session.current?.token ?? null;
  }, [client]);
  const api = useMemo(() => injectedApi ?? httpSyncApi(getToken), [injectedApi, getToken]);
  const engine = useMemo(() => new SyncEngine(db, api), [db, api]);

  const sync = useCallback(async (): Promise<void> => {
    if (!profile) return;
    if (running.current) {
      again.current = true;
      return running.current;
    }
    if (!navigator.onLine) {
      setStatus((s) => ({ ...s, state: 'offline' }));
      return;
    }
    const run = async () => {
      setStatus((s) => ({ ...s, state: 'syncing' }));
      try {
        const result = await engine.run();
        if (result.pulled > 0) await queryClient.invalidateQueries();
        setStatus((s) => ({
          ...s,
          state: 'idle',
          lastSyncedAt: new Date().toISOString(),
          message:
            result.rejected.length > 0
              ? `${String(result.rejected.length)} change(s) were refused by the server`
              : undefined,
        }));
      } catch (err) {
        if (err instanceof AuthRequiredError) setStatus((s) => ({ ...s, state: 'signin' }));
        else setStatus((s) => ({ ...s, state: 'error', message: (err as Error).message }));
      }
    };
    running.current = run().finally(() => {
      running.current = null;
      if (again.current) {
        again.current = false;
        void sync();
      }
    });
    return running.current;
  }, [profile, engine, queryClient]);

  // Outbox size drives the status line and a debounced push after local changes (FR-SYNC-02).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = -1;
    const sub = liveQuery(() => db.pending.count()).subscribe((pending) => {
      setStatus((s) => ({ ...s, pending }));
      if (profile && pending > 0 && pending !== last) {
        clearTimeout(timer);
        timer = setTimeout(() => void sync(), SYNC_DELAY_MS);
      }
      last = pending;
    });
    return () => {
      clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [db, profile, sync]);

  // Sync on start, on reconnect and when the app comes back to the foreground (FR-SYNC-03).
  useEffect(() => {
    if (!profile) return;
    void sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    const onOnline = () => void sync();
    const onOffline = () => {
      setStatus((s) => ({ ...s, state: 'offline' }));
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [profile, sync]);

  const signIn = useCallback(
    async (s: Session) => {
      session.current = s;
      await engine.adopt(s.profile.sub);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(s.profile));
      setProfile(s.profile);
    },
    [engine],
  );

  const signOut = useCallback(
    async (removeData: boolean) => {
      client.signOut();
      session.current = null;
      await engine.reset(removeData);
      localStorage.removeItem(PROFILE_KEY);
      setProfile(null);
      setStatus((s) => ({ state: 'idle', pending: s.pending }));
      await queryClient.invalidateQueries();
    },
    [client, engine, queryClient],
  );

  const value = useMemo<Account>(
    () =>
      client.enabled
        ? {
            enabled: true,
            profile,
            status,
            renderButton: (el) =>
              client.renderButton(el, (s) => {
                void signIn(s);
              }),
            signIn,
            signOut,
            deleteAccount: async () => {
              await api.deleteAccount();
              await signOut(false);
            },
            syncNow: sync,
          }
        : disabled,
    [client, profile, status, signIn, signOut, api, sync],
  );
  return <AccountContext value={value}>{children}</AccountContext>;
}

export const useAccount = (): Account => use(AccountContext);
