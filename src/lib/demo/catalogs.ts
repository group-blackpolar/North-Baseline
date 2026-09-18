import type { CategoryModel } from '@/lib/models';
import { PERSONAL_WS_ID, SHARK_WS_ID } from '@/lib/demo/store';


/** Catálogo del workspace Personal: Home, Profile, Billing, Preferences. */
function personalCatalog(): CategoryModel[] {
  return [
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
        { id: 'sessions', categoryId: 'profile', name: 'Sessions', icon: 'pulse', group: 'Security', route: '/profile/sessions', order: 4 },
        { id: 'connected-accounts', categoryId: 'profile', name: 'Connected accounts', icon: 'key', group: 'Security', route: '/profile/connected-accounts', order: 5 },
      ],
    },
    {
      id: 'billing',
      workspaceId: PERSONAL_WS_ID,
      name: 'Billing',
      icon: 'chart',
      order: 2,
      subcategories: [
        { id: 'plans', categoryId: 'billing', name: 'Plans', icon: 'chart', group: 'Billing', route: '/billing/plans', order: 0 },
        { id: 'invoices', categoryId: 'billing', name: 'Invoices', icon: 'scroll', group: 'Billing', route: '/billing/invoices', order: 1 },
      ],
    },
   {
      id: 'settings',
      workspaceId: PERSONAL_WS_ID,
      name: 'Settings',
      icon: 'settings',
      order: 3,
      subcategories: [
        { id: 'general', categoryId: 'settings', name: 'General', icon: 'settings', group: 'General', route: '/settings/general', order: 0 },
        { id: 'appearance', categoryId: 'settings', name: 'Appearance', icon: 'palette', group: 'General', route: '/settings/appearance', order: 1 },
        { id: 'language-region', categoryId: 'settings', name: 'Language & Region', icon: 'languages', group: 'General', route: '/settings/language-region', order: 2 },
        { id: 'notifications', categoryId: 'settings', name: 'Notifications', icon: 'bell', group: 'Preferences', route: '/settings/notifications', order: 3 },
        { id: 'accessibility', categoryId: 'settings', name: 'Accessibility', icon: 'accessibility', group: 'Preferences', route: '/settings/accessibility', order: 4 },
        { id: 'privacy', categoryId: 'settings', name: 'Privacy', icon: 'shield-check', group: 'Preferences', route: '/settings/privacy', order: 5 },
        { id: 'advanced', categoryId: 'settings', name: 'Advanced', icon: 'wrench', group: 'Advanced', route: '/settings/advanced', order: 6 },
      ],
    },
  ];
}

/** Catálogo del workspace SHARK: Home + Master House con 7 subcategorías. */
function sharkCatalog(): CategoryModel[] {
  return [
    {
      id: 'shark-home',
      workspaceId: SHARK_WS_ID,
      name: 'Home',
      icon: 'layout',
      order: 0,
      subcategories: [
        {
          id: 'overview',
          categoryId: 'shark-home',
          name: 'Overview',
          icon: 'layout',
          group: 'General',
          route: '/shark-home/overview',
          order: 0,
        },
      ],
    },
    {
      id: 'master-house',
      workspaceId: SHARK_WS_ID,
      name: 'Master House',
      icon: 'chart',
      order: 1,
      subcategories: [
        {
          id: 'report-info',
          categoryId: 'master-house',
          name: 'Report Info',
          icon: 'scroll',
          group: 'Maritime Imports',
          route: '/master-house/report-info',
          order: 0,
        },
        {
          id: 'port',
          categoryId: 'master-house',
          name: 'Port',
          icon: 'db',
          group: 'Maritime Imports',
          route: '/master-house/port',
          order: 1,
        },
        {
          id: 'year-comparison',
          categoryId: 'master-house',
          name: 'Year Comparison',
          icon: 'chart',
          group: 'Maritime Imports',
          route: '/master-house/year-comparison',
          order: 2,
        },
        {
          id: 'consignee-details',
          categoryId: 'master-house',
          name: 'Consignee Details',
          icon: 'user',
          group: 'Maritime Imports',
          route: '/master-house/consignee-details',
          order: 3,
        },
        {
          id: 'consignees-by-port',
          categoryId: 'master-house',
          name: 'Consignees by Port',
          icon: 'users',
          group: 'Maritime Imports',
          route: '/master-house/consignees-by-port',
          order: 4,
        },
        {
          id: 'origin-port-detail',
          categoryId: 'master-house',
          name: 'Origin Port Detail',
          icon: 'pulse',
          group: 'Maritime Imports',
          route: '/master-house/origin-port-detail',
          order: 5,
        },
        {
          id: 'table-consignees-list',
          categoryId: 'master-house',
          name: 'Consignees List',
          icon: 'note',
          group: 'Maritime Imports',
          route: '/master-house/table-consignees-list',
          order: 6,
        },
      ],
    },
  ];
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
export function demoCatalogFor(workspaceId: string | null): CategoryModel[] | null {
  if (!workspaceId) return null;
  if (workspaceId === PERSONAL_WS_ID) return personalCatalog();
  if (workspaceId === SHARK_WS_ID) return sharkCatalog();
  if (workspaceId.startsWith('ws-')) return customCatalog(workspaceId);
  return null;
}