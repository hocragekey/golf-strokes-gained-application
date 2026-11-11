import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { useStore } from '../data/context';
import { cardScanEnabled } from './features';
import { clearScanNotice, SCAN_EVENT, scanNotice } from './queue';

/** Home notice for scorecard photos waiting for signal, or one the reader couldn't use. */
export function ScanStatus() {
  const { db } = useStore();
  const [waiting, setWaiting] = useState(0);
  const [notice, setNotice] = useState(scanNotice);
  useEffect(() => {
    const sub = liveQuery(() => db.scans.count()).subscribe(setWaiting);
    const onChange = () => {
      setNotice(scanNotice());
    };
    window.addEventListener(SCAN_EVENT, onChange);
    return () => {
      sub.unsubscribe();
      window.removeEventListener(SCAN_EVENT, onChange);
    };
  }, [db]);
  if (!cardScanEnabled() || (waiting === 0 && !notice)) return null;
  return (
    <section className="card scan-status" aria-label="Scorecard photo">
      {waiting > 0 ? (
        <p>Your scorecard photo will be read as soon as you have signal.</p>
      ) : (
        <p>
          {notice} Try again with the card flat and every hole in view.{' '}
          <button type="button" className="link" onClick={clearScanNotice}>
            Dismiss
          </button>
        </p>
      )}
    </section>
  );
}
