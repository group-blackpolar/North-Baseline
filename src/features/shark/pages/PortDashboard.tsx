import { useMemo, useState } from 'react';
import { Boat, Package } from '@phosphor-icons/react';
import { DashboardCard, FilterBar, FilterSelect, MetricCard, SimpleTable } from '@/components/dashboard/primitives';
import { GroupedBarChart, ShareDonut, TrendLineChart, formatNumber, yearSeries } from '@/components/dashboard/charts';
import { sharkService } from '../data/service';
import { EMPTY_FILTERS, type SharkFilters } from '../data/types';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function PortDashboard() {
  const [filters, setFilters] = useState<SharkFilters>({ ...EMPTY_FILTERS, year: '2026' });
  const report = useMemo(() => sharkService.portReport(filters), [filters]);
  const { options } = sharkService;

  const set = (patch: Partial<SharkFilters>) => setFilters((current) => ({ ...current, ...patch }));

  // Serie del trend: 3 años si no hay año filtrado, solo el año elegido si lo hay
  const trendSeries = filters.year === 'all' ? yearSeries(options.years) : yearSeries([filters.year]);

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
          label="Year"
          value={filters.year}
          onChange={(value) => set({ year: value })}
          options={[{ value: 'all', label: 'All years' }, ...options.years.map((y) => ({ value: String(y), label: String(y) }))]}
        />
        <FilterSelect
          label="Month"
          value={filters.month}
          onChange={(value) => set({ month: value })}
          options={[{ value: 'all', label: 'All months' }, ...MONTHS.map((m) => ({ value: String(m), label: String(m) }))]}
        />
        <FilterSelect
          label="Carrier"
          value={filters.carrier}
          onChange={(value) => set({ carrier: value })}
          options={[{ value: 'all', label: 'All carriers' }, ...options.carriers.map((c) => ({ value: c, label: c }))]}
        />
      </FilterBar>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard label="CONTAINERS" value={formatNumber(report.containers)} icon={Package} />
        <MetricCard label="TEUS" value={formatNumber(report.teus)} icon={Boat} />
      </div>

      {/* Visualizaciones */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DashboardCard title="Monthly volume trend" description="Containers per month, series by year.">
          <TrendLineChart data={report.monthlyByYear} series={trendSeries} />
        </DashboardCard>

        <DashboardCard title="Port market share" description="Containers by port of arrival.">
          <GroupedBarChart data={report.byPort} series={[{ key: 'containers' }]} />
        </DashboardCard>

        <DashboardCard title="Line / agency share" description="Distribution by shipping line.">
          <ShareDonut data={report.byCarrier} />
        </DashboardCard>

        <DashboardCard title="Country of origin" description="Top origin countries (replaces legacy map).">
          <GroupedBarChart data={report.byCountry} series={[{ key: 'containers' }]} horizontal />
        </DashboardCard>

        <DashboardCard title="Top consignees" description="Leading importers for the current selection." className="xl:col-span-2">
          <SimpleTable
            columns={['Consignee', 'Containers', 'TEUs', 'Share']}
            rows={report.topConsignees.map((entry) => [
              entry.label,
              formatNumber(entry.containers),
              formatNumber(entry.teus),
              `${(entry.share * 100).toFixed(1)}%`,
            ])}
          />
        </DashboardCard>
      </div>
    </div>
  );
}