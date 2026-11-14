import type { CardLayoutResult } from '@golf-sg/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAccount } from '../auth/context';
import { AuthRequiredError, ScanRejectedError } from '../sync/api';
import { preparePhoto } from './image';

const total = (yardages: (number | null)[]): number =>
  yardages.reduce<number>((sum, y) => sum + (y ?? 0), 0);

/**
 * Before tee-off: reads par and every tee row off a photo of the blank card, then asks which tees
 * the golfer is playing (FR-CARD-07). Nothing is kept: without signal the golfer enters par and
 * yardage hole by hole instead.
 */
export function LayoutImport({
  onRead,
}: {
  onRead: (scan: CardLayoutResult, tee: number | null) => void;
}) {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choose, setChoose] = useState<CardLayoutResult | null>(null);
  if (!account.enabled) return null;
  if (!account.profile) {
    return (
      <p className="muted small">
        <Link to="/account">Sign in</Link> to fill par and yardage from a photo of the scorecard.
      </p>
    );
  }

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      if (!navigator.onLine) throw new Error('offline');
      const scan = await account.readLayout(await preparePhoto(file));
      if (scan.tees.length > 1) setChoose(scan);
      else onRead(scan, scan.tees.length === 1 ? 0 : null);
    } catch (err) {
      setError(
        err instanceof ScanRejectedError || err instanceof AuthRequiredError
          ? err.message
          : "No signal to read the card. Enter par and yards as you play; they're saved on your phone.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (choose) {
    return (
      <fieldset className="photo-import tee-picker">
        <legend>Which tees are you playing?</legend>
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
        {busy ? 'Reading the card…' : 'Snap the scorecard to fill par and yards'}
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
        Photograph the blank card before you tee off. The photo is deleted once it&apos;s read.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
