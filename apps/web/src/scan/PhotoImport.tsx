import type { CardScanResult } from '@golf-sg/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAccount } from '../auth/context';
import { AuthRequiredError, ScanRejectedError } from '../sync/api';
import { preparePhoto } from './image';

/** Fills a new round from a photo of a card marked the two-row way (FR-CARD-06). */
export function PhotoImport({ onRead }: { onRead: (scan: CardScanResult) => void }) {
  const account = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!account.enabled) return null;
  if (!account.profile) {
    return (
      <p className="muted small">
        <Link to="/account">Sign in</Link> to fill this round from a photo of your marked card.
      </p>
    );
  }

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      const photo = await preparePhoto(file);
      try {
        if (!navigator.onLine) throw new Error('offline');
        onRead(await account.scanCard(photo));
      } catch (err) {
        if (err instanceof ScanRejectedError || err instanceof AuthRequiredError) throw err;
        // No signal: keep the photo on the phone and read it once back in range.
        await account.queueScan(photo);
        void navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-import">
      <label className={`button ghost${busy ? ' disabled' : ''}`}>
        {busy ? 'Reading your card…' : 'Fill from a photo of my card'}
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
        Lay the card flat with every hole in view. The photo is deleted once it&apos;s read.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
