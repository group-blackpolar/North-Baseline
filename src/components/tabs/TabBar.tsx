/* oxlint-disable react/only-export-components */
import { Plus, X } from '@phosphor-icons/react';
import { useTabs, type Tab } from '@/context/TabsContext';
import { useCatalog } from '@/context/CatalogContext';
import { resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function tabMeta(
  tab: Tab,
  getCategory: (id: string) => { name: string; icon: string } | undefined,
  getSubcategory: (catId: string, subId: string | null) => { name: string; icon: string; labelKey?: string } | undefined,
  label: (key: string) => string,
) {
  const sub = getSubcategory(tab.route.categoryId, tab.route.subcategoryId);
  const cat = getCategory(tab.route.categoryId);
  return {
    title: (sub?.labelKey ? label(sub.labelKey) : sub?.name) ?? cat?.name ?? tab.route.categoryId,
    Icon: resolveIcon(sub?.icon ?? cat?.icon),
  };
}

export function TabBar() {
  const { t } = useI18n();
  const { tabs, activeTab, setActiveTab, closeTab, openNewTab } = useTabs();
  const { getCategory, getSubcategory } = useCatalog();

  return (
    <div role="tablist" aria-label={t('tabs.openViews')} className="shrink-0 flex items-center gap-1 px-2 border-b border-border bg-surface overflow-x-auto" style={{ height: 'var(--shell-tabs-height)' }}>
      {tabs.map((tab, index) => {
        const active = tab.id === activeTab?.id;
        const { title, Icon } = tabMeta(tab, getCategory, getSubcategory, (key) => t(key as never));

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cn(
              'north-enter group flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-lg border text-xs cursor-pointer select-none transition-colors duration-150 shrink-0',
              active
                ? 'bg-surface-active border-border text-text font-medium shadow-soft'
                : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text'
            )}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveTab(tab.id);
              }
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const offset = event.key === 'ArrowRight' ? 1 : -1;
                const nextIndex = (index + offset + tabs.length) % tabs.length;
                const next = tabs[nextIndex];
                if (next) {
                  setActiveTab(next.id);
                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]
                    ?.focus();
                }
              }
            }}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-36">{title}</span>
            {/* × siempre visible (comportamiento de tab de navegador) */}
            <button
              type="button"
              aria-label={t('tabs.close', { title })}
              className="h-5 w-5 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        aria-label={t('tabs.new')}
        title={t('tabs.new')}
        className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 shrink-0"
        onClick={openNewTab}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
