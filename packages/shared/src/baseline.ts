/**
 * Expected strokes to hole out from a given distance and lie.
 *
 * The PGA Tour baseline below is adapted from the benchmark tables in Mark Broadie,
 * "Every Shot Counts" (2014). Values below 20 yards off the green are estimates that
 * blend toward short-chip expectations. See docs/adr/0005-strokes-gained-model.md.
 */
export type BaselineLie = 'tee' | 'fairway' | 'rough' | 'sand' | 'recovery' | 'green';

type Table = readonly (readonly [distance: number, expected: number])[];

export interface Baseline {
  id: string;
  name: string;
  /** Distance is in feet when `lie` is `green`, otherwise yards. */
  expectedStrokes: (distance: number, lie: BaselineLie) => number;
}

const PGA_TOUR: Record<BaselineLie, Table> = {
  tee: [
    [100, 2.92],
    [120, 2.99],
    [140, 2.97],
    [160, 2.99],
    [180, 3.05],
    [200, 3.12],
    [220, 3.17],
    [240, 3.25],
    [260, 3.45],
    [280, 3.65],
    [300, 3.71],
    [320, 3.79],
    [340, 3.86],
    [360, 3.92],
    [380, 3.96],
    [400, 3.99],
    [420, 4.02],
    [440, 4.08],
    [460, 4.17],
    [480, 4.28],
    [500, 4.41],
    [520, 4.54],
    [540, 4.65],
    [560, 4.74],
    [580, 4.79],
    [600, 4.82],
  ],
  fairway: [
    [1, 2.0],
    [5, 2.1],
    [10, 2.18],
    [20, 2.4],
    [40, 2.6],
    [60, 2.7],
    [80, 2.75],
    [100, 2.8],
    [120, 2.85],
    [140, 2.91],
    [160, 2.98],
    [180, 3.08],
    [200, 3.19],
    [220, 3.32],
    [240, 3.45],
    [260, 3.58],
    [280, 3.69],
    [300, 3.78],
    [320, 3.84],
    [340, 3.88],
    [360, 3.95],
    [380, 4.03],
    [400, 4.11],
    [420, 4.15],
    [440, 4.2],
    [460, 4.29],
    [480, 4.4],
    [500, 4.53],
    [520, 4.66],
    [540, 4.78],
    [560, 4.86],
    [580, 4.91],
    [600, 4.94],
  ],
  rough: [
    [1, 2.1],
    [5, 2.22],
    [10, 2.34],
    [20, 2.59],
    [40, 2.78],
    [60, 2.91],
    [80, 2.96],
    [100, 3.02],
    [120, 3.08],
    [140, 3.15],
    [160, 3.23],
    [180, 3.31],
    [200, 3.42],
    [220, 3.53],
    [240, 3.64],
    [260, 3.74],
    [280, 3.83],
    [300, 3.9],
    [320, 3.95],
    [340, 4.02],
    [360, 4.11],
    [380, 4.21],
    [400, 4.3],
    [420, 4.34],
    [440, 4.39],
    [460, 4.48],
    [480, 4.59],
    [500, 4.72],
    [520, 4.85],
    [540, 4.97],
    [560, 5.05],
    [580, 5.1],
    [600, 5.13],
  ],
  sand: [
    [1, 2.3],
    [5, 2.38],
    [10, 2.43],
    [20, 2.53],
    [40, 2.82],
    [60, 3.15],
    [80, 3.24],
    [100, 3.23],
    [120, 3.21],
    [140, 3.22],
    [160, 3.28],
    [180, 3.4],
    [200, 3.55],
    [220, 3.7],
    [240, 3.84],
    [260, 3.93],
    [280, 4.0],
    [300, 4.04],
    [320, 4.12],
    [340, 4.26],
    [360, 4.41],
    [380, 4.55],
    [400, 4.69],
    [420, 4.73],
    [440, 4.78],
    [460, 4.87],
    [480, 4.98],
    [500, 5.11],
    [520, 5.24],
    [540, 5.36],
    [560, 5.44],
    [580, 5.49],
    [600, 5.52],
  ],
  recovery: [
    [100, 3.8],
    [120, 3.78],
    [140, 3.8],
    [160, 3.81],
    [180, 3.82],
    [200, 3.87],
    [220, 3.92],
    [240, 3.97],
    [260, 4.03],
    [280, 4.1],
    [300, 4.2],
    [320, 4.31],
    [340, 4.44],
    [360, 4.56],
    [380, 4.66],
    [400, 4.75],
    [420, 4.79],
    [440, 4.84],
    [460, 4.93],
    [480, 5.04],
    [500, 5.17],
    [520, 5.3],
    [540, 5.42],
    [560, 5.5],
    [580, 5.55],
    [600, 5.58],
  ],
  green: [
    [1, 1.0],
    [2, 1.01],
    [3, 1.04],
    [4, 1.13],
    [5, 1.23],
    [6, 1.34],
    [7, 1.42],
    [8, 1.5],
    [9, 1.56],
    [10, 1.61],
    [15, 1.78],
    [20, 1.87],
    [30, 1.98],
    [40, 2.06],
    [50, 2.14],
    [60, 2.21],
    [90, 2.4],
    [150, 2.65],
  ],
};

/** Piecewise-linear interpolation, clamped to the table's range. */
export function interpolate(table: Table, x: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) throw new Error('Baseline table is empty');
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i] as readonly [number, number];
    if (x <= x1) {
      const [x0, y0] = table[i - 1] as readonly [number, number];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

export const pgaTourBaseline: Baseline = {
  id: 'pga-tour',
  name: 'PGA Tour',
  expectedStrokes: (distance, lie) => {
    if (!Number.isFinite(distance) || distance < 0) {
      throw new RangeError(`distance must be a non-negative number, got ${distance}`);
    }
    if (distance === 0) return 0;
    return interpolate(PGA_TOUR[lie], distance);
  },
};

export const BASELINES: Readonly<Record<string, Baseline>> = {
  [pgaTourBaseline.id]: pgaTourBaseline,
};
export const DEFAULT_BASELINE = pgaTourBaseline;
