import { Plus, X } from 'lucide-react';
import { useTabs, tabTitle } from '@/context/TabsContext';
import { iconForRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function TabBar() {
  const { tabs, activeTab, setActiveTab, closeTab, openNewTab } = useTabs();
  const { t } = useI18n();

  return (
    <div className="h-10 shrink-0 flex items-center gap-1 px-2 bg-background">
      <div className="flex-1 flex items-center gap-1 overflow-x-auto min-w-0" role="tablist">
        {tabs.length === 0 && <span className="text-xs text-text-muted">{t('tabs.empty')}</span>}
        {tabs.map((tab) => {
          const Icon = iconForRoute(tab.route.categoryId, tab.route.subcategoryId);
          const active = tab.id === activeTab?.id;
          const title = tabTitle(tab);
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              title={title}
              className={cn(
                'group flex items-center gap-2 h-8 pl-2.5 pr-1.5 rounded-lg text-[13px] cursor-pointer select-none shrink-0 max-w-56 border transition-colors duration-150',
                active
                  ? 'bg-surface border-border text-text font-medium shadow-soft'
                  : 'bg-transparent border-transparent text-text-secondary hover:bg-surface-hover hover:text-text'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-accent' : '')} />
              <span className="truncate">{title}</span>
              <button
                type="button"
                aria-label={t('tabs.close', { title })}
                className={cn(
                  'rounded-md p-0.5 transition-[opacity,background-color] duration-150 hover:bg-surface-active',
                  active ? 'opacity-50 hover:opacity-100' : 'opacity-0 group-hover:opacity-50 group-hover:hover:opacity-100'
                )}
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

        {/* Única vía de creación de tabs */}
        <button
          type="button"
          title={t('tabs.new')}
          aria-label={t('tabs.new')}
          onClick={openNewTab}
          className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}