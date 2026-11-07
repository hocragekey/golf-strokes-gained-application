import QRCode from 'qrcode';
import { useMemo } from 'react';

/** Renders a QR code as inline SVG, generated on-device so it works offline. */
export function QrCode({
  value,
  size = 96,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  const { path, dimension } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const d: string[] = [];
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(x, y)) d.push(`M${String(x + 4)} ${String(y + 4)}h1v1h-1z`);
      }
    }
    return { path: d.join(''), dimension: modules.size + 8 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${String(dimension)} ${String(dimension)}`}
      shapeRendering="crispEdges"
    >
      <rect width={dimension} height={dimension} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
