import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTabs } from '@/context/TabsContext';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';
import { ProfileMenu } from '@/components/sidebar/ProfileMenu';
import type { ViewId } from '@/lib/navigation';

export function ContextSidebar({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { categories } = useCatalog();
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();
  const { navigate, activeTab } = useTabs();
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const activeCategoryId = activeTab?.route.categoryId;

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
            placeholder={t('sidebar.search') || 'Buscar...'}
            className="w-full h-8 pl-7 pr-2 rounded-md border border-border bg-surface text-xs text-text placeholder:text-text-muted outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 transition-[border-color,box-shadow] duration-150"
          />
        </div>
      </header>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {categories
          .filter((category) => category.id === activeCategoryId)
          .map((category) => {
            const filtered = category.subcategories.filter((sub) =>
              search.trim() === '' || sub.name.toLowerCase().includes(search.toLowerCase())
            );

            return (
              <div key={category.id} className="space-y-0.5">
                <h3 className="ui-label px-2 py-1.5 text-[10px]">{category.name}</h3>
                {filtered.map((sub) => {
                  const disabled = Boolean(sub.requiredPermission && !can(sub.requiredPermission));
                  const active = activeTab?.route.subcategoryId === sub.id;

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => navigate(category.id as ViewId, sub.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors duration-150',
                        disabled
                          ? 'text-text-muted cursor-not-allowed opacity-50'
                          : active
                          ? 'bg-surface-active text-text font-medium'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text'
                      )}
                    >
                      <span className="truncate">{sub.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
      </nav>

      <footer className="shrink-0 p-2 border-t border-border">
        <ProfileMenu user={user} />
      </footer>
    </aside>
  );
}