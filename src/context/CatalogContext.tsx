import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchCatalog } from '@/lib/catalog';
import type { CategoryModel, SubcategoryModel } from '@/lib/models';
import { getOrganizationNavigation, type NavigationCategory } from '@/lib/organizations';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';

interface CatalogContextValue {
  categories: CategoryModel[];
  isLoading: boolean;
  getCategory: (categoryId: string) => CategoryModel | undefined;
  getSubcategory: (categoryId: string, subcategoryId: string | null) => SubcategoryModel | undefined;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({
  workspaceId,
  organizationId,
  children,
}: {
  workspaceId: string | null;
  organizationId: string;
  children: ReactNode;
}) {
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    const catalog = organizationId === PERSONAL_ORG_ID
      ? fetchCatalog(workspaceId)
      : getOrganizationNavigation(organizationId).then(navigationToCatalog);
    catalog
      .then((catalog) => {
        if (alive) setCategories(catalog);
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [organizationId, workspaceId]);

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

function localizedName(value: Record<string, string>) {
  return value.es ?? value.en ?? Object.values(value)[0] ?? '';
}

function navigationToCatalog(navigation: NavigationCategory[]): CategoryModel[] {
  return navigation.map((category) => ({
    id: category.id,
    workspaceId: null,
    name: localizedName(category.name),
    icon: category.icon ?? 'Folder',
    order: 0,
    subcategories: category.subcategories.map((subcategory, index): SubcategoryModel => ({
      id: subcategory.id,
      categoryId: category.id,
      name: localizedName(subcategory.name),
      icon: subcategory.icon ?? 'FileText',
      route: subcategory.slug,
      order: index,
    })),
  }));
}
