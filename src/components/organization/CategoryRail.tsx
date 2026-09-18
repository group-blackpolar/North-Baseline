import { useState } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { usePermissions } from '@/context/PermissionContext';
import { useTabs } from '@/context/TabsContext';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { resolveIcon } from '@/lib/iconRegistry';

export function CategoryRail() {
  const { activeTab, navigate } = useTabs();
  const { categories } = useCatalog();
  const { can } = usePermissions();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const activeCategory = activeTab?.route.categoryId ?? null;

  return (
    <nav
      aria-label={t('rail.categories')}
      className={cn(
        'h-full shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden',
        'transition-[width] duration-200 ease-out',
        expanded ? 'w-44' : 'w-14'
      )}
    >
      <div className="flex-1 flex flex-col gap-1 px-2 py-2">
        {categories.map((category) => {
          const Icon = resolveIcon(category.icon);
          const active = category.id === activeCategory;
          const allowed = !category.requiredPermission || can(category.requiredPermission);
          return (
            <button
              key={category.id}
              type="button"
              disabled={!allowed}
              title={allowed ? category.name : t('category.locked')}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center h-9 rounded-lg transition-colors duration-150 shrink-0',
                expanded ? 'gap-2.5 px-2.5 w-full' : 'justify-center w-full',
                active
                  ? 'bg-surface-active text-text font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                !allowed && 'opacity-40 cursor-not-allowed hover:bg-transparent'
              )}
              onClick={() => allowed && navigate(category.id as Parameters<typeof navigate>[0])}
            >
              <Icon className={cn('shrink-0', active ? 'w-4 h-4 text-accent' : 'w-4 h-4')} />
              <span className={cn('truncate text-sm transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0 w-0')}>
                {category.name}
              </span>
              {!allowed && <Lock className="w-3 h-3 shrink-0 text-text-muted" />}
            </button>
          );
        })}
      </div>

      <div className="px-2 pb-2 pt-1 border-t border-border/60">
        <button
          type="button"
          aria-label={expanded ? t('rail.collapse') : t('rail.expand')}
          title={expanded ? t('rail.collapse') : t('rail.expand')}
          className={cn(
            'flex items-center h-8 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150 w-full',
            expanded ? 'gap-2 px-2.5' : 'justify-center'
          )}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <ChevronLeft className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <span className={cn('text-xs font-medium transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0 w-0')}>
            {expanded ? t('rail.collapse') : t('rail.expand')}
          </span>
        </button>
      </div>
    </nav>
  );
}