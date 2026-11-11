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
import { clearInProgress } from '../data/inProgress';
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
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
};

const AccountContext = createContext<Account>(disabled);
const PROFILE_KEY = 'golf-sg:profile';
/** Debounce between a local change and pushing it. */
const SYNC_DELAY_MS = 2000;
/** Wait before retrying a failed sync while the app stays open (FR-SYNC-05). */
const RETRY_DELAY_MS = 30_000;

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
  const profileRef = useRef(profile);
  // Engine work (sync, adopt, reset, delete) runs one at a time so a sign-out can never interleave
  // with a pull that would write rounds back after the reset.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const queuedSync = useRef<Promise<void> | null>(null);
  const exclusive = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const getToken = useCallback(async () => {
    const s = session.current;
    if (s && s.expiresAt - 60_000 > Date.now()) return s.token;
    session.current = await client.refresh();
    return session.current?.token ?? null;
  }, [client]);
  const api = useMemo(() => injectedApi ?? httpSyncApi(getToken), [injectedApi, getToken]);
  const engine = useMemo(() => new SyncEngine(db, api), [db, api]);

  const sync = useCallback((): Promise<void> => {
    // One waiting run covers every request made while another run is in flight.
    if (queuedSync.current) return queuedSync.current;
    const run = exclusive(async () => {
      queuedSync.current = null;
      if (!profileRef.current) return;
      if (!navigator.onLine) {
        setStatus((s) => ({ ...s, state: 'offline' }));
        return;
      }
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
    });
    queuedSync.current = run;
    return run;
  }, [exclusive, engine, queryClient]);

  // Outbox size drives the status line and a debounced push after local changes (FR-SYNC-02).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = '';
    const sub = liveQuery(() => db.pending.toArray()).subscribe((entries) => {
      const pending = entries.length;
      setStatus((s) => ({ ...s, pending }));
      // Any new or re-edited entry schedules a push, even when the count stays the same.
      const signature = entries.map((e) => `${e.key}@${e.updatedAt}`).join(',');
      if (profile && pending > 0 && signature !== last) {
        clearTimeout(timer);
        timer = setTimeout(() => void sync(), SYNC_DELAY_MS);
      }
      last = signature;
    });
    return () => {
      clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [db, profile, sync]);

  // Nobody sees sync errors, so keep retrying quietly while the app stays open.
  useEffect(() => {
    if (!profile || status.state !== 'error') return;
    const timer = setTimeout(() => void sync(), RETRY_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [profile, status.state, sync]);

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
      // The token switches only once the outbox belongs to this account, so a sync already in
      // flight can never upload one golfer's rounds with another golfer's token.
      await exclusive(async () => {
        await engine.adopt(s.profile.sub);
        session.current = s;
        profileRef.current = s.profile;
      });
      localStorage.setItem(PROFILE_KEY, JSON.stringify(s.profile));
      setProfile(s.profile);
    },
    [exclusive, engine],
  );

  const signOut = useCallback(async () => {
    await exclusive(async () => {
      if ((await engine.pendingCount()) > 0) await engine.run().catch(() => undefined);
      await engine.signOut();
      session.current = null;
      profileRef.current = null;
    });
    client.signOut();
    localStorage.removeItem(PROFILE_KEY);
    clearInProgress();
    setProfile(null);
    setStatus((s) => ({ state: 'idle', pending: s.pending }));
    await queryClient.invalidateQueries();
  }, [client, exclusive, engine, queryClient]);

  // Stable identity so the page renders Google's button once, not on every status change.
  const renderButton = useCallback(
    (el: HTMLElement) =>
      client.renderButton(el, (s) => {
        void signIn(s);
      }),
    [client, signIn],
  );

  const deleteAccount = useCallback(async () => {
    await exclusive(async () => {
      await api.deleteAccount();
      await engine.forgetServerCopy();
    });
    await signOut();
  }, [exclusive, api, engine, signOut]);

  const value = useMemo<Account>(
    () =>
      client.enabled
        ? {
            enabled: true,
            profile,
            status,
            renderButton,
            signIn,
            signOut,
            deleteAccount,
          }
        : disabled,
    [client, profile, status, renderButton, signIn, signOut, deleteAccount],
  );
  return <AccountContext value={value}>{children}</AccountContext>;
}

export const useAccount = (): Account => use(AccountContext);
