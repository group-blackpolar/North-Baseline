/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchCatalog } from '@/lib/catalog';
import type { CategoryModel, SubcategoryModel } from '@/lib/models';

interface CatalogContextValue {
  categories: CategoryModel[];
  isLoading: boolean;
  getCategory: (categoryId: string) => CategoryModel | undefined;
  getSubcategory: (categoryId: string, subcategoryId: string | null) => SubcategoryModel | undefined;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ workspaceId, children }: { workspaceId: string | null; children: ReactNode }) {
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    fetchCatalog(workspaceId)
      .then((catalog) => {
        if (alive) setCategories(catalog);
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const getCategory = useCallback(
    (categoryId: string) => categories.find((c) => c.id === categoryId),
    [categories]
  );

  const getSubcategory = useCallback(
    (categoryId: string, subcategoryId: string | null) =>
      subcategoryId ? getCategory(categoryId)?.subcategories.find((s) => s.id === subcategoryId) : undefined,
    [getCategory]
  );

  return (
    <CatalogContext.Provider value={{ categories, isLoading, getCategory, getSubcategory }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used within CatalogProvider');
  return context;
}