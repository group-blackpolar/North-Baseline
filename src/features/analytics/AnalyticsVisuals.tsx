import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, CaretUpDown, Funnel, WarningCircle } from '@phosphor-icons/react';
import { useMemo, useState, type ReactNode } from 'react';
import { AXIS_TICK, CHART_PALETTE, GRID, NorthChartTooltip, useLabelAxisWidth } from '@/components/charts';
import { DelayedSkeleton, SkeletonChart } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import type { AnalyticsColumn, AnalyticsData, AnalyticsFilter, AnalyticsResult, AnalyticsRow, AnalyticsSeries, AnalyticsValue } from './types';

const PALETTE = CHART_PALETTE;

function number(value: AnalyticsValue): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function display(value: AnalyticsValue): string {
  if (value === null) return '—';
  if (typeof value === 'number') return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? '✓' : '—';
  return value;
}

function ResultState({ result, children }: { result: AnalyticsResult; children: (data: AnalyticsData) => ReactNode }) {
  const { t } = useI18n();
  if (result.state === 'loading') {
    // Delayed, real-shape placeholder (no spinner flash on fast responses); the label stays for assistive tech.
    return <><span className="sr-only" role="status">{t('analytics.loading')}</span><DelayedSkeleton loading minHeight={128} fallback={<SkeletonChart height={160} />} /></>;
  }
  if (result.state === 'error') {
    return <div role="alert" className="flex min-h-32 items-center justify-center gap-2 px-4 text-center text-xs text-error"><WarningCircle className="size-4 shrink-0" />{result.message || t('analytics.error')}</div>;
  }
  if (result.state === 'empty') {
    return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{result.message || t('analytics.empty')}</div>;
  }
  if (result.data.rows.length === 0) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.empty')}</div>;
  return <div className="np-fade-in">{children(result.data)}</div>;
}

const KPI_VARIANT = {
  default: 'text-text', primary: 'text-accent', secondary: 'text-text-secondary', muted: 'text-text-muted',
  success: 'text-success', warning: 'text-warning', danger: 'text-error',
} as const;

export function AnalyticsKpi({ result, field, label, format, variant = 'default' }: { result: AnalyticsResult; field: string; label: string; format?: (value: AnalyticsValue) => string; variant?: keyof typeof KPI_VARIANT }) {
  return (
    <ResultState result={result}>
      {(data) => {
        const value = data.rows[0]?.[field] ?? null;
        return <div className="space-y-1"><p className="text-xs text-text-secondary">{label}</p><p className={`font-display text-2xl font-semibold tracking-tight ${KPI_VARIANT[variant]}`}>{format ? format(value) : display(value)}</p></div>;
      }}
    </ResultState>
  );
}

export function AnalyticsDataGrid({ result, columns }: { result: AnalyticsResult; columns?: AnalyticsColumn[] }) {
  const { t } = useI18n();
  return (
    <ResultState result={result}>
      {(data) => {
        const visible = columns ?? data.columns;
        if (visible.length === 0) return <div role="status" className="py-6 text-center text-xs text-text-muted">{t('analytics.empty')}</div>;
        return <SortableGrid columns={visible} rows={data.rows} />;
      }}
    </ResultState>
  );
}

/** Sorts only the rows CORECROW already returned; it never requests more data. */
function SortableGrid({ columns, rows }: { columns: AnalyticsColumn[]; rows: AnalyticsRow[] }) {
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const numeric = useMemo(
    () => new Set(columns.filter((column) => column.align === 'right' || (rows.length > 0 && rows.every((row) => row[column.key] === null || typeof row[column.key] === 'number'))).map((column) => column.key)),
    [columns, rows],
  );
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = left[sort.key] ?? null;
      const b = right[sort.key] ?? null;
      if (a === b) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))) * factor;
    });
  }, [rows, sort]);
  const toggle = (key: string) => setSort((current) => (current?.key !== key ? { key, direction: 'desc' } : current.direction === 'desc' ? { key, direction: 'asc' } : null));

  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
      <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr>
            <th scope="col" className="w-8 border-b border-border px-2 py-2 text-right font-medium text-text-muted">#</th>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const Icon = !active ? CaretUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={column.key} scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={`border-b border-border p-0 font-medium text-text-secondary ${numeric.has(column.key) ? 'text-right' : ''}`}>
                  <button type="button" onClick={() => toggle(column.key)} className={`flex w-full items-center gap-1 px-3 py-2 hover:bg-surface-hover hover:text-text transition-colors duration-(--duration-fast) ${numeric.has(column.key) ? 'justify-end' : ''}`}>
                    {column.label}<Icon className={`size-3 shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`} aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={index} className="odd:bg-surface-hover/40 hover:bg-accent-soft/40 transition-colors duration-100">
              <td className="border-b border-border/60 px-2 py-2 text-right tabular-nums text-text-muted">{index + 1}</td>
              {columns.map((column) => <td key={column.key} className={`border-b border-border/60 px-3 py-2 text-text ${numeric.has(column.key) ? 'text-right tabular-nums' : ''}`}>{display(row[column.key] ?? null)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function numericRows(data: AnalyticsData, series: AnalyticsSeries[]) {
  return data.rows.filter((row) => series.some((item) => number(row[item.key]) !== null));
}

function ChartState({ result, series, children }: { result: AnalyticsResult; series: AnalyticsSeries[]; children: (rows: AnalyticsRow[]) => ReactNode }) {
  const { t } = useI18n();
  return <ResultState result={result}>{(data) => {
    const rows = numericRows(data, series);
    return rows.length ? children(rows) : <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.noNumericValues')}</div>;
  }}</ResultState>;
}

export function AnalyticsBarChart({ result, categoryKey, series, horizontal = false, stacked = false, height = 240 }: { result: AnalyticsResult; categoryKey: string; series: AnalyticsSeries[]; horizontal?: boolean; stacked?: boolean; height?: number }) {
  const labelWidth = useLabelAxisWidth();
  return <ChartState result={result} series={series}>{(rows) => <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 20 : -12, bottom: 0 }}><CartesianGrid {...GRID} vertical={!horizontal} horizontal={horizontal} />{horizontal ? <><XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis type="category" dataKey={categoryKey} width={labelWidth} tick={AXIS_TICK} tickLine={false} axisLine={false} /></> : <><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /></>}<Tooltip content={<NorthChartTooltip />} />{series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} stackId={stacked ? 'values' : undefined} fill={item.color ?? PALETTE[index % PALETTE.length]} radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]} />)}</BarChart></ResponsiveContainer></div>}</ChartState>;
}

export function AnalyticsLineAreaChart({ result, categoryKey, series, variant = 'line', height = 240 }: { result: AnalyticsResult; categoryKey: string; series: AnalyticsSeries[]; variant?: 'line' | 'area'; height?: number }) {
  return <ChartState result={result} series={series}>{(rows) => <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{variant === 'area' ? <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip content={<NorthChartTooltip />} />{series.map((item, index) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} fill={item.color ?? PALETTE[index % PALETTE.length]} fillOpacity={0.18} strokeWidth={2} />)}</AreaChart> : <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip content={<NorthChartTooltip />} />{series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} strokeWidth={2} dot={false} />)}</LineChart>}</ResponsiveContainer></div>}</ChartState>;
}

export function AnalyticsDonutChart({ result, categoryKey, valueKey, variant = 'donut', color, height = 240 }: { result: AnalyticsResult; categoryKey: string; valueKey: string; variant?: 'donut' | 'pie'; color?: string; height?: number }) {
  const { t } = useI18n();
  return <ResultState result={result}>{(data) => {
    const rows = data.rows.filter((row) => number(row[valueKey]) !== null);
    if (!rows.length) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.noNumericValues')}</div>;
    return <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} nameKey={categoryKey} dataKey={valueKey} innerRadius={variant === 'donut' ? '55%' : 0} outerRadius="78%" paddingAngle={2} stroke="none">{rows.map((row, index) => <Cell key={`${String(row[categoryKey])}-${index}`} fill={index === 0 && color ? color : PALETTE[index % PALETTE.length]} />)}</Pie><Tooltip content={<NorthChartTooltip />} /></PieChart></ResponsiveContainer></div>;
  }}</ResultState>;
}

export function AnalyticsFilterControls({ filters, onChange }: { filters: AnalyticsFilter[]; onChange: (id: string, value: string | string[]) => void }) {
  const { t } = useI18n();
  if (!filters.length) return null;
  return <fieldset className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-hover/40 p-3"><legend className="sr-only">{t('analytics.filters')}</legend><Funnel className="mb-2 size-4 text-text-muted" aria-hidden="true" />{filters.map((filter) => <label key={filter.id} className="min-w-32 flex-1 space-y-1 text-xs text-text-secondary"><span className="block font-medium">{filter.label}</span>{filter.type === 'select' || filter.type === 'multiselect' ? <select multiple={filter.type === 'multiselect'} value={filter.value} disabled={filter.disabled} onChange={(event) => onChange(filter.id, filter.type === 'multiselect' ? [...event.currentTarget.selectedOptions].map((option) => option.value) : event.currentTarget.value)} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text disabled:cursor-not-allowed disabled:opacity-60">{filter.type === 'select' && <option value="">{t('analytics.all')}</option>}{(filter.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={filter.type === 'date' ? 'date' : 'text'} value={Array.isArray(filter.value) ? '' : filter.value} disabled={filter.disabled} onChange={(event) => onChange(filter.id, event.currentTarget.value)} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text disabled:cursor-not-allowed disabled:opacity-60" />}</label>)}</fieldset>;
}
