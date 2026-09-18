import { useMemo, useState } from 'react';
import { DashboardCard, FilterBar, FilterSelect } from '@/components/dashboard/primitives';
import {
  CHART_PALETTE,
  GroupedBarChart,
  TrendLineChart,
  yearSeries,
  type SeriesDef,
} from '@/components/dashboard/charts';
import { sharkService } from '../data/service';
import { EMPTY_FILTERS, type SharkFilters } from '../data/types';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Leyenda compacta de series (chips de color). */
function SeriesLegend({ series }: { series: SeriesDef[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {series.map((s, index) => (
        <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ background: s.color ?? CHART_PALETTE[index % CHART_PALETTE.length] }}
          />
          <span className="truncate max-w-32" title={s.key}>{s.key}</span>
        </span>
      ))}
    </div>
  );
}

export function YearComparison() {
  const [filters, setFilters] = useState<SharkFilters>({ ...EMPTY_FILTERS });
  const report = useMemo(() => sharkService.yearComparison(filters), [filters]);
  const { options } = sharkService;

  const set = (patch: Partial<SharkFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const portSeries: SeriesDef[] = options.ports.map((port, index) => ({
    key: port,
    color: CHART_PALETTE[index % CHART_PALETTE.length],
  }));
  const yearSeriesDefs = yearSeries(options.years);

  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
      <FilterBar>
        <FilterSelect
          label="Port"
          value={filters.port}
          onChange={(value) => set({ port: value })}
          options={[{ value: 'all', label: 'All ports' }, ...options.ports.map((p) => ({ value: p, label: p }))]}
        />
        <FilterSelect
          label="Consignee"
          value={filters.consignee}
          onChange={(value) => set({ consignee: value })}
          options={[{ value: 'all', label: 'All consignees' }, ...options.consignees.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          label="Carrier"
          value={filters.carrier}
          onChange={(value) => set({ carrier: value })}
          options={[{ value: 'all', label: 'All carriers' }, ...options.carriers.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          label="Month"
          value={filters.month}
          onChange={(value) => set({ month: value })}
          options={[{ value: 'all', label: 'All months' }, ...MONTHS.map((m) => ({ value: String(m), label: String(m) }))]}
        />
      </FilterBar>

      {/* Visualizaciones */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DashboardCard title="Containers by year and port" description="Grouped by entry port per year.">
          <SeriesLegend series={portSeries} />
          <GroupedBarChart data={report.byYearPort} series={portSeries} height={240} />
        </DashboardCard>

        <DashboardCard title="Containers by year" description="Total volume per year.">
          <GroupedBarChart
            data={report.byYear}
            series={[{ key: 'containers', color: 'var(--color-accent)' }]}
            height={240}
          />
        </DashboardCard>

        <DashboardCard title="Containers by month and year" description="Seasonality across years.">
          <SeriesLegend series={yearSeriesDefs} />
          <TrendLineChart data={report.byMonthYear} series={yearSeriesDefs} height={240} />
        </DashboardCard>

        <DashboardCard title="Containers by region and year" description="Top origin countries per year.">
          <SeriesLegend series={yearSeriesDefs} />
          <GroupedBarChart data={report.byRegionYear} series={yearSeriesDefs} horizontal height={280} />
        </DashboardCard>
      </div>
    </div>
  );
}