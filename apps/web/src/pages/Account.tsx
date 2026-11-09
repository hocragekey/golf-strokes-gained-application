import { useEffect, useRef, useState } from 'react';
import { useAccount, type SyncStatus } from '../auth/context';

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${String(mins)} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${String(hours)} h ago` : new Date(iso).toLocaleDateString();
}

/** Human status line for the sync engine (FR-SYNC-05). */
export function syncLabel(status: SyncStatus): string {
  const waiting =
    status.pending > 0
      ? `${String(status.pending)} change${status.pending === 1 ? '' : 's'} waiting`
      : '';
  switch (status.state) {
    case 'syncing':
      return 'Syncing…';
    case 'offline':
      return `Offline, will sync later${waiting ? ` · ${waiting}` : ''}`;
    case 'signin':
      return 'Sign in again to sync';
    case 'error':
      return `Sync problem: ${status.message ?? 'unknown error'}${waiting ? ` · ${waiting}` : ''}`;
    case 'idle':
      if (waiting) return waiting;
      return status.lastSyncedAt ? `Synced ${ago(status.lastSyncedAt)}` : 'Synced';
  }
}

export function Account() {
  const account = useAccount();
  const button = useRef<HTMLDivElement>(null);
  const [removeData, setRemoveData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { enabled, profile, renderButton, status } = account;

  useEffect(() => {
    if (!enabled || profile || !button.current) return;
    renderButton(button.current).catch((err: unknown) => {
      setError(`${(err as Error).message}. Check your connection and try again.`);
    });
  }, [enabled, profile, renderButton]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return (
      <section className="card stack">
        <h1>Account</h1>
        <p className="muted">
          Accounts are not set up in this build. Everything stays on this device.
        </p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="card stack account">
        <h1>Save your rounds to your account</h1>
        <p>
          Sign in to back up your strokes gained and track progress on every device. The app keeps
          working offline; rounds you enter without signal upload when you are back online.
        </p>
        <div ref={button} className="google-button" />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">
          Signing in is optional. We only store your rounds and courses, keyed to your Google
          account.
        </p>
      </section>
    );
  }

  return (
    <section className="card stack account">
      <h1>Account</h1>
      <div className="account-profile">
        {profile.picture && (
          <img src={profile.picture} alt="" width={48} height={48} referrerPolicy="no-referrer" />
        )}
        <div>
          <strong>{profile.name}</strong>
          <div className="muted">{profile.email}</div>
        </div>
      </div>
      <p className={`sync-line sync-${status.state}`} role="status">
        {syncLabel(status)}
      </p>
      {status.message && status.state === 'idle' && <p className="muted">{status.message}</p>}
      <div className="row">
        <button
          type="button"
          className="button"
          disabled={busy || status.state === 'syncing'}
          onClick={() => void act(account.syncNow)}
        >
          Sync now
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <h2>Sign out</h2>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={removeData}
          onChange={(e) => {
            setRemoveData(e.target.checked);
          }}
        />
        Also remove my rounds from this device (they stay in your account)
      </label>
      <div className="row">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void act(() => account.signOut(removeData))}
        >
          Sign out
        </button>
      </div>

      <h2>Delete account data</h2>
      <p className="muted">
        Permanently deletes every round and course stored in your account. Rounds on this device are
        kept.
      </p>
      <div className="row">
        <button
          type="button"
          className="button danger"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm('Delete all rounds stored in your account? This cannot be undone.')
            ) {
              void act(account.deleteAccount);
            }
          }}
        >
          Delete account data
        </button>
      </div>
    </section>
  );
}
