import { apiRequest } from '@/lib/api';

export const PERM = {
  workspaceAdmin: 'workspace:admin',
  membersManage: 'members:manage',
  auditRead: 'audit:read',
  securityManage: 'security:manage',
  billingRead: 'billing:read',
} as const;

export type Permission = string;

export interface PermissionSet {
  permissions: Permission[];
  source: 'corecrow' | 'role-fallback';
}

/** Solo UX: la autoridad real siempre es CoreCrow */
const ROLE_FALLBACK: Record<string, Permission[]> = {
  SUPERADMIN: ['*', ...Object.values(PERM)],
  ADMIN: [PERM.workspaceAdmin, PERM.membersManage, PERM.auditRead, PERM.securityManage],
  DEVELOPER: [PERM.auditRead],
  USER: [],
};

export async function fetchPermissions(
  organizationId: string,
  workspaceId: string | null,
  role: string
): Promise<PermissionSet> {
  const path = workspaceId
    ? `/v1/organizations/${organizationId}/workspaces/${workspaceId}/permissions`
    : `/v1/organizations/${organizationId}/permissions`;
  try {
    const data = await apiRequest<{ permissions?: Permission[] }>(path);
    return { permissions: Array.isArray(data.permissions) ? data.permissions : [], source: 'corecrow' };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404 || status === 501) {
      return { permissions: ROLE_FALLBACK[role] ?? [], source: 'role-fallback' };
    }
    throw error;
  }
}