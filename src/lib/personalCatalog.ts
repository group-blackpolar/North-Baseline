import type { CategoryModel } from '@/lib/models';

export const PERSONAL_ORG_ID = 'personal';
export const PERSONAL_WORKSPACE_ID = 'personal-ws';

/** Catálogo para el workspace personal cuando el usuario no tiene organizaciones */
export function buildPersonalCatalog(): CategoryModel[] {
  return [
    {
      id: 'home',
      workspaceId: PERSONAL_WORKSPACE_ID,
      name: 'Home',
      icon: 'layout',
      order: 0,
      subcategories: [
        { id: 'overview', categoryId: 'home', name: 'Overview', icon: 'layout', group: 'General', route: '/home/overview', order: 0 },
        { id: 'recent', categoryId: 'home', name: 'Actividad reciente', icon: 'note', group: 'General', route: '/home/recent', order: 1 },
        { id: 'quick-actions', categoryId: 'home', name: 'Acciones rápidas', icon: 'scroll', group: 'General', route: '/home/quick-actions', order: 2 },
      ],
    },
    {
      id: 'profile',
      workspaceId: PERSONAL_WORKSPACE_ID,
      name: 'Profile',
      icon: 'user',
      order: 1,
      subcategories: [
        { id: 'info', categoryId: 'profile', name: 'Información', icon: 'user', group: 'Cuenta', route: '/profile/info', order: 0 },
        { id: 'verification', categoryId: 'profile', name: 'Verificación', icon: 'shield', group: 'Cuenta', route: '/profile/verification', order: 1 },
        { id: 'preferences', categoryId: 'profile', name: 'Preferencias', icon: 'settings', group: 'Cuenta', route: '/profile/preferences', order: 2 },
      ],
    },
    {
      id: 'billing',
      workspaceId: PERSONAL_WORKSPACE_ID,
      name: 'Billing',
      icon: 'chart',
      order: 2,
      requiredPermission: 'billing:read',
      subcategories: [
        { id: 'plans', categoryId: 'billing', name: 'Planes', icon: 'chart', group: 'Facturación', route: '/billing/plans', order: 0 },
        { id: 'invoices', categoryId: 'billing', name: 'Facturas', icon: 'scroll', group: 'Facturación', route: '/billing/invoices', order: 1 },
        { id: 'payment-methods', categoryId: 'billing', name: 'Métodos de pago', icon: 'key', group: 'Facturación', route: '/billing/payment-methods', order: 2 },
      ],
    },
    {
      id: 'preferences',
      workspaceId: PERSONAL_WORKSPACE_ID,
      name: 'Settings',
      icon: 'settings',
      order: 3,
      requiredPermission: 'settings:manage',
      subcategories: [
        { id: 'appearance', categoryId: 'preferences', name: 'Apariencia', icon: 'settings', group: 'Configuración', route: '/preferences/appearance', order: 0 },
        { id: 'notifications', categoryId: 'preferences', name: 'Notificaciones', icon: 'scroll', group: 'Configuración', route: '/preferences/notifications', order: 1 },
        { id: 'security', categoryId: 'preferences', name: 'Seguridad', icon: 'shield', group: 'Configuración', route: '/preferences/security', order: 2 },
        { id: 'language', categoryId: 'preferences', name: 'Idioma', icon: 'layout', group: 'Configuración', route: '/preferences/language', order: 3 },
      ],
    },
  ];
}