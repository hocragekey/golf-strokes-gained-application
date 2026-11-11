import type { CardScanResult } from '@golf-sg/shared';
import { describe, expect, it } from 'vitest';
import { emptyDraft } from '../components/scorecard';
import { applyScan, emptyRound } from './apply';

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
