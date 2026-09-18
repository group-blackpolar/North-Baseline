import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTabs } from '@/context/TabsContext';
import { usePermissions } from '@/context/PermissionContext';
import { resolveIcon } from '@/lib/iconMap';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';
import type { SubcategoryModel } from '@/lib/models';
import { ProfileMenu } from '@/components/sidebar/ProfileMenu';

export function ContextSidebar({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { categories } = useCatalog();
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();
  const { navigate, activeTab } = useTabs();
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const activeCategoryId = activeTab?.route.categoryId;
  const activeCategory = categories.find((category) => category.id === activeCategoryId);

  // Agrupar subcategorías por `group`, preservando orden
  const groups = useMemo(() => {
    if (!activeCategory) return [] as Array<{ name: string; items: SubcategoryModel[] }>;
    const query = search.trim().toLowerCase();
    const map = new Map<string, SubcategoryModel[]>();
    for (const sub of activeCategory.subcategories) {
      if (query !== '' && !sub.name.toLowerCase().includes(query)) continue;
      const groupName = sub.group ?? '';
      const list = map.get(groupName) ?? [];
      list.push(sub);
      map.set(groupName, list);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }, [activeCategory, search]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((current) => ({ ...current, [name]: !current[name] }));
  };

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0 h-full bg-surface border-r border-border flex flex-col items-center py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="h-8 w-8 rounded-lg hover:bg-surface-hover flex items-center justify-center text-text-muted hover:text-text transition-colors duration-150"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 h-full bg-surface border-r border-border flex flex-col">
      {/* Header */}
      <header className="shrink-0 p-3 border-b border-border space-y-2">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-full flex items-center justify-end text-text-muted hover:text-text transition-colors duration-150"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {workspaces.length > 1 && (
          <select
            value={activeWorkspace?.id ?? ''}
            onChange={(event) => switchWorkspace(event.target.value)}
            className="w-full h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 transition-[border-color,box-shadow] duration-150"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('sidebar.search') || 'Search...'}
            className="w-full h-8 pl-7 pr-2 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 transition-[border-color,box-shadow] duration-150"
          />
        </div>
      </header>

      {/* Subcategorías agrupadas y colapsables */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-2">
        {groups.length === 0 && (
          <p className="px-2 py-4 text-xs text-text-muted text-center">
            {t('sidebar.noResults') || 'No results'}
          </p>
        )}
        {groups.map((group) => {
          const groupCollapsed = Boolean(collapsedGroups[group.name]);
          return (
            <div key={group.name} className="space-y-0.5">
              <button
                type="button"
                className="w-full flex items-center gap-1.5 px-2 py-1.5 ui-label text-[10px] text-text-muted hover:text-text transition-colors duration-150"
                onClick={() => toggleGroup(group.name)}
              >
                {groupCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span className="truncate">{group.name}</span>
              </button>

              {!groupCollapsed &&
                group.items.map((sub) => {
                  const SubIcon = resolveIcon(sub.icon);
                  const disabled = Boolean(sub.requiredPermission && !can(sub.requiredPermission));
                  const active = activeTab?.route.subcategoryId === sub.id;

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => navigate(activeCategory?.id ?? '', sub.id)}
                      className={cn(
                        'w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-md text-sm transition-colors duration-150',
                        disabled
                          ? 'text-text-muted cursor-not-allowed opacity-50'
                          : active
                          ? 'bg-surface-active text-text font-medium'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text'
                      )}
                    >
                      <SubIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{sub.name}</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <footer className="shrink-0 p-2 border-t border-border">
        <ProfileMenu user={user} />
      </footer>
    </aside>
  );
}