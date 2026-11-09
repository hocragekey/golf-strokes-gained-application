import { describe, expect, it } from 'vitest';
import { computeStats, summarizeRound } from './insights.js';
import { course, entry, round } from './test/fixtures.js';

const regulationPar4 = entry({ teeResult: 'fairway', approachYards: 150, firstPuttFeet: 20 });
const threePuttPar3 = entry({ holeNumber: 2, score: 4, putts: 3, firstPuttFeet: 40 });
const scrambledPar5 = entry({
  holeNumber: 3,
  score: 6,
  teeResult: 'left',
  approachYards: 90,
  approachLie: 'rough',
  gir: false,
  missDirection: 'long',
  shortGameShots: 1,
  shortGameYards: 20,
  shortGameLie: 'sand',
  firstPuttFeet: 8,
  putts: 2,
});

const rounds = [1, 2, 3].map((id) =>
  round(`r${id}`, `2026-0${id}-01`, [regulationPar4, threePuttPar3, scrambledPar5]),
);

describe('summarizeRound', () => {
  it('totals score, par and strokes gained', () => {
    const summary = summarizeRound(rounds[0] ?? rounds[1]!);
    expect(summary).toMatchObject({ score: 14, toPar: 2, holesPlayed: 3, courseName: course.name });
    expect(summary.holeSg).toHaveLength(3);
  });
});

describe('computeStats', () => {
  const stats = computeStats([...rounds].reverse());

  it('normalises strokes gained to 18 holes', () => {
    expect(stats.rounds).toBe(3);
    expect(stats.holes).toBe(9);
    const single = summarizeRound(rounds[0]!).sg;
    expect(stats.sgPer18.total).toBeCloseTo(single.total * 6, 1);
  });

  it('computes traditional stats', () => {
    expect(stats.traditional).toEqual({
      scoringAverage: 84,
      fairwayPct: 50,
      missLeftPct: 50,
      missRightPct: 0,
      girPct: 66.67,
      puttsPer18: 42,
      upAndDownPct: 0,
    });
  });

  it('buckets approaches, putts and short game', () => {
    expect(stats.approachByDistance.map((b) => [b.label, b.count])).toEqual([
      ['<100 yds', 3],
      ['100–150 yds', 3],
      ['150–200 yds', 3],
      ['200+ yds', 0],
    ]);
    expect(stats.puttingByDistance.find((b) => b.label === '21–40 ft')?.count).toBe(3);
    expect(stats.aroundTheGreenByLie).toEqual([
      expect.objectContaining({ label: 'sand', count: 3 }),
    ]);
    expect(stats.approachMisses).toEqual({ left: 0, right: 0, long: 3, short: 0 });
  });

  it('ranks practice priorities from most strokes lost', () => {
    const values = stats.priorities.map((p) => p.sgPer18);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    const putting = stats.priorities.find((p) => p.category === 'putting');
    expect(putting?.focus).toMatch(/^First putts from 21–40 ft: -\d\.\d\d per hole \(3 samples\)$/);
    expect(stats.priorities.find((p) => p.category === 'offTheTee')?.focus).toBe(
      'Fairways 50% — misses left 50%',
    );
  });

  it('orders the trend chronologically', () => {
    expect(stats.trend.map((t) => t.playedOn)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('handles no data', () => {
    const empty = computeStats([]);
    expect(empty.sgPer18.total).toBe(0);
    expect(empty.traditional.scoringAverage).toBeNull();
    expect(empty.priorities.every((p) => p.focus.length > 0)).toBe(true);
  });
});
