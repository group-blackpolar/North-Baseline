import {
  Activity, Archive, BarChart3, Bell, Blocks, Brain, CalendarDays, CheckCircle2,
  CheckSquare, Database, Download, Eye, FileClock, FileText, Fingerprint, GitBranch,
  Globe, HardDrive, History, KeyRound, LayoutDashboard, LineChart, Lock, Mail,
  Package, Palette, RefreshCw, Rocket, ScrollText, Search, Server, Settings,
  ShieldCheck, Star, StickyNote, Sun, TrendingUp, UserCog, UserRound,
  Users, Wallet, type LucideIcon,
} from 'lucide-react';

export type ViewId =
  | 'dashboards' | 'notas-tareas' | 'usuarios' | 'logs' | 'api-health'
  | 'api-keys' | 'cicd' | 'auditoria' | 'db-backups' | 'config' | 'perfil' | 'settings'
  | 'home' | 'profile' | 'billing' | 'preferences' | 'shark-home' | 'master-house';

export interface NavLeaf { id: string; label: string; icon: LucideIcon; children?: NavLeaf[] }
export interface NavGroup { id: string; label: string; items: NavLeaf[] }
export interface ViewCatalogEntry { id: ViewId; label: string; icon: LucideIcon; group: string }

export const VIEW_CATALOG: ViewCatalogEntry[] = [
  { id: 'dashboards', label: 'Paneles', icon: LayoutDashboard, group: 'General' },
  { id: 'notas-tareas', label: 'Notas y Tareas', icon: StickyNote, group: 'General' },
  { id: 'perfil', label: 'Perfil', icon: UserRound, group: 'General' },
  { id: 'usuarios', label: 'Usuarios', icon: Users, group: 'Administración' },
  { id: 'auditoria', label: 'Auditoría', icon: ShieldCheck, group: 'Administración' },
  { id: 'logs', label: 'Registros', icon: ScrollText, group: 'Operaciones' },
  { id: 'cicd', label: 'CI/CD', icon: GitBranch, group: 'Operaciones' },
  { id: 'db-backups', label: 'Base de Datos', icon: Database, group: 'Operaciones' },
  { id: 'api-health', label: 'Estado de API', icon: Activity, group: 'Plataforma' },
  { id: 'api-keys', label: 'Claves de API', icon: KeyRound, group: 'Plataforma' },
  { id: 'settings', label: 'Configuración', icon: Settings, group: 'Administración' },
];

export const VIEW_CATALOG_GROUPS = ['General', 'Administración', 'Operaciones', 'Plataforma'];

export const GROUP_ICONS: Record<string, LucideIcon> = {
  General: LayoutDashboard,
  Administración: ShieldCheck,
  Operaciones: GitBranch,
  Plataforma: Server,
};

export const viewLabel = (id: ViewId): string => VIEW_CATALOG.find((v) => v.id === id)?.label ?? id;

export const VIEW_SECTIONS: Record<ViewId, NavGroup[]> = {
  home: [
    { id: 'general', label: 'General', items: [
      { id: 'overview', label: 'Overview', icon: Eye },
      { id: 'recent', label: 'Actividad reciente', icon: FileClock },
      { id: 'quick-actions', label: 'Acciones rápidas', icon: Rocket },
    ] },
  ],
  profile: [
    { id: 'account', label: 'Cuenta', items: [
      { id: 'info', label: 'Información', icon: UserRound },
      { id: 'verification', label: 'Verificación', icon: CheckCircle2 },
    ] },
  ],
  billing: [
    { id: 'billing', label: 'Facturación', items: [
      { id: 'plans', label: 'Planes', icon: Wallet },
      { id: 'invoices', label: 'Facturas', icon: FileText },
    ] },
  ],
  preferences: [
    { id: 'preferences', label: 'Preferencias', items: [
      { id: 'appearance', label: 'Apariencia', icon: Palette },
      { id: 'language', label: 'Idioma', icon: LayoutDashboard },
    ] },
  ],
  'shark-home': [
    { id: 'overview', label: 'Overview', items: [
      { id: 'overview', label: 'Overview', icon: Eye },
      { id: 'intel', label: 'Inteligencia', icon: Brain },
    ] },
  ],
  'master-house': [
    { id: 'overview', label: 'Overview', items: [
      { id: 'overview', label: 'Overview', icon: Eye },
      { id: 'operations', label: 'Operaciones', icon: Server },
    ] },
  ],
  dashboards: [
    { id: 'types', label: 'Tipos de Panel', items: [
      { id: 'overview', label: 'Overview', icon: Eye },
      { id: 'executive', label: 'Resumen Ejecutivo', icon: BarChart3, children: [
        { id: 'executive-kpis', label: 'KPIs principales', icon: TrendingUp },
        { id: 'executive-trends', label: 'Tendencias', icon: LineChart },
      ] },
      { id: 'operations', label: 'Panel de Operaciones', icon: ScrollText },
      { id: 'financial', label: 'Panel Financiero', icon: Wallet },
    ] },
    { id: 'reports', label: 'Resúmenes de Reportes', items: [
      { id: 'weekly', label: 'Reportes Semanales', icon: FileText },
      { id: 'monthly', label: 'Insights Mensuales', icon: Star },
      { id: 'quarterly', label: 'Análisis Trimestral', icon: CalendarDays },
    ] },
    { id: 'bi', label: 'Inteligencia de Negocio', items: [
      { id: 'performance', label: 'Métricas de Rendimiento', icon: BarChart3 },
      { id: 'predictive', label: 'Analítica Predictiva', icon: Brain },
    ] },
  ],
  'notas-tareas': [
    { id: 'manage', label: 'Gestión', items: [
      { id: 'notes', label: 'Notas', icon: StickyNote },
      { id: 'tasks', label: 'Tareas', icon: CheckSquare },
      { id: 'archived', label: 'Archivadas', icon: Archive },
    ] },
    { id: 'filters', label: 'Filtros rápidos', items: [
      { id: 'today', label: 'Hoy', icon: Sun },
      { id: 'week', label: 'Esta semana', icon: CalendarDays },
      { id: 'done', label: 'Completadas', icon: CheckCircle2 },
    ] },
  ],
  usuarios: [
    { id: 'directory', label: 'Directorio', items: [
      { id: 'members', label: 'Miembros', icon: Users },
      { id: 'invitations', label: 'Invitaciones', icon: Mail },
    ] },
    { id: 'security', label: 'Seguridad', items: [
      { id: 'roles', label: 'Roles y Permisos', icon: Lock },
      { id: 'sessions', label: 'Sesiones activas', icon: UserCog },
    ] },
  ],
  logs: [
    { id: 'streams', label: 'Streams', items: [
      { id: 'app', label: 'Aplicación', icon: ScrollText },
      { id: 'security', label: 'Seguridad', icon: ShieldCheck },
      { id: 'system', label: 'Sistema', icon: Server },
    ] },
    { id: 'tools', label: 'Herramientas', items: [
      { id: 'search', label: 'Búsqueda', icon: Search },
      { id: 'export', label: 'Exportar', icon: Download },
    ] },
  ],
  'api-health': [
    { id: 'monitor', label: 'Monitoreo', items: [
      { id: 'status', label: 'Estado general', icon: Activity },
      { id: 'latency', label: 'Latencia', icon: LineChart },
      { id: 'errors', label: 'Errores', icon: FileClock },
    ] },
    { id: 'services', label: 'Servicios', items: [
      { id: 'corecrow', label: 'CoreCrow', icon: Server },
      { id: 'smtp', label: 'SMTP', icon: Mail },
      { id: 'db', label: 'Base de datos', icon: Database },
    ] },
  ],
  'api-keys': [
    { id: 'keys', label: 'Claves', items: [
      { id: 'active', label: 'Activas', icon: KeyRound },
      { id: 'revoked', label: 'Revocadas', icon: Lock },
    ] },
    { id: 'policy', label: 'Políticas', items: [
      { id: 'scopes', label: 'Scopes', icon: ShieldCheck },
      { id: 'rotation', label: 'Rotación', icon: RefreshCw },
    ] },
  ],
  cicd: [
    { id: 'pipelines', label: 'Pipelines', items: [
      { id: 'builds', label: 'Builds', icon: Package },
      { id: 'deploys', label: 'Deploys', icon: Rocket },
    ] },
    { id: 'envs', label: 'Ambientes', items: [
      { id: 'prod', label: 'Producción', icon: Globe },
      { id: 'staging', label: 'Staging', icon: Blocks },
    ] },
  ],
  auditoria: [
    { id: 'records', label: 'Registros', items: [
      { id: 'actions', label: 'Acciones', icon: History },
      { id: 'auth', label: 'Autenticación', icon: Fingerprint },
    ] },
    { id: 'policies', label: 'Políticas', items: [
      { id: 'retention', label: 'Retención', icon: FileClock },
      { id: 'export', label: 'Exportación', icon: Download },
    ] },
  ],
  'db-backups': [
    { id: 'backups', label: 'Backups', items: [
      { id: 'auto', label: 'Automáticos', icon: HardDrive },
      { id: 'manual', label: 'Manuales', icon: Download },
    ] },
    { id: 'restore', label: 'Restauración', items: [
      { id: 'points', label: 'Puntos de restauración', icon: History },
    ] },
  ],
  config: [
    { id: 'org', label: 'Organización', items: [
      { id: 'general', label: 'General', icon: Settings },
      { id: 'branding', label: 'Branding', icon: Palette },
    ] },
    { id: 'ws', label: 'Workspace', items: [
      { id: 'prefs', label: 'Preferencias', icon: Blocks },
      { id: 'modules', label: 'Módulos', icon: Blocks },
    ] },
  ],
  perfil: [
    { id: 'account', label: 'Cuenta', items: [
      { id: 'info', label: 'Información', icon: UserRound },
      { id: 'verification', label: 'Verificación', icon: CheckCircle2 },
    ] },
    { id: 'prefs', label: 'Preferencias', items: [
      { id: 'appearance', label: 'Apariencia', icon: Sun },
      { id: 'notifications', label: 'Notificaciones', icon: Bell },
    ] },
  ],
  settings: [],
};

export function firstSubcategoryId(categoryId: ViewId): string | null {
  return VIEW_SECTIONS[categoryId]?.[0]?.items[0]?.id ?? null;
}

export function subcategoryLabel(categoryId: ViewId, subcategoryId: string | null): string | null {
  if (!subcategoryId) return null;
  for (const group of VIEW_SECTIONS[categoryId] ?? []) {
    for (const item of group.items) {
      if (item.id === subcategoryId) return item.label;
      const child = item.children?.find((c) => c.id === subcategoryId);
      if (child) return child.label;
    }
  }
  return null;
}

export function iconForRoute(categoryId: ViewId, subcategoryId: string | null): LucideIcon {
  if (subcategoryId) {
    for (const group of VIEW_SECTIONS[categoryId] ?? []) {
      for (const item of group.items) {
        if (item.id === subcategoryId) return item.icon;
        const child = item.children?.find((c) => c.id === subcategoryId);
        if (child) return child.icon;
      }
    }
  }
  return VIEW_CATALOG.find((v) => v.id === categoryId)?.icon ?? LayoutDashboard;
}