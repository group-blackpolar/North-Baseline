import { apiRequest } from '@/lib/api';

/** Typed adapters over the existing CORECROW organization-access contracts. CORECROW authorizes every call. */
export const TENANT_ROLES = ['OWNER', 'ADMIN', 'BILLING_ADMIN', 'MEMBER', 'VIEWER'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];
export const INVITABLE_ROLES = ['ADMIN', 'BILLING_ADMIN', 'MEMBER', 'VIEWER'] as const;

export const REGISTERED_PERMISSIONS = [
  'organization.read', 'organization.update', 'members.read', 'members.manage', 'invitations.manage', 'groups.read',
  'groups.manage', 'permissions.manage', 'audit.read', 'commerce.read', 'billing.read', 'billing.manage',
  'documents.read', 'documents.create', 'documents.update', 'documents.delete', 'documents.download', 'documents.send', 'documents.manage',
] as const;
export type RegisteredPermission = (typeof REGISTERED_PERMISSIONS)[number];

export type Member = { id: string; organizationId: string; userId: string; role: TenantRole; createdAt: string; email?: string; name?: string | null; status?: 'ACTIVE' | 'SUSPENDED' };
export type Invitation = {
  id: string; kind: 'EMAIL' | 'CODE'; email: string | null; role: TenantRole; status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string; acceptedAt: string | null; revokedAt: string | null; createdAt: string; groupIds: string[]; permissions: RegisteredPermission[];
};
export type IssuedInvitation = Invitation & { token?: string; delivery: 'sent' | 'failed' | 'not_applicable' };
export type Group = { id: string; name: string; description: string | null; memberUserIds: string[]; permissions: RegisteredPermission[] };

const org = (id: string) => `/v1/organizations/${encodeURIComponent(id)}`;
const json = (body: unknown) => JSON.stringify(body);

export const listMembers = (o: string) => apiRequest<Member[]>(`${org(o)}/members`);
export const changeMemberRole = (o: string, userId: string, role: TenantRole) => apiRequest<Member>(`${org(o)}/members/${encodeURIComponent(userId)}`, { method: 'PATCH', body: json({ role }) });
export const removeMember = (o: string, userId: string) => apiRequest<void>(`${org(o)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const listInvitations = (o: string) => apiRequest<Invitation[]>(`${org(o)}/invitations`);
export const createInvitation = (o: string, input: { email: string; role: (typeof INVITABLE_ROLES)[number]; expiresInHours: number; groupIds: string[]; permissions: RegisteredPermission[] }) =>
  apiRequest<IssuedInvitation>(`${org(o)}/invitations`, { method: 'POST', body: json({ kind: 'EMAIL', ...input }) });
export const revokeInvitation = (o: string, id: string) => apiRequest<void>(`${org(o)}/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const replaceInvitation = (o: string, id: string) => apiRequest<IssuedInvitation>(`${org(o)}/invitations/${encodeURIComponent(id)}/replace`, { method: 'POST' });

export const listGroups = (o: string) => apiRequest<Group[]>(`${org(o)}/groups`);
export const createGroup = (o: string, input: { name: string; description?: string | null }) => apiRequest<Group>(`${org(o)}/groups`, { method: 'POST', body: json(input) });
export const deleteGroup = (o: string, groupId: string) => apiRequest<void>(`${org(o)}/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
export const addGroupMember = (o: string, groupId: string, userId: string) => apiRequest<unknown>(`${org(o)}/groups/${encodeURIComponent(groupId)}/members`, { method: 'POST', body: json({ userId }) });
export const removeGroupMember = (o: string, groupId: string, userId: string) => apiRequest<void>(`${org(o)}/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
export const grantGroupPermission = (o: string, groupId: string, permission: RegisteredPermission) => apiRequest<unknown>(`${org(o)}/groups/${encodeURIComponent(groupId)}/permissions`, { method: 'POST', body: json({ permission }) });
export const revokeGroupPermission = (o: string, groupId: string, permission: RegisteredPermission) => apiRequest<void>(`${org(o)}/groups/${encodeURIComponent(groupId)}/permissions/${encodeURIComponent(permission)}`, { method: 'DELETE' });

export const listMemberGrants = (o: string, userId: string) => apiRequest<RegisteredPermission[]>(`${org(o)}/members/${encodeURIComponent(userId)}/permission-grants`);
export const grantMemberPermission = (o: string, userId: string, permission: RegisteredPermission) => apiRequest<unknown>(`${org(o)}/members/${encodeURIComponent(userId)}/permission-grants`, { method: 'POST', body: json({ permission }) });
export const revokeMemberPermission = (o: string, userId: string, permission: RegisteredPermission) => apiRequest<void>(`${org(o)}/members/${encodeURIComponent(userId)}/permission-grants/${encodeURIComponent(permission)}`, { method: 'DELETE' });
