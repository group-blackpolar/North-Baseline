// The eight capabilities of organization Administration. They are subcategories of the server-defined `admin` category
// (the existing category/subcategory/tab system) — NOT a second navigation. `views` reuses the server's system
// subcategory (slug `settings`, the structure editor); the rest are client entries whose every read/write is authorized
// by CORECROW. Framework-free: imported by the catalog, the renderer and the route guard.

export const ADMIN_SECTIONS = ['overview', 'members', 'views', 'queries', 'integrations', 'audit', 'billing', 'settings'] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** Phosphor icon names understood by `resolveIcon` (see lib/iconMap). */
export const ADMIN_ICON: Record<AdminSection, string> = {
  overview: 'layout', members: 'users', views: 'stack', queries: 'database', integrations: 'plug', audit: 'scroll', billing: 'receipt', settings: 'settings',
};

/** UI hint only (disables the entry); CORECROW authorizes the data. `null` = no tenant permission names it. */
export const ADMIN_PERMISSION: Record<AdminSection, string | null> = {
  overview: 'organization.read', members: 'members.read', views: null, queries: null, integrations: 'organization.read', audit: 'audit.read', billing: 'billing.read', settings: 'organization.read',
};

export const adminSubcategoryId = (section: AdminSection) => `adm-${section}`;

/** The server's system subcategory that holds the structure editor. */
export const SERVER_VIEWS_SLUG = 'settings';

export function adminSectionOf(subcategory: { id: string; slug?: string } | null | undefined): AdminSection | null {
  if (!subcategory) return null;
  if (subcategory.slug === SERVER_VIEWS_SLUG || subcategory.id === adminSubcategoryId('views')) return 'views';
  const match = /^adm-(.+)$/.exec(subcategory.id);
  return match && (ADMIN_SECTIONS as readonly string[]).includes(match[1]!) ? (match[1] as AdminSection) : null;
}

/** True for any Administration screen that is rendered from the catalog route and never from a published panel. */
export const isAdminScreen = (subcategory: { id: string; slug?: string } | null | undefined) => adminSectionOf(subcategory) !== null;
