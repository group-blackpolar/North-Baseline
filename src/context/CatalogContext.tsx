import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchCatalog } from '@/lib/catalog';
import type { CategoryModel, SubcategoryModel } from '@/lib/models';
import { getOrganizationNavigation, type NavigationCategory } from '@/lib/organizations';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import type { SessionUser } from '@/lib/auth';
import { ACCESS_SECTIONS, type AccessSection } from '@/features/access-admin/AccessAdminView';

interface CatalogContextValue {
  categories: CategoryModel[];
  isLoading: boolean;
  getCategory: (categoryId: string) => CategoryModel | undefined;
  getSubcategory: (categoryId: string, subcategoryId: string | null) => SubcategoryModel | undefined;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({
  workspaceId,
  organizationId,
  platformRole,
  children,
}: {
  workspaceId: string | null;
  organizationId: string;
  platformRole?: SessionUser['role'];
  children: ReactNode;
}) {
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const catalog = organizationId === PERSONAL_ORG_ID
      ? fetchCatalog(workspaceId, { includePlatformAdministration: platformRole === 'ADMIN' || platformRole === 'SUPERADMIN' })
      : getOrganizationNavigation(organizationId).then(navigationToCatalog);
    try {
      setCategories(await catalog);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, platformRole, workspaceId]);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    const catalog = organizationId === PERSONAL_ORG_ID
      ? fetchCatalog(workspaceId, { includePlatformAdministration: platformRole === 'ADMIN' || platformRole === 'SUPERADMIN' })
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
  }, [organizationId, platformRole, workspaceId]);

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
    <CatalogContext.Provider value={{ categories, isLoading, getCategory, getSubcategory, refresh }}>
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

/** Organization access screens. UI entries only: every read and write behind them is authorized by CORECROW. */
const ACCESS_ICONS: Record<AccessSection, string> = { settings: 'settings', users: 'users', invitations: 'bell', groups: 'users', permissions: 'key', audit: 'scroll' };
const ACCESS_PERMISSIONS: Record<AccessSection, string> = {
  settings: 'organization.read', users: 'members.read', invitations: 'invitations.read', groups: 'groups.read', permissions: 'members.read', audit: 'audit.read',
};

function accessSubcategories(categoryId: string, offset: number): SubcategoryModel[] {
  return ACCESS_SECTIONS.map((section, index) => ({
    id: `access-${section}`,
    categoryId,
    name: section,
    labelKey: section === 'settings' || section === 'audit' ? `adm.nav.${section}` : `access.nav.${section}`,
    icon: ACCESS_ICONS[section],
    requiredPermission: ACCESS_PERMISSIONS[section],
    route: `access/${section}`,
    slug: `access-${section}`,
    // Settings leads the Administration list; the rest follow the server-defined Architecture entry.
    order: section === 'settings' ? -1 : offset + index,
  }));
}

/** Administration lists Settings first, then the server-defined Architecture entry, then the access screens. */
function withAccessSections(category: NavigationCategory, serverSubs: SubcategoryModel[]): SubcategoryModel[] {
  if (category.slug !== 'admin') return serverSubs;
  const access = accessSubcategories(category.id, serverSubs.length);
  return [...access.filter((sub) => sub.slug === 'access-settings'), ...serverSubs, ...access.filter((sub) => sub.slug !== 'access-settings')];
}

function navigationToCatalog(navigation: NavigationCategory[]): CategoryModel[] {
  return navigation.map((category) => ({
    id: category.id,
    workspaceId: null,
    name: localizedName(category.name),
    icon: category.icon ?? 'Folder',
    slug: category.slug,
    order: 0,
    subcategories: withAccessSections(category, category.subcategories.map((subcategory, index): SubcategoryModel => ({
      id: subcategory.id,
      categoryId: category.id,
      name: localizedName(subcategory.name),
      icon: subcategory.icon ?? 'FileText',
      route: subcategory.slug,
      slug: subcategory.slug,
      // The server's system entry holds the structure editor (categories, subcategories, views): shown as Architecture.
      ...(category.slug === 'admin' && subcategory.slug === 'settings' ? { labelKey: 'adm.nav.architecture' } : {}),
      publishedPanels: subcategory.panels.map((panel) => ({
        id: panel.id,
        name: localizedName(panel.name),
        slug: panel.slug,
      })),
      order: index,
    }))),
  }));
}
