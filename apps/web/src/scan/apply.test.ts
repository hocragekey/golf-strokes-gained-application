import type { CardScanResult } from '@golf-sg/shared';
import { describe, expect, it } from 'vitest';
import { emptyDraft, emptyLayout } from '../components/scorecard';
import { applyLayout, applyScan, emptyRound } from './apply';

const hole = (over: Partial<CardScanResult['holes'][number]>) => ({
  number: 1,
  par: 4,
  yardage: 410,
  score: 4,
  drive: 'R',
  putts: 1,
  stats: '175 / s15 / 8',
  unsure: false,
  ...over,
});
const scan = (holes: CardScanResult['holes']): CardScanResult => ({
  courseName: 'Pebble Creek',
  tees: 'Blue',
  holes,
});

describe('applyScan', () => {
  it('fills par, yardage and every answer from the marks', () => {
    const { round, check } = applyScan(
      emptyRound('2026-11-07'),
      scan([
        hole({}),
        hole({ number: 2, par: 3, yardage: 170, score: 3, drive: null, putts: 2, stats: '20' }),
      ]),
    );
    expect(check).toEqual([]);
    expect(round).toMatchObject({ courseName: 'Pebble Creek', tees: 'Blue', holeCount: 18 });
    expect(round.layout.slice(0, 2)).toEqual([
      { par: '4', yardage: '410' },
      { par: '3', yardage: '170' },
    ]);
    expect(round.drafts[0]).toMatchObject({
      score: '4',
      teeResult: 'right',
      approachYards: '175',
      shortGameShots: '1',
      shortGameYards: '15',
      shortGameLie: 'sand',
      putts: '1',
      firstPuttFeet: '8',
    });
    expect(round.drafts[1]).toMatchObject({ score: '3', putts: '2', firstPuttFeet: '20' });
  });

  it('flags holes the reader was unsure of or whose marks do not parse', () => {
    const { round, check } = applyScan(
      emptyRound('2026-11-07'),
      scan([hole({ unsure: true }), hole({ number: 2, stats: '175 / ??' })]),
    );
    expect(check).toEqual([1, 2]);
    expect(round.check).toEqual([1, 2]);
    expect(round.drafts[1]).toMatchObject({ score: '4', putts: '1', teeResult: '' });
  });

  it('uses the printed par when the yardage could not be read', () => {
    const { round } = applyScan(
      emptyRound('2026-11-07'),
      scan([
        hole({ par: 5, yardage: null, score: 6, drive: 'F', putts: 2, stats: '150 / r20 / 8' }),
        hole({
          number: 2,
          par: 3,
          yardage: null,
          score: 4,
          drive: null,
          putts: 1,
          stats: 'r20 / 8',
        }),
      ]),
    );
    expect(round.layout.slice(0, 2)).toEqual([
      { par: '5', yardage: '' },
      { par: '3', yardage: '' },
    ]);
    expect(round.drafts[0]).toMatchObject({ shortGameShots: '1' });
    expect(round.drafts[1]).toMatchObject({ shortGameShots: '2' });
  });

  it('flags a listed hole whose score could not be read', () => {
    const { check } = applyScan(
      emptyRound('2026-11-07'),
      scan([hole({}), hole({ number: 2, score: null })]),
    );
    expect(check).toEqual([2]);
  });

  it('never overwrites holes already entered by hand', () => {
    const current = emptyRound('2026-11-07');
    current.courseName = 'My course';
    current.drafts[0] = { ...emptyDraft(), score: '7' };
    const { round } = applyScan(current, scan([hole({})]));
    expect(round.drafts[0]?.score).toBe('7');
    expect(round.courseName).toBe('My course');
    expect(round.layout[0]).toEqual({ par: '4', yardage: '410' });
  });
});

describe('applyLayout', () => {
  const scan = {
    courseName: 'Pebble Creek',
    pars: [4, 3, null, 5, 4, 4, 3, 4, 5, 4],
    tees: [
      { name: 'Blue', yardages: [410, 180, 390, 520] },
      { name: 'White', yardages: [380, 150] },
    ],
  };
  const blank = Array.from({ length: 18 }, () => emptyLayout());

  it('fills par and the chosen tee row, keeping holes the card does not show', () => {
    const { layout, holeCount } = applyLayout(blank, scan, 1);
    expect(holeCount).toBe(18);
    expect(layout.slice(0, 3)).toEqual([
      { par: '4', yardage: '380' },
      { par: '3', yardage: '150' },
      { par: blank[2]?.par, yardage: blank[2]?.yardage },
    ]);
  });

  it('fills par only when no tee row was read', () => {
    const { layout, holeCount } = applyLayout(blank, { ...scan, pars: [4, 3], tees: [] }, null);
    expect(holeCount).toBe(9);
    expect(layout[0]).toEqual({ par: '4', yardage: blank[0]?.yardage });
  });
});
