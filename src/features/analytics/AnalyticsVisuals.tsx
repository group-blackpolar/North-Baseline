import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, CaretUpDown, Funnel, WarningCircle } from '@phosphor-icons/react';
import { useMemo, useState, type ReactNode } from 'react';
import { AXIS_TICK, CHART_PALETTE, GRID, NorthChartTooltip, useLabelAxisWidth } from '@/components/charts';
import { DelayedSkeleton, SkeletonChart } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import type { AnalyticsColumn, AnalyticsData, AnalyticsFilter, AnalyticsResult, AnalyticsRow, AnalyticsSeries, AnalyticsValue } from './types';

const PALETTE = CHART_PALETTE;

/** Date buckets arrive as ISO timestamps; chart axes and tooltips name them as "Aug 2026" (UTC, so no day shifts). */
function categoryLabel(value: unknown, locale: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(value)) {
    const date = new Date(value);
    const monthStart = value.slice(8, 10) === '01';
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-419' : locale, { timeZone: 'UTC', month: 'short', year: 'numeric', ...(monthStart ? {} : { day: 'numeric' }) }).format(date);
  }
  return String(value ?? '');
}

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

export function AnalyticsBarChart({ result, categoryKey, series, horizontal = false, stacked = false, height = 240, showValues = false }: { result: AnalyticsResult; categoryKey: string; series: AnalyticsSeries[]; horizontal?: boolean; stacked?: boolean; height?: number; showValues?: boolean }) {
  const labelWidth = useLabelAxisWidth();
  const { locale } = useI18n();
  const valueLabel = (value: unknown) => (typeof value === 'number' ? new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale, { maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value) : '');
  return <ChartState result={result} series={series}>{(rows) => <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: showValues && horizontal ? 44 : 8, left: horizontal ? 20 : -12, bottom: 0 }} barCategoryGap={horizontal ? '28%' : '20%'}><CartesianGrid {...GRID} vertical={!horizontal} horizontal={!horizontal ? true : false} />{horizontal ? <><XAxis type="number" hide /><YAxis type="category" dataKey={categoryKey} width={labelWidth} tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} tickFormatter={(value) => categoryLabel(value, locale)} /></> : <><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(value) => categoryLabel(value, locale)} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /></>}<Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} content={<NorthChartTooltip labelFormat={(label) => categoryLabel(label, locale)} />} />{series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} stackId={stacked ? 'values' : undefined} fill={item.color ?? PALETTE[index % PALETTE.length]} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 14 : 36} isAnimationActive={false}>{showValues ? <LabelList dataKey={item.key} position={horizontal ? 'right' : 'top'} formatter={valueLabel} style={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} /> : null}</Bar>)}</BarChart></ResponsiveContainer></div>}</ChartState>;
}

export function AnalyticsLineAreaChart({ result, categoryKey, series, variant = 'line', height = 240 }: { result: AnalyticsResult; categoryKey: string; series: AnalyticsSeries[]; variant?: 'line' | 'area'; height?: number }) {
  const { locale } = useI18n();
  const tick = (value: unknown) => categoryLabel(value, locale);
  return <ChartState result={result} series={series}>{(rows) => <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{variant === 'area' ? <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={tick} minTickGap={24} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip content={<NorthChartTooltip labelFormat={(label) => tick(label)} />} />{series.map((item, index) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} fill={item.color ?? PALETTE[index % PALETTE.length]} fillOpacity={0.18} strokeWidth={2} />)}</AreaChart> : <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={tick} minTickGap={24} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip content={<NorthChartTooltip labelFormat={(label) => tick(label)} />} />{series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} strokeWidth={2} dot={false} />)}</LineChart>}</ResponsiveContainer></div>}</ChartState>;
}

/** Two numeric measures against each other (one point per row). Non-numeric rows are skipped, never plotted as zero. */
export function AnalyticsScatterChart({ result, xKey, yKey, xLabel, yLabel, sizeKey, height = 240 }: { result: AnalyticsResult; xKey: string; yKey: string; xLabel?: string; yLabel?: string; sizeKey?: string; height?: number }) {
  const { t } = useI18n();
  return <ResultState result={result}>{(data) => {
    const points = data.rows.flatMap((row) => { const x = number(row[xKey]); const y = number(row[yKey]); return x === null || y === null ? [] : [{ ...row, [xKey]: x, [yKey]: y }]; });
    if (!points.length) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.noNumericValues')}</div>;
    return <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 8, right: 8, left: -4, bottom: 0 }}><CartesianGrid {...GRID} /><XAxis type="number" dataKey={xKey} name={xLabel ?? xKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis type="number" dataKey={yKey} name={yLabel ?? yKey} tick={AXIS_TICK} tickLine={false} axisLine={false} />{sizeKey ? <ZAxis type="number" dataKey={sizeKey} range={[30, 220]} /> : <ZAxis range={[60, 60]} />}<Tooltip cursor={{ strokeDasharray: '3 3' }} content={<NorthChartTooltip />} /><Scatter data={points} fill={PALETTE[0]} fillOpacity={0.75} /></ScatterChart></ResponsiveContainer></div>;
  }}</ResultState>;
}

export function AnalyticsDonutChart({ result, categoryKey, valueKey, variant = 'donut', color, height = 240, centerLabel, showTotal = false, legend = 'none', maxSlices, total: totalOverride }: { result: AnalyticsResult; categoryKey: string; valueKey: string; variant?: 'donut' | 'pie'; color?: string; height?: number; centerLabel?: string; showTotal?: boolean; legend?: 'right' | 'bottom' | 'none'; maxSlices?: number; total?: number | null }) {
  const { t, locale } = useI18n();
  return <ResultState result={result}>{(data) => {
    const numeric = data.rows.filter((row) => number(row[valueKey]) !== null);
    if (!numeric.length) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.noNumericValues')}</div>;
    // Beyond `maxSlices` the remaining groups are summed into one "Others" slice (their own values, nothing estimated).
    const sorted = [...numeric].sort((a, b) => (number(b[valueKey]) ?? 0) - (number(a[valueKey]) ?? 0));
    const rows = maxSlices && sorted.length > maxSlices ? [...sorted.slice(0, maxSlices - 1), { [categoryKey]: t('analytics.others'), [valueKey]: sorted.slice(maxSlices - 1).reduce((sum, row) => sum + (number(row[valueKey]) ?? 0), 0) }] : numeric;
    // Percentages and the centre use the page's own unique total when one is bound (a container never counts twice).
    const total = totalOverride && totalOverride > 0 ? totalOverride : rows.reduce((sum, row) => sum + (number(row[valueKey]) ?? 0), 0);
    const fill = (index: number) => (index === 0 && color ? color : PALETTE[index % PALETTE.length]);
    const percent = (value: number) => `${new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(total ? (value / total) * 100 : 0)}%`;
    return (
      <div className={`flex ${legend === 'bottom' ? 'flex-col' : 'flex-row items-center'} gap-3`} style={{ minHeight: height }}>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} nameKey={categoryKey} dataKey={valueKey} innerRadius={variant === 'donut' ? '62%' : 0} outerRadius="88%" paddingAngle={variant === 'donut' ? 1.5 : 0} stroke="none" isAnimationActive={false}>{rows.map((row, index) => <Cell key={`${String(row[categoryKey])}-${index}`} fill={fill(index)} />)}</Pie><Tooltip content={<NorthChartTooltip />} /></PieChart></ResponsiveContainer>
          {variant === 'donut' && (showTotal || centerLabel) ? <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{showTotal ? <span className="font-display text-lg font-semibold tabular-nums text-text">{new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale, { maximumFractionDigits: 0 }).format(total)}</span> : null}{centerLabel ? <span className="max-w-[60%] truncate text-[0.7rem] text-text-muted">{centerLabel}</span> : null}</div> : null}
        </div>
        {legend !== 'none' ? (
          <ul className={`flex min-w-0 gap-1.5 text-xs ${legend === 'right' ? 'w-[46%] max-w-52 shrink-0 flex-col' : 'flex-wrap'}`} aria-label={t('analytics.legend')}>
            {rows.map((row, index) => <li key={`${String(row[categoryKey])}-${index}`} className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: fill(index) }} /><span className="min-w-0 flex-1 truncate text-text-secondary" title={String(row[categoryKey])}>{String(row[categoryKey])}</span><span className="shrink-0 tabular-nums font-medium text-text">{percent(number(row[valueKey]) ?? 0)}</span></li>)}
          </ul>
        ) : null}
      </div>
    );
  }}</ResultState>;
}

export function AnalyticsFilterControls({ filters, onChange }: { filters: AnalyticsFilter[]; onChange: (id: string, value: string | string[]) => void }) {
  const { t } = useI18n();
  if (!filters.length) return null;
  return <fieldset className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-hover/40 p-3"><legend className="sr-only">{t('analytics.filters')}</legend><Funnel className="mb-2 size-4 text-text-muted" aria-hidden="true" />{filters.map((filter) => <label key={filter.id} className="min-w-32 flex-1 space-y-1 text-xs text-text-secondary"><span className="block font-medium">{filter.label}</span>{filter.type === 'select' || filter.type === 'multiselect' ? <select multiple={filter.type === 'multiselect'} value={filter.value} disabled={filter.disabled} onChange={(event) => onChange(filter.id, filter.type === 'multiselect' ? [...event.currentTarget.selectedOptions].map((option) => option.value) : event.currentTarget.value)} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text disabled:cursor-not-allowed disabled:opacity-60">{filter.type === 'select' && <option value="">{t('analytics.all')}</option>}{(filter.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={filter.type === 'date' ? 'date' : 'text'} value={Array.isArray(filter.value) ? '' : filter.value} disabled={filter.disabled} onChange={(event) => onChange(filter.id, event.currentTarget.value)} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text disabled:cursor-not-allowed disabled:opacity-60" />}</label>)}</fieldset>;
}
