import type { AnalyticsSeries } from './types';

type Props = Record<string, unknown>;

export type PublishedBarChartProps = {
  categoryKey: string;
  series: AnalyticsSeries[];
  horizontal: boolean;
  stacked: boolean;
  height: number;
  showValues: boolean;
};

export type PublishedLineChartProps = {
  categoryKey: string;
  series: AnalyticsSeries[];
  variant: 'line' | 'area';
  height: number;
};

export type PublishedDonutChartProps = {
  categoryKey: string;
  valueKey: string;
  variant: 'donut' | 'pie';
  color?: string;
  height: number;
  centerLabel?: string;
  showTotal: boolean;
  legend: 'right' | 'bottom' | 'none';
  maxSlices?: number;
  totalKey?: string;
};

function knownKey(value: unknown, availableKeys: ReadonlySet<string>): string | null {
  return typeof value === 'string' && availableKeys.has(value) ? value : null;
}

function height(value: unknown): number | null {
  if (value === undefined) return 240;
  return typeof value === 'number' && Number.isFinite(value) && value >= 160 && value <= 800 ? Math.round(value) : null;
}

function color(value: unknown): string | undefined {
  // Keep published JSON from supplying arbitrary CSS expressions. The chart
  // primitives provide their own palette whenever the optional color is absent.
  if (typeof value !== 'string') return undefined;
  return /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value) ? value : undefined;
}

function localized(value: unknown, locales: string[]): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const labels = value as Record<string, unknown>;
  const match = locales.map((locale) => labels[locale]).find((item) => typeof item === 'string' && item.trim());
  const fallback = match ?? Object.values(labels).find((item) => typeof item === 'string' && item.trim());
  return typeof fallback === 'string' ? fallback : null;
}

function series(value: unknown, availableKeys: ReadonlySet<string>, locales: string[]): AnalyticsSeries[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Props;
    const key = knownKey(record.key, availableKeys);
    const label = localized(record.label, locales);
    if (!key || !label) return null;
    return { key, label, ...(color(record.color) ? { color: color(record.color) } : {}) };
  });
  if (parsed.some((item) => item === null)) return null;
  const result = parsed as AnalyticsSeries[];
  return new Set(result.map((item) => item.key)).size === result.length ? result : null;
}

export function publishedMetricField(props: Props, availableKeys: ReadonlySet<string>): string | null {
  return knownKey(props.fieldKey, availableKeys);
}

export function publishedBarChartProps(props: Props, availableKeys: ReadonlySet<string>, locales: string[]): PublishedBarChartProps | null {
  const categoryKey = knownKey(props.categoryKey, availableKeys);
  const configuredSeries = series(props.series, availableKeys, locales);
  const configuredHeight = height(props.height);
  const variant = props.variant === undefined ? 'grouped' : props.variant;
  if (!categoryKey || !configuredSeries || configuredHeight === null || (props.horizontal !== undefined && typeof props.horizontal !== 'boolean') || (variant !== 'grouped' && variant !== 'stacked')) return null;
  return { categoryKey, series: configuredSeries, horizontal: props.horizontal === true, stacked: variant === 'stacked', height: configuredHeight, showValues: props.showValues === true };
}

export function publishedLineChartProps(props: Props, availableKeys: ReadonlySet<string>, locales: string[]): PublishedLineChartProps | null {
  const categoryKey = knownKey(props.categoryKey, availableKeys);
  const configuredSeries = series(props.series, availableKeys, locales);
  const configuredHeight = height(props.height);
  const variant = props.variant === undefined ? 'line' : props.variant;
  if (!categoryKey || !configuredSeries || configuredHeight === null || (variant !== 'line' && variant !== 'area')) return null;
  return { categoryKey, series: configuredSeries, variant, height: configuredHeight };
}

export function publishedDonutChartProps(props: Props, availableKeys: ReadonlySet<string>, locales: string[] = []): PublishedDonutChartProps | null {
  const categoryKey = knownKey(props.categoryKey, availableKeys);
  const valueKey = knownKey(props.valueKey, availableKeys);
  const configuredHeight = height(props.height);
  const variant = props.variant === undefined ? 'donut' : props.variant;
  const configuredColor = color(props.color);
  return categoryKey && valueKey && configuredHeight !== null && (variant === 'donut' || variant === 'pie')
    ? { categoryKey, valueKey, variant, ...(configuredColor ? { color: configuredColor } : {}), height: configuredHeight, ...(localized(props.centerLabel, locales) ? { centerLabel: localized(props.centerLabel, locales)! } : {}), showTotal: props.showTotal === true, ...(typeof props.maxSlices === 'number' && props.maxSlices >= 2 && props.maxSlices <= 12 ? { maxSlices: Math.round(props.maxSlices) } : {}), ...(typeof props.totalKey === 'string' ? { totalKey: props.totalKey } : {}), legend: props.legend === 'right' || props.legend === 'bottom' ? props.legend : 'none' }
    : null;
}
