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
import { AXIS_TICK, CHART_PALETTE, GRID, NorthChartTooltip, compact, formatNumber } from '@/components/charts';
import type { AggEntry, SeriesRow } from '@/features/shark/data/types';

/** Wrappers reutilizables de recharts con el lenguaje visual de NORTH.
 *  Todas las vistas SHARK (y futuras) consumen estos componentes, no recharts directo. */

/** Colores por año: el año vigente resalta con accent. */
export const SERIES_COLORS: Record<string, string> = {
  '2024': 'var(--color-text-muted)',
  '2025': 'var(--chart-2)',
  '2026': 'var(--chart-1)',
};

export { CHART_PALETTE, formatNumber, compact };

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
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} />
          <Tooltip content={<NorthChartTooltip />} />
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
          <CartesianGrid {...GRID} vertical={!horizontal} horizontal={horizontal} />
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
          <Tooltip content={<NorthChartTooltip />} cursor={{ fill: 'var(--color-surface-hover)' }} />
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
            <Tooltip content={<NorthChartTooltip />} />
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