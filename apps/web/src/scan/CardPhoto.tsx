import type { CardReadResult } from '@golf-sg/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAccount } from '../auth/context';
import { AuthRequiredError, ScanRejectedError } from '../sync/api';
import { preparePhoto } from './image';

const total = (yardages: (number | null)[]): number =>
  yardages.reduce<number>((sum, y) => sum + (y ?? 0), 0);

/**
 * One photo button for the scorecard (FR-CARD-06, FR-CARD-07). A blank card fills par and the
 * chosen tees' yardages; a marked card fills the blank holes too. Without signal the photo waits
 * on the phone and is read as a marked card once back in range.
 */
export function CardPhoto({
  onRead,
}: {
  onRead: (card: CardReadResult, tee: number | null) => void;
}) {
  const account = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choose, setChoose] = useState<CardReadResult | null>(null);
  if (!account.enabled) return null;
  if (!account.profile) {
    return (
      <p className="muted small">
        <Link to="/account">Sign in</Link> to fill this round from a photo of your scorecard.
      </p>
    );
  }

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      const photo = await preparePhoto(file);
      let card: CardReadResult;
      try {
        if (!navigator.onLine) throw new Error('offline');
        card = await account.readCard(photo);
      } catch (err) {
        if (err instanceof ScanRejectedError || err instanceof AuthRequiredError) throw err;
        // No signal: keep the photo on the phone and read it once back in range.
        await account.queueScan(photo);
        void navigate('/');
        return;
      }
      if (card.tees.length > 1) setChoose(card);
      else onRead(card, card.tees.length === 1 ? 0 : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo');
    } finally {
      setBusy(false);
    }
  }

  if (choose) {
    const marked = choose.holes.some((h) => h.score !== null);
    return (
      <fieldset className="photo-import tee-picker">
        <legend>{marked ? 'Which tees did you play?' : 'Which tees are you playing?'}</legend>
        <div className="choice-grid">
          {choose.tees.map((t, i) => (
            <button
              key={`${t.name}-${String(i)}`}
              type="button"
              className="choice"
              onClick={() => {
                setChoose(null);
                onRead(choose, i);
              }}
            >
              {t.name}
              {total(t.yardages) > 0 && (
                <span className="muted small"> {total(t.yardages).toLocaleString()} yds</span>
              )}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="photo-import">
      <label className={`button secondary${busy ? ' disabled' : ''}`}>
        {busy ? 'Reading your scorecard…' : 'Take a photo of your scorecard'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          disabled={busy}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void pick(file);
          }}
        />
      </label>
      <p className="muted small">
        Before your round, this fills in par and yards. After your round, it fills in your scores
        too. The photo is deleted once it&apos;s read.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
