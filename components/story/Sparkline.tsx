/** Lightweight inline SVG sparkline (plan §8.1: no chart library). */
export function Sparkline({
  values,
  label,
  width = 160,
  height = 36,
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-signal"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </svg>
  );
}
