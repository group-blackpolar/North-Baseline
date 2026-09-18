import {
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
import type { AggEntry, SeriesRow } from '@/features/shark/data/types';

/** Wrappers reutilizables de recharts con el lenguaje visual de NORTH.
 *  Todas las vistas SHARK (y futuras) consumen estos componentes, no recharts directo. */

const AXIS_TICK = { fontSize: 10, fill: 'var(--color-text-muted)' };
const TOOLTIP_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  fontSize: 12,
};

/** Colores por año: el año vigente resalta con accent. */
export const SERIES_COLORS: Record<string, string> = {
  '2024': 'var(--color-text-muted)',
  '2025': '#60A5FA',
  '2026': 'var(--color-accent)',
};

export const CHART_PALETTE = [
  'var(--color-accent)',
  '#60A5FA',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#34D399',
  '#F472B6',
  '#94A3B8',
];

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export interface SeriesDef {
  key: string;
  color?: string;
}

export function yearSeries(years: Array<number | string>): SeriesDef[] {
  return years.map((year) => ({ key: String(year), color: SERIES_COLORS[String(year)] }));
}

/** Líneas multi-serie (tendencia mensual por año). */
export function TrendLineChart({
  data,
  series,
  height = 224,
}: {
  data: SeriesRow[];
  series: SeriesDef[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'var(--color-text)' }}
            formatter={(value) => [formatNumber(Number(value)), undefined]}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color ?? SERIES_COLORS[s.key] ?? 'var(--color-accent)'}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras agrupadas. `horizontal` = ranking (layout vertical). */
export function GroupedBarChart({
  data,
  series,
  height = 224,
  horizontal = false,
}: {
  data: SeriesRow[];
  series: SeriesDef[];
  height?: number;
  horizontal?: boolean;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, left: horizontal ? 8 : -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={!horizontal} horizontal={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} />
              <YAxis type="category" dataKey="label" width={120} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} />
            </>
          )}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'var(--color-text)' }}
            cursor={{ fill: 'var(--color-surface-hover)' }}
            formatter={(value) => [formatNumber(Number(value)), undefined]}
          />
          {series.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={s.color ?? CHART_PALETTE[index % CHART_PALETTE.length]}
              radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
              maxBarSize={horizontal ? 14 : 32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut de participación con leyenda lateral (reemplaza donuts flotantes legacy). */
export function ShareDonut({ data, height = 224 }: { data: AggEntry[]; height?: number }) {
  const total = data.reduce((sum, entry) => sum + entry.containers, 0) || 1;
  return (
    <div className="flex items-center gap-4" style={{ height }}>
      <div className="w-[55%] h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="containers" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatNumber(Number(value)), undefined]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5 overflow-y-auto max-h-full">
        {data.map((entry, index) => (
          <li key={entry.label} className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="size-2 rounded-full shrink-0" style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }} />
            <span className="flex-1 truncate" title={entry.label}>{entry.label}</span>
            <span className="mono-data">{((entry.containers / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}