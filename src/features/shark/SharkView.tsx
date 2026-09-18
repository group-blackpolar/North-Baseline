import type { TabRoute } from '@/context/TabsContext';
import { DashboardCard, MetricCard } from '@/components/dashboard/primitives';

export function SharkView({ route }: { route: TabRoute }) {
  const sub = route.subcategoryId ?? 'overview';

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">SHARK</h1>
        <p className="text-sm text-text-secondary mt-1">{sub === 'intel' ? 'Maritime intelligence overview' : 'Operations dashboard'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Imports" value="128" />
        <MetricCard label="Alerts" value="18" />
        <MetricCard label="Routes" value="24" />
      </div>

      <DashboardCard title="Operational snapshot">
        <ul className="space-y-2 text-sm text-text-secondary">
          <li>• Live vessel watchlist is active.</li>
          <li>• Slippage and route exceptions are being monitored.</li>
          <li>• Performance insights are ready for review.</li>
        </ul>
      </DashboardCard>
    </div>
  );
}
