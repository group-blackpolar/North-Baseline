import { CalendarDays, Database, Globe2, Layers } from 'lucide-react';
import { useTabs } from '@/context/TabsContext';
import { DashboardCard, MetricCard } from '@/components/dashboard/primitives';
import { SHARK_RECORDS } from '../data/mocks';

export function ReportInfo() {
  const { navigate } = useTabs();
  const containers = SHARK_RECORDS.reduce((sum, row) => sum + row.containers, 0);
  const sections = [
    { sub: 'port', title: 'Port', body: 'Arrival ports, carriers and monthly volume.' },
    { sub: 'year-comparison', title: 'Year Comparison', body: '2024 vs 2025 vs 2026 side by side.' },
    { sub: 'consignee-details', title: 'Consignee Details', body: 'Deep dive per importing company.' },
    { sub: 'origin-port-detail', title: 'Origin Port Detail', body: 'Countries and departure ports hierarchy.' },
  ];
  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Maritime Imports</h1>
        <p className="text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
          Containerized import activity received through Panama's main ports: volumes, consignees,
          origin markets and port performance, updated monthly.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="CONTAINERS (DATASET)" value={containers.toLocaleString('en-US')} icon={Layers} />
        <MetricCard label="COVERAGE" value="2024 – 2026" icon={Globe2} />
        <MetricCard label="LAST UPDATE" value="Sep 2026" icon={CalendarDays} />
      </div>
      <DashboardCard title="Dataset information" description="Source: Panama maritime import records (demo dataset).">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="ui-label pb-1">SCOPE</dt>
            <dd className="text-text-secondary">
              Container arrivals, TEUs, consignees, carriers, origin country and departure port.
            </dd>
          </div>
          <div>
            <dt className="ui-label pb-1">GRAIN</dt>
            <dd className="mono-data text-text-secondary">month × port × carrier × consignee</dd>
          </div>
        </dl>
      </DashboardCard>
      <section className="space-y-3">
        <h2 className="ui-label">Quick navigation</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map((section) => (
            <button
              key={section.sub}
              type="button"
              className="np-card p-4 text-left hover:bg-surface-hover transition-colors duration-150"
              onClick={() => navigate('master-house', section.sub)}
            >
              <p className="text-sm font-semibold text-text flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-accent" />
                {section.title}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">{section.body}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}