import { useMemo, useState } from 'react';
import { ChevronDown, FolderOpen, Lock, PanelLeftClose, PanelLeftOpen, Search, Settings } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTabs } from '@/context/TabsContext';
import { useCatalog } from '@/context/CatalogContext';
import { usePermissions } from '@/context/PermissionContext';
import type { SubcategoryModel } from '@/lib/models';
import { resolveIcon } from '@/lib/iconRegistry';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';


export function ContextSidebar() {
  const { workspaces, activeWorkspace, switchWorkspace, isLoading: wsLoading } = useWorkspace();
  const { activeTab, navigate } = useTabs();
  const { getCategory } = useCatalog();
  const { can } = usePermissions();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [wsOpen, setWsOpen] = useState(false);
  

  const categoryId = activeTab?.route.categoryId ?? null;
  const category = getCategory(categoryId ?? '');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byGroup = new Map<string, SubcategoryModel[]>();
    const visible = (category?.subcategories ?? []).filter((subcategory) => can(subcategory.requiredPermission));
    for (const subcategory of visible) {
      if (!q || subcategory.name.toLowerCase().includes(q)) {
        const key = subcategory.group ?? '';
        byGroup.set(key, [...(byGroup.get(key) ?? []), subcategory]);
      }
    }
    return [...byGroup.entries()].map(([label, items]) => ({
      id: label || 'general',
      label,
      items,
    }));
  }, [can, category, query]);

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0 h-full bg-surface border-r border-border flex flex-col items-center py-2">
        <button
          type="button"
          aria-label="Expandir panel contextual"
          title={t('sidebar.expand')}
          onClick={() => setCollapsed(false)}
          className="h-8 w-8 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  const renderLeaf = (subcategory: SubcategoryModel) => {
    const Icon = resolveIcon(subcategory.icon);
    const active = activeTab?.route.subcategoryId === subcategory.id;
    const allowed = can(subcategory.requiredPermission);
    return (
      <div key={subcategory.id}>
        <button
          type="button"
          disabled={!allowed}
          title={allowed ? subcategory.name : t('category.locked')}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-md transition-colors duration-150',
            'px-2.5 py-2 text-sm',
            active
              ? 'bg-surface-active text-text font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text'
          )}
          onClick={() => {
            if (allowed && categoryId) navigate(categoryId, subcategory.id);
          }}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left truncate">{subcategory.name}</span>
          {!allowed && <Lock className="w-3 h-3 shrink-0" />}
        </button>
      </div>
    );
  };

  return (
    <aside className="w-64 shrink-0 h-full bg-surface border-r border-border flex flex-col">
      {/* Workspace + collapse */}
      <div className="p-3 border-b border-border/60 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-surface-hover transition-colors duration-150"
              onClick={() => setWsOpen((open) => !open)}
            >
              <span className="flex-1 min-w-0 text-[13px] font-semibold text-text truncate">
                {activeWorkspace?.name ?? t('sidebar.noWorkspace')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
            </button>
            {wsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWsOpen(false)} />
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface shadow-pop p-1 max-h-48 overflow-y-auto">
                  {workspaces.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-text-muted">{t('empty.ws.title')}</p>
                  )}
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors duration-150',
                        ws.id === activeWorkspace?.id
                          ? 'bg-surface-active text-text font-medium'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text'
                      )}
                      onClick={() => {
                        switchWorkspace(ws.id);
                        setWsOpen(false);
                      }}
                    >
                      {ws.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            aria-label="Contraer panel contextual"
            title={t('sidebar.collapse')}
            onClick={() => setCollapsed(true)}
            className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface-hover/60 px-2.5 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
          <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('sidebar.search')}
            className="flex-1 min-w-0 bg-transparent text-xs text-text outline-none placeholder:text-text-muted"
          />
        </label>
      </div>

      {/* Subcategorías de la categoría activa */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {wsLoading && (
          <div className="space-y-2 px-1">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-5/6" />
              <Skeleton className="h-7 w-4/6" />
            </div>
          )}
          {!wsLoading && workspaces.length === 0 && (
            <EmptyState icon={FolderOpen} title={t('empty.ws.title')} body={t('empty.ws.body')} className="py-6" />
        )}

        {!categoryId && (
          <p className="text-xs text-text-muted text-center py-6">{t('sidebar.selectCategory')}</p>
        )}
        {categoryId && groups.length === 0 && (
          <p className="text-xs text-text-muted text-center py-6">{t('sidebar.noResults', { query })}</p>
        )}
        {groups.map((group) => (
          <div key={group.id}>
            <p className="ui-label px-1 pb-1.5">{group.label}</p>
            <div className="space-y-0.5">{group.items.map((item) => renderLeaf(item))}</div>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-border/60">
        <button
          type="button"
          aria-label={t('sidebar.settings')}
          title={t('sidebar.settings')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-hover hover:text-text transition-colors duration-150"
          onClick={() => navigate('settings')}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>{t('sidebar.settings')}</span>
        </button>
      </div>
    </aside>
  );
}