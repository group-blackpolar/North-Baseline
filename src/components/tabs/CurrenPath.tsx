import { ChevronRight } from 'lucide-react';
import { useTabs } from '@/context/TabsContext';
import { useCatalog } from '@/context/CatalogContext';

export function CurrentPath() {
  const { activeTab } = useTabs();
  const { getCategory, getSubcategory } = useCatalog();

  if (!activeTab) return null;

  const category = getCategory(activeTab.route.categoryId);
  const subcategory = getSubcategory(activeTab.route.categoryId, activeTab.route.subcategoryId);

  return (
    <div className="h-7 shrink-0 flex items-center gap-1 px-3 border-b border-border/60 bg-surface-hover/30 text-xs text-text-muted">
      <span className="font-medium text-text-secondary">{category?.name ?? activeTab.route.categoryId}</span>
      {subcategory && (
        <>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text">{subcategory.name}</span>
        </>
      )}
    </div>
  );
}