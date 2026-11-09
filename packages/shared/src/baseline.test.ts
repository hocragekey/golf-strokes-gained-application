import { describe, expect, it } from 'vitest';
import { interpolate, pgaTourBaseline, type BaselineLie } from './baseline.js';

const E = pgaTourBaseline.expectedStrokes;

describe('interpolate', () => {
  const table = [
    [10, 1],
    [20, 3],
  ] as const;

  it('returns exact table values', () => {
    expect(interpolate(table, 10)).toBe(1);
    expect(interpolate(table, 20)).toBe(3);
  });

  it('interpolates linearly between points', () => {
    expect(interpolate(table, 15)).toBe(2);
  });

  it('clamps outside the table range', () => {
    expect(interpolate(table, 1)).toBe(1);
    expect(interpolate(table, 99)).toBe(3);
  });

  it('rejects empty tables', () => {
    expect(() => interpolate([], 1)).toThrow();
  });
});

describe('pgaTourBaseline', () => {
  it('matches published reference points', () => {
    expect(E(400, 'tee')).toBe(3.99);
    expect(E(150, 'fairway')).toBeCloseTo(2.945, 5);
    expect(E(8, 'green')).toBe(1.5);
  });

  it('is zero once holed', () => {
    expect(E(0, 'green')).toBe(0);
  });

  it('rejects invalid distances', () => {
    expect(() => E(-1, 'fairway')).toThrow(RangeError);
    expect(() => E(Number.NaN, 'green')).toThrow(RangeError);
  });

  it('is harder from worse lies at the same distance', () => {
    for (const d of [30, 100, 150, 200]) {
      expect(E(d, 'rough')).toBeGreaterThan(E(d, 'fairway'));
    }
    expect(E(150, 'recovery')).toBeGreaterThan(E(150, 'rough'));
  });

  it('is non-decreasing with distance on the green', () => {
    let previous = 0;
    for (let ft = 1; ft <= 150; ft++) {
      const value = E(ft, 'green');
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it.each<BaselineLie>(['tee', 'fairway', 'rough', 'sand', 'recovery'])(
    'produces plausible values from %s',
    (lie) => {
      expect(E(250, lie)).toBeGreaterThan(2);
      expect(E(250, lie)).toBeLessThan(5);
    },
  );
});
