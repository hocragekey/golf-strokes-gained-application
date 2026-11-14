import type { CourseHole } from '@golf-sg/shared';
import { describe, expect, it } from 'vitest';
import {
  draftFromEntry,
  emptyDraft,
  emptyLayout,
  isGir,
  layoutFromHole,
  parseLayout,
  validateCard,
  validateRow,
  type HoleDraft,
} from './scorecard';

const par4: CourseHole = { number: 1, par: 4, yardage: 400 };
const par3: CourseHole = { number: 2, par: 3, yardage: 160 };

const good4: HoleDraft = {
  ...emptyDraft(),
  score: '4',
  teeResult: 'fairway',
  approachYards: '150',
  firstPuttFeet: '20',
  putts: '2',
};
const good3: HoleDraft = {
  ...emptyDraft(),
  score: '3',
  firstPuttFeet: '15',
  putts: '2',
};

describe('validateRow', () => {
  it('converts a valid par 4 row', () => {
    const { entry, errors } = validateRow(good4, par4);
    expect(errors).toEqual({});
    expect(entry).toMatchObject({ score: 4, teeResult: 'fairway', approachYards: 150, putts: 2 });
  });

  it('treats a short-game shot with no lie as from the fairway', () => {
    const { entry, errors } = validateRow(
      {
        ...good4,
        score: '5',
        missDirection: 'short',
        shortGameShots: '1',
        shortGameYards: '15',
      },
      par4,
    );
    expect(errors).toEqual({});
    expect(entry).toMatchObject({ shortGameShots: 1, shortGameLie: 'fairway' });
    expect(validateRow(good4, par4).entry).toMatchObject({ shortGameLie: null });
  });

  it('ignores tee fields on par 3s', () => {
    const { entry } = validateRow({ ...good3, teeResult: 'left', approachYards: '99' }, par3);
    expect(entry).toMatchObject({ teeResult: null, approachYards: null, approachLie: 'tee' });
  });

  it('reports invalid numbers and cross-field issues', () => {
    expect(validateRow({ ...good4, putts: '' }, par4).errors).toHaveProperty('putts');
    expect(validateRow({ ...good4, firstPuttFeet: '' }, par4).errors).toHaveProperty(
      'firstPuttFeet',
    );
  });

  it('works out green in regulation from score and putts', () => {
    expect(isGir(good4, 4)).toBe(true);
    expect(isGir({ ...good4, score: '5' }, 4)).toBe(false);
    expect(isGir({ ...good4, score: '3', putts: '0', firstPuttFeet: '' }, 4)).toBe(true);
    expect(isGir({ ...good4, shortGameShots: '1' }, 4)).toBe(false);
    expect(validateRow(good4, par4).entry).toMatchObject({ gir: true });
  });

  it('round-trips through draftFromEntry', () => {
    const { entry } = validateRow(good4, par4);
    if (!entry) throw new Error('expected entry');
    expect(draftFromEntry(entry)).toMatchObject({ score: '4', approachYards: '150' });
  });
});

describe('validateCard', () => {
  it('requires at least one hole', () => {
    expect(validateCard([emptyDraft()], [par4]).error).toBe('Enter at least one hole');
  });

  it('ignores trailing blank holes', () => {
    const result = validateCard([good4, good3, emptyDraft()], [par4, par3, par4]);
    expect(result.error).toBeNull();
    expect(result.entries).toHaveLength(2);
  });

  it('rejects gaps', () => {
    const result = validateCard([emptyDraft(), good3], [par4, par3]);
    expect(result.error).toBe('1 hole need attention');
    expect(result.rowErrors[0]).toEqual({ score: 'Fill holes in order from hole 1' });
  });
});

describe('parseLayout', () => {
  it('parses par and yardage copied from the card', () => {
    expect(parseLayout(layoutFromHole(par3), 2)).toEqual({ hole: par3, errors: {} });
  });

  it('asks for a missing or out-of-range yardage', () => {
    expect(parseLayout(emptyLayout(), 1).errors).toHaveProperty('yardage');
    expect(parseLayout({ par: '9', yardage: '30' }, 1).errors).toMatchObject({
      par: expect.stringContaining('par') as string,
      yardage: expect.stringContaining('50–800') as string,
    });
  });
});

describe('validateCard without a layout', () => {
  it('asks for par and yardage on played holes that have none', () => {
    const result = validateCard([good4], [undefined]);
    expect(result.rowErrors[0]).toHaveProperty('yardage');
    expect(result.error).toBe('1 hole need attention');
  });
});
