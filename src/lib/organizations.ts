import { apiRequest } from '@/lib/api';

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  avatarUrl?: string | null;
  iconData?: string | null;
  description?: string | null;
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
}

export interface PublicOrganization {
  name: string;
  slug: string;
}

export interface NavigationCategory {
  id: string;
  name: Record<string, string>;
  icon: string | null;
  color: string | null;
  slug: string;
  subcategories: Array<{ id: string; name: Record<string, string>; icon: string | null; slug: string; panels: Array<{ id: string; name: Record<string, string>; icon: string | null; slug: string; status: 'PUBLISHED' }> }>;
}

export interface ResolvedPanel {
  category: { id: string; name: Record<string, string>; slug: string };
  subcategory: { id: string; name: Record<string, string>; slug: string };
  canonicalPath: string;
  panel: { id: string; name: Record<string, string>; description: Record<string, string> | null; icon: string | null; slug: string; status: 'PUBLISHED' };
  revision: { id: string; etag: string; defaultLocale: string; fallbackLocales: string[]; locale: { requested: string | null; resolved: string; fallbackChain: string[] }; document: PublishedPanelDocument } | null;
}

export interface PublishedPanelDocument {
  schemaVersion: 1;
  defaultLocale: string;
  fallbackLocales: string[];
  sections: Array<{ id: string; order: number; layout: { variant: 'grid'; gap: 'none' | 'sm' | 'md' | 'lg' }; components: Array<{ id: string; type: string; schemaVersion: number; props: Record<string, unknown>; bindings?: Record<string, PublishedPanelBinding>; layout: { desktop: { x: number; y: number; w: number; h: number }; tablet: { x: number; y: number; w: number; h: number }; mobile: { x: number; y: number; w: number; h: number } }; order: number }> }>;
}

/** Canonical, server-validated reference stored in a published panel document. */
export type PublishedPanelBinding =
  | { sourceType: 'dataset'; sourceId: string; datasetId: string; viewId?: string }
  | { sourceType: 'metric'; sourceId: string };

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug?: string;
  description?: string | null;
}

export async function getOrganizations(): Promise<Organization[]> {
  const organizations = await apiRequest<Organization[]>('/v1/organizations');
  return organizations.map((organization) => ({ ...organization, avatarUrl: organization.iconData ?? organization.avatarUrl ?? null }));
}

export function updateOrganization(organizationId: string, input: { name?: string; slug?: string; iconData?: string | null; description?: string | null }) {
  return apiRequest<Organization>(`/v1/organizations/${encodeURIComponent(organizationId)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function resolvePublicOrganization(slug: string) {
  return apiRequest<PublicOrganization>(`/v1/organizations/resolve/${encodeURIComponent(slug)}`);
}

export function getOrganizationNavigation(organizationId: string) {
  return apiRequest<NavigationCategory[]>(`/v1/organizations/${encodeURIComponent(organizationId)}/navigation`);
}

export function resolvePublishedPanel(input: { organizationSlug: string; categorySlug: string; subcategorySlug: string; panelSlug: string }) {
  // Only the four slugs: callers may pass a whole route object, and CORECROW rejects unknown query parameters.
  const { organizationSlug, categorySlug, subcategorySlug, panelSlug } = input;
  const query = new URLSearchParams({ organizationSlug, categorySlug, subcategorySlug, panelSlug });
  return apiRequest<ResolvedPanel>(`/v1/content/resolve?${query.toString()}`);
}

export function acceptInvitation(token: string) {
  return apiRequest('/v1/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) });
}

export function createOrganization(input: { name: string; slug?: string }) {
  return apiRequest<Organization>('/v1/organizations', { method: 'POST', body: JSON.stringify(input) });
}

export async function getWorkspaces(organizationId: string): Promise<Workspace[]> {
  const data = await apiRequest<{ workspaces?: Workspace[] }>(
    `/v1/organizations/${organizationId}/workspaces`
  );
  return data.workspaces ?? [];
}

