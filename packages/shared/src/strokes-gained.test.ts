import { describe, expect, it } from 'vitest';
import { pgaTourBaseline } from './baseline.js';
import { holeEntrySchema, type HoleEntry } from './schemas.js';
import { holeStrokesGained, roundStrokesGained, sumCategories } from './strokes-gained.js';
import { entry, par3, par4, par5 } from './test/fixtures.js';
import { holeEntryIssues } from './validation.js';

const E = pgaTourBaseline.expectedStrokes;

describe('holeStrokesGained', () => {
  it('splits a regulation par 4 into categories', () => {
    const sg = holeStrokesGained(
      par4,
      entry({ teeResult: 'fairway', approachYards: 150, firstPuttFeet: 20 }),
    );
    // E(tee 400)=3.99, E(fw 150)=2.945, E(green 20ft)=1.87
    expect(sg.offTheTee).toBeCloseTo(3.99 - 2.945 - 1, 1);
    expect(sg.approach).toBeCloseTo(2.945 - 1.87 - 1, 1);
    expect(sg.aroundTheGreen).toBe(0);
    expect(sg.putting).toBeCloseTo(1.87 - 2, 1);
    expect(sg.total).toBeCloseTo(3.99 - 4, 1);
  });

  it('treats the par 3 tee shot as the approach', () => {
    const sg = holeStrokesGained(par3, entry({ holeNumber: 2, score: 3, firstPuttFeet: 30 }));
    expect(sg.offTheTee).toBe(0);
    expect(sg.approach).toBeCloseTo(E(160, 'tee') - E(30, 'green') - 1, 1);
    expect(sg.putting).toBeCloseTo(E(30, 'green') - 2, 1);
  });

  it('credits the short game for an up-and-down', () => {
    const sg = holeStrokesGained(
      par4,
      entry({
        teeResult: 'right',
        approachYards: 170,
        approachLie: 'rough',
        gir: false,
        missDirection: 'short',
        shortGameShots: 1,
        shortGameYards: 15,
        shortGameLie: 'fringe',
        firstPuttFeet: 4,
        putts: 1,
      }),
    );
    expect(sg.aroundTheGreen).toBeCloseTo(E(15, 'fairway') - E(4, 'green') - 1, 1);
    expect(sg.approach).toBeCloseTo(E(170, 'rough') - E(15, 'fairway') - 1, 1);
    expect(sg.putting).toBeCloseTo(E(4, 'green') - 1, 1);
  });

  it('charges lay-ups on par 5s to off-the-tee', () => {
    const sg = holeStrokesGained(
      par5,
      entry({
        holeNumber: 3,
        score: 5,
        teeResult: 'fairway',
        approachYards: 100,
        firstPuttFeet: 10,
      }),
    );
    expect(sg.offTheTee).toBeCloseTo(E(520, 'tee') - E(100, 'fairway') - 2, 1);
  });

  it('assigns tee-shot penalties to off-the-tee and others to approach', () => {
    const base = { score: 5, approachYards: 160, firstPuttFeet: 10, penalties: 1 };
    const teePenalty = holeStrokesGained(par4, entry({ ...base, teeResult: 'penalty' }));
    const approachPenalty = holeStrokesGained(par4, entry({ ...base, teeResult: 'fairway' }));
    expect(teePenalty.offTheTee).toBeCloseTo(approachPenalty.offTheTee - 1, 1);
    expect(approachPenalty.approach).toBeCloseTo(teePenalty.approach - 1, 1);
  });

  it('handles holed approaches', () => {
    const sg = holeStrokesGained(
      par4,
      entry({ score: 2, teeResult: 'fairway', approachYards: 120, putts: 0 }),
    );
    expect(sg.approach).toBeCloseTo(E(120, 'fairway') - 1, 1);
    expect(sg.putting).toBe(0);
  });

  it('always sums categories to E(tee) - score for valid entries', () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed % n;
    };
    let checked = 0;
    for (let i = 0; i < 2000; i++) {
      const hole = [par3, par4, par5][rand(3)] ?? par4;
      const shortGameShots = rand(3);
      const putts = rand(4);
      const candidate: HoleEntry = holeEntrySchema.parse({
        holeNumber: hole.number,
        score: 1 + rand(9),
        teeResult:
          hole.par === 3 ? null : (['fairway', 'left', 'right', 'penalty'] as const)[rand(4)],
        approachYards: hole.par === 3 ? null : 20 + rand(hole.yardage - 20),
        approachLie:
          hole.par === 3 ? 'tee' : (['fairway', 'rough', 'sand', 'recovery'] as const)[rand(4)],
        gir: shortGameShots === 0 && rand(2) === 0,
        shortGameShots,
        shortGameYards: shortGameShots > 0 ? 1 + rand(50) : null,
        shortGameLie: shortGameShots > 0 ? (['fringe', 'rough', 'sand'] as const)[rand(3)] : null,
        firstPuttFeet: putts > 0 ? 1 + rand(80) : null,
        putts,
        penalties: rand(2),
      });
      if (holeEntryIssues(hole, candidate).length > 0) continue;
      const sg = holeStrokesGained(hole, candidate);
      const sum = sg.offTheTee + sg.approach + sg.aroundTheGreen + sg.putting;
      expect(sum).toBeCloseTo(E(hole.yardage, 'tee') - candidate.score, 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('roundStrokesGained', () => {
  it('sums holes and rejects holes missing from the course', () => {
    const holes = [
      entry({ teeResult: 'fairway', approachYards: 150, firstPuttFeet: 20 }),
      entry({ holeNumber: 2, score: 3, firstPuttFeet: 30 }),
    ];
    const result = roundStrokesGained([par4, par3], holes);
    expect(result.holes).toHaveLength(2);
    expect(result.total).toEqual(sumCategories(result.holes));
    expect(() => roundStrokesGained([par4], holes)).toThrow(/no hole 2/);
  });
});
