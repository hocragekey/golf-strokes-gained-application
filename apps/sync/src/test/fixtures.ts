import { holeEntrySchema, roundChange, type Change, type Round } from '@golf-sg/shared';

export const ROUND_ID = '9b2f7c1e-3d4a-4b5c-8d6e-7f8091a2b3c4';

export function round(updatedAt = '2026-05-01T10:00:00.000Z', id = ROUND_ID): Round {
  return {
    id,
    courseName: 'Pine Valley Muni',
    tees: 'White',
    playedOn: '2026-05-01',
    notes: '',
    layout: [{ number: 1, par: 4, yardage: 400 }],
    holes: [
      holeEntrySchema.parse({
        holeNumber: 1,
        score: 4,
        gir: true,
        putts: 2,
        teeResult: 'fairway',
        approachYards: 150,
        firstPuttFeet: 20,
      }),
    ],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt,
  };
}

export const change = (updatedAt?: string, id?: string): Change =>
  roundChange(round(updatedAt, id));

/** A deterministic clock that advances one second per call. */
export function tickingClock(start = Date.parse('2026-06-01T00:00:00.000Z')): () => Date {
  let t = start;
  return () => new Date((t += 1000));
}
