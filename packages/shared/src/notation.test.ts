import { describe, expect, it } from 'vitest';
import { parseHoleNotation } from './notation.js';
import { holeEntrySchema } from './schemas.js';
import { holeEntryIssues } from './validation.js';

describe('parseHoleNotation', () => {
  it.each([
    ['5 R 165r Sh 1@15s 1@4', 4, 410],
    ['3 ✓ 2@25', 3, 160],
    ['6 P 90 L 1@12 1@3 +1', 5, 520],
  ])('parses the card-guide example "%s" into a valid hole', (line, par, yardage) => {
    const result = parseHoleNotation(line, par);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = holeEntrySchema.parse({ holeNumber: 1, ...result.fields });
    expect(holeEntryIssues({ number: 1, par, yardage }, entry)).toEqual([]);
  });

  it('maps every field of a full line', () => {
    expect(parseHoleNotation('5 R 165r Sh 1@15s 1@4', 4)).toEqual({
      ok: true,
      fields: {
        score: 5,
        teeResult: 'right',
        approachYards: 165,
        approachLie: 'rough',
        gir: false,
        missDirection: 'short',
        shortGameShots: 1,
        shortGameYards: 15,
        shortGameLie: 'sand',
        firstPuttFeet: 4,
        putts: 1,
        penalties: 0,
      },
    });
  });

  it('treats a short-game shot with no lie letter as from the fairway and allows holing out', () => {
    const result = parseHoleNotation('4 F 120 L 1@20 0', 4);
    expect(result).toMatchObject({
      ok: true,
      fields: { shortGameLie: 'fairway', putts: 0, firstPuttFeet: null, missDirection: 'left' },
    });
  });

  it('is case-insensitive and accepts G for green in regulation', () => {
    expect(parseHoleNotation('4 f 150 g 2@20', 4)).toMatchObject({
      ok: true,
      fields: { gir: true },
    });
  });

  it.each([
    ['', 4, 'score'],
    ['4 X 150 ✓ 2@20', 4, 'tee result'],
    ['4 F ✓ 2@20', 4, 'approach'],
    ['4 F 150 2@20', 4, 'green'],
    ['4 F 150 ✓ 2', 4, 'first-putt'],
    ['3 ✓ 2@25 extra', 3, 'Unexpected'],
  ])('explains what is wrong with "%s"', (line, par, hint) => {
    const result = parseHoleNotation(line, par);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(hint);
  });
});
