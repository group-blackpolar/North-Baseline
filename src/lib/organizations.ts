import { apiRequest } from '@/lib/api';

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  avatarUrl?: string | null;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug?: string;
  description?: string | null;
}

export async function getOrganizations(): Promise<Organization[]> {
  const data = await apiRequest<{ organizations?: Organization[] }>('/v1/organizations');
  return data.organizations ?? [];
}

export async function getWorkspaces(organizationId: string): Promise<Workspace[]> {
  const data = await apiRequest<{ workspaces?: Workspace[] }>(
    `/v1/organizations/${organizationId}/workspaces`
  );
  return data.workspaces ?? [];
}

