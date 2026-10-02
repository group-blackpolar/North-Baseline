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
import { AlertCircle, Filter, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import type { AnalyticsColumn, AnalyticsData, AnalyticsFilter, AnalyticsResult, AnalyticsRow, AnalyticsSeries, AnalyticsValue } from './types';

const PALETTE = ['var(--color-accent)', '#60A5FA', '#FBBF24', '#A78BFA', '#F87171', '#34D399', '#F472B6', '#94A3B8'];
const AXIS_TICK = { fill: 'var(--color-text-muted)', fontSize: 10 };
const TOOLTIP_STYLE = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 };

function number(value: AnalyticsValue): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function display(value: AnalyticsValue): string {
  if (value === null) return '—';
  if (typeof value === 'number') return new Intl.NumberFormat().format(value);
  if (typeof value === 'boolean') return value ? '✓' : '—';
  return value;
}

function ResultState({ result, children }: { result: AnalyticsResult; children: (data: AnalyticsData) => ReactNode }) {
  const { t } = useI18n();
  if (result.state === 'loading') {
    return <div aria-busy="true" className="flex min-h-32 items-center justify-center gap-2 text-xs text-text-muted"><LoaderCircle className="size-4 animate-spin" />{t('analytics.loading')}</div>;
  }
  if (result.state === 'error') {
    return <div role="alert" className="flex min-h-32 items-center justify-center gap-2 px-4 text-center text-xs text-error"><AlertCircle className="size-4 shrink-0" />{result.message || t('analytics.error')}</div>;
  }
  if (result.state === 'empty') {
    return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{result.message || t('analytics.empty')}</div>;
  }
  if (result.data.rows.length === 0) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.empty')}</div>;
  return <>{children(result.data)}</>;
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
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
              <thead><tr>{visible.map((column) => <th key={column.key} className={`border-b border-border px-3 py-2 font-medium text-text-secondary ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>)}</tr></thead>
              <tbody>{data.rows.map((row, index) => <tr key={index} className="odd:bg-surface-hover/40">{visible.map((column) => <td key={column.key} className={`border-b border-border/60 px-3 py-2 text-text ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>{display(row[column.key] ?? null)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      }}
    </ResultState>
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
  return <ChartState result={result} series={series}>{(rows) => <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 20 : -12, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={!horizontal} horizontal={horizontal} />{horizontal ? <><XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis type="category" dataKey={categoryKey} width={120} tick={AXIS_TICK} tickLine={false} axisLine={false} /></> : <><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /></>}<Tooltip contentStyle={TOOLTIP_STYLE} />{series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} stackId={stacked ? 'values' : undefined} fill={item.color ?? PALETTE[index % PALETTE.length]} radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]} />)}</BarChart></ResponsiveContainer></div>}</ChartState>;
}

export function AnalyticsLineAreaChart({ result, categoryKey, series, variant = 'line', height = 240 }: { result: AnalyticsResult; categoryKey: string; series: AnalyticsSeries[]; variant?: 'line' | 'area'; height?: number }) {
  return <ChartState result={result} series={series}>{(rows) => <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{variant === 'area' ? <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip contentStyle={TOOLTIP_STYLE} />{series.map((item, index) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} fill={item.color ?? PALETTE[index % PALETTE.length]} fillOpacity={0.18} strokeWidth={2} />)}</AreaChart> : <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip contentStyle={TOOLTIP_STYLE} />{series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} strokeWidth={2} dot={false} />)}</LineChart>}</ResponsiveContainer></div>}</ChartState>;
}

export function AnalyticsDonutChart({ result, categoryKey, valueKey, variant = 'donut', color, height = 240 }: { result: AnalyticsResult; categoryKey: string; valueKey: string; variant?: 'donut' | 'pie'; color?: string; height?: number }) {
  const { t } = useI18n();
  return <ResultState result={result}>{(data) => {
    const rows = data.rows.filter((row) => number(row[valueKey]) !== null);
    if (!rows.length) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.noNumericValues')}</div>;
    return <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} nameKey={categoryKey} dataKey={valueKey} innerRadius={variant === 'donut' ? '55%' : 0} outerRadius="78%" paddingAngle={2} stroke="none">{rows.map((row, index) => <Cell key={`${String(row[categoryKey])}-${index}`} fill={index === 0 && color ? color : PALETTE[index % PALETTE.length]} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} /></PieChart></ResponsiveContainer></div>;
  }}</ResultState>;
}

export function AnalyticsFilterControls({ filters, onChange }: { filters: AnalyticsFilter[]; onChange: (id: string, value: string | string[]) => void }) {
  const { t } = useI18n();
  if (!filters.length) return null;
  return <fieldset className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-hover/40 p-3"><legend className="sr-only">{t('analytics.filters')}</legend><Filter className="mb-2 size-4 text-text-muted" aria-hidden="true" />{filters.map((filter) => <label key={filter.id} className="min-w-32 flex-1 space-y-1 text-xs text-text-secondary"><span className="block font-medium">{filter.label}</span>{filter.type === 'select' || filter.type === 'multiselect' ? <select multiple={filter.type === 'multiselect'} value={filter.value} disabled={filter.disabled} onChange={(event) => onChange(filter.id, filter.type === 'multiselect' ? [...event.currentTarget.selectedOptions].map((option) => option.value) : event.currentTarget.value)} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text disabled:cursor-not-allowed disabled:opacity-60">{filter.type === 'select' && <option value="">{t('analytics.all')}</option>}{(filter.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={filter.type === 'date' ? 'date' : 'text'} value={Array.isArray(filter.value) ? '' : filter.value} disabled={filter.disabled} onChange={(event) => onChange(filter.id, event.currentTarget.value)} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text disabled:cursor-not-allowed disabled:opacity-60" />}</label>)}</fieldset>;
}
