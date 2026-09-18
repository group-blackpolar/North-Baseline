import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricCard({ label, value, delta, icon: Icon }: { label: string; value: string; delta?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="np-card p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="ui-label pb-1">{label}</p>
        <p className="font-display text-2xl font-semibold text-text tabular-nums">{value}</p>
        {delta && <p className="text-xs text-success mt-1">{delta}</p>}
      </div>
      {Icon && <div className="size-9 rounded-lg bg-surface-active flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-text-secondary" /></div>}
    </div>
  );
}

export function DashboardCard({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('np-card p-5 space-y-4', className)}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-display font-semibold text-text">{title}</h2>
          {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="np-card px-3 py-2 flex flex-wrap items-center gap-2">{children}</div>;
}

export function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="ui-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 transition-[border-color,box-shadow] duration-150"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function SimpleTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-105">
        <thead className="bg-surface-hover/60">
          <tr>{columns.map((column) => <th key={column} className="text-left ui-label px-3 py-2 whitespace-nowrap">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border/60 hover:bg-surface-hover/50 transition-colors duration-150">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={cn('px-3 py-2 whitespace-nowrap', cellIndex === 0 ? 'text-text font-medium' : 'mono-data text-text-secondary')}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}