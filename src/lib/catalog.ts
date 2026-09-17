import { VIEW_CATALOG, VIEW_SECTIONS, type ViewId } from '@/lib/navigation';
import type { CategoryModel } from '@/lib/models';
import { PERM } from '@/lib/permissions';

const PERMISSION_BY_VIEW: Record<string, string> = {
  usuarios: PERM.membersManage,
  auditoria: PERM.auditRead,
  settings: PERM.workspaceAdmin,
  'api-keys': PERM.securityManage,
  'db-backups': PERM.workspaceAdmin,
  cicd: PERM.workspaceAdmin,
};

const ICON_BY_VIEW: Record<string, string> = {
  dashboards: 'chart',
  'notas-tareas': 'note',
  perfil: 'user',
  usuarios: 'users',
  auditoria: 'shield',
  settings: 'settings',
  logs: 'scroll',
  cicd: 'branch',
  'db-backups': 'db',
  'api-health': 'pulse',
  'api-keys': 'key',
};

function buildStaticCatalog(workspaceId: string | null): CategoryModel[] {
  return VIEW_CATALOG.map((view, index) => ({
    id: view.id,
    workspaceId,
    name: view.label,
    icon: ICON_BY_VIEW[view.id] ?? 'layout',
    requiredPermission: PERMISSION_BY_VIEW[view.id],
    order: index,
    subcategories: (VIEW_SECTIONS[view.id as ViewId] ?? []).flatMap((group) =>
      group.items.map((item, itemIndex) => ({
        id: item.id,
        categoryId: view.id,
        name: item.label,
        icon: ICON_BY_VIEW[view.id] ?? 'layout',
        group: group.label,
        route: `/${view.id}/${item.id}`,
        order: itemIndex,
      }))
    ),
  }));
}

/** ÚNICO punto a sustituir cuando CoreCrow exponga el catálogo por workspace */
export async function fetchCatalog(workspaceId: string | null): Promise<CategoryModel[]> {
  return buildStaticCatalog(workspaceId);
}