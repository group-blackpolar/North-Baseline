import { cn } from '@/lib/utils';
import { seriesColor } from './palette';

export interface LegendItem { label: string; color?: string; total?: string; hidden?: boolean }

/** Compact legend: marker + label + optional total; clicking toggles a series when `onToggle` is given. */
export function NorthLegend({ items, onToggle, className }: { items: LegendItem[]; onToggle?: (label: string) => void; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary', className)}>
      {items.map((item, index) => {
        const body = (
          <>
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: seriesColor(index, item.color) }} />
            <span className="truncate">{item.label}</span>
            {item.total ? <span className="mono-data tabular-nums text-text">{item.total}</span> : null}
          </>
        );
        const cls = cn('flex items-center gap-1.5', onToggle && 'np-press-flat rounded-md px-1', item.hidden && 'opacity-40');
        return (
          <li key={item.label}>
            {onToggle ? <button type="button" aria-pressed={!item.hidden} onClick={() => onToggle(item.label)} className={cn(cls, 'min-h-6 pointer-coarse:min-h-(--touch-min)')}>{body}</button> : <span className={cls}>{body}</span>}
          </li>
        );
      })}
    </ul>
  );
}
