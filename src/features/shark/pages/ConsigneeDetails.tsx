import { useMemo, useState } from 'react';
import { Container, Ship } from 'lucide-react';
import { DashboardCard, FilterBar, FilterSelect, MetricCard, SimpleTable } from '@/components/dashboard/primitives';
import { GroupedBarChart, ShareDonut, TrendLineChart, formatNumber, yearSeries } from '@/components/dashboard/charts';
import { sharkService } from '../data/service';
import { EMPTY_FILTERS, type SharkFilters } from '../data/types';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function ConsigneeDetails() {
  const { options } = sharkService;
  const [filters, setFilters] = useState<SharkFilters>({
    ...EMPTY_FILTERS,
    consignee: options.consignees[0],
    year: '2026',
  });
  const report = useMemo(() => sharkService.consigneeReport(filters), [filters]);

  const set = (patch: Partial<SharkFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const trendSeries = filters.year === 'all' ? yearSeries(options.years) : yearSeries([filters.year]);

  return (
    <div className="p-6 space-y-4">
      {/* Header del consignee activo */}
      <div>
        <h1 className="text-xl font-display font-bold text-text">
          {filters.consignee === 'all' ? 'All consignees' : filters.consignee}
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Distribution across entry ports, shipping lines, origin countries and months.
        </p>
      </div>

      {/* Filtros */}
      <FilterBar>
        <FilterSelect
          label="Consignee"
          value={filters.consignee}
          onChange={(value) => set({ consignee: value })}
          options={[{ value: 'all', label: 'All consignees' }, ...options.consignees.map((c) => ({ value: c, label: c }))]}
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
      </FilterBar>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard label="CONTAINERS" value={formatNumber(report.containers)} icon={Container} />
        <MetricCard label="TEUS" value={formatNumber(report.teus)} icon={Ship} />
      </div>

      {/* Visualizaciones */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DashboardCard title="Containers by entry port" description="Where this consignee's cargo arrives.">
          <GroupedBarChart data={report.byEntryPort} series={[{ key: 'containers' }]} />
        </DashboardCard>

        <DashboardCard title="Containers by line / agency" description="Shipping line distribution.">
          <ShareDonut data={report.byLine} />
        </DashboardCard>

        <DashboardCard title="Containers by month" description="Monthly evolution for the selection.">
          <TrendLineChart data={report.byMonth} series={trendSeries} />
        </DashboardCard>

        <DashboardCard title="Containers by country of origin" description="Top origin countries.">
          <GroupedBarChart data={report.byCountry} series={[{ key: 'containers' }]} horizontal />
        </DashboardCard>

        <DashboardCard
          title="Origin drill-down"
          description="Country of origin → containers (departure port detail coming next)."
          className="xl:col-span-2"
        >
          <SimpleTable
            columns={['Country of Origin', 'Containers', 'TEUs', 'Share']}
            rows={report.byCountry.map((entry) => [
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