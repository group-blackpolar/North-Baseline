import type { CategoryModel } from '@/lib/models';
import { PERSONAL_WS_ID } from '@/lib/demo/store';


/** Catálogo del workspace Personal. Platform administration remains a global route. */
/** Black Polar platform administration, as navigation inside the shell (CORECROW still authorizes every request). */
const PLATFORM_SECTIONS: Array<{ id: string; icon: string; superadmin?: boolean }> = [
  { id: 'dashboard', icon: 'layout' },
  { id: 'users', icon: 'users' },
  { id: 'organizations', icon: 'stack' },
  { id: 'billing', icon: 'receipt' },
  { id: 'contacts', icon: 'note' },
  { id: 'audit', icon: 'scroll', superadmin: true },
  { id: 'permissions', icon: 'key', superadmin: true },
  { id: 'templates', icon: 'palette', superadmin: true },
];

function personalCatalog(includePlatformAdministration = false, includeSuperadmin = false): CategoryModel[] {
  const categories: CategoryModel[] = [
    {
      id: 'home',
      workspaceId: PERSONAL_WS_ID,
      name: 'Home',
      icon: 'layout',
      order: 0,
      subcategories: [
        { id: 'overview', categoryId: 'home', name: 'Overview', icon: 'layout', group: 'General', route: '/home/overview', order: 0 },
        { id: 'recent', categoryId: 'home', name: 'Recent activity', icon: 'note', group: 'General', route: '/home/recent', order: 1 },
        { id: 'quick-actions', categoryId: 'home', name: 'Quick actions', icon: 'scroll', group: 'General', route: '/home/quick-actions', order: 2 },
      ],
    },
    {
      id: 'profile',
      workspaceId: PERSONAL_WS_ID,
      name: 'Profile',
      icon: 'user',
      order: 1,
      subcategories: [
        { id: 'personal-information', categoryId: 'profile', name: 'Personal information', icon: 'user', group: 'Personal', route: '/profile/personal-information', order: 0 },
        { id: 'account', categoryId: 'profile', name: 'Account', icon: 'settings', group: 'Personal', route: '/profile/account', order: 1 },
        { id: 'contact', categoryId: 'profile', name: 'Contact information', icon: 'note', group: 'Personal', route: '/profile/contact', order: 2 },
        { id: 'security', categoryId: 'profile', name: 'Security', icon: 'shield', group: 'Security', route: '/profile/security', order: 3 },
      ],
    },
   {
      id: 'settings',
      workspaceId: PERSONAL_WS_ID,
      name: 'Settings',
      icon: 'settings',
      order: 3,
      subcategories: [
        { id: 'appearance', categoryId: 'settings', name: 'Appearance', icon: 'palette', group: 'Local preferences', route: '/settings/appearance', order: 0 },
        { id: 'language-region', categoryId: 'settings', name: 'Language & Region', icon: 'languages', group: 'Local preferences', route: '/settings/language-region', order: 1 },
      ],
    },
  ];

  if (includePlatformAdministration) {
    categories.splice(2, 0, {
      id: 'platform-administration',
      workspaceId: PERSONAL_WS_ID,
      name: 'Administration',
      icon: 'shield-check',
      order: 2,
      subcategories: PLATFORM_SECTIONS.filter((section) => includeSuperadmin || !section.superadmin).map((section, index) => ({
        id: section.id, categoryId: 'platform-administration', name: section.id, labelKey: `pa.nav.${section.id}`, icon: section.icon,
        group: 'Black Polar', route: `/workspace/admin/${section.id}`, order: index,
      })),
    });
  }

  return categories;
}

/** Catálogo básico para orgs custom (creadas vía modal). */
function customCatalog(workspaceId: string): CategoryModel[] {
  return [
    {
      id: 'home',
      workspaceId,
      name: 'Home',
      icon: 'layout',
      order: 0,
      subcategories: [
        {
          id: 'overview',
          categoryId: 'home',
          name: 'Overview',
          icon: 'layout',
          group: 'General',
          route: '/home/overview',
          order: 0,
        },
      ],
    },
  ];
}

/** Router: decide qué catálogo servir según el workspaceId. */
export function demoCatalogFor(
  workspaceId: string | null,
  options?: { includePlatformAdministration?: boolean; includeSuperadminAdministration?: boolean }
): CategoryModel[] | null {
  if (!workspaceId) return null;
  if (workspaceId === PERSONAL_WS_ID) return personalCatalog(options?.includePlatformAdministration, options?.includeSuperadminAdministration);
  if (workspaceId.startsWith('ws-')) return customCatalog(workspaceId);
  return null;
}
