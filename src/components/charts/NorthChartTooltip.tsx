import { formatNumber } from './palette';

interface Entry { name?: string | number; value?: unknown; color?: string; dataKey?: string | number }

/** The only chart tooltip: elevated, compact, aligned rows. Pass as `<Tooltip content={<NorthChartTooltip />} />`. */
export function NorthChartTooltip({ active, payload, label, format = formatNumber }: { active?: boolean; payload?: Entry[]; label?: string | number; format?: (value: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-32 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs shadow-pop">
      {label !== undefined && label !== '' && <p className="mb-1 font-medium text-text">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => (
          <li key={`${entry.dataKey ?? entry.name}-${index}`} className="flex items-center gap-2 text-text-secondary">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="flex-1 truncate">{entry.name}</span>
            <span className="mono-data tabular-nums text-text">{typeof entry.value === 'number' ? format(entry.value) : String(entry.value ?? '')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
