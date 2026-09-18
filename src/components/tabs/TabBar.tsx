import { Plus, X } from 'lucide-react';
import { useTabs, type Tab } from '@/context/TabsContext';
import { useCatalog } from '@/context/CatalogContext';
import { resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';

function tabMeta(
  tab: Tab,
  getCategory: (id: string) => { name: string; icon: string } | undefined,
  getSubcategory: (catId: string, subId: string | null) => { name: string; icon: string } | undefined
) {
  const sub = getSubcategory(tab.route.categoryId, tab.route.subcategoryId);
  const cat = getCategory(tab.route.categoryId);
  return {
    title: sub?.name ?? cat?.name ?? tab.route.categoryId,
    Icon: resolveIcon(sub?.icon ?? cat?.icon),
  };
}

export function TabBar() {
  const { tabs, activeTab, setActiveTab, closeTab, openNewTab } = useTabs();
  const { getCategory, getSubcategory } = useCatalog();

  return (
    <div className="h-9 shrink-0 flex items-center gap-1 px-2 border-b border-border bg-surface overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.id === activeTab?.id;
        const { title, Icon } = tabMeta(tab, getCategory, getSubcategory);

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            className={cn(
              'group flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-lg border text-xs cursor-pointer select-none transition-colors duration-150 shrink-0',
              active
                ? 'bg-surface-active border-border text-text font-medium shadow-soft'
                : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-36">{title}</span>
            {/* × siempre visible (comportamiento de tab de navegador) */}
            <button
              type="button"
              aria-label="Close tab"
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
        aria-label="New tab"
        title="New tab"
        className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 shrink-0"
        onClick={openNewTab}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}