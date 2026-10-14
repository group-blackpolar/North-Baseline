import type { RegisteredPermission } from './api';

/** Human grouping of the registered permission codes. The codes themselves stay the contract with CORECROW. */
export const PERMISSION_GROUPS: Array<{ id: string; labelKey: string; permissions: RegisteredPermission[] }> = [
  { id: 'org', labelKey: 'perm.group.org', permissions: ['organization.read', 'organization.update'] },
  { id: 'members', labelKey: 'perm.group.members', permissions: ['members.read', 'members.manage', 'invitations.read', 'invitations.manage'] },
  { id: 'groups', labelKey: 'perm.group.groups', permissions: ['groups.read', 'groups.manage', 'permissions.manage'] },
  { id: 'audit', labelKey: 'perm.group.audit', permissions: ['audit.read'] },
  { id: 'billing', labelKey: 'perm.group.billing', permissions: ['commerce.read', 'billing.read', 'billing.manage'] },
  { id: 'docs', labelKey: 'perm.group.docs', permissions: ['documents.read', 'documents.create', 'documents.update', 'documents.delete', 'documents.download', 'documents.send', 'documents.manage'] },
];

export const permissionLabelKey = (permission: string) => `perm.${permission}.l`;
export const permissionHintKey = (permission: string) => `perm.${permission}.d`;
