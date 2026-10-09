import { apiRequest, cachedGet } from '@/lib/api';

export type LocalizedText = Record<string, string>;

export type TaxonomyCategory = {
  id: string;
  organizationId: string;
  resourceKind: 'SYSTEM' | 'CONTENT';
  categoryClass: 'SYSTEM' | 'TEMPLATE' | 'CUSTOM';
  name: LocalizedText;
  slug: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

export type TaxonomySubcategory = {
  id: string;
  organizationId: string;
  categoryId: string;
  resourceKind: 'SYSTEM' | 'CONTENT';
  name: LocalizedText;
  slug: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

export type TaxonomyPanel = {
  id: string;
  organizationId: string;
  subcategoryId: string;
  resourceKind: 'SYSTEM' | 'CONTENT';
  name: LocalizedText;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  audienceType: 'ALL_MEMBERS' | 'ROLES' | 'GROUPS' | 'PERMISSIONS' | 'SPECIFIC_USERS';
  /** Revision pointers served by the management tree (null when never saved / never published). */
  publishedRevisionId?: string | null;
  draftRevisionId?: string | null;
};

export type ManagementCategory = TaxonomyCategory & {
  subcategories: Array<TaxonomySubcategory & { panels: TaxonomyPanel[] }>;
};

export type MetadataInput = { name: LocalizedText; slug?: string };
export type PanelDocument = { schemaVersion: 1; defaultLocale: string; fallbackLocales: string[]; sections: Array<{ id: string; name?: LocalizedText; order: number; layout: { variant: 'grid'; gap: 'none' | 'sm' | 'md' | 'lg' }; components: Array<{ id: string; type: ComponentType; schemaVersion: 1; props: Record<string, unknown>; bindings: Record<string, unknown>; layout: ResponsiveLayout; order: number }> }> };
export type ComponentType = 'heading' | 'rich_text' | 'image' | 'video' | 'link' | 'file' | 'table' | 'card' | 'list' | 'metric' | 'divider' | 'embed' | 'bar_chart' | 'line_chart' | 'donut_chart' | 'document_workspace';
export type ResponsiveLayout = { desktop: GridPosition; tablet: GridPosition; mobile: GridPosition };
export type GridPosition = { x: number; y: number; w: number; h: number };
export type PanelRevision = { id: string; panelId: string; revisionNumber: number; etag: string; defaultLocale: string; fallbackLocales: string[]; message: string | null; publishAt: string | null; unpublishAt: string | null; createdBy: string; createdAt: string; document: PanelDocument };
export type PanelRevisionSummary = Omit<PanelRevision, 'document'>;
export type NorthGrant = { id: string; organizationId: string; capability: string; scope: 'ORGANIZATION' | 'CATEGORY' | 'SUBCATEGORY' | 'PANEL'; role?: string; groupId?: string; membershipId?: string; categoryId: string | null; subcategoryId: string | null; panelId: string | null; createdAt: string };
export const componentTypes: ComponentType[] = ['heading', 'rich_text', 'image', 'video', 'link', 'file', 'table', 'card', 'list', 'metric', 'divider', 'embed'];

/** Complete metadata-only management tree. CORECROW authorizes this endpoint
 * with north.category.create, so the UI never infers admin rights client-side. */
export function listAuthorizedTaxonomy(organizationId: string, options?: { force?: boolean }): Promise<ManagementCategory[]> {
  // Short TTL: the Views workspace, the editor and the Overview share one read. Every write to the organization
  // (create, rename, archive, reorder, publish…) invalidates it, so a mutation is always followed by a fresh tree.
  return cachedGet<ManagementCategory[]>(`/v1/organizations/${encodeURIComponent(organizationId)}/north/management-tree`, { ttlMs: 10_000 }, options);
}

export function createCategory(organizationId: string, input: MetadataInput) {
  return apiRequest<TaxonomyCategory>(`/v1/organizations/${encodeURIComponent(organizationId)}/categories`, {
    method: 'POST', body: JSON.stringify({ ...input, categoryClass: 'CUSTOM', resourceKind: 'CONTENT' }),
  });
}

export function createSubcategory(organizationId: string, categoryId: string, input: MetadataInput) {
  return apiRequest<TaxonomySubcategory>(`/v1/organizations/${encodeURIComponent(organizationId)}/categories/${encodeURIComponent(categoryId)}/subcategories`, {
    method: 'POST', body: JSON.stringify({ ...input, resourceKind: 'CONTENT' }),
  });
}

export function createPanel(organizationId: string, subcategoryId: string, input: MetadataInput) {
  return apiRequest<TaxonomyPanel>(`/v1/organizations/${encodeURIComponent(organizationId)}/subcategories/${encodeURIComponent(subcategoryId)}/panels`, {
    method: 'POST', body: JSON.stringify({ ...input, resourceKind: 'CONTENT', audienceType: 'ALL_MEMBERS' }),
  });
}

const orgPath = (organizationId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}`;
export function updateCategory(organizationId: string, id: string, input: MetadataInput) { return apiRequest<TaxonomyCategory>(`${orgPath(organizationId)}/categories/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function updateSubcategory(organizationId: string, id: string, input: MetadataInput & { categoryId?: string }) { return apiRequest<TaxonomySubcategory>(`${orgPath(organizationId)}/subcategories/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function updatePanel(organizationId: string, id: string, input: MetadataInput & { subcategoryId?: string }) { return apiRequest<TaxonomyPanel>(`${orgPath(organizationId)}/panels/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function archiveResource(organizationId: string, type: 'categories' | 'subcategories' | 'panels', id: string) { return apiRequest(`${orgPath(organizationId)}/${type}/${encodeURIComponent(id)}/archive`, { method: 'POST' }); }
export function reorderResources(organizationId: string, kind: 'CATEGORY' | 'SUBCATEGORY' | 'PANEL', ids: string[], parentId?: string) { return apiRequest<{ updated: number }>(`${orgPath(organizationId)}/north/reorder`, { method: 'POST', body: JSON.stringify({ kind, ids, ...(parentId ? { parentId } : {}) }) }); }
export function setOrganizationHome(organizationId: string, panelId: string | null) { return apiRequest(`${orgPath(organizationId)}/home-panel`, { method: 'PUT', body: JSON.stringify({ panelId }) }); }
export function cloneTaxonomyResource(organizationId: string, input: { kind: 'CATEGORY' | 'SUBCATEGORY' | 'PANEL'; sourceId: string; destinationParentId?: string; slug: string }) {
  return apiRequest(`${orgPath(organizationId)}/north/clone`, { method: 'POST', body: JSON.stringify(input) });
}

export function getDraft(organizationId: string, panelId: string) { return apiRequest<PanelRevision>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/draft`); }
export function saveDraft(organizationId: string, panelId: string, document: PanelDocument, etag?: string, message?: string) { return apiRequest<PanelRevision>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/draft`, { method: 'PATCH', headers: etag ? { 'If-Match': etag } : undefined, body: JSON.stringify({ document, ...(message ? { message } : {}) }) }); }
export function publishDraft(organizationId: string, panelId: string, etag: string) { return apiRequest<PanelRevision>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/publish`, { method: 'POST', headers: { 'If-Match': etag } }); }
export function listRevisions(organizationId: string, panelId: string) { return cachedGet<PanelRevisionSummary[]>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/revisions`, { ttlMs: 20_000 }); }
export function readRevision(organizationId: string, panelId: string, revisionId: string) { return apiRequest<PanelRevision>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/revisions/${encodeURIComponent(revisionId)}`); }
export function restoreRevision(organizationId: string, panelId: string, revisionId: string, etag: string) { return apiRequest<PanelRevision>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/revisions/${encodeURIComponent(revisionId)}/restore`, { method: 'POST', headers: { 'If-Match': etag }, body: JSON.stringify({}) }); }
export function setPanelAudience(organizationId: string, panelId: string, input: { type: TaxonomyPanel['audienceType']; roles?: string[]; groupIds?: string[]; capabilities?: string[]; membershipIds?: string[] }) { return apiRequest<TaxonomyPanel>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/audience`, { method: 'PUT', body: JSON.stringify(input) }); }
export function getPanelAudience(organizationId: string, panelId: string) { return apiRequest<{ type: TaxonomyPanel['audienceType']; roles: string[]; groupIds: string[]; capabilities: string[]; membershipIds: string[] }>(`${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}/audience`); }
export function listNorthGrants(organizationId: string) { return apiRequest<{ roles: NorthGrant[]; groups: NorthGrant[]; memberships: NorthGrant[] }>(`${orgPath(organizationId)}/north/permission-grants`); }
export function createNorthGrant(organizationId: string, input: { subjectType: 'ROLE' | 'GROUP' | 'MEMBERSHIP'; role?: string; groupId?: string; membershipId?: string; capability: string; scope: NorthGrant['scope']; resourceId?: string }) { return apiRequest<NorthGrant>(`${orgPath(organizationId)}/north/permission-grants`, { method: 'POST', body: JSON.stringify(input) }); }
export function revokeNorthGrant(organizationId: string, id: string) { return apiRequest(`${orgPath(organizationId)}/north/permission-grants/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export function listPermissionSubjects(organizationId: string) { return apiRequest<{ roles: string[]; groups: Array<{ id: string; name: string }>; memberships: Array<{ id: string; userId: string; name: string | null; role: string }> }>(`${orgPath(organizationId)}/north/permission-subjects`); }
