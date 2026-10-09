import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DataGridPro } from './DataGridPro';
import { InsightCards } from './InsightCards';
import { KpiCardPro } from './KpiCardPro';

// The map pulls in the world outline (~55 kB): load it only on pages that contain one.
const GeoBubbleMap = lazy(() => import('./GeoBubbleMap'));

/** Component types that read one or more NAMED bindings (`data`, `total`, `trend`...) and draw themselves. */
export const PRO_TYPES: ReadonlySet<string> = new Set(['kpi_card', 'data_grid', 'geo_map', 'insights']);

export type ProComponentModel = { id: string; type: string; props: Record<string, unknown>; bindings?: Record<string, unknown> };

/** The single renderer for analytics components: the published page and the Studio preview both render through it. */
export function ProComponent({ component, panelKey, locales }: { component: ProComponentModel; panelKey: string; locales: string[] }) {
  const bindings = component.bindings ?? {};
  if (component.type === 'kpi_card') return <KpiCardPro props={component.props} bindings={bindings} locales={locales} />;
  if (component.type === 'data_grid') return <DataGridPro componentId={component.id} panelKey={panelKey} props={component.props} bindings={bindings} locales={locales} />;
  if (component.type === 'insights') return <InsightCards props={component.props} bindings={bindings} locales={locales} />;
  if (component.type === 'geo_map') return <Suspense fallback={<Skeleton className="h-full min-h-40 w-full" />}><GeoBubbleMap props={component.props} bindings={bindings} locales={locales} /></Suspense>;
  return null;
}
