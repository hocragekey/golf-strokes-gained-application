import { describe, expect, it } from 'vitest';
import { formatNumber, formatPct, formatSg, formatToPar, sgClass } from './format';

describe('format', () => {
  it('formats strokes gained with a sign', () => {
    expect(formatSg(1.234)).toBe('+1.23');
    expect(formatSg(-0.5)).toBe('−0.50');
    expect(formatSg(0)).toBe('0.00');
  });

  it('formats percentages and numbers', () => {
    expect(formatPct(null)).toBe('—');
    expect(formatPct(50)).toBe('50%');
    expect(formatPct(66.67)).toBe('66.7%');
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(31.456)).toBe('31.5');
  });

  it('formats score to par', () => {
    expect(formatToPar(0)).toBe('E');
    expect(formatToPar(5)).toBe('+5');
    expect(formatToPar(-2)).toBe('-2');
  });

  it('classifies strokes gained', () => {
    expect(sgClass(0.2)).toBe('sg-pos');
    expect(sgClass(-0.2)).toBe('sg-neg');
    expect(sgClass(0)).toBe('sg-zero');
  });
});
