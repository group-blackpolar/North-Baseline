import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { usePermissions } from '@/context/PermissionContext';
import { resolveIcon } from '@/lib/iconMap';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const EXPANDED_KEY = 'north-category-rail-expanded';

export function CategoryRail() {
  const { categories, isLoading } = useCatalog();
  const { activeTab, navigate } = useTabs();
  const { can } = usePermissions();
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(EXPANDED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const activeCategoryId = activeTab?.route.categoryId;

  const toggleExpanded = () => {
    setExpanded((current) => {
      const next = !current;
      try {
        localStorage.setItem(EXPANDED_KEY, next ? '1' : '0');
      } catch {
        /* storage no disponible */
      }
      return next;
    });
  };

  return (
    <nav
      className={cn(
        'shrink-0 h-full bg-surface border-r border-border flex flex-col py-3 gap-1 transition-[width] duration-200 ease-out',
        expanded ? 'w-44 px-2' : 'w-14 px-0 items-center'
      )}
    >
      {/* Toggle expandir/colapsar */}
      <button
        type="button"
        title={expanded ? 'Collapse categories' : 'Expand categories'}
        aria-label={expanded ? 'Collapse categories' : 'Expand categories'}
        className={cn(
          'h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150 mb-1',
          expanded ? 'w-full' : 'w-10'
        )}
        onClick={toggleExpanded}
      >
        {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {isLoading && (
        <>
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </>
      )}

      {!isLoading &&
        categories.map((category) => {
          const Icon = resolveIcon(category.icon);
          const active = category.id === activeCategoryId;
          const disabled = Boolean(category.requiredPermission && !can(category.requiredPermission));

          return (
            <button
              key={category.id}
              type="button"
              title={category.name}
              disabled={disabled}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'h-10 rounded-xl flex items-center gap-2.5 transition-colors duration-150',
                expanded ? 'w-full px-2.5' : 'w-10 justify-center',
                disabled
                  ? 'text-text-muted opacity-40 cursor-not-allowed'
                  : active
                  ? 'bg-surface-active text-text shadow-soft ring-1 ring-border'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text'
              )}
              onClick={() => {
                if (!disabled) navigate(category.id, category.subcategories[0]?.id ?? null);
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {expanded && <span className="text-xs font-medium truncate">{category.name}</span>}
            </button>
          );
        })}
    </nav>
  );
}