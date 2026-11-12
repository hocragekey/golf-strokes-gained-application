import { describe, expect, it } from 'vitest';
import { parseCardMarks, parseHoleNotation } from './notation.js';
import { holeEntrySchema } from './schemas.js';
import { holeEntryIssues } from './validation.js';

describe('parseHoleNotation', () => {
  it.each([
    ['5 L 2 165 / r15 / 4', 4, 385],
    ['3 2 20', 3, 170],
    ['5 F 2 110 / 25', 5, 520],
    ['4 R 1 175 / s15 / 8', 4, 410],
    ['4 2 s10 / 5', 3, 195],
    ['5 X 2 150 / 18', 4, 395],
    ['6 L 3 95 / 40', 5, 545],
    ['6 L 3 280 / 95 / 40', 5, 545],
    ['3 S 0 190 / r25', 4, 425],
  ])('parses the card-guide example "%s" into a valid hole', (line, par, yardage) => {
    const result = parseHoleNotation(line, par);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const entry = holeEntrySchema.parse({ holeNumber: 1, ...result.fields });
    expect(holeEntryIssues({ number: 1, par, yardage }, entry)).toEqual([]);
  });

  it('maps a chipped hole and works out the rest', () => {
    expect(parseHoleNotation('4 R 1 175 / s15 / 8', 4)).toEqual({
      ok: true,
      fields: {
        score: 4,
        teeResult: 'right',
        driveYardsLeft: null,
        approachYards: 175,
        approachLie: 'rough',
        gir: false,
        missDirection: null,
        shortGameShots: 1,
        shortGameYards: 15,
        shortGameLie: 'sand',
        firstPuttFeet: 8,
        putts: 1,
        penalties: 0,
      },
    });
  });

  it('derives green in regulation from score and putts', () => {
    const gir = parseHoleNotation('4 F 2 140 / 30', 4);
    const missed = parseHoleNotation('5 F 2 140 / 30', 4);
    expect(gir.ok && gir.fields.gir).toBe(true);
    expect(missed.ok && missed.fields.gir).toBe(false);
  });

  it('counts extra short-game shots from the score', () => {
    const result = parseHoleNotation('6 F 2 150 / f20 / 6', 4);
    expect(result.ok && result.fields.shortGameShots).toBe(2);
    expect(result.ok && result.fields.shortGameLie).toBe('fairway');
  });

  it('uses an approach lie letter over the drive arrow', () => {
    const result = parseHoleNotation('5 L 2 165s / 30', 4);
    expect(result.ok && result.fields.approachLie).toBe('sand');
  });

  it('reads f as a fairway approach after a missed drive', () => {
    const result = parseHoleNotation('4 L 2 150f / 20', 4);
    expect(result.ok && result.fields.approachLie).toBe('fairway');
  });

  it('reads yards left after the drive on a par 5', () => {
    const result = parseHoleNotation('5 F 2 250 / 110 / 25', 5);
    expect(result.ok && result.fields).toMatchObject({
      driveYardsLeft: 250,
      approachYards: 110,
      firstPuttFeet: 25,
    });
  });

  it('turns a double cross into a re-tee with one penalty stroke', () => {
    const result = parseHoleNotation('6 XX 1 150 / f10 / 12', 4);
    expect(result.ok && result.fields).toMatchObject({
      teeResult: 'ob',
      penalties: 1,
      shortGameShots: 1,
    });
    if (!result.ok) return;
    const entry = holeEntrySchema.parse({ holeNumber: 1, ...result.fields });
    expect(holeEntryIssues({ number: 1, par: 4, yardage: 400 }, entry)).toEqual([]);
  });

  it('turns a penalty drive into one penalty stroke', () => {
    const result = parseHoleNotation('5 X 2 150 / 18', 4);
    expect(result.ok && result.fields.penalties).toBe(1);
  });

  it.each([
    ['5 2 165 / 20', 4, 'drive'],
    ['5 R 2 165', 4, 'first-putt feet'],
    ['3 R 0 190 / r25 / 4', 4, 'No putts'],
    ['5 R 2 165 / x20 / 4', 4, 'x20'],
    ['3 R 2 20', 3, 'Par 3s'],
    ['nonsense', 4, 'Type score'],
  ])('explains what is wrong with "%s"', (line, par, message) => {
    const result = parseHoleNotation(line, par);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it('stays fast on long, odd input', () => {
    const start = performance.now();
    expect(parseHoleNotation(`9 9${' '.repeat(110)}x`, 4).ok).toBe(false);
    expect(parseHoleNotation(`9 9${' '.repeat(50_000)}x`, 4).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('accepts slashes typed without spaces', () => {
    const result = parseHoleNotation('5 R 2/175/s15/8', 4);
    expect(result.ok && result.fields).toMatchObject({
      putts: 2,
      approachYards: 175,
      firstPuttFeet: 8,
    });
  });

  it('refuses a line too long to be one hole instead of cutting it short', () => {
    expect(parseHoleNotation(`5 R 2 175 / ${'1'.repeat(200)}`, 4)).toMatchObject({ ok: false });
  });

  it('accepts drive arrows as written on the card', () => {
    const result = parseCardMarks({ score: 4, drive: '←', putts: 2, stats: '150 / 25' }, 4);
    expect(result.ok && result.fields.teeResult).toBe('left');
  });
});
