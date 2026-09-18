import { ArrowUpRight, Construction, GitCompare, MapPin, Ship, Users } from 'lucide-react';
import { useTabs } from '@/context/TabsContext';
import type { TabRoute } from '@/context/TabsContext';
import { EmptyState } from '@/components/ui/empty-state';
import { ReportInfo } from './pages/ReportInfo';
import { PortDashboard } from './pages/PortDashboard';
import { YearComparison } from './pages/YearComparison';
import { ConsigneeDetails } from './pages/ConsigneeDetails';

const QUICK_ACCESS = [
  { sub: 'report-info', icon: MapPin, title: 'Report Info', body: 'Dataset scope, coverage and navigation guide.' },
  { sub: 'port', icon: Ship, title: 'Port Analysis', body: "Container movements across Panama's main ports." },
  { sub: 'year-comparison', icon: GitCompare, title: 'Year Comparison', body: 'Compare maritime import activity across multiple years.' },
  { sub: 'consignee-details', icon: Users, title: 'Consignee Details', body: 'Explore individual consignee activity and distribution.' },
];

/** Home de SHARK: presentación + quick access a Master House. */
function SharkHome() {
  const { navigate } = useTabs();
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-text text-background flex items-center justify-center font-display text-xl font-bold shadow-soft">
          S
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-text">SHARK</h1>
          <p className="text-sm text-text-secondary">Maritime Imports Intelligence</p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="ui-label">Quick access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_ACCESS.map((card) => (
            <button
              key={card.sub}
              type="button"
              className="np-card p-4 text-left group hover:bg-surface-hover transition-colors duration-150"
              onClick={() => navigate('master-house', card.sub)}
            >
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
                  <card.icon className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text flex items-center gap-1.5">
                    {card.title}
                    <ArrowUpRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{card.body}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Secciones de Master House aún no construidas. */
const PENDING: Record<string, string> = {
  'consignees-by-port': 'Consignees by Port',
  'origin-port-detail': 'Origin Port Detail',
  'table-consignees-list': 'Consignees List',
};

export function SharkView({ route }: { route: TabRoute }) {
  if (route.categoryId === 'shark-home') return <SharkHome />;

  switch (route.subcategoryId) {
    case 'report-info':
      return <ReportInfo />;
    case 'port':
      return <PortDashboard />;
    case 'year-comparison':
      return <YearComparison />;
    case 'consignee-details':
      return <ConsigneeDetails />;
    default: {
      const title = PENDING[route.subcategoryId ?? ''] ?? route.subcategoryId ?? 'View';
      return (
        <div className="p-6">
          <EmptyState
            icon={Construction}
            title={`${title} — in progress`}
            body="This Master House section is being prepared for the demo."
            className="max-w-md"
          />
        </div>
      );
    }
  }
}