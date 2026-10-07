import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Failed request. `compact` is a non-destructive banner shown above data that is still on screen;
 * the default is a block that stands in for content that could not be loaded. `onRetry` adds a Retry button.
 */
export function ErrorState({ message, onRetry, compact, className }: { message?: string | null; onRetry?: () => void; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={cn(compact ? 'flex flex-wrap items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error' : 'flex flex-col items-center gap-2 rounded-xl border border-dashed border-error/40 px-6 py-8 text-center', className)}>
      <Icon icon={WarningCircle} size={compact ? 'sm' : 'xl'} weight={compact ? 'regular' : 'duotone'} />
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <p className={compact ? 'font-medium' : 'text-sm font-medium text-text'}>{t('state.loadError')}</p>
        {message ? <p className={compact ? 'break-words text-text-secondary' : 'mt-1 max-w-sm break-words text-xs text-text-secondary'}>{message}</p> : null}
      </div>
      {onRetry ? <Button size="sm" variant="outline" onClick={onRetry}><Icon icon={ArrowClockwise} size="xs" />{t('error.retry')}</Button> : null}
    </div>
  );
}
