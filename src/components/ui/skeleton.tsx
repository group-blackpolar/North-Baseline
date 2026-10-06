import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-active', className)} />;
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
