import { useEffect, useRef, useState } from 'react';
import { useAccount } from '../auth/context';

export function Account() {
  const account = useAccount();
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { enabled, profile, renderButton } = account;

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
        <p className="muted">Sign-in isn't available in this build.</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="card stack account">
        <h1>Save your rounds to your account</h1>
        <p>Sign in to save your rounds and track your progress.</p>
        <div ref={button} className="google-button" />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">We only store your rounds, keyed to your Google account.</p>
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <h2>Sign out</h2>
      <div className="row">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void act(account.signOut)}
        >
          Sign out
        </button>
      </div>

      <h2>Delete account data</h2>
      <p className="muted">Permanently deletes every round in your account.</p>
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
