import { Plus, X } from '@phosphor-icons/react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { tabMeta } from '@/components/tabs/TabBar';
import { useI18n } from '@/lib/i18n';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { cn } from '@/lib/utils';

/** Phone replacement for the tab strip: open views as a bottom sheet. Same TabsContext actions as the desktop TabBar. */
export function TabSwitcher({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const { tabs, activeTab, setActiveTab, closeTab, openNewTab } = useTabs();
  const { getCategory, getSubcategory } = useCatalog();
  const go = useOverlayHistory(open, () => onOpenChange(false));

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) go(() => {}); }} side="bottom" title={t('tabs.openViews')}
      footer={<Button className="w-full" onClick={() => go(openNewTab)}><Icon icon={Plus} size="sm" />{t('tabs.new')}</Button>}>
      <ul className="space-y-1">
        {tabs.map((tab) => {
          const { title, Icon: TabIcon } = tabMeta(tab, getCategory, getSubcategory, (key) => t(key as never));
          const active = tab.id === activeTab?.id;
          return (
            <li key={tab.id} className={cn('flex items-center rounded-lg', active ? 'bg-surface-active ring-1 ring-border' : 'hover:bg-surface-hover')}>
              <button type="button" aria-current={active ? 'true' : undefined} className="flex min-h-(--touch-min) min-w-0 flex-1 items-center gap-3 px-3 text-left text-sm" onClick={() => go(() => setActiveTab(tab.id))}>
                <Icon icon={TabIcon} size="md" className="text-text-secondary" /><span className="truncate">{title}</span>
              </button>
              <button type="button" aria-label={t('tabs.close', { title })} className="flex size-(--touch-min) shrink-0 items-center justify-center text-text-muted hover:text-text" onClick={() => closeTab(tab.id)}>
                <Icon icon={X} size="sm" />
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
