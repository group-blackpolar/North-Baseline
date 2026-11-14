import { lazy, Suspense, type ComponentType } from 'react';
import { SkeletonChart } from '@/components/ui/skeleton';

/**
 * RM-071: Recharts is ~300 kB; the visuals load on first use instead of weighing on the initial bundle.
 * Same exports and props as before: only the chunk they live in changed.
 */
type Charts = typeof import('./AnalyticsCharts');

function defer<K extends keyof Charts>(name: K) {
  type Props = Charts[K] extends (props: infer P) => unknown ? P : never;
  const Lazy = lazy(() => import('./AnalyticsCharts').then((module) => ({ default: module[name] as unknown as ComponentType<Props> })));
  return function Deferred(props: Props) {
    return <Suspense fallback={<SkeletonChart height={160} />}><Lazy {...(props as Props & object)} /></Suspense>;
  };
}

export const AnalyticsKpi = defer('AnalyticsKpi');
export const AnalyticsDataGrid = defer('AnalyticsDataGrid');
export const AnalyticsBarChart = defer('AnalyticsBarChart');
export const AnalyticsLineAreaChart = defer('AnalyticsLineAreaChart');
export const AnalyticsDonutChart = defer('AnalyticsDonutChart');
export const AnalyticsScatterChart = defer('AnalyticsScatterChart');
export const AnalyticsFilterControls = defer('AnalyticsFilterControls');
