import type { CategoryModel } from '@/lib/models';
import { PERSONAL_WS_ID } from '@/lib/demo/store';

export function personalCatalog(): CategoryModel[] {
  return [
    {
      id: 'home', workspaceId: PERSONAL_WS_ID, name: 'Home', icon: 'layout', order: 0,
      subcategories: [
        { id: 'overview', categoryId: 'home', name: 'Overview', icon: 'layout', group: 'General', route: '/home/overview', order: 0 },
        { id: 'recent', categoryId: 'home', name: 'Recent activity', icon: 'note', group: 'General', route: '/home/recent', order: 1 },
        { id: 'quick-actions', categoryId: 'home', name: 'Quick actions', icon: 'pulse', group: 'General', route: '/home/quick-actions', order: 2 },
      ],
    },
    {
      id: 'profile', workspaceId: PERSONAL_WS_ID, name: 'Profile', icon: 'user', order: 1,
      subcategories: [
        { id: 'info', categoryId: 'profile', name: 'Information', icon: 'user', group: 'Account', route: '/profile/info', order: 0 },
        { id: 'verification', categoryId: 'profile', name: 'Verification', icon: 'shield', group: 'Account', route: '/profile/verification', order: 1 },
      ],
    },
    {
      id: 'billing', workspaceId: PERSONAL_WS_ID, name: 'Billing', icon: 'chart', order: 2,
      subcategories: [
        { id: 'plans', categoryId: 'billing', name: 'Plans', icon: 'chart', group: 'Billing', route: '/billing/plans', order: 0 },
        { id: 'invoices', categoryId: 'billing', name: 'Invoices', icon: 'scroll', group: 'Billing', route: '/billing/invoices', order: 1 },
      ],
    },
    {
      id: 'preferences', workspaceId: PERSONAL_WS_ID, name: 'Preferences', icon: 'settings', order: 3,
      subcategories: [
        { id: 'appearance', categoryId: 'preferences', name: 'Appearance', icon: 'settings', group: 'Preferences', route: '/preferences/appearance', order: 0 },
        { id: 'language', categoryId: 'preferences', name: 'Language', icon: 'layout', group: 'Preferences', route: '/preferences/language', order: 1 },
      ],
    },
  ];
}