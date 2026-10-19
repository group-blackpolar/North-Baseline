import { apiRequest } from '@/lib/api';

/** Typed adapters over the CORECROW dataset-group contracts (authorization, tenancy and audit are enforced server-side). */
const org = (organizationId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}`;

export type GroupHealth = 'EMPTY' | 'OK' | 'ISSUES';
export type GroupSummary = {
  datasetCount: number; rowCount: number; originalBytes: number; periodStart: string | null; periodEnd: string | null;
  lastImportAt: string | null; datasetsWithIssues: number; health: GroupHealth;
};
export type DatasetGroup = {
  id: string; slug: string; name: Record<string, string>; description: Record<string, string> | null; category: string | null;
  tags: string[]; status: 'ACTIVE' | 'ARCHIVED'; createdAt: string; updatedAt: string; summary: GroupSummary;
};
export type GroupMember = {
  id: string; slug: string; name: Record<string, string>; status: 'ACTIVE' | 'ARCHIVED'; periodStart: string | null; periodEnd: string | null;
  periodLabel: string | null; rowCount: number; originalBytes: number;
};
export type GroupDetail = DatasetGroup & { datasets: GroupMember[] };
export type GroupAuditEntry = { id: string; action: string; actorId: string | null; createdAt: string; metadata: Record<string, unknown> };
export type GroupDependencies = { datasets: number; bindings: number; panels: number; runningImports: number };

export const listGroups = (organizationId: string) => apiRequest<DatasetGroup[]>(`${org(organizationId)}/dataset-groups`);
export const readGroup = (organizationId: string, groupId: string) => apiRequest<GroupDetail>(`${org(organizationId)}/dataset-groups/${encodeURIComponent(groupId)}`);
export const createGroup = (organizationId: string, input: { slug: string; name: string; category?: string; tags: string[] }) =>
  apiRequest<DatasetGroup>(`${org(organizationId)}/dataset-groups`, {
    method: 'POST',
    body: JSON.stringify({ slug: input.slug, name: { es: input.name, en: input.name }, ...(input.category ? { category: input.category } : {}), tags: input.tags }),
  });
export const setGroupStatus = (organizationId: string, groupId: string, status: 'ACTIVE' | 'ARCHIVED') =>
  apiRequest<DatasetGroup>(`${org(organizationId)}/dataset-groups/${encodeURIComponent(groupId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const groupDependencies = (organizationId: string, groupId: string) =>
  apiRequest<GroupDependencies>(`${org(organizationId)}/dataset-groups/${encodeURIComponent(groupId)}/dependencies`);
export const deleteGroup = (organizationId: string, groupId: string) =>
  apiRequest<null>(`${org(organizationId)}/dataset-groups/${encodeURIComponent(groupId)}?detachDatasets=true`, { method: 'DELETE' });
export const groupAudit = (organizationId: string, groupId: string) =>
  apiRequest<GroupAuditEntry[]>(`${org(organizationId)}/dataset-groups/${encodeURIComponent(groupId)}/audit?limit=50`);
export const assignDataset = (organizationId: string, datasetId: string, input: { groupId: string | null; periodStart?: string | null; periodEnd?: string | null; periodLabel?: string | null; allowOverlap?: boolean }) =>
  apiRequest<unknown>(`${org(organizationId)}/datasets/${encodeURIComponent(datasetId)}/group`, { method: 'PUT', body: JSON.stringify(input) });

export const slugOf = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export const formatBytes = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(0, Math.round(bytes / 1024))} KB`);
