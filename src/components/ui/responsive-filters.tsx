import { useState, type ReactNode } from 'react';
import { Funnel } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { useI18n } from '@/lib/i18n';
import { useShellMode } from '@/lib/responsive';

/** Desktop: the controls inline. Phone: a `Filters (n)` button that opens them in a bottom sheet with Clear / Apply. Filters here apply live, so Apply only closes. */
export function ResponsiveFilters({ children, activeCount = 0, onClear }: { children: ReactNode; activeCount?: number; onClear?: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (useShellMode() !== 'phone') return <>{children}</>;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon icon={Funnel} size="sm" />{t('analytics.filters')}{activeCount > 0 ? ` (${activeCount})` : ''}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} side="bottom" title={t('analytics.filters')}
        footer={<div className="flex gap-2">{onClear && <Button variant="ghost" className="flex-1" onClick={onClear}>{t('analytics.clearFilters')}</Button>}<Button variant="primary" className="flex-1" onClick={() => setOpen(false)}>{t('filters.apply')}</Button></div>}>
        <div className="flex flex-col gap-3 [&_input]:w-full [&_select]:w-full [&_label]:flex-col [&_label]:items-start">{children}</div>
      </Sheet>
    </>
  );
}
