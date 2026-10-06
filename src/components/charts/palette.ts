/** One categorical palette for every chart (CSS tokens `--chart-1..8`, defined in index.css). */
export const CHART_PALETTE = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);
export const seriesColor = (index: number, explicit?: string) => explicit ?? CHART_PALETTE[index % CHART_PALETTE.length]!;

export const AXIS_TICK = { fontSize: 10, fill: 'var(--color-text-muted)' } as const;
export const GRID = { stroke: 'var(--color-border)', strokeDasharray: '3 3' } as const;

export const formatNumber = (value: number): string => value.toLocaleString('en-US');

export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}
