import { LockKey, WarningCircle } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** 403 from CORECROW: the reader may open the page but not this component's data. Shown as "no permission", never as a failure. */
export const isForbidden = (status?: number) => status === 403;

/** One error / no-permission surface for every analytics component (chart, grid, map, KPI, insights). */
export function ReportError({ status, message, className, onRetry, compact = false }: { status?: number; message?: string; className?: string; onRetry?: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const forbidden = isForbidden(status);
  const Icon = forbidden ? LockKey : WarningCircle;
  return (
    <div role={forbidden ? 'status' : 'alert'} className={cn('flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 text-center text-xs', compact ? 'min-h-16' : 'min-h-32', forbidden ? 'text-text-muted' : 'text-error', className)}>
      <Icon className={compact ? 'size-4 shrink-0' : 'size-5 shrink-0'} aria-hidden="true" />
      <span>{forbidden ? t('analytics.forbidden') : message || t('analytics.error')}</span>
      {onRetry && !forbidden ? <button type="button" className="rounded-md border border-border px-2.5 py-1 font-medium text-text hover:bg-surface-hover" onClick={onRetry}>{t('flt.retry')}</button> : null}
    </div>
  );
}
