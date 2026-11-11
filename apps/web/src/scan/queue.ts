import type { CardScanRequest, CardScanResult } from '@golf-sg/shared';
import type { GolfDb } from '../data/db';
import { loadInProgress, saveInProgress } from '../data/inProgress';
import { ScanRejectedError } from '../sync/api';
import { applyScan, emptyRound } from './apply';

export const SCAN_EVENT = 'golf-sg:scans';
const NOTICE_KEY = 'golf-sg.scan-notice';

const today = (): string => new Date().toLocaleDateString('sv');

/** Keeps a photo on the device until there is signal to read it (FR-CARD-06). */
export async function enqueueScan(db: GolfDb, scan: CardScanRequest): Promise<void> {
  await db.scans.add({ id: crypto.randomUUID(), ...scan, createdAt: new Date().toISOString() });
  window.dispatchEvent(new Event(SCAN_EVENT));
}

export const scanNotice = (): string | null => localStorage.getItem(NOTICE_KEY);
export const clearScanNotice = (): void => {
  localStorage.removeItem(NOTICE_KEY);
  window.dispatchEvent(new Event(SCAN_EVENT));
};

/**
 * Reads queued photos oldest first into the round in progress, deleting each once read. Stops at
 * the first network or server failure and tries again later; a photo the reader rejects is
 * dropped with a notice.
 */
export async function processScans(
  db: GolfDb,
  scanCard: (scan: CardScanRequest) => Promise<CardScanResult>,
): Promise<number> {
  let read = 0;
  const queued = (await db.scans.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const scan of queued) {
    try {
      const result = await scanCard({ mediaType: scan.mediaType, image: scan.image });
      saveInProgress(applyScan(loadInProgress() ?? emptyRound(today()), result).round);
      read++;
    } catch (err) {
      if (!(err instanceof ScanRejectedError)) break;
      localStorage.setItem(NOTICE_KEY, err.message);
    }
    await db.scans.delete(scan.id);
  }
  window.dispatchEvent(new Event(SCAN_EVENT));
  return read;
}
