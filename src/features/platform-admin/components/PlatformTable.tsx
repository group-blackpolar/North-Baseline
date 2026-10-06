import type { ReactNode } from 'react';
import { Tray } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';

export type PlatformColumn<Row> = {
  key: string;
  header: string;
  render?: (row: Row) => ReactNode;
  className?: string;
};

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

  if (error) return <>{error}</>;
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-lg" />
        ))}
      </div>
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
    <div className="space-y-3">
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
                    {column.render ? column.render(row) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
