import type { ReactNode } from 'react';

/** Ring for quota / target / health. `value` is 0-100. Centre content is the caller's (usually the number). */
export function RadialProgress({ value, size = 72, stroke = 7, color = 'var(--chart-1)', label, children }: { value: number; size?: number; stroke?: number; color?: string; label: string; children?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-active)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-(--duration-slow) ease-(--ease-standard)" />
      </svg>
      <span className="absolute font-display text-sm font-semibold tabular-nums text-text">{children ?? `${Math.round(pct)}%`}</span>
    </div>
  );
}
