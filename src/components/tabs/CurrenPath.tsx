import { ChevronRight } from 'lucide-react';
import { useTabs } from '@/context/TabsContext';
import { useCatalog } from '@/context/CatalogContext';
import { useI18n } from '@/lib/i18n';

export function CurrentPath() {
  const { t } = useI18n();
  const { activeTab } = useTabs();
  const { getCategory, getSubcategory } = useCatalog();

  if (!activeTab) return null;

  const category = getCategory(activeTab.route.categoryId);
  const subcategory = getSubcategory(activeTab.route.categoryId, activeTab.route.subcategoryId);

  return (
    <div className="shrink-0 flex items-center gap-1 px-3 border-b border-border/60 bg-surface-hover/30 text-xs text-text-muted" style={{ height: 'var(--shell-breadcrumb-height)' }}>
      <span className="font-medium text-text-secondary">{category?.name ?? activeTab.route.categoryId}</span>
      {subcategory && (
        <>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text">{subcategory.labelKey ? t(subcategory.labelKey as never) : subcategory.name}</span>
        </>
      )}
    </div>
  );
}
