import { describe, expect, it } from 'vitest';
import { entry, par3, par4 } from './test/fixtures.js';
import { holeEntryIssues, strokesBeforeApproach } from './validation.js';

const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe('strokesBeforeApproach', () => {
  it('derives long-game strokes from the recorded counts', () => {
    expect(
      strokesBeforeApproach(entry({ score: 6, putts: 2, shortGameShots: 1, penalties: 1 })),
    ).toBe(1);
  });
});

describe('holeEntryIssues', () => {
  const validPar4 = entry({ teeResult: 'fairway', approachYards: 150, firstPuttFeet: 20 });

  it('accepts a complete par 4', () => {
    expect(holeEntryIssues(par4, validPar4)).toEqual([]);
  });

  it('accepts a par 3 without tee result or approach distance', () => {
    expect(holeEntryIssues(par3, entry({ score: 3, firstPuttFeet: 12 }))).toEqual([]);
  });

  it('requires tee result and approach distance on par 4s', () => {
    expect(paths(holeEntryIssues(par4, entry({ firstPuttFeet: 10 })))).toEqual([
      'teeResult',
      'approachYards',
    ]);
  });

  it('rejects tee result and tee lie in the wrong places', () => {
    expect(
      paths(holeEntryIssues(par3, entry({ score: 3, teeResult: 'left', firstPuttFeet: 5 }))),
    ).toEqual(['teeResult']);
    expect(paths(holeEntryIssues(par4, { ...validPar4, approachLie: 'tee' }))).toEqual([
      'approachLie',
    ]);
  });

  it('flags approach distances longer than the hole', () => {
    expect(paths(holeEntryIssues(par4, { ...validPar4, approachYards: 500 }))).toEqual([
      'approachYards',
    ]);
  });

  it('keeps putts and first putt distance consistent', () => {
    expect(paths(holeEntryIssues(par4, { ...validPar4, firstPuttFeet: null }))).toEqual([
      'firstPuttFeet',
    ]);
    expect(paths(holeEntryIssues(par4, { ...validPar4, score: 2, putts: 0 }))).toEqual([
      'firstPuttFeet',
    ]);
  });

  it('requires distance and lie for short-game shots', () => {
    const missed = { ...validPar4, gir: false, shortGameShots: 1 };
    expect(paths(holeEntryIssues(par4, missed))).toEqual([
      'shortGameYards',
      'shortGameLie',
      'score',
    ]);
    expect(
      paths(
        holeEntryIssues(par4, {
          ...validPar4,
          gir: false,
          shortGameYards: 10,
          shortGameLie: 'sand',
        }),
      ),
    ).toEqual(['shortGameShots']);
  });

  it('keeps GIR consistent with short game and miss direction', () => {
    expect(
      paths(
        holeEntryIssues(par4, {
          ...validPar4,
          score: 5,
          shortGameShots: 1,
          shortGameYards: 10,
          shortGameLie: 'rough',
          missDirection: 'left',
        }),
      ),
    ).toEqual(['gir', 'gir', 'missDirection']);
  });

  it('requires a GIR to reach the green in regulation', () => {
    expect(paths(holeEntryIssues(par4, { ...validPar4, score: 5 }))).toEqual(['gir']);
    expect(
      holeEntryIssues(par4, { ...validPar4, score: 3, putts: 0, firstPuttFeet: null }),
    ).toEqual([]);
  });

  it('rejects scores lower than the recorded shots allow', () => {
    const issues = holeEntryIssues(par4, { ...validPar4, score: 3 });
    expect(issues).toEqual([
      { path: 'score', message: expect.stringContaining('at least 4') as string },
    ]);
  });
});
