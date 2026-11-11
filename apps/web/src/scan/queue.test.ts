import type { CardScanResult } from '@golf-sg/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { GolfDb } from '../data/db';
import { loadInProgress } from '../data/inProgress';
import { ScanRejectedError } from '../sync/api';
import { enqueueScan, processScans, scanNotice } from './queue';

const result: CardScanResult = {
  courseName: 'Pebble Creek',
  tees: '',
  holes: [
    {
      number: 1,
      par: 3,
      yardage: 160,
      score: 3,
      drive: null,
      putts: 2,
      stats: '20',
      unsure: false,
    },
  ],
};
const photo = { mediaType: 'image/jpeg' as const, image: 'AAAA' };

afterEach(() => {
  localStorage.clear();
});

describe('scan queue', () => {
  it('keeps photos until they can be read, then fills the round in progress', async () => {
    const db = new GolfDb(`test-${crypto.randomUUID()}`);
    await enqueueScan(db, photo);
    expect(await processScans(db, () => Promise.reject(new Error('No signal')))).toBe(0);
    expect(await db.scans.count()).toBe(1);

    expect(await processScans(db, () => Promise.resolve(result))).toBe(1);
    expect(await db.scans.count()).toBe(0);
    expect(loadInProgress()).toMatchObject({ courseName: 'Pebble Creek' });
    expect(loadInProgress()?.drafts[0]).toMatchObject({ score: '3', putts: '2' });
  });

  it('drops a photo the reader rejects and leaves a notice', async () => {
    const db = new GolfDb(`test-${crypto.randomUUID()}`);
    await enqueueScan(db, photo);
    await processScans(db, () =>
      Promise.reject(new ScanRejectedError("We couldn't read that scorecard.")),
    );
    expect(await db.scans.count()).toBe(0);
    expect(scanNotice()).toBe("We couldn't read that scorecard.");
    expect(loadInProgress()).toBeNull();
  });
});
