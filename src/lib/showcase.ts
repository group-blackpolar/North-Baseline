import { apiRequest } from '@/lib/api';
import type { DatasetQueryFilter } from '@/features/analytics/datasetQuery';
import type { PanelBindingQueryResult } from '@/features/analytics/panelBindingQuery';
import type { NavigationCategory, ResolvedPanel } from '@/lib/organizations';

/**
 * Anonymous, read-only showcase contracts. CORECROW returns only organizations
 * with the showcase enabled and panels explicitly marked SHOWCASE; everything
 * else is a generic 404. Nothing here needs, or sends meaning through, a session.
 */
const base = (slug: string) => `/v1/public/showcases/${encodeURIComponent(slug)}`;

export type ShowcaseNavigation = { organization: { name: string; slug: string }; navigation: NavigationCategory[] };

export function getShowcaseNavigation(slug: string) {
  return apiRequest<ShowcaseNavigation>(`${base(slug)}/navigation`);
}

export function resolveShowcasePanel(slug: string, input: { categorySlug: string; subcategorySlug: string; panelSlug: string }) {
  const query = new URLSearchParams(input);
  return apiRequest<ResolvedPanel & { organization: { name: string; slug: string } }>(`${base(slug)}/resolve?${query.toString()}`);
}

export function queryShowcaseBinding(slug: string, panelId: string, bindingId: string, filters: DatasetQueryFilter[] = [], signal?: AbortSignal) {
  return apiRequest<PanelBindingQueryResult>(
    `${base(slug)}/panels/${encodeURIComponent(panelId)}/analytics-bindings/${encodeURIComponent(bindingId)}/results`,
    { method: 'POST', body: JSON.stringify({ filters }), signal },
  );
}
