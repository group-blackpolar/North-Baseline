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
import { cn } from '@/lib/utils';
import { intlTag } from '@/lib/intlTag';
import { useCellFill, useElementSize } from './cellFill';
import type { AnalyticsColumn, AnalyticsData, AnalyticsFilter, AnalyticsResult, AnalyticsRow, AnalyticsSeries, AnalyticsValue } from './types';

const PALETTE = CHART_PALETTE;

/** Date buckets arrive as ISO timestamps; chart axes and tooltips name them as "Aug 2026" (UTC, so no day shifts). */
function categoryLabel(value: unknown, locale: string, unit?: 'month' | 'year' | 'monthOfYear'): string {
  if (unit === 'monthOfYear') { const month = Number(value); return Number.isInteger(month) && month >= 1 && month <= 12 ? new Intl.DateTimeFormat(locale === 'es' ? 'es-419' : locale, { timeZone: 'UTC', month: 'short' }).format(new Date(Date.UTC(2000, month - 1, 1))) : String(value ?? ''); }
  if (unit === 'year' && typeof value === 'string' && /^\d{4}-/.test(value)) return value.slice(0, 4);
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

function display(value: AnalyticsValue, locale: string): string {
  if (value === null) return '—';
  if (typeof value === 'number') return new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? '✓' : '—';
  return value;
}

function ResultState({ result, children }: { result: AnalyticsResult; children: (data: AnalyticsData) => ReactNode }) {
  const { t } = useI18n();
  const fill = useCellFill();
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
  return <div className={cn('np-fade-in', fill && 'h-full')}>{children(result.data)}</div>;
}

const KPI_VARIANT = {
  default: 'text-text', primary: 'text-accent', secondary: 'text-text-secondary', muted: 'text-text-muted',
  success: 'text-success', warning: 'text-warning', danger: 'text-error',
} as const;

export function AnalyticsKpi({ result, field, label, format, variant = 'default' }: { result: AnalyticsResult; field: string; label: string; format?: (value: AnalyticsValue) => string; variant?: keyof typeof KPI_VARIANT }) {
  const { locale } = useI18n();
  return (
    <ResultState result={result}>
      {(data) => {
        const value = data.rows[0]?.[field] ?? null;
        return <div className="space-y-1"><p className="text-xs text-text-secondary">{label}</p><p className={`font-display text-2xl font-semibold tracking-tight ${KPI_VARIANT[variant]}`}>{format ? format(value) : display(value, locale)}</p></div>;
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
  const { locale } = useI18n();
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
              {columns.map((column) => <td key={column.key} className={`border-b border-border/60 px-3 py-2 text-text ${numeric.has(column.key) ? 'text-right tabular-nums' : ''}`}>{display(row[column.key] ?? null, locale)}</td>)}
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

/** Inside a fixed-matrix cell a chart fills the cell; otherwise it keeps its own configured height. */
const sized = (fill: boolean, height: number) => (fill ? { height: '100%' } : { height });

export function AnalyticsBarChart({ result, categoryKey, series, horizontal = false, stacked = false, height = 240, showValues = false, categoryFormat, onSelect, selected = [] }: { result: AnalyticsResult; categoryKey: string; series: AnalyticsSeries[]; horizontal?: boolean; stacked?: boolean; height?: number; showValues?: boolean; categoryFormat?: 'month' | 'year' | 'monthOfYear'; /** Cross-filter: the clicked category narrows the dashboard (only passed when the field is filterable). */ onSelect?: (category: string) => void; /** Categories currently selected by a cross-filter: they stay at full strength, the rest recede. */ selected?: string[] }) {
  const labelWidth = useLabelAxisWidth();
  const fill = useCellFill();
  const [box, size] = useElementSize<HTMLDivElement>();
  const { locale } = useI18n();
  const valueLabel = (value: unknown) => (typeof value === 'number' ? new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale, { maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value) : '');
  // In a fixed cell a horizontal bar chart shows only the categories that fit legibly (18 px each); the rest stay in the table/export.
  const room = fill && horizontal && size.height > 0 ? Math.max(3, Math.floor((size.height - 8) / 18)) : Infinity;
  const clip = (value: unknown) => { const label = categoryLabel(value, locale, categoryFormat); return label.length > 26 ? `${label.slice(0, 25)}…` : label; };
  // Ranking style (single measure, horizontal, inside a dashboard cell): label · track with the bar growing to the right · value. Comfortable at any width.
  if (fill && horizontal && !stacked && series.length === 1) {
    const only = series[0]!;
    return <ChartState result={result} series={series}>{(all) => {
      const capacity = size.height > 0 ? Math.max(3, Math.floor(size.height / 21)) : all.length;
      const rows = all.slice(0, capacity);
      const max = Math.max(1e-9, ...rows.map((row) => (typeof row[only.key] === 'number' ? row[only.key] as number : 0)));
      const money = new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 0 });
      return (
        <div ref={box} className="flex h-full min-h-0 flex-col" role="list">
          {rows.map((row, index) => {
            const name = categoryLabel(row[categoryKey], locale, categoryFormat);
            const value = typeof row[only.key] === 'number' ? row[only.key] as number : 0;
            const chosen = selected.includes(String(row[categoryKey]));
            const faded = selected.length > 0 && !chosen;
            const pick = onSelect ? () => onSelect(String(row[categoryKey])) : undefined;
            return (
              <div key={`${name}-${index}`} role={pick ? 'button' : 'listitem'} tabIndex={pick ? 0 : undefined} aria-pressed={pick ? chosen : undefined} onClick={pick}
                onKeyDown={pick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } } : undefined}
                className={cn('grid min-h-0 flex-1 grid-cols-[minmax(3.5rem,34%)_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 text-xs', pick && 'cursor-pointer hover:bg-surface-hover', faded && 'opacity-40')}>
                <span className="truncate text-text-secondary" title={name}>{name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-hover"><span className="block h-full rounded-full" style={{ width: `${Math.max(1.5, (value / max) * 100)}%`, background: only.color ?? PALETTE[0] }} /></span>
                <span className="min-w-[3.25rem] text-right tabular-nums font-medium text-text">{money.format(value)}</span>
              </div>
            );
          })}
        </div>
      );
    }}</ChartState>;
  }
  return <ChartState result={result} series={series}>{(all) => { const rows = all.slice(0, room); return <div ref={box} style={sized(fill, height)}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: showValues && horizontal ? 44 : 8, left: horizontal ? 20 : -12, bottom: 0 }} barCategoryGap={horizontal ? '28%' : '20%'}><CartesianGrid {...GRID} vertical={!horizontal} horizontal={!horizontal ? true : false} />{horizontal ? <><XAxis type="number" hide /><YAxis type="category" dataKey={categoryKey} width={labelWidth} tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} tickFormatter={clip} /></> : <><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(value) => categoryLabel(value, locale, categoryFormat)} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /></>}<Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} content={<NorthChartTooltip labelFormat={(label) => categoryLabel(label, locale, categoryFormat)} />} />{series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} stackId={stacked ? 'values' : undefined} fill={item.color ?? PALETTE[index % PALETTE.length]} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 14 : 36} isAnimationActive={false} cursor={onSelect ? 'pointer' : undefined} onClick={onSelect ? (entry: unknown) => { const value = (entry as Record<string, unknown> | null)?.[categoryKey]; if (typeof value === 'string' || typeof value === 'number') onSelect(String(value)); } : undefined}>{selected.length ? rows.map((row, index) => <Cell key={`${String(row[categoryKey])}-${index}`} fillOpacity={selected.includes(String(row[categoryKey])) ? 1 : 0.3} />) : null}{showValues ? <LabelList dataKey={item.key} position={horizontal ? 'right' : 'top'} formatter={valueLabel} style={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} /> : null}</Bar>)}</BarChart></ResponsiveContainer></div>; }}</ChartState>;
}

export function AnalyticsLineAreaChart({ result, categoryKey, series, variant = 'line', height = 240, categoryFormat }: { result: AnalyticsResult; categoryKey: string; series: AnalyticsSeries[]; variant?: 'line' | 'area'; height?: number; categoryFormat?: 'month' | 'year' | 'monthOfYear' }) {
  const { locale } = useI18n();
  const fill = useCellFill();
  const tick = (value: unknown) => categoryLabel(value, locale, categoryFormat);
  return <ChartState result={result} series={series}>{(rows) => <div style={sized(fill, height)}><ResponsiveContainer width="100%" height="100%">{variant === 'area' ? <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={tick} minTickGap={24} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip content={<NorthChartTooltip labelFormat={(label) => tick(label)} />} />{series.map((item, index) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} fill={item.color ?? PALETTE[index % PALETTE.length]} fillOpacity={0.18} strokeWidth={2} />)}</AreaChart> : <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={tick} minTickGap={24} /><YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} /><Tooltip content={<NorthChartTooltip labelFormat={(label) => tick(label)} />} />{series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color ?? PALETTE[index % PALETTE.length]} strokeWidth={2} dot={false} />)}</LineChart>}</ResponsiveContainer></div>}</ChartState>;
}

/** Two numeric measures against each other (one point per row). Non-numeric rows are skipped, never plotted as zero. */
export function AnalyticsScatterChart({ result, xKey, yKey, xLabel, yLabel, sizeKey, height = 240 }: { result: AnalyticsResult; xKey: string; yKey: string; xLabel?: string; yLabel?: string; sizeKey?: string; height?: number }) {
  const { t } = useI18n();
  const fill = useCellFill();
  return <ResultState result={result}>{(data) => {
    const points = data.rows.flatMap((row) => { const x = number(row[xKey]); const y = number(row[yKey]); return x === null || y === null ? [] : [{ ...row, [xKey]: x, [yKey]: y }]; });
    if (!points.length) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.noNumericValues')}</div>;
    return <div style={sized(fill, height)}><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 8, right: 8, left: -4, bottom: 0 }}><CartesianGrid {...GRID} /><XAxis type="number" dataKey={xKey} name={xLabel ?? xKey} tick={AXIS_TICK} tickLine={false} axisLine={false} /><YAxis type="number" dataKey={yKey} name={yLabel ?? yKey} tick={AXIS_TICK} tickLine={false} axisLine={false} />{sizeKey ? <ZAxis type="number" dataKey={sizeKey} range={[30, 220]} /> : <ZAxis range={[60, 60]} />}<Tooltip cursor={{ strokeDasharray: '3 3' }} content={<NorthChartTooltip />} /><Scatter data={points} fill={PALETTE[0]} fillOpacity={0.75} /></ScatterChart></ResponsiveContainer></div>;
  }}</ResultState>;
}

export function AnalyticsDonutChart({ result, categoryKey, valueKey, variant = 'donut', color, height = 240, centerLabel, showTotal = false, legend = 'none', maxSlices, total: totalOverride, onSelect, selected = [] }: { result: AnalyticsResult; categoryKey: string; valueKey: string; variant?: 'donut' | 'pie'; color?: string; height?: number; centerLabel?: string; showTotal?: boolean; legend?: 'right' | 'bottom' | 'none'; maxSlices?: number; total?: number | null; onSelect?: (category: string) => void; selected?: string[] }) {
  const { t, locale } = useI18n();
  const fill = useCellFill();
  const [ringBox, ring] = useElementSize<HTMLDivElement>();
  const [rootBox, root] = useElementSize<HTMLDivElement>();
  // A legend configured at the bottom moves to the right (with counts) whenever the cell is wide enough for it.
  const side = legend === 'bottom' && root.width >= 340 ? 'right' : legend;
  return <ResultState result={result}>{(data) => {
    const numeric = data.rows.filter((row) => number(row[valueKey]) !== null);
    if (!numeric.length) return <div role="status" className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-text-muted">{t('analytics.noNumericValues')}</div>;
    // Beyond `maxSlices` the remaining groups are summed into one "Others" slice (their own values, nothing estimated).
    const sorted = [...numeric].sort((a, b) => (number(b[valueKey]) ?? 0) - (number(a[valueKey]) ?? 0));
    const rows = maxSlices && sorted.length > maxSlices ? [...sorted.slice(0, maxSlices - 1), { [categoryKey]: t('analytics.others'), [valueKey]: sorted.slice(maxSlices - 1).reduce((sum, row) => sum + (number(row[valueKey]) ?? 0), 0) }] : numeric;
    // Percentages and the centre use the page's own unique total when one is bound (a container never counts twice).
    const total = totalOverride && totalOverride > 0 ? totalOverride : rows.reduce((sum, row) => sum + (number(row[valueKey]) ?? 0), 0);
    const sliceFill = (index: number) => (index === 0 && color ? color : PALETTE[index % PALETTE.length]);
    const percent = (value: number) => `${new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(total ? (value / total) * 100 : 0)}%`;
    return (
      <div ref={rootBox} className={`flex ${side === 'bottom' ? 'flex-col' : 'flex-row items-center'} min-h-0 gap-3 ${fill ? 'overflow-hidden' : ''}`} style={fill ? { height: '100%' } : { minHeight: height }}>
        <div ref={ringBox} className="relative min-h-0 min-w-0 flex-1 self-stretch" style={sized(fill, height)}>
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} nameKey={categoryKey} dataKey={valueKey} innerRadius={variant === 'donut' ? '62%' : 0} outerRadius="88%" paddingAngle={variant === 'donut' ? 1.5 : 0} stroke="none" isAnimationActive={false} cursor={onSelect ? 'pointer' : undefined} onClick={onSelect ? (entry: unknown) => { const name = (entry as { name?: unknown } | null)?.name; if (typeof name === 'string' && name !== t('analytics.others')) onSelect(name); } : undefined}>{rows.map((row, index) => <Cell key={`${String(row[categoryKey])}-${index}`} fill={sliceFill(index)} fillOpacity={selected.length && !selected.includes(String(row[categoryKey])) ? 0.3 : 1} />)}</Pie><Tooltip content={<NorthChartTooltip />} /></PieChart></ResponsiveContainer>
          {variant === 'donut' && (showTotal || centerLabel) ? (() => {
            // The ring's hole is ~62 % of min(width, height): the figure and label must fit inside it, so they scale with it and the label is dropped when it cannot be read.
            const hole = Math.min(ring.width, ring.height || ring.width) * 0.88 * 0.62;
            const figure = hole > 0 ? Math.max(11, Math.min(18, hole / 5)) : 18;
            return <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{showTotal ? <span className="font-display font-semibold tabular-nums leading-none text-text" style={{ fontSize: figure }}>{new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale, { notation: hole && hole < 70 ? 'compact' : 'standard', maximumFractionDigits: 0 }).format(total)}</span> : null}{centerLabel && hole >= 84 ? <span className="mt-0.5 truncate text-[0.65rem] leading-none text-text-muted" style={{ maxWidth: hole }}>{centerLabel}</span> : null}</div>;
          })() : null}
        </div>
        {side !== 'none' ? (
          <ul className={`flex min-w-0 gap-1.5 text-xs ${side === 'right' ? 'min-h-0 w-[46%] max-w-60 shrink-0 flex-col overflow-hidden' : 'flex-wrap'}`} aria-label={t('analytics.legend')}>
            {(() => {
              // A legend never scrolls: it lists as many entries as the ring's height allows (18 px each) and sums the remainder.
              const capacity = fill && side === 'right' && ring.height > 0 ? Math.max(2, Math.floor(ring.height / 20)) : rows.length;
              if (rows.length <= capacity) return rows;
              const rest = rows.slice(capacity - 1);
              return [...rows.slice(0, capacity - 1), { [categoryKey]: `+${rest.length}`, [valueKey]: rest.reduce((sum, row) => sum + (number(row[valueKey]) ?? 0), 0) }];
            })().map((row, index) => { const name = String(row[categoryKey]); const pickable = Boolean(onSelect) && name !== t('analytics.others') && !/^\+\d+$/.test(name); return <li key={`${name}-${index}`} className={cn('flex min-w-0 items-center gap-2 rounded', pickable && 'cursor-pointer hover:bg-surface-hover', selected.length > 0 && !selected.includes(name) && 'opacity-50')} {...(pickable ? { role: 'button', tabIndex: 0, 'aria-pressed': selected.includes(name), onClick: () => onSelect!(name), onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect!(name); } } } : {})}><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: sliceFill(index) }} /><span className="min-w-0 flex-1 truncate text-text-secondary" title={String(row[categoryKey])}>{String(row[categoryKey])}</span><span className="shrink-0 tabular-nums font-medium text-text">{percent(number(row[valueKey]) ?? 0)}</span>{side === 'right' && root.width >= 340 ? <span className="w-12 shrink-0 text-right tabular-nums text-text-muted">{new Intl.NumberFormat(intlTag(locale)).format(number(row[valueKey]) ?? 0)}</span> : null}</li>; })}
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
