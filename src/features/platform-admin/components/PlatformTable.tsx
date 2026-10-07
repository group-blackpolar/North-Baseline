import type { ReactNode } from 'react';
import { Tray } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { DelayedSkeleton, SkeletonAdminCard, SkeletonTable } from '@/components/ui/skeleton';
import { useShellMode } from '@/lib/responsive';
import { useI18n } from '@/lib/i18n';

export type PlatformColumn<Row> = {
  key: string;
  header: string;
  render?: (row: Row) => ReactNode;
  className?: string;
};

/** Custom renderer, else the row's own field (columns such as `email` have no renderer). */
function cell<Row>(column: PlatformColumn<Row>, row: Row): ReactNode {
  if (column.render) return column.render(row);
  const value = (row as Record<string, unknown>)[column.key];
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

export type PlatformTableProps<Row> = {
  columns: PlatformColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  loading: boolean;
  error?: ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  label?: string;
};

/** Shared table primitive for platform listings (§20).
 *
 * It owns only presentational concerns — loading, error, empty and cursor
 * pagination — while column definitions stay domain-specific. Row selection is
 * deliberately absent until a screen actually needs it. */
export function PlatformTable<Row>({
  columns,
  rows,
  getRowKey,
  loading,
  error,
  emptyTitle,
  emptyBody,
  hasMore,
  loadingMore,
  onLoadMore,
  label,
}: PlatformTableProps<Row>) {
  const { t } = useI18n();

  const phone = useShellMode() === 'phone';

  if (error) return <>{error}</>;
  // First load (nothing to show yet): real-shape skeleton, only if it lasts. Reloads keep the current rows.
  if (loading && rows.length === 0) {
    return (
      <DelayedSkeleton
        loading
        minHeight={phone ? 220 : 260}
        fallback={phone ? <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonAdminCard key={i} lines={4} />)}</div> : <SkeletonTable rows={6} columns={columns.length} />}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Tray}
        title={emptyTitle ?? t('pa.table.emptyTitle')}
        body={emptyBody ?? t('pa.table.emptyBody')}
      />
    );
  }

  return (
    <div className={cn('np-fade-in space-y-3 transition-opacity duration-(--duration-fast)', loading && 'opacity-60')} aria-busy={loading || undefined}>
      <ResponsiveList items={rows} getKey={getRowKey}
        renderCard={(row, index) => (
          <div className="np-card np-stagger space-y-1.5 p-3" style={{ '--i': index } as React.CSSProperties}>
            {columns.map((column, index) => (index === 0
              ? <div key={column.key} className="text-sm font-medium text-text">{cell(column, row)}</div>
              : (
                <div key={column.key} className="flex items-start justify-between gap-3 text-xs">
                  <span className="shrink-0 text-text-muted">{column.header}</span>
                  <span className="min-w-0 text-right text-text-secondary">{cell(column, row)}</span>
                </div>
              )))}
          </div>
        )}
        table={(
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-105">
            <caption className="sr-only">{label}</caption>
            <thead className="bg-surface-hover/60">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="text-left ui-label px-3 py-2 whitespace-nowrap">
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={getRowKey(row)} className="border-t border-border/60 hover:bg-surface-hover/50 transition-colors duration-(--duration-fast)">
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-3 py-2 align-top',
                        column.className ?? (index === 0 ? 'text-text font-medium' : 'mono-data text-text-secondary')
                      )}
                    >
                      {cell(column, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )} />
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover disabled:opacity-50"
        >
          {loadingMore ? t('pa.table.loadingMore') : t('pa.table.loadMore')}
        </button>
      )}
    </div>
  );
}
