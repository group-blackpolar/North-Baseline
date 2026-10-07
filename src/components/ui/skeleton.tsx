import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useDelayedFlag } from '@/lib/useDelayedFlag';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-active', className)} style={style} />;
}
/** Placeholder for list/table bodies; keeps layout height while data loads (no global spinners). */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

export const SkeletonCard = ({ className }: { className?: string }) => <Skeleton className={cn('h-28 rounded-xl', className)} />;

/**
 * Shows `fallback` only when `loading` lasts longer than `delay`. Until then (and for fast responses) it renders an
 * empty box of `minHeight` so the layout does not jump, and never a skeleton flash.
 */
export function DelayedSkeleton({ loading, fallback, minHeight = 0, delay = 150, children }: { loading: boolean; fallback: ReactNode; minHeight?: number; delay?: number; children?: ReactNode }) {
  const show = useDelayedFlag(loading, delay);
  if (!loading && !show) return <>{children}</>;
  if (show) return <div className="np-fade-in" aria-busy="true">{fallback}</div>;
  return <div aria-busy="true" style={{ minHeight }} />;
}

/* Real-shape skeletons: roughly the final height of what they stand in for, to avoid layout shift. */

export const SkeletonMetricCard = () => (
  <div className="np-card flex items-start justify-between gap-3 p-4" aria-hidden="true">
    <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-28" /></div>
    <Skeleton className="size-9 rounded-lg" />
  </div>
);

/** Formas list row/card: reference + status, client, date + total. */
export const SkeletonDocumentCard = () => (
  <div className="np-card space-y-2 p-3" aria-hidden="true">
    <div className="flex items-center justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div>
    <Skeleton className="h-4 w-2/3" />
    <div className="flex items-center justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div>
  </div>
);

/** Administration record: title + subtitle and a few label/value lines. */
export const SkeletonAdminCard = ({ lines = 3 }: { lines?: number }) => (
  <div className="np-card space-y-2 p-3" aria-hidden="true">
    <Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" />
    {Array.from({ length: lines }, (_, i) => <div key={i} className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-24" /></div>)}
  </div>
);

export const SkeletonTable = ({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) => (
  <div className="overflow-hidden rounded-lg border border-border" aria-hidden="true">
    <div className="flex gap-4 border-b border-border bg-surface-hover/60 px-3 py-2.5">{Array.from({ length: columns }, (_, i) => <Skeleton key={i} className="h-3 flex-1" />)}</div>
    {Array.from({ length: rows }, (_, r) => <div key={r} className="flex gap-4 border-t border-border/60 px-3 py-3 first:border-t-0">{Array.from({ length: columns }, (_, i) => <Skeleton key={i} className={i === 0 ? 'h-4 flex-1' : 'h-3 flex-1'} />)}</div>)}
  </div>
);

export const SkeletonChart = ({ height = 224 }: { height?: number }) => (
  <div className="flex items-end gap-2 rounded-lg px-1" style={{ height }} aria-hidden="true">
    {[40, 65, 50, 80, 55, 70, 45, 60].map((h, i) => <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />)}
  </div>
);

export const SkeletonDocumentDetail = () => (
  <div className="space-y-4" aria-hidden="true">
    <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-7 w-40" /><Skeleton className="h-3 w-48" /></div>
    <Skeleton className="h-10 w-full rounded-lg" />
    <div className="np-card space-y-2 p-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-2/3" /></div>
    <div className="np-card space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="flex justify-between gap-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-20" /></div>)}</div>
  </div>
);

/** Content area of the workspace while the organization's navigation loads (org switch / first load). */
export const WorkspaceSkeleton = () => (
  <div className="space-y-4 p-4 md:p-6" aria-hidden="true">
    <Skeleton className="h-7 w-48" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonMetricCard key={i} />)}</div>
    <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonDocumentCard key={i} />)}</div>
  </div>
);
