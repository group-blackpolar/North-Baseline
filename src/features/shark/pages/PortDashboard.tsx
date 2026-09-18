import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Ship } from 'lucide-react';
import { DashboardCard, FilterBar, FilterSelect, MetricCard, SimpleTable } from '@/components/dashboard/primitives';
import { sharkService } from '../data/service';
import { CARRIERS, PORTS, YEARS } from '../data/mocks';
import type { PortFilters } from '../data/type';

const CHART_COLORS = ['#3ECFBA', '#60A5FA', '#FBBF24', '#F87171', '#A78BFA'];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function PortDashboard() {
  const [filters, setFilters] = useState<PortFilters>({ port: 'all', year: '2026', carrier: 'all', month: 'all' });
  const report = useMemo(() => sharkService.portReport(filters), [filters]);
  const set = (patch: Partial<PortFilters>) => setFilters((current: PortFilters) => ({ ...current, ...patch }));

  return (
    <div className="p-6 space-y-4">
      <FilterBar>
        <FilterSelect label="Port" value={filters.port} onChange={(value) => set({ port: value })} options={[{ value: 'all', label: 'All ports' }, ...PORTS.map((port) => ({ value: port, label: port }))]} />
        <FilterSelect label="Year" value={filters.year} onChange={(value) => set({ year: value })} options={[{ value: 'all', label: 'All years' }, ...YEARS.map((year) => ({ value: String(year), label: String(year) }))]} />
        <FilterSelect label="Carrier" value={filters.carrier} onChange={(value) => set({ carrier: value })} options={[{ value: 'all', label: 'All carriers' }, ...CARRIERS.map((carrier) => ({ value: carrier, label: carrier }))]} />
        <FilterSelect label="Month" value={filters.month} onChange={(value) => set({ month: value })} options={[{ value: 'all', label: 'All months' }, ...MONTHS.map((month) => ({ value: String(month), label: String(month) }))]} />
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard label="CONTAINERS" value={report.containers.toLocaleString('en-US')} icon={Ship} />
        <MetricCard label="TEUS" value={report.teus.toLocaleString('en-US')} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DashboardCard title="Monthly volume trend" description="Containers per month for the current selection.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.monthly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--color-text)' }} />
                <Line type="monotone" dataKey="containers" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        <DashboardCard title="Port market share" description="Containers by port of arrival.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byPort} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--color-text)' }} cursor={{ fill: 'var(--color-surface-hover)' }} />
                <Bar dataKey="containers" radius={[6, 6, 0, 0]}>
                  {report.byPort.map((entry: { label: string; containers: number }, index: number) => (
                    <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        <DashboardCard title="Carrier / agency share" description="Distribution by shipping line.">
          <div className="h-56 flex items-center gap-4">
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={report.byCarrier} dataKey="containers" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
                  {report.byCarrier.map((entry: { label: string; containers: number }, index: number) => (
                    <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-1.5">
              {report.byCarrier.map((entry: { label: string; containers: number }, index: number) => (
                <li key={entry.label} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="size-2 rounded-full shrink-0" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="flex-1 truncate">{entry.label}</span>
                  <span className="mono-data">{entry.containers.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          </div>
        </DashboardCard>

        <DashboardCard title="Top consignees" description="Leading importers for the current selection.">
          <SimpleTable
            columns={['Consignee', 'Containers', 'TEUs', 'Share']}
            rows={report.topConsignees.map((entry: { label: string; containers: number; teus: number; share: number }) => [
              entry.label,
              entry.containers.toLocaleString('en-US'),
              entry.teus.toLocaleString('en-US'),
              `${(entry.share * 100).toFixed(1)}%`,
            ])}
          />
        </DashboardCard>
      </div>
    </div>
  );
}