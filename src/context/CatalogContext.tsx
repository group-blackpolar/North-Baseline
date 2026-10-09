import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchCatalog } from '@/lib/catalog';
import type { CategoryModel, SubcategoryModel } from '@/lib/models';
import { getOrganizationNavigation, type NavigationCategory } from '@/lib/organizations';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import type { SessionUser } from '@/lib/auth';
import { ADMIN_ICON, ADMIN_PERMISSION, ADMIN_SECTIONS, SERVER_VIEWS_SLUG, adminSubcategoryId } from '@/features/admin-center/sections';

interface CatalogContextValue {
  categories: CategoryModel[];
  /** True only while there is nothing to show yet. A background refresh keeps the current catalog on screen. */
  isLoading: boolean;
  /** The last load failed (network / API). The previous catalog, if any, is kept; this is never an access decision. */
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async (force: boolean) => {
    const catalog = organizationId === PERSONAL_ORG_ID
      ? fetchCatalog(workspaceId, { includePlatformAdministration: platformRole === 'ADMIN' || platformRole === 'SUPERADMIN' })
      : getOrganizationNavigation(organizationId, { force }).then(navigationToCatalog);
    return catalog;
  }, [organizationId, platformRole, workspaceId]);

  /** Explicit refresh (after a structural edit): always asks CORECROW, never blanks the navigation. */
  const refresh = useCallback(async () => {
    try {
      setCategories(await load(true));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Request failed');
      throw reason;
    }
  }, [load]);

  useEffect(() => {
    let alive = true;
    // Only the very first load shows a skeleton; later reloads (role change, workspace) are silent.
    if (!loadedRef.current) setIsLoading(true);
    load(false)
      .then((next) => {
        if (!alive) return;
        loadedRef.current = true;
        setCategories(next);
        setError(null);
      })
      .catch((reason) => {
        // Keep whatever is already on screen: an API failure must not empty (and so redirect) the shell.
        if (alive) setError(reason instanceof Error ? reason.message : 'Request failed');
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load]);

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
    <CatalogContext.Provider value={{ categories, isLoading, error, getCategory, getSubcategory, refresh }}>
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

/**
 * Administration is the eight-capability control center (see admin-center/sections.ts). They are subcategories of the
 * server-defined `admin` category, so tabs, deep links and the sidebar keep working unchanged. `views` IS the server's
 * system subcategory (the structure editor); the others are client entries — UI only: CORECROW authorizes every read/write.
 */
function withAdminSections(category: NavigationCategory, serverSubs: SubcategoryModel[]): SubcategoryModel[] {
  if (category.slug !== 'admin') return serverSubs;
  const serverViews = serverSubs.find((sub) => sub.slug === SERVER_VIEWS_SLUG);
  // Anything else the server defines for `admin` (future system entries) stays after the eight capabilities.
  const extras = serverSubs.filter((sub) => sub !== serverViews);
  const entries = ADMIN_SECTIONS.map((section, index): SubcategoryModel => {
    const base = {
      categoryId: category.id,
      labelKey: `adm.nav.${section}`,
      icon: ADMIN_ICON[section],
      requiredPermission: ADMIN_PERMISSION[section] ?? undefined,
      route: section,
      order: index,
    };
    if (section === 'views' && serverViews) return { ...serverViews, ...base, name: serverViews.name, slug: SERVER_VIEWS_SLUG, route: SERVER_VIEWS_SLUG };
    return { ...base, id: adminSubcategoryId(section), name: section, slug: section === 'views' ? SERVER_VIEWS_SLUG : `adm-${section}` };
  });
  return [...entries, ...extras.map((sub, index) => ({ ...sub, order: entries.length + index }))];
}

function navigationToCatalog(navigation: NavigationCategory[]): CategoryModel[] {
  return navigation.map((category) => ({
    id: category.id,
    workspaceId: null,
    name: localizedName(category.name),
    icon: category.icon ?? 'Folder',
    slug: category.slug,
    order: 0,
    subcategories: withAdminSections(category, category.subcategories.map((subcategory, index): SubcategoryModel => ({
      id: subcategory.id,
      categoryId: category.id,
      name: localizedName(subcategory.name),
      icon: subcategory.icon ?? 'FileText',
      route: subcategory.slug,
      slug: subcategory.slug,
      publishedPanels: subcategory.panels.map((panel) => ({
        id: panel.id,
        name: localizedName(panel.name),
        slug: panel.slug,
      })),
      order: index,
    }))),
  }));
}
