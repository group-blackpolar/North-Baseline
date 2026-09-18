import { useMemo } from 'react';
import { ArrowUpRight, CalendarDays, Database, Globe2, Layers, Waves } from 'lucide-react';
import { useTabs } from '@/context/TabsContext';
import { DashboardCard, MetricCard } from '@/components/dashboard/primitives';
import { compact } from '@/components/dashboard/charts';
import { sharkService } from '../data/service';
import { EMPTY_FILTERS } from '../data/types';

const SECTIONS = [
  { sub: 'port', title: 'Port', body: 'Filter by year and port of entry: top consignees, origin countries, line/agency share and monthly trend.' },
  { sub: 'year-comparison', title: 'Year Comparison', body: 'Compare 2024 vs 2025 vs 2026 across ports, months and origin regions.' },
  { sub: 'consignee-details', title: 'Consignee Details', body: 'Distribution per importing company: entry port, line/agency, origin and month.' },
  { sub: 'consignees-by-port', title: 'Consignees by Port', body: 'Consignee × port of entry matrix with yearly volumes.' },
  { sub: 'origin-port-detail', title: 'Origin Port Detail', body: 'Country → departure port → consignee hierarchy.' },
];

export function ReportInfo() {
  const { navigate } = useTabs();
  const dataset = useMemo(() => sharkService.portReport(EMPTY_FILTERS), []);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-text text-background flex items-center justify-center shadow-soft">
          <Waves className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Maritime Imports</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Containerized imports received through Panama's container ports, as declared to the Customs Authority.
          </p>
        </div>
      </header>

      {/* Callout */}
      <div className="np-card px-4 py-3 border-l-2 border-l-accent">
        <p className="text-sm text-text-secondary leading-relaxed">
          Covers consignees handling at least <span className="font-semibold text-text">100 containers per year</span> in Panama.
          All volume metrics are presented in container counts, updated through <span className="font-semibold text-text">June 2026</span>.
        </p>
      </div>

      {/* KPIs del dataset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="CONTAINERS" value={compact(dataset.containers)} icon={Layers} />
        <MetricCard label="TEUS" value={compact(dataset.teus)} icon={Database} />
        <MetricCard label="COVERAGE" value="2024 – 2026" icon={Globe2} />
        <MetricCard label="LAST UPDATE" value="Jun 2026" icon={CalendarDays} />
      </div>

      {/* Dataset information */}
      <DashboardCard title="Dataset information" description="Source: Panama maritime import records (demo dataset).">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="ui-label pb-1">SCOPE</dt>
            <dd className="text-text-secondary">Container arrivals, TEUs, consignees, carriers, origin country and departure port.</dd>
          </div>
          <div>
            <dt className="ui-label pb-1">GRAIN</dt>
            <dd className="mono-data text-text-secondary">month × port × carrier × consignee</dd>
          </div>
          <div>
            <dt className="ui-label pb-1">THRESHOLD</dt>
            <dd className="text-text-secondary">Consignees with 100+ containers/year.</dd>
          </div>
        </dl>
      </DashboardCard>

      {/* Quick navigation */}
      <section className="space-y-3">
        <h2 className="ui-label">Report navigation</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTIONS.map((section) => (
            <button
              key={section.sub}
              type="button"
              className="np-card p-4 text-left group hover:bg-surface-hover transition-colors duration-150"
              onClick={() => navigate('master-house', section.sub)}
            >
              <p className="text-sm font-semibold text-text flex items-center gap-1.5">
                {section.title}
                <ArrowUpRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
              </p>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{section.body}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}