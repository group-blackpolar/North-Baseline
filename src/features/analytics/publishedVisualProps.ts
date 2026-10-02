import type { AnalyticsSeries } from './types';

type Props = Record<string, unknown>;

export type PublishedBarChartProps = {
  categoryKey: string;
  series: AnalyticsSeries[];
  horizontal: boolean;
  height: number;
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
  height: number;
};

function knownKey(value: unknown, availableKeys: ReadonlySet<string>): string | null {
  return typeof value === 'string' && availableKeys.has(value) ? value : null;
}

function height(value: unknown): number | null {
  if (value === undefined) return 240;
  return typeof value === 'number' && Number.isFinite(value) && value >= 120 && value <= 600 ? Math.round(value) : null;
}

function color(value: unknown): string | undefined {
  // Keep published JSON from supplying arbitrary CSS expressions. The chart
  // primitives provide their own palette whenever the optional color is absent.
  if (typeof value !== 'string') return undefined;
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^var\(--[a-z0-9-]+\)$/i.test(value) ? value : undefined;
}

function series(value: unknown, availableKeys: ReadonlySet<string>): AnalyticsSeries[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Props;
    const key = knownKey(record.key, availableKeys);
    if (!key || typeof record.label !== 'string' || !record.label.trim()) return null;
    return { key, label: record.label, ...(color(record.color) ? { color: color(record.color) } : {}) };
  });
  if (parsed.some((item) => item === null)) return null;
  const result = parsed as AnalyticsSeries[];
  return new Set(result.map((item) => item.key)).size === result.length ? result : null;
}

export function publishedMetricField(props: Props, availableKeys: ReadonlySet<string>): string | null {
  return knownKey(props.fieldKey, availableKeys);
}

export function publishedBarChartProps(props: Props, availableKeys: ReadonlySet<string>): PublishedBarChartProps | null {
  const categoryKey = knownKey(props.categoryKey, availableKeys);
  const configuredSeries = series(props.series, availableKeys);
  const configuredHeight = height(props.height);
  if (!categoryKey || !configuredSeries || configuredHeight === null || (props.horizontal !== undefined && typeof props.horizontal !== 'boolean')) return null;
  return { categoryKey, series: configuredSeries, horizontal: props.horizontal === true, height: configuredHeight };
}

export function publishedLineChartProps(props: Props, availableKeys: ReadonlySet<string>): PublishedLineChartProps | null {
  const categoryKey = knownKey(props.categoryKey, availableKeys);
  const configuredSeries = series(props.series, availableKeys);
  const configuredHeight = height(props.height);
  const variant = props.variant === undefined ? 'line' : props.variant;
  if (!categoryKey || !configuredSeries || configuredHeight === null || (variant !== 'line' && variant !== 'area')) return null;
  return { categoryKey, series: configuredSeries, variant, height: configuredHeight };
}

export function publishedDonutChartProps(props: Props, availableKeys: ReadonlySet<string>): PublishedDonutChartProps | null {
  const categoryKey = knownKey(props.categoryKey, availableKeys);
  const valueKey = knownKey(props.valueKey, availableKeys);
  const configuredHeight = height(props.height);
  return categoryKey && valueKey && configuredHeight !== null ? { categoryKey, valueKey, height: configuredHeight } : null;
}
