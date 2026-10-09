import { cachedGet } from '@/lib/api';

export const PERM = {
  organizationRead: 'organization.read',
  organizationUpdate: 'organization.update',
  membersRead: 'members.read',
  membersManage: 'members.manage',
  invitationsRead: 'invitations.read',
  invitationsManage: 'invitations.manage',
  groupsRead: 'groups.read',
  groupsManage: 'groups.manage',
  permissionsManage: 'permissions.manage',
  auditRead: 'audit.read',
  commerceRead: 'commerce.read',
  billingRead: 'billing.read',
  billingManage: 'billing.manage',
  documentsRead: 'documents.read',
  documentsCreate: 'documents.create',
  documentsUpdate: 'documents.update',
  documentsDelete: 'documents.delete',
  documentsDownload: 'documents.download',
  documentsSend: 'documents.send',
  documentsManage: 'documents.manage',
} as const;

export type Permission = string;

export interface PermissionSet {
  permissions: Permission[];
  role: 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER' | 'VIEWER';
  source: 'corecrow';
}

/**
 * UX capability discovery only. CoreCrow remains the authorization authority.
 * Failures are intentionally handled as an empty permission set by the caller.
 */
export async function fetchPermissions(organizationId: string, options?: { force?: boolean }): Promise<PermissionSet> {
  // Short TTL + SWR: permission *discovery* only drives what the UI offers. Role/grant/group writes invalidate it and
  // CORECROW re-authorizes every protected request regardless.
  const data = await cachedGet<{
    permissions: Permission[];
    role: PermissionSet['role'];
  }>(`/v1/organizations/${organizationId}/permissions`, { ttlMs: 10_000, staleMs: 50_000 }, options);
  return {
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    role: data.role,
    source: 'corecrow',
  };
}
