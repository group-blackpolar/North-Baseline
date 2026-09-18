import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import type { TabRoute } from '@/context/TabsContext';
import { SharkHome } from './pages/SharkHome';
import { ReportInfo } from './pages/ReportInfo';
import { PortDashboard } from './pages/PortDashboard';

export function SharkView({ route }: { route: TabRoute }) {
  if (route.categoryId === 'shark-home') return <SharkHome />;
  switch (route.subcategoryId) {
    case 'report-info': return <ReportInfo />;
    case 'port': return <PortDashboard />;
    default:
      return (
        <div className="p-6">
          <EmptyState icon={Construction} title="Dashboard in progress" body="This Master House view is being prepared for the demo." className="max-w-md" />
        </div>
      );
  }
}