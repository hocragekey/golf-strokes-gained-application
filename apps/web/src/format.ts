export const formatSg = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`;

export const formatPct = (value: number | null): string =>
  value === null ? '—' : `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;

export const formatNumber = (value: number | null, digits = 1): string =>
  value === null ? '—' : value.toFixed(digits);

export const formatToPar = (toPar: number): string =>
  toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : String(toPar);

export const sgClass = (value: number): string =>
  value > 0.005 ? 'sg-pos' : value < -0.005 ? 'sg-neg' : 'sg-zero';
